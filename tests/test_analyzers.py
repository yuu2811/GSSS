"""Smoke tests for each analyzer's analyze() method with mock data."""

from analyzers.morgan_technical import MorganTechnical
from analyzers.morgan_dcf import MorganDCF
from analyzers.goldman_screener import GoldmanScreener
from analyzers.blackrock_dividend import BlackRockDividend
from analyzers.bridgewater_risk import BridgewaterRisk
from analyzers.jpmorgan_earnings import JPMorganEarnings
from analyzers.academic_quant import AcademicQuant
from analyzers.renaissance_quant import RenaissanceQuant


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
    # Should still produce a result using defaults
    assert "wacc" in result


# ── GoldmanScreener ──

def test_goldman_screener_smoke(mock_stock_data):
    result = GoldmanScreener.analyze(mock_stock_data)
    assert result["analyzer"] == GoldmanScreener.NAME
    assert "pe_analysis" in result
    assert "summary" in result


# ── BlackRockDividend ──

def test_blackrock_dividend_smoke(mock_stock_data):
    result = BlackRockDividend.analyze(mock_stock_data)
    assert result["analyzer"] == BlackRockDividend.NAME
    assert "yield_analysis" in result
    assert "growth_analysis" in result
    assert "safety" in result
    assert result["safety"]["score"] >= 1
    assert result["safety"]["score"] <= 10


# ── BridgewaterRisk ──

def test_bridgewater_risk_smoke(mock_stock_data):
    result = BridgewaterRisk.analyze(mock_stock_data)
    assert result["analyzer"] == BridgewaterRisk.NAME
    assert "volatility" in result


# ── JPMorganEarnings ──

def test_jpmorgan_earnings_smoke(mock_stock_data):
    result = JPMorganEarnings.analyze(mock_stock_data)
    assert result["analyzer"] == JPMorganEarnings.NAME
    assert "consensus" in result


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
