"""株価データ取得モジュール - yfinanceを使用して日本株データを取得"""

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta


class StockDataFetcher:
    """日本株のデータを取得・整形するクラス"""

    # 主要な日本株セクターETF
    SECTOR_ETFS = {
        "情報・通信": "1626.T",
        "電気機器": "1613.T",
        "輸送用機器": "1622.T",
        "銀行": "1615.T",
        "医薬品": "1621.T",
        "食料品": "1617.T",
        "化学": "1620.T",
        "機械": "1624.T",
        "小売業": "1630.T",
        "建設業": "1619.T",
        "不動産業": "1633.T",
    }

    TOPIX_TICKER = "^TPX"
    NIKKEI_TICKER = "^N225"

    @staticmethod
    def normalize_ticker(code: str) -> str:
        """銘柄コードを正規化（.T付与）"""
        code = code.strip()
        if code.startswith("^"):
            return code
        if not code.endswith(".T"):
            # 数字のみの場合は.Tを付与
            code_num = code.replace(".T", "")
            if code_num.isdigit():
                return f"{code_num}.T"
        return code

    @staticmethod
    def fetch(ticker: str, period: str = "5y") -> dict:
        """指定銘柄の包括的なデータを取得"""
        ticker = StockDataFetcher.normalize_ticker(ticker)
        stock = yf.Ticker(ticker)

        result = {
            "ticker": ticker,
            "info": {},
            "history": pd.DataFrame(),
            "financials": pd.DataFrame(),
            "balance_sheet": pd.DataFrame(),
            "cashflow": pd.DataFrame(),
            "dividends": pd.Series(dtype=float),
            "earnings_dates": pd.DataFrame(),
        }

        try:
            result["info"] = stock.info or {}
        except Exception:
            result["info"] = {}

        try:
            result["history"] = stock.history(period=period)
        except Exception:
            pass

        try:
            result["financials"] = stock.financials
        except Exception:
            pass

        try:
            result["balance_sheet"] = stock.balance_sheet
        except Exception:
            pass

        try:
            result["cashflow"] = stock.cashflow
        except Exception:
            pass

        try:
            result["dividends"] = stock.dividends
        except Exception:
            pass

        try:
            result["earnings_dates"] = stock.earnings_dates
        except Exception:
            pass

        return result

    @staticmethod
    def fetch_price_history(ticker: str, period: str = "1y") -> pd.DataFrame:
        """価格履歴のみを取得"""
        ticker = StockDataFetcher.normalize_ticker(ticker)
        stock = yf.Ticker(ticker)
        try:
            return stock.history(period=period)
        except Exception:
            return pd.DataFrame()

    @staticmethod
    def fetch_market_index(period: str = "1y") -> dict:
        """日経225とTOPIXのデータを取得"""
        result = {}
        for name, ticker in [("nikkei225", StockDataFetcher.NIKKEI_TICKER),
                              ("topix", StockDataFetcher.TOPIX_TICKER)]:
            try:
                stock = yf.Ticker(ticker)
                result[name] = stock.history(period=period)
            except Exception:
                result[name] = pd.DataFrame()
        return result

    @staticmethod
    def get_company_name(ticker: str) -> str:
        """会社名を取得"""
        ticker = StockDataFetcher.normalize_ticker(ticker)
        try:
            stock = yf.Ticker(ticker)
            info = stock.info or {}
            return info.get("longName", info.get("shortName", ticker))
        except Exception:
            return ticker

    @staticmethod
    def calculate_technical_indicators(history: pd.DataFrame) -> dict:
        """テクニカル指標を計算"""
        if history.empty or len(history) < 20:
            return {}

        close = history["Close"]
        volume = history["Volume"] if "Volume" in history.columns else pd.Series(dtype=float)

        indicators = {}

        # 移動平均
        for period in [20, 50, 100, 200]:
            if len(close) >= period:
                indicators[f"sma_{period}"] = close.rolling(window=period).mean().iloc[-1]
            else:
                indicators[f"sma_{period}"] = None

        # RSI (14日)
        delta = close.diff()
        gain = delta.where(delta > 0, 0).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss.replace(0, np.nan)
        rsi = 100 - (100 / (1 + rs))
        indicators["rsi"] = rsi.iloc[-1] if not rsi.empty else None

        # MACD
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        macd_line = ema12 - ema26
        signal_line = macd_line.ewm(span=9, adjust=False).mean()
        histogram = macd_line - signal_line
        indicators["macd"] = macd_line.iloc[-1] if not macd_line.empty else None
        indicators["macd_signal"] = signal_line.iloc[-1] if not signal_line.empty else None
        indicators["macd_histogram"] = histogram.iloc[-1] if not histogram.empty else None

        # ボリンジャーバンド (20日, 2σ)
        sma20 = close.rolling(window=20).mean()
        std20 = close.rolling(window=20).std()
        indicators["bb_upper"] = (sma20 + 2 * std20).iloc[-1]
        indicators["bb_middle"] = sma20.iloc[-1]
        indicators["bb_lower"] = (sma20 - 2 * std20).iloc[-1]
        bb_width = ((indicators["bb_upper"] - indicators["bb_lower"]) / indicators["bb_middle"]) * 100
        indicators["bb_width"] = bb_width

        # 現在価格
        indicators["current_price"] = close.iloc[-1]

        # 出来高分析
        if not volume.empty and len(volume) >= 20:
            indicators["avg_volume_20"] = volume.rolling(window=20).mean().iloc[-1]
            indicators["current_volume"] = volume.iloc[-1]
            indicators["volume_ratio"] = volume.iloc[-1] / indicators["avg_volume_20"] if indicators["avg_volume_20"] > 0 else 0

        return indicators

    @staticmethod
    def calculate_fibonacci_levels(history: pd.DataFrame) -> dict:
        """フィボナッチリトレースメントレベルを計算"""
        if history.empty or len(history) < 20:
            return {}

        close = history["Close"]
        high = close.max()
        low = close.min()
        diff = high - low

        return {
            "high": high,
            "low": low,
            "level_236": high - diff * 0.236,
            "level_382": high - diff * 0.382,
            "level_500": high - diff * 0.500,
            "level_618": high - diff * 0.618,
            "level_786": high - diff * 0.786,
        }

    @staticmethod
    def calculate_volatility(history: pd.DataFrame, market_history: pd.DataFrame = None) -> dict:
        """ボラティリティとベータを計算"""
        if history.empty or len(history) < 30:
            return {}

        close = history["Close"]
        returns = close.pct_change().dropna()

        result = {
            "daily_volatility": returns.std(),
            "annual_volatility": returns.std() * np.sqrt(252),
            "max_drawdown": 0,
            "max_drawdown_date": None,
        }

        # 最大ドローダウン
        cummax = close.cummax()
        drawdown = (close - cummax) / cummax
        result["max_drawdown"] = drawdown.min()
        if drawdown.min() < 0:
            result["max_drawdown_date"] = drawdown.idxmin().strftime("%Y-%m-%d") if hasattr(drawdown.idxmin(), 'strftime') else str(drawdown.idxmin())

        # ベータ計算
        if market_history is not None and not market_history.empty:
            market_close = market_history["Close"]
            market_returns = market_close.pct_change().dropna()

            # 日付で揃える
            common_idx = returns.index.intersection(market_returns.index)
            if len(common_idx) > 30:
                stock_r = returns.loc[common_idx]
                market_r = market_returns.loc[common_idx]
                cov = stock_r.cov(market_r)
                var = market_r.var()
                result["beta"] = cov / var if var > 0 else 1.0
                result["correlation"] = stock_r.corr(market_r)

        return result
