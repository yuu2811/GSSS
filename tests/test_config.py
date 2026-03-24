"""Tests for analyzers.config module."""

from analyzers.config import (
    score_by_brackets,
    PE_BRACKETS, DE_BRACKETS, DIVIDEND_YIELD_BRACKETS,
    PAYOUT_RATIO_BRACKETS, VOLATILITY_ANNUAL_BRACKETS,
    BETA_BRACKETS, RENAISSANCE_WEIGHTS, ACADEMIC_WEIGHTS,
)


class TestScoreByBrackets:
    def test_none_value_returns_default(self):
        label, score = score_by_brackets(None, PE_BRACKETS)
        assert label == "データなし"
        assert score == 5

    def test_pe_undervalued(self):
        label, score = score_by_brackets(8, PE_BRACKETS)
        assert "割安" in label
        assert score == 9

    def test_pe_overvalued(self):
        label, score = score_by_brackets(35, PE_BRACKETS)
        assert "割高" in label
        assert score == 2

    def test_pe_fair(self):
        label, score = score_by_brackets(17, PE_BRACKETS)
        assert "適正" in label
        assert score == 5

    def test_de_very_healthy(self):
        label, score = score_by_brackets(0.2, DE_BRACKETS)
        assert "健全" in label
        assert score == 10

    def test_de_high_risk(self):
        label, score = score_by_brackets(3.0, DE_BRACKETS)
        assert "リスク" in label
        assert score == 2

    def test_dividend_yield_brackets(self):
        label, _ = score_by_brackets(6, DIVIDEND_YIELD_BRACKETS)
        assert "高配当" in label

    def test_volatility_brackets(self):
        label, _ = score_by_brackets(0.10, VOLATILITY_ANNUAL_BRACKETS)
        assert label == "低い"

    def test_beta_brackets(self):
        label, _ = score_by_brackets(0.5, BETA_BRACKETS)
        assert "ディフェンシブ" in label

    def test_brackets_without_score(self):
        brackets = [(10, "low"), (20, "mid"), (float("inf"), "high")]
        label, score = score_by_brackets(5, brackets)
        assert label == "low"
        assert score is None


class TestWeightsConsistency:
    def test_renaissance_weights_sum_to_one(self):
        total = sum(RENAISSANCE_WEIGHTS.values())
        assert abs(total - 1.0) < 0.01

    def test_academic_weights_sum_to_one(self):
        total = sum(ACADEMIC_WEIGHTS.values())
        assert abs(total - 1.0) < 0.01
