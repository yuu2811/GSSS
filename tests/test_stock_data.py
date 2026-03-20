"""Tests for StockDataFetcher static helpers (no network calls)."""

import pandas as pd
import numpy as np

from analyzers.stock_data import StockDataFetcher


# ── get_display_name ──

def test_display_name_long():
    assert StockDataFetcher.get_display_name({"longName": "Toyota"}, "7203.T") == "Toyota"


def test_display_name_short_fallback():
    assert StockDataFetcher.get_display_name({"shortName": "TM"}, "7203.T") == "TM"


def test_display_name_ticker_fallback():
    assert StockDataFetcher.get_display_name({}, "7203.T") == "7203.T"


# ── get_current_price ──

def test_current_price():
    assert StockDataFetcher.get_current_price({"currentPrice": 1500}) == 1500


def test_current_price_fallback():
    assert StockDataFetcher.get_current_price({"regularMarketPrice": 2000}) == 2000


def test_current_price_zero_when_missing():
    assert StockDataFetcher.get_current_price({}) == 0


# ── normalize_percent ──

def test_normalize_percent_decimal():
    assert StockDataFetcher.normalize_percent(0.05) == 0.05


def test_normalize_percent_large():
    assert StockDataFetcher.normalize_percent(15.0) == 0.15


def test_normalize_percent_none():
    assert StockDataFetcher.normalize_percent(None) is None


def test_normalize_percent_negative():
    assert StockDataFetcher.normalize_percent(-0.5) == -0.5


def test_normalize_percent_negative_large():
    assert StockDataFetcher.normalize_percent(-25.0) == -0.25


# ── normalize_ticker ──

def test_normalize_ticker_digits():
    assert StockDataFetcher.normalize_ticker("7203") == "7203.T"


def test_normalize_ticker_already_suffixed():
    assert StockDataFetcher.normalize_ticker("7203.T") == "7203.T"


def test_normalize_ticker_index():
    assert StockDataFetcher.normalize_ticker("^N225") == "^N225"


# ── _safe_get_latest ──

def test_safe_get_latest_returns_value():
    df = pd.DataFrame({"2024": [100], "2023": [90]}, index=["Revenue"])
    assert StockDataFetcher._safe_get_latest(df, "Revenue") == 100.0


def test_safe_get_latest_none_when_empty():
    assert StockDataFetcher._safe_get_latest(None, "Revenue") is None
    assert StockDataFetcher._safe_get_latest(pd.DataFrame(), "Revenue") is None


def test_safe_get_latest_missing_row():
    df = pd.DataFrame({"2024": [100]}, index=["Revenue"])
    assert StockDataFetcher._safe_get_latest(df, "Net Income") is None


# ── _set_if_missing ──

def test_set_if_missing_adds():
    info = {}
    StockDataFetcher._set_if_missing(info, "foo", 42)
    assert info["foo"] == 42


def test_set_if_missing_preserves_existing():
    info = {"foo": 10}
    StockDataFetcher._set_if_missing(info, "foo", 42)
    assert info["foo"] == 10


def test_set_if_missing_preserves_zero():
    info = {"foo": 0}
    StockDataFetcher._set_if_missing(info, "foo", 42)
    assert info["foo"] == 0


def test_set_if_missing_skips_none_value():
    info = {}
    StockDataFetcher._set_if_missing(info, "foo", None)
    assert "foo" not in info


# ── calculate_technical_indicators ──

def _make_history(n=250):
    """Generate a simple uptrending history DataFrame."""
    dates = pd.date_range("2024-01-01", periods=n, freq="B")
    close = pd.Series(np.linspace(1000, 1500, n), index=dates)
    return pd.DataFrame({
        "Open": close - 5,
        "High": close + 10,
        "Low": close - 10,
        "Close": close,
        "Volume": [1_000_000] * n,
    })


def test_technical_indicators_keys():
    history = _make_history()
    ind = StockDataFetcher.calculate_technical_indicators(history)
    assert "current_price" in ind
    assert "sma_20" in ind
    assert "sma_50" in ind
    assert "rsi" in ind
    assert "macd" in ind
    assert "bb_upper" in ind


def test_technical_indicators_short_history():
    history = _make_history(5)
    ind = StockDataFetcher.calculate_technical_indicators(history)
    # With very short history, the function may return limited data
    assert isinstance(ind, dict)


# ── calculate_fibonacci_levels ──

def test_fibonacci_levels():
    history = _make_history()
    fib = StockDataFetcher.calculate_fibonacci_levels(history)
    assert "high" in fib
    assert "low" in fib
    # Fibonacci uses level_XXX keys
    assert "level_236" in fib
    assert "level_382" in fib
    assert "level_500" in fib
    assert fib["high"] >= fib["low"]
