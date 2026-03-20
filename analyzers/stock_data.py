"""株価データ取得モジュール - yfinanceを使用して日本株データを取得"""

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

from .stock_names import search_stocks, get_name_by_code


class StockDataFetcher:
    """日本株のデータを取得・整形するクラス"""

    # ── 共通ヘルパーメソッド ──────────────────────────────

    @staticmethod
    def get_display_name(info: dict, ticker: str = "N/A") -> str:
        """info辞書から表示用会社名を取得"""
        return info.get("longName") or info.get("shortName") or ticker

    @staticmethod
    def get_current_price(info: dict) -> float:
        """info辞書から現在価格を取得"""
        return info.get("currentPrice") or info.get("regularMarketPrice") or 0

    @staticmethod
    def normalize_percent(value, threshold: float = 10) -> float | None:
        """比率を小数形式(0.x)に正規化する。
        yfinanceのD/E比率、配当性向等は値域が不定（小数 or パーセント）のため統一する。
        threshold以上の値はパーセント値とみなして100で割る。
        """
        if value is None:
            return None
        if abs(value) >= threshold:
            return value / 100
        return value

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
    def search_by_name(query: str) -> list:
        """銘柄名またはコードで検索し、候補リストを返す

        Args:
            query: 検索クエリ（銘柄コード or 銘柄名 or 略称）

        Returns:
            [{"ticker": "7203.T", "name": "トヨタ自動車", "code": "7203"}, ...]
        """
        query = query.strip()
        if not query:
            return []

        # まずローカルDBで検索
        results = search_stocks(query, max_results=10)
        if results:
            return [
                {
                    "ticker": f"{code}.T",
                    "name": name,
                    "code": code,
                }
                for code, name in results
            ]

        # ローカルDBにない場合はyfinanceで直接検索を試みる
        code = query.replace(".T", "")
        if code.isdigit():
            ticker = f"{code}.T"
            try:
                stock = yf.Ticker(ticker)
                info = stock.info or {}
                name = info.get("longName", info.get("shortName", ""))
                if name:
                    return [{"ticker": ticker, "name": name, "code": code}]
            except Exception:
                pass

        return []

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

        # 不足データを財務諸表から補完
        StockDataFetcher._enrich_info(result)

        return result

    @staticmethod
    def _enrich_info(data: dict):
        """infoに不足しているデータを財務諸表・価格履歴から計算して補完する"""
        info = data.get("info", {})
        financials = data.get("financials")
        balance_sheet = data.get("balance_sheet")
        cashflow = data.get("cashflow")
        history = data.get("history")
        dividends = data.get("dividends")

        # --- 現在価格の補完 ---
        if not info.get("currentPrice") and not info.get("regularMarketPrice"):
            if history is not None and not history.empty:
                info["currentPrice"] = float(history["Close"].iloc[-1])

        current_price = info.get("currentPrice") or info.get("regularMarketPrice", 0)

        # --- 会社名の補完 (ローカルDB) ---
        if not info.get("longName") and not info.get("shortName"):
            ticker = data.get("ticker", "")
            local_name = get_name_by_code(ticker.replace(".T", ""))
            if local_name:
                info["longName"] = local_name

        # --- 52週高値/安値の補完 ---
        if history is not None and not history.empty:
            close = history["Close"]
            if len(close) >= 252:
                recent_year = close.iloc[-252:]
            else:
                recent_year = close

            if not info.get("fiftyTwoWeekHigh"):
                info["fiftyTwoWeekHigh"] = float(recent_year.max())
            if not info.get("fiftyTwoWeekLow"):
                info["fiftyTwoWeekLow"] = float(recent_year.min())

        # --- 財務諸表からの指標計算 ---
        def _safe_get_latest(df, row_name):
            """DataFrameから最新の値を安全に取得"""
            if df is None or df.empty:
                return None
            if row_name in df.index:
                vals = df.loc[row_name].dropna()
                if not vals.empty:
                    return float(vals.iloc[0])  # 最新（列が新しい順）
            return None

        # 売上高
        if not info.get("totalRevenue"):
            rev = _safe_get_latest(financials, "Total Revenue")
            if rev:
                info["totalRevenue"] = rev

        # 営業利益
        operating_income = _safe_get_latest(financials, "Operating Income")

        # 純利益
        net_income = _safe_get_latest(financials, "Net Income")

        # 総資産
        total_assets = _safe_get_latest(balance_sheet, "Total Assets")

        # 総負債
        total_debt_bs = (
            _safe_get_latest(balance_sheet, "Total Debt")
            or _safe_get_latest(balance_sheet, "Long Term Debt")
        )
        if not info.get("totalDebt") and total_debt_bs:
            info["totalDebt"] = total_debt_bs

        # 現金同等物
        total_cash_bs = (
            _safe_get_latest(balance_sheet, "Cash And Cash Equivalents")
            or _safe_get_latest(balance_sheet, "Cash Cash Equivalents And Short Term Investments")
        )
        if not info.get("totalCash") and total_cash_bs:
            info["totalCash"] = total_cash_bs

        # 株主資本
        total_equity = (
            _safe_get_latest(balance_sheet, "Stockholders Equity")
            or _safe_get_latest(balance_sheet, "Total Equity Gross Minority Interest")
            or _safe_get_latest(balance_sheet, "Common Stock Equity")
        )

        # --- ROE (Return on Equity) ---
        if not info.get("returnOnEquity") and net_income and total_equity and total_equity != 0:
            info["returnOnEquity"] = net_income / total_equity

        # --- ROA (Return on Assets) ---
        if not info.get("returnOnAssets") and net_income and total_assets and total_assets != 0:
            info["returnOnAssets"] = net_income / total_assets

        # --- 営業利益率 ---
        total_revenue = info.get("totalRevenue") or _safe_get_latest(financials, "Total Revenue")
        if not info.get("operatingMargins") and operating_income and total_revenue and total_revenue != 0:
            info["operatingMargins"] = operating_income / total_revenue

        # --- 純利益率 ---
        if not info.get("profitMargins") and net_income and total_revenue and total_revenue != 0:
            info["profitMargins"] = net_income / total_revenue

        # --- D/E比率（小数形式で統一、例: 0.5 = 50%）---
        if info.get("debtToEquity") is not None:
            info["debtToEquity"] = StockDataFetcher.normalize_percent(info["debtToEquity"])
        else:
            total_debt_val = info.get("totalDebt") or total_debt_bs
            if total_debt_val and total_equity and total_equity != 0:
                info["debtToEquity"] = total_debt_val / total_equity

        # --- PER (株価収益率) ---
        shares_outstanding = info.get("sharesOutstanding", 0)
        if not info.get("trailingPE") and net_income and current_price and shares_outstanding:
            eps = net_income / shares_outstanding
            if eps > 0:
                info["trailingPE"] = current_price / eps

        # --- PBR (株価純資産倍率) ---
        if not info.get("priceToBook") and total_equity and current_price and shares_outstanding:
            bps = total_equity / shares_outstanding
            if bps > 0:
                info["priceToBook"] = current_price / bps

        # --- 時価総額 ---
        if not info.get("marketCap") and current_price and shares_outstanding:
            info["marketCap"] = current_price * shares_outstanding

        # --- フリーキャッシュフロー ---
        if not info.get("freeCashflow"):
            fcf = _safe_get_latest(cashflow, "Free Cash Flow")
            if fcf is not None:
                info["freeCashflow"] = fcf

        # --- 営業キャッシュフロー ---
        if not info.get("operatingCashflow"):
            ocf = _safe_get_latest(cashflow, "Operating Cash Flow")
            if ocf:
                info["operatingCashflow"] = ocf

        # --- 配当利回りの補完 ---
        if not info.get("dividendYield") and dividends is not None and not dividends.empty and current_price:
            # 直近1年間の配当合計
            one_year_ago = datetime.now() - timedelta(days=365)
            try:
                recent_divs = dividends[dividends.index >= one_year_ago]
                if not recent_divs.empty:
                    annual_div = float(recent_divs.sum())
                    if annual_div > 0 and current_price > 0:
                        info["dividendYield"] = annual_div / current_price
                        if not info.get("dividendRate"):
                            info["dividendRate"] = annual_div
            except Exception:
                pass

        # --- EPS ---
        if not info.get("trailingEps") and net_income and shares_outstanding:
            info["trailingEps"] = net_income / shares_outstanding

        # --- 売上成長率の補完 ---
        if not info.get("revenueGrowth") and financials is not None and not financials.empty:
            if "Total Revenue" in financials.index:
                revs = financials.loc["Total Revenue"].dropna()
                if len(revs) >= 2:
                    latest = float(revs.iloc[0])
                    prev = float(revs.iloc[1])
                    if prev > 0:
                        info["revenueGrowth"] = (latest - prev) / prev

        # --- EPS成長率の補完 ---
        if not info.get("earningsGrowth") and financials is not None and not financials.empty:
            if "Net Income" in financials.index:
                ni = financials.loc["Net Income"].dropna()
                if len(ni) >= 2:
                    latest_ni = float(ni.iloc[0])
                    prev_ni = float(ni.iloc[1])
                    if prev_ni > 0:
                        info["earningsGrowth"] = (latest_ni - prev_ni) / prev_ni

        # --- EV/EBITDA の補完 ---
        if not info.get("enterpriseToEbitda"):
            ebitda = _safe_get_latest(financials, "EBITDA")
            if not ebitda:
                # EBITDA = Operating Income + Depreciation
                depreciation = _safe_get_latest(cashflow, "Depreciation And Amortization")
                if operating_income and depreciation:
                    ebitda = operating_income + abs(depreciation)
            if ebitda and ebitda > 0:
                market_cap = info.get("marketCap", 0)
                total_debt_val = info.get("totalDebt", 0) or 0
                total_cash_val = info.get("totalCash", 0) or 0
                if market_cap:
                    ev = market_cap + total_debt_val - total_cash_val
                    info["enterpriseToEbitda"] = ev / ebitda

        # --- 配当性向の正規化（小数形式で統一）---
        if info.get("payoutRatio") is not None:
            info["payoutRatio"] = StockDataFetcher.normalize_percent(info["payoutRatio"], threshold=2)

        # --- 配当性向の補完 ---
        if not info.get("payoutRatio") and dividends is not None and not dividends.empty and net_income and shares_outstanding:
            one_year_ago = datetime.now() - timedelta(days=365)
            try:
                recent_divs = dividends[dividends.index >= one_year_ago]
                if not recent_divs.empty:
                    annual_div = float(recent_divs.sum())
                    eps = net_income / shares_outstanding
                    if eps > 0 and annual_div > 0:
                        info["payoutRatio"] = annual_div / eps
            except Exception:
                pass

        data["info"] = info

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
        """会社名を取得（ローカルDB優先、なければyfinance）"""
        ticker = StockDataFetcher.normalize_ticker(ticker)
        # まずローカルDBで検索
        local_name = get_name_by_code(ticker.replace(".T", ""))
        if local_name:
            return local_name
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
        if indicators["bb_middle"] and indicators["bb_middle"] != 0:
            bb_width = ((indicators["bb_upper"] - indicators["bb_lower"]) / indicators["bb_middle"]) * 100
        else:
            bb_width = 0
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
