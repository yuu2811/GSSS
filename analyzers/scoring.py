"""共通スコアリングユーティリティ — 複数のアナライザーで共有される計算ロジック"""

from __future__ import annotations

from typing import Any

# レーティング閾値のデフォルト（スコア降順）
RatingThreshold = tuple[float, str, str]

DEFAULT_RATING_THRESHOLDS: list[RatingThreshold] = [
    (70, "非常に魅力的", "強い買い推奨"),
    (55, "魅力的", "買い推奨"),
    (40, "中立", "保持/様子見"),
    (25, "やや弱い", "慎重に検討"),
    (0, "弱い", "見送り推奨"),
]


def weighted_composite(
    scores: dict[str, float],
    weights: dict[str, float],
    thresholds: list[RatingThreshold] | None = None,
) -> dict[str, Any]:
    """重み付け複合スコアを計算し、レーティングと推奨を返す。

    Args:
        scores: {ファクター名: スコア} — 0-100
        weights: {ファクター名: 重み} — 合計1.0
        thresholds: [(下限, rating, recommendation), ...] 降順。Noneならデフォルト使用。

    Returns:
        dict with total_score, max_score, factor_scores, weights, rating, recommendation
    """
    if thresholds is None:
        thresholds = DEFAULT_RATING_THRESHOLDS

    total = sum(scores[k] * weights[k] for k in weights)

    rating = thresholds[-1][1]
    recommendation = thresholds[-1][2]
    for threshold, r, rec in thresholds:
        if total >= threshold:
            rating = r
            recommendation = rec
            break

    return {
        "total_score": round(total, 1),
        "max_score": 100,
        "factor_scores": scores,
        "weights": {k: f"{v*100:.0f}%" for k, v in weights.items()},
        "rating": rating,
        "recommendation": recommendation,
    }
