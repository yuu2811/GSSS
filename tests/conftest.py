"""Shared test fixtures for analyzer tests."""

import pandas as pd
import numpy as np
import pytest


@pytest.fixture
def mock_info():
    """Minimal yfinance-like info dict."""
    return {
        "longName": "テスト株式会社",
        "shortName": "テスト",
        "currentPrice": 1500,
        "regularMarketPrice": 1500,
        "marketCap": 100_000_000_000,
        "sharesOutstanding": 66_666_667,
        "trailingPE": 15.0,
        "forwardPE": 13.0,
        "priceToBook": 1.5,
        "returnOnEquity": 0.12,
        "returnOnAssets": 0.05,
        "operatingMargins": 0.15,
        "profitMargins": 0.10,
        "revenueGrowth": 0.08,
        "earningsGrowth": 0.10,
        "dividendYield": 0.025,
        "dividendRate": 37.5,
        "payoutRatio": 0.35,
        "debtToEquity": 0.5,
        "freeCashflow": 10_000_000_000,
        "totalCash": 20_000_000_000,
        "totalDebt": 15_000_000_000,
        "totalRevenue": 200_000_000_000,
        "beta": 1.1,
        "fiftyTwoWeekHigh": 1800,
        "fiftyTwoWeekLow": 1200,
        "enterpriseToEbitda": 8.5,
        "trailingEps": 100,
        "sector": "Technology",
        "industry": "Software",
        "fiveYearAvgDividendYield": 2.0,
        "exDividendDate": 1700000000,
    }


@pytest.fixture
def mock_history():
    """250-day price history DataFrame."""
    n = 250
    dates = pd.date_range("2024-01-01", periods=n, freq="B")
    np.random.seed(42)
    close = 1000 + np.cumsum(np.random.randn(n) * 5)
    close = pd.Series(close, index=dates)
    return pd.DataFrame({
        "Open": close - 3,
        "High": close + 10,
        "Low": close - 10,
        "Close": close,
        "Volume": np.random.randint(500_000, 2_000_000, n),
    })


@pytest.fixture
def mock_financials():
    """Simple financials DataFrame."""
    years = pd.to_datetime(["2024-03-31", "2023-03-31", "2022-03-31"])
    return pd.DataFrame({
        years[0]: [200e9, 30e9, 20e9],
        years[1]: [185e9, 27e9, 18e9],
        years[2]: [170e9, 25e9, 16e9],
    }, index=["Total Revenue", "Operating Income", "Net Income"])


@pytest.fixture
def mock_cashflow():
    """Simple cashflow DataFrame."""
    years = pd.to_datetime(["2024-03-31", "2023-03-31", "2022-03-31"])
    return pd.DataFrame({
        years[0]: [25e9, 10e9],
        years[1]: [22e9, 8e9],
        years[2]: [20e9, 7e9],
    }, index=["Operating Cash Flow", "Free Cash Flow"])


@pytest.fixture
def mock_balance_sheet():
    """Simple balance sheet DataFrame."""
    years = pd.to_datetime(["2024-03-31", "2023-03-31"])
    return pd.DataFrame({
        years[0]: [300e9, 200e9, 100e9, 50e9],
        years[1]: [280e9, 190e9, 90e9, 45e9],
    }, index=["Total Assets", "Stockholders Equity", "Total Debt", "Total Current Assets"])


@pytest.fixture
def mock_dividends():
    """Dividend history Series."""
    dates = pd.to_datetime([
        "2024-09-01", "2024-03-01",
        "2023-09-01", "2023-03-01",
        "2022-09-01", "2022-03-01",
        "2021-09-01", "2021-03-01",
    ])
    return pd.Series([20, 17.5, 18, 16, 16, 14, 14, 12], index=dates)


@pytest.fixture
def mock_earnings_dates():
    """Earnings dates DataFrame."""
    dates = pd.to_datetime([
        "2024-10-30", "2024-07-31", "2024-04-26", "2024-01-31",
        "2023-10-30", "2023-07-28", "2023-04-28", "2023-01-31",
    ])
    return pd.DataFrame({
        "EPS Estimate": [105, 100, 95, 90, 85, 80, 75, 70],
        "Reported EPS": [110, 102, 98, 88, 90, 82, 73, 72],
        "Surprise(%)": [4.8, 2.0, 3.2, -2.2, 5.9, 2.5, -2.7, 2.9],
    }, index=dates)


@pytest.fixture
def mock_stock_data(mock_info, mock_history, mock_financials, mock_cashflow,
                    mock_balance_sheet, mock_dividends, mock_earnings_dates):
    """Complete StockData dict."""
    return {
        "ticker": "9999.T",
        "info": mock_info,
        "history": mock_history,
        "financials": mock_financials,
        "cashflow": mock_cashflow,
        "balance_sheet": mock_balance_sheet,
        "dividends": mock_dividends,
        "earnings_dates": mock_earnings_dates,
    }
