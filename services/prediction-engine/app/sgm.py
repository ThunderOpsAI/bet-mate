"""Same-game multi Gaussian Copula correlation pricing engine."""
from __future__ import annotations

from math import prod
from typing import Any, Mapping, Sequence
import numpy as np
from scipy.stats import norm, multivariate_normal

DEFAULT_CORRELATION_FALLBACK = 0.10

SPORT_CORRELATION_MATRIX: dict[str, dict[tuple[str, str], float]] = {
    "nba": {
        ("head_to_head", "spread"): 0.14,
        ("moneyline", "spread"): 0.14,
        ("spread", "total_points"): 0.08,
        ("head_to_head", "total_points"): 0.07,
        ("player_points", "team_total"): 0.22,
        ("player_points", "total_points"): 0.18,
        ("player_points", "player_assists"): 0.12,
        ("player_points", "player_rebounds"): -0.25,
        ("player_rebounds", "total_points"): 0.06,
        ("player_assists", "player_threes"): 0.15,
        ("player_points", "player_threes"): 0.35,
    },
    "nfl": {
        ("head_to_head", "spread"): 0.15,
        ("moneyline", "spread"): 0.15,
        ("spread", "total_points"): 0.08,
        ("head_to_head", "total_points"): 0.09,
        ("player_pass_yds", "player_pass_tds"): 0.38,
        ("player_pass_yds", "player_rec_yds"): 0.45,
        ("player_pass_tds", "player_rec_yds"): 0.35,
        ("player_pass_tds", "total_points"): 0.22,
        ("player_rush_yds", "player_pass_yds"): -0.25,
        ("player_rush_yds", "spread"): 0.18,
        ("player_anytime_td", "total_points"): 0.24,
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
    return float(prod(probabilities))


def get_pairwise_correlation(market_a: str, market_b: str, sport: str = "nba") -> float:
    """Return pairwise Pearson correlation coefficient between two markets."""
    if market_a.lower() == market_b.lower():
        return 1.0

    matrix = SPORT_CORRELATION_MATRIX.get(sport.lower(), {})
    pair = (market_a.lower(), market_b.lower())
    reverse_pair = (market_b.lower(), market_a.lower())

    if pair in matrix:
        return matrix[pair]
    if reverse_pair in matrix:
        return matrix[reverse_pair]

    return DEFAULT_CORRELATION_FALLBACK


def build_correlation_matrix(legs: Sequence[Mapping[str, object]], sport: str = "nba") -> np.ndarray:
    """Construct a positive semi-definite correlation matrix for the active legs."""
    k = len(legs)
    corr = np.eye(k)
    for i in range(k):
        for j in range(i + 1, k):
            rho = get_pairwise_correlation(
                str(legs[i].get("market_type", "")),
                str(legs[j].get("market_type", "")),
                sport=sport,
            )
            corr[i, j] = rho
            corr[j, i] = rho

    # Ensure matrix is positive semi-definite by eigenvalue thresholding
    eigenvalues, eigenvectors = np.linalg.eigh(corr)
    if np.any(eigenvalues < 1e-6):
        eigenvalues = np.maximum(eigenvalues, 1e-4)
        corr = eigenvectors @ np.diag(eigenvalues) @ eigenvectors.T
        diag_inv_sqrt = 1.0 / np.sqrt(np.diag(corr))
        corr = diag_inv_sqrt[:, None] * corr * diag_inv_sqrt[None, :]

    return corr


def calculate_copula_joint_probability(probabilities: Sequence[float], correlation_matrix: np.ndarray) -> float:
    """Compute Gaussian Copula joint probability for correlated events."""
    k = len(probabilities)
    probs_clipped = np.clip(probabilities, 1e-5, 1.0 - 1e-5)
    z = norm.ppf(probs_clipped)
    mean = np.zeros(k)

    try:
        joint_p = multivariate_normal.cdf(z, mean=mean, cov=correlation_matrix)
        return float(np.clip(joint_p, 1e-6, 0.999999))
    except Exception:
        # Fallback to independent product
        return float(prod(probabilities))


def analyze_pairwise_warnings(legs: Sequence[Mapping[str, object]], sport: str = "nba") -> list[dict[str, Any]]:
    """Generate warnings for UI based on pairwise correlation levels."""
    warnings: list[dict[str, Any]] = []
    k = len(legs)
    for i in range(k):
        for j in range(i + 1, k):
            rho = get_pairwise_correlation(
                str(legs[i].get("market_type", "")),
                str(legs[j].get("market_type", "")),
                sport=sport,
            )
            if rho > 0.40:
                warning_level = "high"
                warning_color = "red"
                message = f"High positive correlation (ρ = +{rho:.2f})"
            elif rho > 0.20:
                warning_level = "mild"
                warning_color = "yellow"
                message = f"Mild positive correlation (ρ = +{rho:.2f})"
            elif rho < -0.20:
                warning_level = "negative"
                warning_color = "blue"
                message = f"Negative correlation (ρ = {rho:.2f})"
            else:
                warning_level = "none"
                warning_color = "gray"
                message = f"Weak correlation (ρ = {rho:.2f})"

            warnings.append({
                "leg_a_index": i,
                "leg_b_index": j,
                "leg_a_desc": str(legs[i].get("leg_description") or legs[i].get("selectionLabel") or legs[i].get("selection") or f"Leg {i+1}"),
                "leg_b_desc": str(legs[j].get("leg_description") or legs[j].get("selectionLabel") or legs[j].get("selection") or f"Leg {j+1}"),
                "rho": round(rho, 3),
                "level": warning_level,
                "color": warning_color,
                "message": message,
            })
    return warnings


def calculate_sgm_odds(legs: Sequence[Mapping[str, object]], sport: str = "nba") -> dict[str, Any]:
    """Calculate SGM odds and true probability using Gaussian Copula."""
    if len(legs) < 2:
        raise ValueError("SGM requires at least two legs")

    probabilities = [
        float(leg.get("probability") or (float(leg.get("true_prob")) if leg.get("true_prob") else None) or probability_from_odds(float(leg["odds"])))
        for leg in legs
    ]
    fair_probability = combine_independent_probabilities(legs)
    corr_matrix = build_correlation_matrix(legs, sport=sport)
    copula_probability = calculate_copula_joint_probability(probabilities, corr_matrix)

    # Haircut is the relative difference between independent and copula joint probability
    if copula_probability > 0:
        haircut = max(0.0, 1.0 - (fair_probability / copula_probability))
    else:
        haircut = 0.15

    # Bounds for consistency with legacy reporting
    haircut = round(float(np.clip(haircut, 0.05, 0.50)), 4)
    adjusted_probability = round(copula_probability, 6)

    warnings = analyze_pairwise_warnings(legs, sport=sport)
    max_rho = max([w["rho"] for w in warnings], default=0.0)

    # Standard combined parlay odds
    combined_odds = round(float(prod([float(leg.get("odds", 1.0)) for leg in legs])), 2)
    # Expected value per $10 stake
    # EV = ($10 * combined_odds * copula_probability) - $10
    expected_value_10 = round((10.0 * combined_odds * copula_probability) - 10.0, 2)
    combined_edge_pct = round(((copula_probability * combined_odds) - 1.0) * 100.0, 2)

    return {
        "fair_probability": round(fair_probability, 6),
        "fair_odds": round(1.0 / fair_probability, 2) if fair_probability > 0 else 0.0,
        "adjusted_probability": adjusted_probability,
        "adjusted_odds": round(1.0 / adjusted_probability, 2) if adjusted_probability > 0 else 0.0,
        "correlation_haircut": haircut,
        "combined_odds": combined_odds,
        "combined_edge_pct": combined_edge_pct,
        "expected_value_10": expected_value_10,
        "max_rho": max_rho,
        "pairwise_warnings": warnings,
        "has_high_correlation": any(w["level"] == "high" for w in warnings),
        "has_mild_correlation": any(w["level"] == "mild" for w in warnings),
    }
