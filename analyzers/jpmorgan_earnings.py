"""JPMorgan Chase スタイル 決算分析"""

import numpy as np
import pandas as pd
from .stock_data import StockDataFetcher


class JPMorganEarnings:
    """JPモルガン流の決算分析"""

    NAME = "JPMorgan 決算アナライザー"
    DESCRIPTION = "決算履歴、コンセンサス予想、オプションインプライドムーブ、ポジション戦略"

    @staticmethod
    def analyze(stock_data: dict) -> dict:
        info = stock_data.get("info", {})
        history = stock_data.get("history")
        earnings_dates = stock_data.get("earnings_dates")
        financials = stock_data.get("financials")
        ticker = stock_data.get("ticker", "N/A")
        company_name = StockDataFetcher.get_display_name(info, ticker)

        current_price = StockDataFetcher.get_current_price(info)

        # 決算履歴分析
        earnings_history = JPMorganEarnings._earnings_history(earnings_dates)

        # コンセンサス予想
        consensus = JPMorganEarnings._consensus_estimates(info)

        # 注目指標
        key_metrics = JPMorganEarnings._key_metrics(info, financials)

        # セグメント分析
        segments = JPMorganEarnings._segment_analysis(info)

        # 決算日のインプライドムーブ
        implied_move = JPMorganEarnings._implied_move(history, info)

        # ポジション戦略
        positioning = JPMorganEarnings._positioning_strategy(
            earnings_history, implied_move, current_price
        )

        return {
            "analyzer": JPMorganEarnings.NAME,
            "company_name": company_name,
            "ticker": ticker,
            "current_price": current_price,
            "earnings_history": earnings_history,
            "consensus": consensus,
            "key_metrics": key_metrics,
            "segments": segments,
            "implied_move": implied_move,
            "positioning": positioning,
        }

    @staticmethod
    def _earnings_history(earnings_dates):
        if earnings_dates is None or earnings_dates.empty:
            return {"quarters": [], "summary": "決算データなし"}

        quarters = []
        beats = 0
        misses = 0

        for idx, row in earnings_dates.head(8).iterrows():
            eps_est = row.get("EPS Estimate")
            eps_act = row.get("Reported EPS")
            surprise = row.get("Surprise(%)")

            if pd.notna(eps_est) and pd.notna(eps_act):
                beat = eps_act > eps_est
                if beat:
                    beats += 1
                else:
                    misses += 1
            else:
                beat = None

            quarters.append({
                "date": str(idx)[:10] if idx is not None else "N/A",
                "eps_estimate": round(float(eps_est), 2) if pd.notna(eps_est) else None,
                "eps_actual": round(float(eps_act), 2) if pd.notna(eps_act) else None,
                "surprise_pct": round(float(surprise), 1) if pd.notna(surprise) else None,
                "beat": beat,
            })

        total = beats + misses
        beat_rate = (beats / total * 100) if total > 0 else 0

        return {
            "quarters": quarters,
            "beats": beats,
            "misses": misses,
            "beat_rate": round(beat_rate, 0),
            "summary": f"直近{total}四半期: {beats}回上振れ / {misses}回下振れ (勝率{beat_rate:.0f}%)",
        }

    @staticmethod
    def _consensus_estimates(info):
        return {
            "forward_eps": info.get("forwardEps"),
            "trailing_eps": info.get("trailingEps"),
            "forward_pe": info.get("forwardPE"),
            "peg_ratio": info.get("pegRatio"),
            "earnings_growth": info.get("earningsGrowth"),
            "revenue_growth": info.get("revenueGrowth"),
            "analyst_target_mean": info.get("targetMeanPrice"),
            "analyst_target_high": info.get("targetHighPrice"),
            "analyst_target_low": info.get("targetLowPrice"),
            "recommendation": info.get("recommendationKey", "N/A"),
            "num_analysts": info.get("numberOfAnalystOpinions", 0),
        }

    @staticmethod
    def _key_metrics(info, financials):
        metrics = [
            {"name": "売上高成長率", "value": f"{info.get('revenueGrowth', 0)*100:.1f}%" if info.get('revenueGrowth') else "N/A", "importance": "高"},
            {"name": "営業利益率", "value": f"{info.get('operatingMargins', 0)*100:.1f}%" if info.get('operatingMargins') else "N/A", "importance": "高"},
            {"name": "純利益率", "value": f"{info.get('profitMargins', 0)*100:.1f}%" if info.get('profitMargins') else "N/A", "importance": "高"},
            {"name": "ROE", "value": f"{info.get('returnOnEquity', 0)*100:.1f}%" if info.get('returnOnEquity') else "N/A", "importance": "中"},
            {"name": "フリーキャッシュフロー", "value": f"¥{info.get('freeCashflow', 0):,.0f}" if info.get('freeCashflow') else "N/A", "importance": "高"},
        ]
        return metrics

    @staticmethod
    def _segment_analysis(info):
        # yfinanceからはセグメント詳細は取得困難なため、利用可能な情報を返す
        return {
            "sector": info.get("sector", "不明"),
            "industry": info.get("industry", "不明"),
            "full_time_employees": info.get("fullTimeEmployees"),
            "note": "セグメント別詳細はIR資料を参照してください",
        }

    @staticmethod
    def _implied_move(history, info):
        if history is None or history.empty:
            return {"estimated_move_pct": None}

        close = history["Close"]
        returns = close.pct_change().dropna()

        # 日次リターンの標準偏差から推定
        daily_vol = returns.std()
        # 決算日は通常の2-4倍の動き
        estimated_move = daily_vol * 3 * 100

        # 過去の大きな値動き（決算日の推定）
        large_moves = returns.abs().nlargest(8)
        avg_large_move = large_moves.mean() * 100

        return {
            "estimated_move_pct": round(estimated_move, 1),
            "avg_large_move_pct": round(avg_large_move, 1),
            "max_single_day_move_pct": round(returns.abs().max() * 100, 1),
        }

    @staticmethod
    def _positioning_strategy(earnings_history, implied_move, current_price):
        beat_rate = earnings_history.get("beat_rate", 50)
        est_move = implied_move.get("estimated_move_pct", 5)

        strategies = []

        if beat_rate >= 75:
            strategies.append({
                "timing": "決算前",
                "action": "買い検討",
                "reason": f"上振れ率{beat_rate:.0f}%と高い。決算前の購入が有利な可能性",
            })
        elif beat_rate <= 40:
            strategies.append({
                "timing": "決算前",
                "action": "売り/様子見",
                "reason": f"上振れ率{beat_rate:.0f}%と低い。決算前の保有はリスクが高い",
            })
        else:
            strategies.append({
                "timing": "決算前",
                "action": "様子見推奨",
                "reason": "上振れ/下振れの予測が難しい。決算後の反応を見て判断",
            })

        # ギャップアップ/ダウン戦略
        strategies.append({
            "timing": "決算後ギャップアップ時",
            "action": "初動を確認後、押し目買い",
            "reason": f"想定変動幅±{est_move:.1f}%。ギャップ後の初動30分で方向性を確認",
        })
        strategies.append({
            "timing": "決算後ギャップダウン時",
            "action": "パニック売りの反発を狙う",
            "reason": "過剰反応の場合、翌営業日以降に反発する傾向",
        })

        return {"strategies": strategies}
