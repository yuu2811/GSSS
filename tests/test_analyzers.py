"""Smoke tests for each analyzer's analyze() method with mock data."""

import pandas as pd
import numpy as np

from analyzers.morgan_technical import MorganTechnical
from analyzers.morgan_dcf import MorganDCF
from analyzers.goldman_screener import GoldmanScreener
from analyzers.blackrock_dividend import BlackRockDividend
from analyzers.bridgewater_risk import BridgewaterRisk
from analyzers.jpmorgan_earnings import JPMorganEarnings
from analyzers.academic_quant import AcademicQuant
from analyzers.renaissance_quant import RenaissanceQuant
from analyzers.chart_pattern import ChartPattern


# ── MorganTechnical ──

def test_morgan_technical_smoke(mock_stock_data):
    result = MorganTechnical.analyze(mock_stock_data)
    assert result["analyzer"] == MorganTechnical.NAME
    assert "trend" in result
    assert "rsi_analysis" in result
    assert "macd_analysis" in result
    assert result["ticker"] == "9999.T"


def test_morgan_technical_empty_history(mock_stock_data):
    mock_stock_data["history"] = None
    result = MorganTechnical.analyze(mock_stock_data)
    assert "error" in result


# ── MorganDCF ──

def test_morgan_dcf_smoke(mock_stock_data):
    result = MorganDCF.analyze(mock_stock_data)
    assert result["analyzer"] == MorganDCF.NAME
    assert "wacc" in result
    assert "valuation" in result
    assert "verdict" in result
    assert result["valuation"]["per_share_average"] > 0


def test_morgan_dcf_no_financials(mock_stock_data):
    mock_stock_data["financials"] = None
    mock_stock_data["cashflow"] = None
    result = MorganDCF.analyze(mock_stock_data)
    assert result["analyzer"] == MorganDCF.NAME
    assert "wacc" in result


def test_morgan_dcf_zero_shares(mock_stock_data):
    mock_stock_data["info"]["sharesOutstanding"] = 0
    result = MorganDCF.analyze(mock_stock_data)
    assert result["valuation"]["per_share_average"] == 0


# ── GoldmanScreener ──

def test_goldman_screener_smoke(mock_stock_data):
    result = GoldmanScreener.analyze(mock_stock_data)
    assert result["analyzer"] == GoldmanScreener.NAME
    assert "pe_analysis" in result
    assert "summary" in result


def test_goldman_screener_no_pe(mock_stock_data):
    mock_stock_data["info"].pop("trailingPE", None)
    mock_stock_data["info"].pop("forwardPE", None)
    result = GoldmanScreener.analyze(mock_stock_data)
    assert result["pe_analysis"]["assessment"] == "データなし"


def test_goldman_screener_no_price(mock_stock_data):
    mock_stock_data["info"]["currentPrice"] = 0
    mock_stock_data["info"]["regularMarketPrice"] = 0
    result = GoldmanScreener.analyze(mock_stock_data)
    assert result["entry_zones"] == {}


# ── BlackRockDividend ──

def test_blackrock_dividend_smoke(mock_stock_data):
    result = BlackRockDividend.analyze(mock_stock_data)
    assert result["analyzer"] == BlackRockDividend.NAME
    assert "yield_analysis" in result
    assert "growth_analysis" in result
    assert "safety" in result
    assert result["safety"]["score"] >= 1
    assert result["safety"]["score"] <= 10


def test_blackrock_dividend_no_dividends(mock_stock_data):
    mock_stock_data["dividends"] = pd.Series(dtype=float)
    mock_stock_data["info"]["dividendYield"] = 0
    mock_stock_data["info"]["dividendRate"] = None
    result = BlackRockDividend.analyze(mock_stock_data)
    assert result["yield_analysis"]["current_yield_pct"] == 0


def test_blackrock_dividend_yield_trap(mock_stock_data):
    mock_stock_data["info"]["dividendYield"] = 0.08
    mock_stock_data["info"]["payoutRatio"] = 0.95
    result = BlackRockDividend.analyze(mock_stock_data)
    assert result["yield_trap"]["is_potential_trap"] is True


# ── BridgewaterRisk ──

def test_bridgewater_risk_smoke(mock_stock_data):
    result = BridgewaterRisk.analyze(mock_stock_data)
    assert result["analyzer"] == BridgewaterRisk.NAME
    assert "volatility" in result
    assert "stress_test" in result


def test_bridgewater_risk_empty_history(mock_stock_data):
    mock_stock_data["history"] = None
    result = BridgewaterRisk.analyze(mock_stock_data)
    assert "error" in result


# ── JPMorganEarnings ──

def test_jpmorgan_earnings_smoke(mock_stock_data):
    result = JPMorganEarnings.analyze(mock_stock_data)
    assert result["analyzer"] == JPMorganEarnings.NAME
    assert "consensus" in result


def test_jpmorgan_earnings_no_earnings_dates(mock_stock_data):
    mock_stock_data["earnings_dates"] = pd.DataFrame()
    result = JPMorganEarnings.analyze(mock_stock_data)
    assert result["earnings_history"]["summary"] == "決算データなし"


# ── AcademicQuant ──

def test_academic_quant_smoke(mock_stock_data):
    result = AcademicQuant.analyze(mock_stock_data)
    assert result["analyzer"] == AcademicQuant.NAME
    assert "composite_academic_score" in result
    assert result["composite_academic_score"]["total_score"] >= 0


# ── RenaissanceQuant ──

def test_renaissance_quant_smoke(mock_stock_data):
    result = RenaissanceQuant.analyze(mock_stock_data)
    assert result["analyzer"] == RenaissanceQuant.NAME
    assert "composite_score" in result
    assert 0 <= result["composite_score"]["total_score"] <= 100


# ── ChartPattern ──

def test_chart_pattern_smoke(mock_stock_data):
    result = ChartPattern.analyze(mock_stock_data)
    assert result["analyzer"] == ChartPattern.NAME
    assert "signals_summary" in result
    assert "classical_patterns" in result
    assert "candlestick_patterns" in result


def test_chart_pattern_empty_history(mock_stock_data):
    mock_stock_data["history"] = None
    result = ChartPattern.analyze(mock_stock_data)
    assert "error" in result


def test_chart_pattern_short_history(mock_stock_data):
    # Only 10 days of data
    mock_stock_data["history"] = mock_stock_data["history"].tail(10)
    result = ChartPattern.analyze(mock_stock_data)
    assert result["analyzer"] == ChartPattern.NAME
