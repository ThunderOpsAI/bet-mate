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


def simulate_copula_joint_probability(
    probabilities: Sequence[float],
    correlation_matrix: np.ndarray,
    n_samples: int = 50000,
    seed: int | None = None,
) -> float:
    """Compute Gaussian Copula joint probability via Monte Carlo simulation (Item 2)."""
    k = len(probabilities)
    if k == 0:
        return 0.0
    if k == 1:
        return float(np.clip(probabilities[0], 0.0, 1.0))

    probs_clipped = np.clip(probabilities, 1e-5, 1.0 - 1e-5)
    z_thresholds = norm.ppf(probs_clipped)
    mean = np.zeros(k)

    rng = np.random.default_rng(seed)
    try:
        samples = rng.multivariate_normal(mean, correlation_matrix, size=n_samples)
        successes = np.all(samples <= z_thresholds, axis=1)
        sim_p = float(np.mean(successes))
        max_bound = float(min(probabilities))
        return float(np.clip(sim_p, 1e-6, max_bound))
    except Exception:
        return float(prod(probabilities))


def score_multi_leg(leg: Mapping[str, object], sport: str = "nba") -> dict[str, Any]:
    """Score an individual leg with calibrated probability, edge %, confidence level, and concise rationale (Item 1)."""
    odds = float(leg.get("odds") or leg.get("best_odds") or leg.get("back_price") or 1.90)
    if odds <= 1.0:
        odds = 1.01

    implied_prob = round(1.0 / odds, 4)

    raw_prob = (
        leg.get("calibrated_prob")
        or leg.get("true_prob")
        or leg.get("probability")
        or leg.get("model_probability")
    )
    if raw_prob is not None:
        p = float(raw_prob)
        if p > 1.0:
            p = p / 100.0
        calibrated_prob = float(np.clip(p, 0.001, 0.999))
    else:
        calibrated_prob = implied_prob

    # Edge formula: edge = (true_prob * odds) - 1.0
    edge = (calibrated_prob * odds) - 1.0
    edge_pct = round(edge * 100.0, 2)

    if edge_pct >= 8.0 or calibrated_prob >= 0.65:
        confidence = "high"
    elif edge_pct >= 3.0 or calibrated_prob >= 0.45:
        confidence = "medium"
    else:
        confidence = "low"

    selection = str(
        leg.get("selection")
        or leg.get("selectionLabel")
        or leg.get("leg_description")
        or leg.get("selection_name")
        or "Leg"
    )
    market_type = str(leg.get("market_type") or "head_to_head")

    if edge_pct > 0:
        rationale = f"+{edge_pct:.1f}% edge at ${odds:.2f} odds ({calibrated_prob:.1%} model vs {implied_prob:.1%} implied) - {confidence} confidence"
    elif edge_pct < 0:
        rationale = f"{edge_pct:.1f}% edge at ${odds:.2f} odds ({calibrated_prob:.1%} model vs {implied_prob:.1%} implied) - {confidence} confidence"
    else:
        rationale = f"Neutral value at ${odds:.2f} odds ({calibrated_prob:.1%} implied) - {confidence} confidence"

    return {
        "selection": selection,
        "market_type": market_type,
        "odds": round(odds, 2),
        "implied_prob": implied_prob,
        "calibrated_prob": round(calibrated_prob, 4),
        "edge": round(edge, 4),
        "edge_pct": edge_pct,
        "confidence": confidence,
        "rationale": rationale,
    }


def calculate_multi_correlation_score(
    legs: Sequence[Mapping[str, object]],
    sport: str = "nba",
) -> dict[str, Any]:
    """Calculate multi-wide and pairwise correlation scores across all legs (Item 3)."""
    k = len(legs)
    if k < 2:
        return {
            "score": 0.0,
            "index": 50.0,
            "direction": "neutral",
            "strength": "none",
            "summary": "Single leg has no correlation.",
            "pairwise_count": 0,
            "mean_rho": 0.0,
        }

    rhos = []
    for i in range(k):
        for j in range(i + 1, k):
            rho = get_pairwise_correlation(
                str(legs[i].get("market_type", "")),
                str(legs[j].get("market_type", "")),
                sport=sport,
            )
            rhos.append(rho)

    mean_rho = float(np.mean(rhos)) if rhos else 0.0
    score = round(float(np.clip(mean_rho, -1.0, 1.0)), 4)
    index = round(float(np.clip((score + 1.0) * 50.0, 0.0, 100.0)), 1)

    if score > 0.20:
        direction = "positive"
        strength = "strong"
        summary = f"Legs strongly reinforce each other (average ρ = +{score:.2f})."
    elif score > 0.05:
        direction = "positive"
        strength = "mild"
        summary = f"Legs positively reinforce each other (average ρ = +{score:.2f})."
    elif score < -0.20:
        direction = "negative"
        strength = "strong"
        summary = f"Legs strongly conflict with each other (average ρ = {score:.2f})."
    elif score < -0.05:
        direction = "negative"
        strength = "mild"
        summary = f"Legs work against each other (average ρ = {score:.2f})."
    else:
        direction = "neutral"
        strength = "neutral"
        summary = f"Legs are largely independent (average ρ = {score:.2f})."

    return {
        "score": score,
        "index": index,
        "direction": direction,
        "strength": strength,
        "summary": summary,
        "pairwise_count": len(rhos),
        "mean_rho": score,
    }


def evaluate_bookie_sgm_price(
    model_fair_odds: float,
    adjusted_probability: float,
    bookie_odds: float | None = None,
    combined_parlay_odds: float | None = None,
) -> dict[str, Any]:
    """Compare bookmaker SGM price against model fair price and evaluate house margin vs EV (Item 10)."""
    if combined_parlay_odds is None or combined_parlay_odds <= 1.0:
        combined_parlay_odds = model_fair_odds

    if bookie_odds is not None and float(bookie_odds) > 1.0:
        eff_bookie_odds = float(bookie_odds)
        source = "explicit"
    else:
        eff_bookie_odds = float(combined_parlay_odds)
        source = "combined_parlay"

    eff_bookie_odds = round(eff_bookie_odds, 2)
    fair_odds = round(float(model_fair_odds), 2)
    p_model = float(np.clip(adjusted_probability, 1e-6, 1.0))
    p_bookie_implied = round(1.0 / eff_bookie_odds, 4) if eff_bookie_odds > 1 else 1.0

    ev = (p_model * eff_bookie_odds) - 1.0
    ev_pct = round(ev * 100.0, 2)
    ev_10 = round((10.0 * eff_bookie_odds * p_model) - 10.0, 2)

    margin_pct = round(max(0.0, (1.0 - (eff_bookie_odds / fair_odds)) * 100.0), 2) if fair_odds > 0 else 0.0
    is_value = bool(ev_pct > 0.0)

    if is_value:
        summary = (
            f"Value Bet! Bookie price ${eff_bookie_odds:.2f} beats model fair price ${fair_odds:.2f} "
            f"(+{ev_pct:.1f}% EV, ${ev_10:+.2f} per $10 stake)."
        )
    else:
        summary = (
            f"Bookie margin: {margin_pct:.1f}%. Model fair price ${fair_odds:.2f} vs Bookie ${eff_bookie_odds:.2f} "
            f"({ev_pct:.1f}% EV, ${ev_10:+.2f} per $10 stake)."
        )

    return {
        "bookie_odds": eff_bookie_odds,
        "bookie_odds_source": source,
        "model_fair_odds": fair_odds,
        "model_true_probability": round(p_model, 4),
        "bookie_implied_probability": p_bookie_implied,
        "bookie_margin_pct": margin_pct,
        "model_ev_pct": ev_pct,
        "model_ev_10": ev_10,
        "is_value_bet": is_value,
        "summary": summary,
    }


def calculate_multi_health_score(
    combined_edge_pct: float,
    correlation_score: float,
    scored_legs: Sequence[Mapping[str, Any]],
    has_negative_correlation: bool = False,
) -> dict[str, Any]:
    """Calculate multi health grade (A, B, C, D, F) and 0-100 score (Item 48 / Phase 1 preparation)."""
    score = 50.0

    # EV contribution (-30 to +30 pts)
    if combined_edge_pct >= 20.0:
        score += 30.0
    elif combined_edge_pct >= 10.0:
        score += 20.0
    elif combined_edge_pct >= 3.0:
        score += 12.0
    elif combined_edge_pct >= 0.0:
        score += 5.0
    elif combined_edge_pct >= -10.0:
        score -= 5.0
    elif combined_edge_pct >= -25.0:
        score -= 18.0
    else:
        score -= 30.0

    # Correlation structure (-20 to +15 pts)
    if correlation_score > 0.15:
        score += 15.0
    elif correlation_score > 0.0:
        score += 8.0
    elif correlation_score < -0.20 or has_negative_correlation:
        score -= 20.0
    elif correlation_score < -0.05:
        score -= 10.0

    # Leg quality and count
    k = len(scored_legs)
    positive_legs = sum(1 for leg in scored_legs if float(leg.get("edge_pct", 0)) > 0)
    low_conf_legs = sum(1 for leg in scored_legs if leg.get("confidence") == "low")

    if k > 0:
        score += ((positive_legs / k) * 15.0)

    if k <= 3:
        score += 5.0
    elif k >= 6:
        score -= 10.0

    if low_conf_legs > 0:
        score -= min(15.0, low_conf_legs * 5.0)

    total_score = int(np.clip(round(score), 0, 100))

    if total_score >= 80:
        grade = "A"
    elif total_score >= 65:
        grade = "B"
    elif total_score >= 50:
        grade = "C"
    elif total_score >= 35:
        grade = "D"
    else:
        grade = "F"

    summary = (
        f"Health Grade {grade} ({total_score}/100): "
        f"{combined_edge_pct:+.1f}% EV, {positive_legs}/{k} legs with positive edge, "
        f"correlation index {int(np.clip((correlation_score + 1.0) * 50.0, 0, 100))}."
    )

    return {
        "grade": grade,
        "score": total_score,
        "summary": summary,
        "combined_edge_pct": round(combined_edge_pct, 2),
        "correlation_score": round(correlation_score, 4),
        "positive_legs_ratio": round(positive_legs / max(1, k), 2),
    }


def calculate_sgm_odds(
    legs: Sequence[Mapping[str, object]],
    sport: str = "nba",
    bookie_odds: float | None = None,
    method: str = "copula",
) -> dict[str, Any]:
    """Calculate SGM odds, true probability, leg scores, correlation index, bookie evaluation, and health."""
    if len(legs) < 2:
        raise ValueError("SGM requires at least two legs")

    probabilities = [
        float(leg.get("probability") or (float(leg.get("true_prob")) if leg.get("true_prob") else None) or probability_from_odds(float(leg["odds"])))
        for leg in legs
    ]
    fair_probability = combine_independent_probabilities(legs)
    corr_matrix = build_correlation_matrix(legs, sport=sport)

    if method == "monte_carlo":
        copula_probability = simulate_copula_joint_probability(probabilities, corr_matrix)
    else:
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
    expected_value_10 = round((10.0 * combined_odds * copula_probability) - 10.0, 2)
    combined_edge_pct = round(((copula_probability * combined_odds) - 1.0) * 100.0, 2)
    adjusted_odds = round(1.0 / adjusted_probability, 2) if adjusted_probability > 0 else 0.0

    # Item 1: Leg-level scoring
    scored_legs = [score_multi_leg(leg, sport=sport) for leg in legs]

    # Item 3: Multi-wide correlation score
    corr_eval = calculate_multi_correlation_score(legs, sport=sport)

    # Item 10: Bookie SGM price vs Model fair price evaluation
    bookie_comp = evaluate_bookie_sgm_price(
        model_fair_odds=adjusted_odds,
        adjusted_probability=adjusted_probability,
        bookie_odds=bookie_odds,
        combined_parlay_odds=combined_odds,
    )

    # Item 48 / Phase 1: Multi health score
    health = calculate_multi_health_score(
        combined_edge_pct=combined_edge_pct,
        correlation_score=corr_eval["score"],
        scored_legs=scored_legs,
        has_negative_correlation=any(w["level"] == "negative" for w in warnings),
    )

    return {
        "fair_probability": round(fair_probability, 6),
        "fair_odds": round(1.0 / fair_probability, 2) if fair_probability > 0 else 0.0,
        "adjusted_probability": adjusted_probability,
        "adjusted_odds": adjusted_odds,
        "correlation_haircut": haircut,
        "combined_odds": combined_odds,
        "combined_edge_pct": combined_edge_pct,
        "expected_value_10": expected_value_10,
        "max_rho": max_rho,
        "pairwise_warnings": warnings,
        "warnings": warnings,
        "has_high_correlation": any(w["level"] == "high" for w in warnings),
        "has_mild_correlation": any(w["level"] == "mild" for w in warnings),
        "scored_legs": scored_legs,
        "correlation_score": corr_eval["score"],
        "correlation_index": corr_eval["index"],
        "correlation_direction": corr_eval["direction"],
        "correlation_summary": corr_eval["summary"],
        "correlation_details": corr_eval,
        "bookie_comparison": bookie_comp,
        "bookie_odds": bookie_comp["bookie_odds"],
        "bookie_margin_pct": bookie_comp["bookie_margin_pct"],
        "health_grade": health["grade"],
        "health_score": health["score"],
        "health_summary": health["summary"],
        "multi_health": health,
    }

