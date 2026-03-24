"""Bridgewater Associates スタイル リスク評価フレームワーク"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

from .base import BaseAnalyzer
from .config import (
    TRADING_DAYS_PER_YEAR, VOLATILITY_ANNUAL_BRACKETS, BETA_BRACKETS,
    LIQUIDITY_VOLUME_BRACKETS, STRESS_SCENARIOS,
    HIGH_RATE_SENSITIVITY_SECTORS, MODERATE_RATE_SENSITIVITY_SECTORS,
    score_by_brackets,
)
from .stock_data import StockDataFetcher, StockData, AnalysisResult

logger = logging.getLogger(__name__)


class BridgewaterRisk(BaseAnalyzer):
    """ブリッジウォーター流のリスク評価"""

    NAME = "Bridgewater リスク評価"
    DESCRIPTION = "ボラティリティ、ベータ、最大ドローダウン、ストレステスト、ヘッジ提案"

    @staticmethod
    def analyze(stock_data: StockData) -> AnalysisResult:
        info = stock_data.get("info", {})
        history = stock_data.get("history")
        ticker = stock_data.get("ticker", "N/A")
        company_name = StockDataFetcher.get_display_name(info, ticker)

        if history is None or history.empty:
            return {"analyzer": BridgewaterRisk.NAME, "error": "データなし"}

        close = history["Close"]
        returns = close.pct_change().dropna()

        # 市場データ取得
        market_data = StockDataFetcher.fetch_market_index(period="5y")
        nikkei = market_data.get("nikkei225", pd.DataFrame())

        # ボラティリティ分析
        volatility = BridgewaterRisk._volatility_profile(returns)

        # ベータ分析
        beta_analysis = BridgewaterRisk._beta_analysis(returns, nikkei)

        # 最大ドローダウン
        drawdown = BridgewaterRisk._max_drawdown(close)

        # 金利感応度
        interest_sensitivity = BridgewaterRisk._interest_rate_sensitivity(info)

        # リセッションストレステスト
        stress_test = BridgewaterRisk._stress_test(close, returns, info)

        # 決算リスク
        earnings_risk = BridgewaterRisk._earnings_risk(info, returns)

        # 流動性リスク
        liquidity = BridgewaterRisk._liquidity_risk(info, history)

        # ヘッジ提案
        hedge = BridgewaterRisk._hedging_recommendation(
            volatility, beta_analysis, info
        )

        # リスクダッシュボード
        risk_dashboard = BridgewaterRisk._build_dashboard(
            volatility, beta_analysis, drawdown, liquidity, stress_test
        )

        return {
            "analyzer": BridgewaterRisk.NAME,
            "company_name": company_name,
            "ticker": ticker,
            "current_price": close.iloc[-1] if not close.empty else 0,
            "volatility": volatility,
            "beta_analysis": beta_analysis,
            "drawdown": drawdown,
            "interest_sensitivity": interest_sensitivity,
            "stress_test": stress_test,
            "earnings_risk": earnings_risk,
            "liquidity": liquidity,
            "hedge_recommendation": hedge,
            "risk_dashboard": risk_dashboard,
        }

    @staticmethod
    def _volatility_profile(returns):
        daily_vol = returns.std()
        annual_vol = daily_vol * np.sqrt(TRADING_DAYS_PER_YEAR)

        level, _ = score_by_brackets(annual_vol, VOLATILITY_ANNUAL_BRACKETS)

        return {
            "daily_pct": round(daily_vol * 100, 2),
            "annual_pct": round(annual_vol * 100, 2),
            "level": level,
            "percentile_95_daily_loss": round(returns.quantile(0.05) * 100, 2),
        }

    @staticmethod
    def _beta_analysis(returns, market_history):
        if market_history.empty:
            return {"beta": None, "interpretation": "市場データなし"}

        market_returns = market_history["Close"].pct_change().dropna()
        common = returns.index.intersection(market_returns.index)

        if len(common) < 30:
            return {"beta": None, "interpretation": "データ不足"}

        sr = returns.loc[common]
        mr = market_returns.loc[common]

        cov = sr.cov(mr)
        var = mr.var()
        beta = cov / var if var > 0 else 1.0

        # 上昇ベータ / 下降ベータ
        up_mask = mr > 0
        down_mask = mr < 0

        up_beta = sr[up_mask].cov(mr[up_mask]) / mr[up_mask].var() if mr[up_mask].var() > 0 else beta
        down_beta = sr[down_mask].cov(mr[down_mask]) / mr[down_mask].var() if mr[down_mask].var() > 0 else beta

        interp, _ = score_by_brackets(beta, BETA_BRACKETS)

        return {
            "beta": round(beta, 2),
            "up_beta": round(up_beta, 2),
            "down_beta": round(down_beta, 2),
            "interpretation": interp,
            "correlation": round(sr.corr(mr), 2),
        }

    @staticmethod
    def _max_drawdown(close):
        cummax = close.cummax()
        drawdown = (close - cummax) / cummax

        max_dd = drawdown.min()
        max_dd_date = drawdown.idxmin()

        # 回復時間を計算
        if max_dd < 0:
            dd_idx = drawdown.idxmin()
            recovery = drawdown.loc[dd_idx:]
            recovered = recovery[recovery >= 0]
            if not recovered.empty:
                recovery_date = recovered.index[0]
                delta = recovery_date - dd_idx
                recovery_days = delta.days if hasattr(delta, 'days') else len(drawdown.loc[dd_idx:recovery_date])
            else:
                recovery_date = None
                recovery_days = "未回復"
        else:
            recovery_days = 0

        return {
            "max_drawdown_pct": round(max_dd * 100, 2),
            "max_drawdown_date": str(max_dd_date)[:10] if max_dd_date is not None else "N/A",
            "recovery_days": recovery_days,
        }

    @staticmethod
    def _interest_rate_sensitivity(info):
        sector = info.get("sector", "")
        industry = info.get("industry", "")

        if any(s in sector or s in industry for s in HIGH_RATE_SENSITIVITY_SECTORS):
            level = "高感応度"
            impact = "金利上昇時に株価下落リスクが高い"
        elif any(s in sector or s in industry for s in MODERATE_RATE_SENSITIVITY_SECTORS):
            level = "中程度"
            impact = "金利変動の影響は限定的"
        else:
            level = "低感応度"
            impact = "金利変動への感応度は低い"

        return {"level": level, "impact": impact, "sector": sector}

    @staticmethod
    def _stress_test(close, returns, _info=None):
        current = close.iloc[-1]
        annual_vol = returns.std() * np.sqrt(TRADING_DAYS_PER_YEAR)

        scenarios = {}
        for name, drop in STRESS_SCENARIOS.items():
            scenarios[name] = {
                "estimated_price": round(current * (1 + drop), 0),
                "loss_pct": round(drop * 100, 1),
            }

        scenarios["2σイベント"] = {
            "estimated_price": round(current * (1 - 2 * annual_vol), 0),
            "loss_pct": round(-2 * annual_vol * 100, 1),
        }
        scenarios["3σイベント"] = {
            "estimated_price": round(current * (1 - 3 * annual_vol), 0),
            "loss_pct": round(-3 * annual_vol * 100, 1),
        }

        return {"current_price": round(current, 0), "scenarios": scenarios}

    @staticmethod
    def _earnings_risk(_info, returns):
        # 決算日前後のボラティリティ推定
        avg_daily_move = returns.abs().mean() * 100

        return {
            "avg_daily_move_pct": round(avg_daily_move, 2),
            "estimated_earnings_move_pct": round(avg_daily_move * 3, 1),
            "note": "決算日は通常の3倍程度の値動きが発生する傾向",
        }

    @staticmethod
    def _liquidity_risk(info, history):
        avg_volume = info.get("averageDailyVolume10Day") or info.get("averageVolume", 0)
        market_cap = info.get("marketCap", 0)

        if avg_volume > 5_000_000:
            level = "非常に高い流動性"
        elif avg_volume > 1_000_000:
            level = "高い流動性"
        elif avg_volume > 100_000:
            level = "中程度"
        elif avg_volume > 10_000:
            level = "低い流動性"
        else:
            level = "非常に低い（注意）"

        bid = info.get("bid", 0)
        ask = info.get("ask", 0)
        spread = ((ask - bid) / ask * 100) if ask > 0 and bid > 0 else None

        return {
            "avg_daily_volume": avg_volume,
            "liquidity_level": level,
            "bid_ask_spread_pct": round(spread, 3) if spread else None,
            "market_cap": market_cap,
        }

    @staticmethod
    def _hedging_recommendation(volatility, beta, info):
        recommendations = []

        annual_vol = volatility.get("annual_pct", 20)
        beta_val = beta.get("beta", 1.0)

        if annual_vol > 30:
            recommendations.append("高ボラティリティ: プットオプション買い（ポジションの10-15%）を検討")
        elif annual_vol > 20:
            recommendations.append("中ボラティリティ: カラー戦略（プット買い＋コール売り）を検討")

        if beta_val and beta_val > 1.2:
            recommendations.append(f"高ベータ({beta_val:.2f}): 日経平均インバースETF（1571.T）でヘッジ")

        if not recommendations:
            recommendations.append("現時点で大きなヘッジの必要性は低い。定期的なモニタリングを推奨")

        return {"strategies": recommendations}

    @staticmethod
    def _build_dashboard(volatility, beta, drawdown, liquidity, stress_test):
        """リスクダッシュボードのスコアを構築"""
        scores = {}

        # ボラティリティスコア (低い方が良い)
        annual_vol = volatility.get("annual_pct", 20)
        if annual_vol < 15:
            scores["ボラティリティ"] = {"score": 2, "label": "低リスク", "color": "green"}
        elif annual_vol < 25:
            scores["ボラティリティ"] = {"score": 5, "label": "中リスク", "color": "yellow"}
        elif annual_vol < 35:
            scores["ボラティリティ"] = {"score": 7, "label": "高リスク", "color": "orange"}
        else:
            scores["ボラティリティ"] = {"score": 9, "label": "非常に高い", "color": "red"}

        # ベータスコア
        beta_val = beta.get("beta", 1.0) or 1.0
        if beta_val < 0.8:
            scores["ベータ"] = {"score": 3, "label": "ディフェンシブ", "color": "green"}
        elif beta_val < 1.2:
            scores["ベータ"] = {"score": 5, "label": "中立", "color": "yellow"}
        else:
            scores["ベータ"] = {"score": 8, "label": "アグレッシブ", "color": "orange"}

        # ドローダウンスコア
        max_dd = abs(drawdown.get("max_drawdown_pct", 0))
        if max_dd < 15:
            scores["ドローダウン"] = {"score": 2, "label": "軽微", "color": "green"}
        elif max_dd < 30:
            scores["ドローダウン"] = {"score": 5, "label": "中程度", "color": "yellow"}
        elif max_dd < 50:
            scores["ドローダウン"] = {"score": 7, "label": "大きい", "color": "orange"}
        else:
            scores["ドローダウン"] = {"score": 9, "label": "深刻", "color": "red"}

        # 流動性スコア
        vol = liquidity.get("avg_daily_volume", 0)
        if vol > 1_000_000:
            scores["流動性"] = {"score": 2, "label": "十分", "color": "green"}
        elif vol > 100_000:
            scores["流動性"] = {"score": 4, "label": "中程度", "color": "yellow"}
        else:
            scores["流動性"] = {"score": 8, "label": "低い", "color": "red"}

        total = sum(s["score"] for s in scores.values())
        avg = total / len(scores) if scores else 5

        return {
            "metrics": scores,
            "total_risk_score": round(avg, 1),
            "overall_risk": "低リスク" if avg < 4 else "中リスク" if avg < 6 else "高リスク" if avg < 8 else "非常に高リスク",
        }
