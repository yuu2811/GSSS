"""アナライザー基底クラス — 全アナライザーで共通のパターンを集約する。"""

from __future__ import annotations

import logging
from typing import Any

from .stock_data import StockDataFetcher, StockData, AnalysisResult

logger = logging.getLogger(__name__)


class BaseAnalyzer:
    """全アナライザーの基底クラス。

    サブクラスは NAME / DESCRIPTION クラス変数と _run() メソッドを実装する。
    analyze() は共通の前処理（ヘッダー抽出・例外ハンドリング）を提供する。
    """

    NAME: str = ""
    DESCRIPTION: str = ""

    @classmethod
    def analyze(cls, stock_data: StockData, **kwargs) -> AnalysisResult:
        """共通エントリーポイント。サブクラスの _run() を呼び出す。"""
        return cls._run(stock_data, **kwargs)

    @classmethod
    def _run(cls, stock_data: StockData, **kwargs) -> AnalysisResult:
        raise NotImplementedError

    # ── 共通ヘルパー ─────────────────────────────────────

    @staticmethod
    def extract_header(stock_data: StockData) -> dict[str, Any]:
        """stock_data から共通ヘッダー情報を抽出する。"""
        info = stock_data.get("info", {})
        ticker = stock_data.get("ticker", "N/A")
        return {
            "info": info,
            "ticker": ticker,
            "company_name": StockDataFetcher.get_display_name(info, ticker),
            "current_price": StockDataFetcher.get_current_price(info),
            "sector": info.get("sector", "不明"),
            "industry": info.get("industry", "不明"),
        }

    @staticmethod
    def require_history(stock_data: StockData, analyzer_name: str) -> AnalysisResult | None:
        """history が空の場合、エラー結果を返す。正常なら None。"""
        history = stock_data.get("history")
        if history is None or history.empty:
            return {"analyzer": analyzer_name, "error": "価格データが取得できません"}
        return None

    @staticmethod
    def safe_divide(numerator, denominator, default=0):
        """ゼロ除算を安全に処理する。"""
        if denominator is None or denominator == 0:
            return default
        if numerator is None:
            return default
        return numerator / denominator

    @staticmethod
    def clamp(value: float, low: float = 0, high: float = 100) -> float:
        """値を [low, high] の範囲にクランプする。"""
        return max(low, min(high, value))

    @staticmethod
    def pct_change_safe(current, previous, default=0):
        """変化率を安全に計算する。"""
        if previous is None or previous == 0 or current is None:
            return default
        return (current - previous) / abs(previous)

    @staticmethod
    def format_large_number(num) -> str:
        """大きな数値を日本語表記に変換する。"""
        if num is None:
            return "N/A"
        abs_num = abs(num)
        if abs_num >= 1e12:
            return f"¥{num / 1e12:.1f}兆"
        if abs_num >= 1e8:
            return f"¥{num / 1e8:.0f}億"
        if abs_num >= 1e4:
            return f"¥{num / 1e4:.0f}万"
        return f"¥{num:,.0f}"
