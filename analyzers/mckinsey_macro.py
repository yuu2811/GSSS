"""McKinsey スタイル マクロ経済影響レポート"""

import numpy as np
import pandas as pd
import yfinance as yf


class McKinseyMacro:
    """マッキンゼー流のマクロ経済分析"""

    NAME = "McKinsey マクロ経済レポート"
    DESCRIPTION = "金利、インフレ、GDP、為替、雇用の市場影響分析"

    @staticmethod
    def analyze(stock_data: dict = None) -> dict:
        # 市場指標を取得
        market_indicators = McKinseyMacro._fetch_market_indicators()

        # 金利環境分析
        interest_rate = McKinseyMacro._interest_rate_analysis(market_indicators)

        # 為替分析
        currency = McKinseyMacro._currency_analysis(market_indicators)

        # セクター推奨
        sector_recommendation = McKinseyMacro._sector_impact(interest_rate, currency)

        # リスクファクター
        global_risks = McKinseyMacro._global_risk_factors()

        # タイムライン
        timeline = McKinseyMacro._impact_timeline()

        # ポートフォリオ調整案
        adjustments = McKinseyMacro._portfolio_adjustments(
            interest_rate, currency, sector_recommendation
        )

        return {
            "analyzer": McKinseyMacro.NAME,
            "market_indicators": market_indicators,
            "interest_rate_analysis": interest_rate,
            "currency_analysis": currency,
            "sector_recommendation": sector_recommendation,
            "global_risks": global_risks,
            "timeline": timeline,
            "portfolio_adjustments": adjustments,
        }

    @staticmethod
    def _fetch_market_indicators():
        indicators = {}

        # 日経225
        try:
            nk = yf.Ticker("^N225")
            hist = nk.history(period="1y")
            if not hist.empty:
                indicators["nikkei225"] = {
                    "current": round(hist["Close"].iloc[-1], 0),
                    "change_1m": round(((hist["Close"].iloc[-1] / hist["Close"].iloc[-22]) - 1) * 100, 1) if len(hist) >= 22 else None,
                    "change_ytd": round(((hist["Close"].iloc[-1] / hist["Close"].iloc[0]) - 1) * 100, 1),
                }
        except Exception:
            pass

        # ドル円
        try:
            usdjpy = yf.Ticker("USDJPY=X")
            hist = usdjpy.history(period="1y")
            if not hist.empty:
                indicators["usdjpy"] = {
                    "current": round(hist["Close"].iloc[-1], 2),
                    "change_1m": round(((hist["Close"].iloc[-1] / hist["Close"].iloc[-22]) - 1) * 100, 1) if len(hist) >= 22 else None,
                    "change_ytd": round(((hist["Close"].iloc[-1] / hist["Close"].iloc[0]) - 1) * 100, 1),
                }
        except Exception:
            pass

        # 米国10年債利回り（代替指標）
        try:
            tnx = yf.Ticker("^TNX")
            hist = tnx.history(period="6mo")
            if not hist.empty:
                indicators["us10y"] = {
                    "current": round(hist["Close"].iloc[-1], 2),
                }
        except Exception:
            pass

        # VIX
        try:
            vix = yf.Ticker("^VIX")
            hist = vix.history(period="3mo")
            if not hist.empty:
                indicators["vix"] = {
                    "current": round(hist["Close"].iloc[-1], 1),
                }
        except Exception:
            pass

        # S&P500
        try:
            sp = yf.Ticker("^GSPC")
            hist = sp.history(period="1y")
            if not hist.empty:
                indicators["sp500"] = {
                    "current": round(hist["Close"].iloc[-1], 0),
                    "change_ytd": round(((hist["Close"].iloc[-1] / hist["Close"].iloc[0]) - 1) * 100, 1),
                }
        except Exception:
            pass

        return indicators

    @staticmethod
    def _interest_rate_analysis(indicators):
        us10y = indicators.get("us10y", {}).get("current", 4.0)

        if us10y > 4.5:
            environment = "高金利環境"
            impact_growth = "成長株に逆風（割引率上昇で現在価値低下）"
            impact_value = "バリュー株・高配当株に追い風"
            impact_real_estate = "不動産セクターに逆風"
        elif us10y > 3.0:
            environment = "中程度の金利環境"
            impact_growth = "成長株への影響は限定的"
            impact_value = "バリュー株は安定"
            impact_real_estate = "不動産セクターはやや逆風"
        else:
            environment = "低金利環境"
            impact_growth = "成長株に追い風"
            impact_value = "バリュー株・高配当株の相対魅力低下"
            impact_real_estate = "不動産セクターに追い風"

        return {
            "us_10y_yield": us10y,
            "environment": environment,
            "impact": {
                "growth_stocks": impact_growth,
                "value_stocks": impact_value,
                "real_estate": impact_real_estate,
            },
            "outlook": "今後6-12ヶ月の金利動向はFRBの政策次第。データ依存のアプローチが重要",
        }

    @staticmethod
    def _currency_analysis(indicators):
        usdjpy = indicators.get("usdjpy", {})
        rate = usdjpy.get("current", 150)
        change_1m = usdjpy.get("change_1m", 0)

        if rate > 150:
            yen_status = "円安水準"
            impact = "輸出企業に追い風、輸入企業・内需にはコスト増"
            beneficiaries = ["自動車（7203.T トヨタ等）", "電子部品", "精密機器"]
            losers = ["食品", "小売", "エネルギー輸入企業"]
        elif rate > 130:
            yen_status = "やや円安"
            impact = "輸出企業にやや有利"
            beneficiaries = ["自動車", "電子機器"]
            losers = ["輸入依存企業"]
        elif rate > 110:
            yen_status = "適正水準"
            impact = "為替の影響は限定的"
            beneficiaries = []
            losers = []
        else:
            yen_status = "円高水準"
            impact = "輸入企業に追い風、輸出企業に逆風"
            beneficiaries = ["内需・小売", "食品", "エネルギー"]
            losers = ["自動車", "電子部品", "機械"]

        return {
            "usdjpy": rate,
            "change_1m_pct": change_1m,
            "yen_status": yen_status,
            "impact": impact,
            "beneficiaries": beneficiaries,
            "losers": losers,
        }

    @staticmethod
    def _sector_impact(interest_rate, currency):
        recommendations = []

        env = interest_rate.get("environment", "")
        yen = currency.get("yen_status", "")

        if "高金利" in env:
            recommendations.append({"sector": "銀行・金融", "stance": "オーバーウェイト", "reason": "金利上昇で利ざや拡大"})
            recommendations.append({"sector": "不動産", "stance": "アンダーウェイト", "reason": "金利上昇で資金調達コスト増"})
        else:
            recommendations.append({"sector": "不動産", "stance": "中立〜オーバーウェイト", "reason": "低金利で資金調達コスト低下"})

        if "円安" in yen:
            recommendations.append({"sector": "自動車・輸出", "stance": "オーバーウェイト", "reason": "円安で海外売上の円建て増加"})
            recommendations.append({"sector": "食品・小売", "stance": "アンダーウェイト", "reason": "原材料コスト上昇"})
        elif "円高" in yen:
            recommendations.append({"sector": "内需・小売", "stance": "オーバーウェイト", "reason": "輸入コスト低下"})
            recommendations.append({"sector": "自動車・輸出", "stance": "アンダーウェイト", "reason": "海外売上の目減り"})

        recommendations.append({"sector": "医薬品", "stance": "中立", "reason": "マクロ環境の影響は限定的。ディフェンシブ"})

        return recommendations

    @staticmethod
    def _global_risk_factors():
        return [
            {"risk": "地政学リスク", "severity": "中〜高", "impact": "サプライチェーン混乱、エネルギー価格上昇"},
            {"risk": "米中関係の悪化", "severity": "中", "impact": "テクノロジーセクターへの規制リスク"},
            {"risk": "インフレ再加速", "severity": "中", "impact": "金利再上昇→株式バリュエーション圧縮"},
            {"risk": "中国経済減速", "severity": "中", "impact": "素材・機械セクターの需要減退"},
            {"risk": "AI・テクノロジーバブル懸念", "severity": "低〜中", "impact": "ハイテク株の調整リスク"},
        ]

    @staticmethod
    def _impact_timeline():
        return [
            {"period": "短期（1-3ヶ月）", "focus": "決算シーズン、中央銀行政策会合、為替動向"},
            {"period": "中期（3-6ヶ月）", "focus": "金利見通しの変化、企業業績ガイダンス"},
            {"period": "長期（6-12ヶ月）", "focus": "経済サイクルの転換点、構造改革の進展"},
        ]

    @staticmethod
    def _portfolio_adjustments(interest_rate, currency, sector_recs):
        adjustments = []

        for rec in sector_recs:
            if rec["stance"] == "オーバーウェイト":
                adjustments.append(f"{rec['sector']}のウェイトを引き上げ: {rec['reason']}")
            elif rec["stance"] == "アンダーウェイト":
                adjustments.append(f"{rec['sector']}のウェイトを引き下げ: {rec['reason']}")

        adjustments.append("キャッシュポジション5-10%を確保し、急落時の買い増し余力を維持")

        return {
            "recommended_actions": adjustments,
            "overall_stance": "慎重な楽観主義。ポジションは維持しつつ、リスク管理を徹底",
        }
