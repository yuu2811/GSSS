"""Tests for analyzers.scoring module."""

from analyzers.scoring import weighted_composite, DEFAULT_RATING_THRESHOLDS


def test_weighted_composite_basic():
    scores = {"a": 80, "b": 60}
    weights = {"a": 0.6, "b": 0.4}
    result = weighted_composite(scores, weights)
    assert result["total_score"] == 72.0  # 80*0.6 + 60*0.4
    assert result["max_score"] == 100
    assert result["rating"] == "非常に魅力的"
    assert result["recommendation"] == "強い買い推奨"


def test_weighted_composite_low_score():
    scores = {"x": 10, "y": 20}
    weights = {"x": 0.5, "y": 0.5}
    result = weighted_composite(scores, weights)
    assert result["total_score"] == 15.0
    assert result["rating"] == "弱い"


def test_weighted_composite_zero():
    scores = {"a": 0}
    weights = {"a": 1.0}
    result = weighted_composite(scores, weights)
    assert result["total_score"] == 0.0
    assert result["rating"] == "弱い"
    assert result["recommendation"] == "見送り推奨"


def test_weighted_composite_custom_thresholds():
    thresholds = [
        (90, "S", "super"),
        (50, "A", "good"),
        (0, "B", "ok"),
    ]
    scores = {"a": 70}
    weights = {"a": 1.0}
    result = weighted_composite(scores, weights, thresholds=thresholds)
    assert result["rating"] == "A"
    assert result["recommendation"] == "good"


def test_weighted_composite_weights_formatted():
    scores = {"alpha": 50, "beta": 50}
    weights = {"alpha": 0.7, "beta": 0.3}
    result = weighted_composite(scores, weights)
    assert result["weights"]["alpha"] == "70%"
    assert result["weights"]["beta"] == "30%"


def test_weighted_composite_factor_scores_preserved():
    scores = {"a": 42, "b": 88}
    weights = {"a": 0.5, "b": 0.5}
    result = weighted_composite(scores, weights)
    assert result["factor_scores"] is scores


def test_default_thresholds_boundaries():
    weights = {"s": 1.0}
    # Exactly at boundary
    assert weighted_composite({"s": 70}, weights)["rating"] == "非常に魅力的"
    assert weighted_composite({"s": 55}, weights)["rating"] == "魅力的"
    assert weighted_composite({"s": 40}, weights)["rating"] == "中立"
    assert weighted_composite({"s": 25}, weights)["rating"] == "やや弱い"
    # Just below boundary
    assert weighted_composite({"s": 69.9}, weights)["rating"] == "魅力的"
    assert weighted_composite({"s": 24.9}, weights)["rating"] == "弱い"
