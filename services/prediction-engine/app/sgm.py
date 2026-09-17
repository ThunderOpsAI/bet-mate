"""Same-game multi correlation pricing helpers."""
from __future__ import annotations

from math import prod
from typing import Mapping, Sequence

DEFAULT_CORRELATION_HAIRCUT = 0.15
SPORT_CORRELATION_MATRIX: dict[str, dict[tuple[str, str], float]] = {
    "nba": {
        ("head_to_head", "spread"): 0.12,
        ("spread", "total_points"): 0.08,
        ("player_points", "team_total"): 0.14,
        ("player_rebounds", "total_points"): 0.06,
    },
    "afl": {
        ("head_to_head", "line"): 0.12,
        ("line", "total_points"): 0.07,
    },
    "nrl": {
        ("head_to_head", "line"): 0.12,
        ("line", "total_points"): 0.07,
    },
}


def probability_from_odds(odds: float) -> float:
    if odds <= 1:
        raise ValueError("Decimal odds must be greater than 1")
    return 1 / odds


def combine_independent_probabilities(legs: Sequence[Mapping[str, object]]) -> float:
    if len(legs) < 2:
        raise ValueError("SGM requires at least two legs")
    probabilities = [float(leg.get("probability") or probability_from_odds(float(leg["odds"]))) for leg in legs]
    return prod(probabilities)


def correlation_haircut(legs: Sequence[Mapping[str, object]], sport: str) -> float:
    matrix = SPORT_CORRELATION_MATRIX.get(sport.lower(), {})
    market_types = [str(leg["market_type"]).lower() for leg in legs]
    deductions: list[float] = []
    for index, left in enumerate(market_types):
        for right in market_types[index + 1 :]:
            deductions.append(matrix.get((left, right), matrix.get((right, left), DEFAULT_CORRELATION_HAIRCUT)))
    return min(max(sum(deductions) / max(len(deductions), 1), 0.12), 0.18)


def calculate_sgm_odds(legs: Sequence[Mapping[str, object]], sport: str) -> dict[str, float]:
    fair_probability = combine_independent_probabilities(legs)
    haircut = correlation_haircut(legs, sport)
    adjusted_probability = min(fair_probability / max(1.0 - haircut, 0.01), 0.999999)
    return {
        "fair_probability": fair_probability,
        "fair_odds": 1 / fair_probability if fair_probability > 0 else 0,
        "adjusted_probability": adjusted_probability,
        "adjusted_odds": 1 / adjusted_probability if adjusted_probability > 0 else 0,
        "correlation_haircut": haircut,
    }
