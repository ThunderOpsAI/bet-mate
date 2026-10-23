"""Deterministic exotic racing and same-race multi calculators."""
from __future__ import annotations

from itertools import permutations, product
from math import prod
from typing import Iterable, Mapping, Sequence

MIN_UNIT_STAKE = 0.50
MIN_FLEXI_PERCENTAGE = 0.01
DEFAULT_CORRELATION_HAIRCUT = 0.15


def _require_count(count: int, minimum: int, label: str) -> None:
    if count < minimum:
        raise ValueError(f"{label} requires at least {minimum} selections")


def quinella_combinations(selection_count: int) -> int:
    _require_count(selection_count, 2, "Quinella")
    return selection_count * (selection_count - 1) // 2


def exacta_combinations(selection_count: int) -> int:
    _require_count(selection_count, 2, "Exacta")
    return selection_count * (selection_count - 1)


def trifecta_combinations(selection_count: int) -> int:
    _require_count(selection_count, 3, "Trifecta")
    return selection_count * (selection_count - 1) * (selection_count - 2)


def first4_combinations(selection_count: int) -> int:
    _require_count(selection_count, 4, "First 4")
    return selection_count * (selection_count - 1) * (selection_count - 2) * (selection_count - 3)


def positional_combinations(position_runner_ids: Sequence[Sequence[str]]) -> int:
    if not position_runner_ids:
        raise ValueError("At least one position is required")
    combos = 0
    for ordered in product(*position_runner_ids):
        if len(set(ordered)) == len(ordered):
            combos += 1
    return combos


def multi_race_combinations(leg_runner_ids: Sequence[Sequence[str]]) -> int:
    if not leg_runner_ids:
        raise ValueError("At least one race leg is required")
    counts = [len(set(leg)) for leg in leg_runner_ids]
    if any(count == 0 for count in counts):
        raise ValueError("Every race leg requires at least one runner")
    return prod(counts)


def flexi_percentage(stake: float, combinations: int) -> float:
    if stake < MIN_UNIT_STAKE:
        raise ValueError(f"Minimum unit stake is ${MIN_UNIT_STAKE:.2f}")
    if combinations <= 0:
        raise ValueError("Combinations must be greater than zero")
    flexi = stake / combinations
    if flexi < MIN_FLEXI_PERCENTAGE:
        raise ValueError("Minimum flexi percentage is 1%")
    return flexi


def _normalise_probabilities(probabilities: Mapping[str, float]) -> dict[str, float]:
    total = sum(max(0.0, float(value)) for value in probabilities.values())
    if total <= 0:
        raise ValueError("Runner probabilities are required")
    return {runner_id: max(0.0, float(value)) / total for runner_id, value in probabilities.items()}


def harville_order_probability(order: Sequence[str], probabilities: Mapping[str, float]) -> float:
    remaining = _normalise_probabilities(probabilities)
    probability = 1.0
    for runner_id in order:
        denominator = sum(remaining.values())
        if runner_id not in remaining or denominator <= 0:
            return 0.0
        probability *= remaining[runner_id] / denominator
        del remaining[runner_id]
    return probability


def top_n_probability(runner_id: str, top_n: int, probabilities: Mapping[str, float]) -> float:
    normalised = _normalise_probabilities(probabilities)
    if runner_id not in normalised:
        raise ValueError("Runner probability is missing")
    places = min(top_n, len(normalised))
    total = 0.0
    for order in permutations(normalised.keys(), places):
        if runner_id in order:
            total += harville_order_probability(order, normalised)
    return min(total, 1.0)


def same_race_multi_odds(legs: Sequence[Mapping[str, object]], probabilities: Mapping[str, float], haircut: float = DEFAULT_CORRELATION_HAIRCUT) -> dict[str, float]:
    if len(legs) < 2:
        raise ValueError("SRM requires at least two legs")
    leg_probabilities = [top_n_probability(str(leg["runner_id"]), int(leg["top_n"]), probabilities) for leg in legs]
    fair_probability = prod(leg_probabilities)
    adjusted_probability = min(fair_probability / max(1.0 - haircut, 0.01), 0.999999)
    return {
        "fair_probability": fair_probability,
        "fair_odds": 1 / fair_probability if fair_probability > 0 else 0,
        "adjusted_probability": adjusted_probability,
        "adjusted_odds": 1 / adjusted_probability if adjusted_probability > 0 else 0,
        "correlation_haircut": haircut,
    }
