"""Tests for analyzers.base module."""

import pandas as pd
import numpy as np
import pytest

from analyzers.base import BaseAnalyzer


class TestExtractHeader:
    def test_basic_extraction(self, mock_stock_data):
        header = BaseAnalyzer.extract_header(mock_stock_data)
        assert header["ticker"] == "9999.T"
        assert header["company_name"] == "テスト株式会社"
        assert header["current_price"] == 1500
        assert header["sector"] == "Technology"

    def test_missing_info(self):
        data = {"ticker": "1234.T", "info": {}}
        header = BaseAnalyzer.extract_header(data)
        assert header["company_name"] == "1234.T"
        assert header["current_price"] == 0
        assert header["sector"] == "不明"


class TestRequireHistory:
    def test_returns_error_when_none(self):
        data = {"history": None}
        result = BaseAnalyzer.require_history(data, "TestAnalyzer")
        assert result is not None
        assert "error" in result

    def test_returns_error_when_empty(self):
        data = {"history": pd.DataFrame()}
        result = BaseAnalyzer.require_history(data, "TestAnalyzer")
        assert result is not None

    def test_returns_none_when_valid(self, mock_stock_data):
        result = BaseAnalyzer.require_history(mock_stock_data, "TestAnalyzer")
        assert result is None


class TestSafeDivide:
    def test_normal_division(self):
        assert BaseAnalyzer.safe_divide(10, 2) == 5.0

    def test_zero_denominator(self):
        assert BaseAnalyzer.safe_divide(10, 0) == 0

    def test_none_denominator(self):
        assert BaseAnalyzer.safe_divide(10, None) == 0

    def test_none_numerator(self):
        assert BaseAnalyzer.safe_divide(None, 5) == 0

    def test_custom_default(self):
        assert BaseAnalyzer.safe_divide(10, 0, default=-1) == -1


class TestClamp:
    def test_within_range(self):
        assert BaseAnalyzer.clamp(50) == 50

    def test_below_minimum(self):
        assert BaseAnalyzer.clamp(-10) == 0

    def test_above_maximum(self):
        assert BaseAnalyzer.clamp(150) == 100

    def test_custom_range(self):
        assert BaseAnalyzer.clamp(5, low=1, high=10) == 5
        assert BaseAnalyzer.clamp(0, low=1, high=10) == 1
        assert BaseAnalyzer.clamp(15, low=1, high=10) == 10


class TestPctChangeSafe:
    def test_normal(self):
        assert abs(BaseAnalyzer.pct_change_safe(110, 100) - 0.1) < 0.001

    def test_zero_previous(self):
        assert BaseAnalyzer.pct_change_safe(110, 0) == 0

    def test_none_values(self):
        assert BaseAnalyzer.pct_change_safe(None, 100) == 0
        assert BaseAnalyzer.pct_change_safe(110, None) == 0


class TestFormatLargeNumber:
    def test_trillion(self):
        assert "兆" in BaseAnalyzer.format_large_number(2e12)

    def test_billion(self):
        assert "億" in BaseAnalyzer.format_large_number(5e10)

    def test_none(self):
        assert BaseAnalyzer.format_large_number(None) == "N/A"

    def test_small(self):
        result = BaseAnalyzer.format_large_number(1234)
        assert "¥" in result
