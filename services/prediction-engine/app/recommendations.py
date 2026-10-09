"""BetMate Multi Recommendation Engine.

Provides algorithms for:
- Item 4: Auto-building multis to a target odds or target payout
- Item 5: Risk profile filtering (Safe, Balanced, Long-shot)
- Item 7: Leg-swap recommendations (replacing negative EV or correlated legs)
- Item 8: Weakest-leg detector (identifying edge drag or correlation penalties)
- Item 16: Daily Bob's Multis generation with transparent quantitative rationales
- Item 46: Fractional Kelly criterion stake sizing with override bounds
- Item 48: Multi health score A-F rating integration
"""
from __future__ import annotations

import itertools
from datetime import datetime, timezone
from math import prod
from typing import Any, Mapping, Sequence

import numpy as np

from app.sgm import (
    calculate_multi_health_score,
    calculate_sgm_odds,
    get_pairwise_correlation,
    score_multi_leg,
)
from app.time_utils import melbourne_date_string


# ---------------------------------------------------------------------------
# Item 46: Kelly Criterion Stake Sizing
# ---------------------------------------------------------------------------

def calculate_kelly_stake(
    combined_odds: float,
    true_prob: float,
    bankroll: float,
    fraction: float = 0.25,
    max_stake_pct: float = 0.05,
    min_stake: float = 1.0,
    max_stake: float | None = None,
) -> dict[str, Any]:
    """Calculate recommended bet stake using fractional Kelly criterion.
    
    Formula:
        b = decimal_odds - 1.0
        raw_kelly = (p * decimal_odds - 1.0) / b = edge / b
        adjusted_kelly = raw_kelly * fraction
        final_fraction = min(adjusted_kelly, max_stake_pct)
        recommended_stake = round(bankroll * final_fraction, 2)
    """
    odds = float(combined_odds)
    p = float(true_prob)
    roll = float(bankroll)
    frac = float(fraction)
    cap_pct = float(max_stake_pct)
    min_s = float(min_stake)

    if odds <= 1.0 or p <= 0.0 or roll <= 0.0:
        return {
            "combined_odds": odds,
            "true_prob": p,
            "bankroll": roll,
            "raw_kelly_fraction": 0.0,
            "fractional_multiplier": frac,
            "adjusted_fraction": 0.0,
            "recommended_fraction": 0.0,
            "recommended_stake": 0.0,
            "edge_pct": 0.0,
            "expected_return": 0.0,
            "expected_profit": 0.0,
            "is_positive_ev": False,
            "rationale": "Invalid odds, probability, or bankroll provided for Kelly calculation.",
        }

    b = odds - 1.0
    edge = (p * odds) - 1.0
    edge_pct = round(edge * 100.0, 2)

    if edge <= 0.0:
        return {
            "combined_odds": round(odds, 2),
            "true_prob": round(p, 4),
            "bankroll": round(roll, 2),
            "raw_kelly_fraction": 0.0,
            "fractional_multiplier": frac,
            "adjusted_fraction": 0.0,
            "recommended_fraction": 0.0,
            "recommended_stake": 0.0,
            "edge_pct": edge_pct,
            "expected_return": 0.0,
            "expected_profit": 0.0,
            "is_positive_ev": False,
            "rationale": (
                f"Negative or zero EV ({edge_pct:+.1f}% edge at ${odds:.2f} odds). "
                f"Kelly criterion recommends $0.00 stake."
            ),
        }

    raw_kelly = edge / b
    adjusted_fraction = raw_kelly * frac
    final_fraction = min(adjusted_fraction, cap_pct)

    raw_stake = roll * final_fraction
    if max_stake is not None and float(max_stake) > 0:
        raw_stake = min(raw_stake, float(max_stake))

    if raw_stake < min_s:
        recommended_stake = 0.0
        below_min = True
    else:
        recommended_stake = round(raw_stake, 2)
        below_min = False

    expected_return = round(recommended_stake * odds * p, 2)
    expected_profit = round(recommended_stake * edge, 2)

    if below_min:
        rationale = (
            f"Calculated fractional Kelly stake (${raw_stake:.2f}) is below minimum bet size "
            f"(${min_s:.2f}) for ${roll:.2f} bankroll. Recommended stake is $0.00."
        )
    else:
        capped_note = " (capped at max limit)" if adjusted_fraction > cap_pct else ""
        rationale = (
            f"Fractional Kelly ({frac:.2f}x) suggests ${recommended_stake:.2f} stake "
            f"({final_fraction * 100:.2f}% of ${roll:.2f} bankroll){capped_note} "
            f"based on {edge_pct:+.1f}% EV at ${odds:.2f} odds."
        )

    return {
        "combined_odds": round(odds, 2),
        "true_prob": round(p, 4),
        "bankroll": round(roll, 2),
        "raw_kelly_fraction": round(raw_kelly, 4),
        "fractional_multiplier": frac,
        "adjusted_fraction": round(adjusted_fraction, 4),
        "recommended_fraction": round(final_fraction, 4),
        "recommended_stake": recommended_stake,
        "edge_pct": edge_pct,
        "expected_return": expected_return,
        "expected_profit": expected_profit,
        "is_positive_ev": True,
        "rationale": rationale,
    }


# ---------------------------------------------------------------------------
# Item 8: Weakest-Leg Detector
# ---------------------------------------------------------------------------

def detect_weakest_leg(
    legs: Sequence[Mapping[str, Any]],
    sport: str = "nba",
) -> dict[str, Any]:
    """Detect the weakest leg in a multi based on negative EV, correlation conflict, or hit rate."""
    if not legs:
        return {
            "weakest_leg_index": -1,
            "weakest_leg": None,
            "weakness_score": 0.0,
            "reason": "No legs provided to analyze.",
            "severity": "none",
            "scored_legs": [],
            "pairwise_impacts": [],
        }

    k = len(legs)
    scored_legs = [score_multi_leg(leg, sport=sport) for leg in legs]

    if k == 1:
        scored = scored_legs[0]
        severity = "critical" if scored["edge_pct"] < 0 else "minor"
        return {
            "weakest_leg_index": 0,
            "weakest_leg": scored,
            "weakness_score": 10.0 if scored["edge_pct"] < 0 else 1.0,
            "reason": f"Single leg multi: {scored['rationale']}",
            "severity": severity,
            "scored_legs": scored_legs,
            "pairwise_impacts": [],
        }

    # Evaluate pairwise correlations for each leg
    pairwise_impacts: list[dict[str, Any]] = []
    leg_min_rhos: list[float] = [1.0] * k
    leg_neg_rhos: list[list[float]] = [[] for _ in range(k)]

    for i in range(k):
        for j in range(i + 1, k):
            rho = get_pairwise_correlation(
                str(legs[i].get("market_type", "")),
                str(legs[j].get("market_type", "")),
                sport=sport,
            )
            pairwise_impacts.append({
                "leg_a": i,
                "leg_b": j,
                "rho": round(rho, 3),
            })
            if rho < leg_min_rhos[i]:
                leg_min_rhos[i] = rho
            if rho < leg_min_rhos[j]:
                leg_min_rhos[j] = rho
            if rho < -0.05:
                leg_neg_rhos[i].append(rho)
                leg_neg_rhos[j].append(rho)

    # Compute a weakness metric for each leg
    weakness_scores: list[float] = []
    for i, scored in enumerate(scored_legs):
        score = 0.0
        edge_pct = scored["edge_pct"]
        calibrated_prob = scored["calibrated_prob"]
        odds = scored["odds"]

        # 1. Negative EV penalty (heaviest penalty)
        if edge_pct < 0:
            score += abs(edge_pct) * 4.0 + 20.0
        elif edge_pct < 2.0:
            score += (2.0 - edge_pct) * 2.0

        # 2. Negative correlation penalty
        if leg_neg_rhos[i]:
            neg_sum = sum(abs(r) for r in leg_neg_rhos[i])
            score += neg_sum * 35.0

        # 3. Hit probability penalty
        if calibrated_prob < 0.25:
            score += (0.25 - calibrated_prob) * 25.0

        # 4. Long shot with thin edge penalty
        if odds > 4.0 and edge_pct < 5.0:
            score += 10.0

        weakness_scores.append(round(score, 2))
        scored["weakness_score"] = round(score, 2)
        scored["min_rho"] = round(leg_min_rhos[i], 3)

    worst_idx = int(np.argmax(weakness_scores))
    worst_scored = scored_legs[worst_idx]
    worst_min_rho = leg_min_rhos[worst_idx]

    # Diagnose primary reason and severity
    if worst_min_rho < -0.15:
        reason = (
            f"Severe negative correlation with another leg (ρ = {worst_min_rho:.2f}), "
            f"conflicting with game script and cutting joint probability."
        )
        severity = "critical"
    elif worst_scored["edge_pct"] < 0:
        reason = (
            f"Negative EV ({worst_scored['edge_pct']:+.1f}% edge at ${worst_scored['odds']:.2f} odds), "
            f"directly destroying multi value."
        )
        severity = "critical"
    elif worst_min_rho < -0.05:
        reason = (
            f"Mild negative correlation (ρ = {worst_min_rho:.2f}) working against the multi."
        )
        severity = "warning"
    elif worst_scored["edge_pct"] < 2.0:
        reason = (
            f"Lowest edge in multi ({worst_scored['edge_pct']:+.1f}%), offering thin reward for added risk."
        )
        severity = "warning"
    elif worst_scored["calibrated_prob"] < 0.30:
        reason = (
            f"Lowest hit probability ({worst_scored['calibrated_prob']:.1%}) with minimal value cushion."
        )
        severity = "warning"
    else:
        reason = (
            f"Lowest relative contribution ({worst_scored['edge_pct']:+.1f}% edge at ${worst_scored['odds']:.2f} odds)."
        )
        severity = "minor"

    return {
        "weakest_leg_index": worst_idx,
        "weakest_leg": worst_scored,
        "weakness_score": weakness_scores[worst_idx],
        "reason": reason,
        "severity": severity,
        "scored_legs": scored_legs,
        "pairwise_impacts": pairwise_impacts,
    }


# ---------------------------------------------------------------------------
# Item 7: Leg-Swap Recommendations
# ---------------------------------------------------------------------------

def recommend_leg_swaps(
    legs: Sequence[Mapping[str, Any]],
    candidate_pool: Sequence[Mapping[str, Any]],
    sport: str = "nba",
    max_swaps: int = 3,
) -> dict[str, Any]:
    """Recommend replacing the weakest or negative EV leg with a positive EV alternative."""
    if not legs or len(legs) < 2:
        return {
            "status": "insufficient_legs",
            "message": "A multi must have at least two legs to evaluate swaps.",
            "swaps": [],
            "count": 0,
            "weakest_leg": None,
            "original_health": None,
        }

    weakest_result = detect_weakest_leg(legs, sport=sport)
    orig_sgm = calculate_sgm_odds(legs, sport=sport)

    if not candidate_pool:
        return {
            "status": "no_candidates",
            "message": "No candidates available in pool for swap suggestions.",
            "swaps": [],
            "count": 0,
            "weakest_leg": weakest_result["weakest_leg"],
            "original_health": orig_sgm["multi_health"],
        }

    weakest_idx = weakest_result["weakest_leg_index"]
    indices_to_consider = {weakest_idx}

    # Also consider replacing any other negative EV legs
    for idx, scored in enumerate(weakest_result["scored_legs"]):
        if scored["edge_pct"] < 0:
            indices_to_consider.add(idx)

    existing_selections = {
        str(l.get("selection") or l.get("selectionLabel") or l.get("leg_description") or "").lower()
        for l in legs
    }

    scored_candidates = []
    for cand in candidate_pool:
        cand_desc = str(cand.get("selection") or cand.get("selectionLabel") or cand.get("leg_description") or "")
        if cand_desc.lower() in existing_selections:
            continue

        scored_cand = score_multi_leg(cand, sport=sport)
        if scored_cand["edge_pct"] > 0:
            scored_candidates.append(cand)

    valid_swaps = []
    for idx in indices_to_consider:
        orig_leg = legs[idx]
        orig_edge = weakest_result["scored_legs"][idx]["edge_pct"]

        for cand in scored_candidates:
            trial_legs = list(legs)
            trial_legs[idx] = cand

            trial_sgm = calculate_sgm_odds(trial_legs, sport=sport)

            ev_improvement = round(trial_sgm["combined_edge_pct"] - orig_sgm["combined_edge_pct"], 2)
            score_improvement = trial_sgm["health_score"] - orig_sgm["health_score"]

            cand_score = score_multi_leg(cand, sport=sport)
            cand_edge = cand_score["edge_pct"]

            # Accept if EV improves or Health improves, or replacement transforms negative edge to positive
            if ev_improvement > 0 or score_improvement > 0 or (orig_edge < 0 and cand_edge > 0):
                cand_selection = str(cand.get("selection") or cand.get("selectionLabel") or cand.get("leg_description") or "Candidate")
                orig_selection = str(orig_leg.get("selection") or orig_leg.get("selectionLabel") or orig_leg.get("leg_description") or f"Leg {idx+1}")

                rationale = (
                    f"Replaces {orig_selection} ({orig_edge:+.1f}% EV) with {cand_selection} ({cand_edge:+.1f}% EV), "
                    f"raising multi EV by {ev_improvement:+.1f}% and Health Score from "
                    f"{orig_sgm['health_score']} ({orig_sgm['health_grade']}) to {trial_sgm['health_score']} ({trial_sgm['health_grade']})."
                )

                rank_metric = (ev_improvement * 2.0) + score_improvement + (10.0 if trial_sgm['health_score'] >= 80 else 0.0)

                valid_swaps.append({
                    "original_leg_index": idx,
                    "original_leg": dict(orig_leg),
                    "replacement_leg": dict(cand),
                    "ev_improvement": ev_improvement,
                    "health_score_before": orig_sgm["health_score"],
                    "health_score_after": trial_sgm["health_score"],
                    "health_grade_before": orig_sgm["health_grade"],
                    "health_grade_after": trial_sgm["health_grade"],
                    "correlation_score_before": orig_sgm["correlation_score"],
                    "correlation_score_after": trial_sgm["correlation_score"],
                    "new_combined_odds": trial_sgm["combined_odds"],
                    "new_combined_edge_pct": trial_sgm["combined_edge_pct"],
                    "rationale": rationale,
                    "rank_metric": rank_metric,
                })

    valid_swaps.sort(key=lambda s: s["rank_metric"], reverse=True)
    top_swaps = valid_swaps[:max_swaps]

    for s in top_swaps:
        s.pop("rank_metric", None)

    return {
        "status": "swaps_found" if top_swaps else "no_qualifying_swaps",
        "message": "Swaps found." if top_swaps else "No qualifying replacement legs improved multi EV or health.",
        "swaps": top_swaps,
        "count": len(top_swaps),
        "weakest_leg": weakest_result["weakest_leg"],
        "original_health": orig_sgm["multi_health"],
    }


# ---------------------------------------------------------------------------
# Items 4 & 5: Auto-Build Multi to Target Payout / Odds & Risk Profile
# ---------------------------------------------------------------------------

RISK_PROFILES = {
    "safe": {
        "name": "Safe",
        "min_hit_prob": 0.50,
        "max_odds": 2.10,
        "min_edge_pct": -2.0,  # low odds legs often have tight lines, but prefer positive EV
        "target_legs": (2, 3),
        "default_target_odds": 2.50,
        "description": "Low odds legs, high hit probability, low variance anchor legs.",
    },
    "balanced": {
        "name": "Balanced",
        "min_hit_prob": 0.30,
        "max_odds": 3.50,
        "min_edge_pct": 1.0,
        "target_legs": (2, 4),
        "default_target_odds": 4.50,
        "description": "Moderate odds with positive edge and healthy risk-adjusted return.",
    },
    "long_shot": {
        "name": "Long Shot",
        "min_hit_prob": 0.10,
        "max_odds": 12.00,
        "min_edge_pct": 0.0,
        "target_legs": (3, 5),
        "default_target_odds": 10.00,
        "description": "Higher payouts, elevated upside with disciplined positive model edge.",
    },
}


def auto_build_multi(
    candidate_pool: Sequence[Mapping[str, Any]],
    target_odds: float | None = None,
    target_payout: float | None = None,
    stake: float | None = None,
    risk_profile: str = "balanced",
    sports: Sequence[str] | str | None = None,
    min_legs: int = 2,
    max_legs: int = 5,
) -> dict[str, Any]:
    """Auto-build an optimal multi targeting desired payout/odds with chosen risk profile.
    
    Zero mock fallback: Returns explicit empty state when no candidates qualify.
    """
    profile_key = risk_profile.lower().replace("-", "_").replace(" ", "_")
    profile_cfg = RISK_PROFILES.get(profile_key, RISK_PROFILES["balanced"])

    # Determine effective target odds
    if target_odds is not None and float(target_odds) > 1.0:
        eff_target_odds = float(target_odds)
    elif target_payout is not None and stake is not None and float(stake) > 0:
        eff_target_odds = float(target_payout) / float(stake)
    elif target_payout is not None:
        eff_target_odds = float(target_payout) / 10.0
    else:
        eff_target_odds = float(profile_cfg["default_target_odds"])

    eff_target_odds = max(1.10, eff_target_odds)

    if not candidate_pool:
        return {
            "status": "no_qualifying_candidates",
            "message": "Candidate pool is empty.",
            "risk_profile": profile_cfg["name"],
            "target_odds": round(eff_target_odds, 2),
            "actual_odds": 0.0,
            "legs": [],
            "combined_edge_pct": 0.0,
            "health_grade": "N/A",
            "health_score": 0,
            "kelly_recommendation": None,
            "rationale": "No candidate legs provided.",
        }

    # Filter candidates by sport
    pool = list(candidate_pool)
    if sports:
        allowed = [s.lower() for s in sports] if isinstance(sports, (list, tuple, set)) else [str(sports).lower()]
        pool = [c for c in pool if str(c.get("sport", "nba")).lower() in allowed]

    # Filter candidates by risk profile constraints
    eligible = []
    for c in pool:
        odds = float(c.get("odds") or c.get("best_odds") or c.get("back_price") or 0.0)
        if odds <= 1.0:
            continue

        sport_c = str(c.get("sport", "nba"))
        scored = score_multi_leg(c, sport=sport_c)

        if scored["odds"] > profile_cfg["max_odds"] * 1.25:
            continue
        if scored["calibrated_prob"] < profile_cfg["min_hit_prob"] * 0.75:
            continue
        if scored["edge_pct"] < profile_cfg["min_edge_pct"] - 5.0:
            continue

        eligible.append(c)

    if len(eligible) < min_legs:
        return {
            "status": "no_qualifying_candidates",
            "message": (
                f"Only {len(eligible)} candidates qualified for '{profile_cfg['name']}' risk profile. "
                f"At least {min_legs} legs required."
            ),
            "risk_profile": profile_cfg["name"],
            "target_odds": round(eff_target_odds, 2),
            "actual_odds": 0.0,
            "legs": [],
            "combined_edge_pct": 0.0,
            "health_grade": "N/A",
            "health_score": 0,
            "kelly_recommendation": None,
            "rationale": "Insufficient qualified candidates matching risk profile criteria.",
        }

    # Sort eligible candidates by edge descending, limiting search pool to top 16 for combinatorial speed
    eligible.sort(
        key=lambda c: float(c.get("edge_pct") or (float(c.get("edge", 0.0)) * 100.0)),
        reverse=True,
    )
    search_pool = eligible[:16]

    best_combo = None
    best_loss = float("inf")
    best_sgm = None

    k_min = max(2, min_legs)
    k_max = min(len(search_pool), max_legs)

    for k in range(k_min, k_max + 1):
        for combo in itertools.combinations(search_pool, k):
            # Check unique selections
            selections = [
                str(leg.get("selection") or leg.get("selectionLabel") or leg.get("leg_description") or "")
                for leg in combo
            ]
            if len(set(selections)) < len(combo):
                continue

            raw_odds = prod(float(leg.get("odds") or leg.get("best_odds") or 1.9) for leg in combo)
            if raw_odds < eff_target_odds * 0.3 or raw_odds > eff_target_odds * 3.5:
                continue

            sport_multi = str(combo[0].get("sport", "nba"))
            sgm_res = calculate_sgm_odds(combo, sport=sport_multi)

            actual_odds = sgm_res["combined_odds"]
            edge_pct = sgm_res["combined_edge_pct"]
            health_score = sgm_res["health_score"]
            has_neg_corr = any(w["level"] == "negative" for w in sgm_res["pairwise_warnings"])

            # Proximity error %
            odds_diff_ratio = abs(actual_odds - eff_target_odds) / eff_target_odds

            # Objective loss (lower is better)
            loss = (odds_diff_ratio * 100.0) - (edge_pct * 0.4) - (health_score * 0.25)
            if has_neg_corr:
                loss += 50.0  # heavy penalty for conflicting legs
            if edge_pct < 0:
                loss += 40.0  # penalty for negative EV

            if loss < best_loss:
                best_loss = loss
                best_combo = combo
                best_sgm = sgm_res

    if best_combo is None or best_sgm is None:
        return {
            "status": "no_qualifying_candidates",
            "message": "Could not construct a valid multi matching target odds and risk constraints.",
            "risk_profile": profile_cfg["name"],
            "target_odds": round(eff_target_odds, 2),
            "actual_odds": 0.0,
            "legs": [],
            "combined_edge_pct": 0.0,
            "health_grade": "N/A",
            "health_score": 0,
            "kelly_recommendation": None,
            "rationale": "No combination met the target odds without severe correlation conflicts.",
        }

    # Kelly stake calculation
    kelly = calculate_kelly_stake(
        combined_odds=best_sgm["combined_odds"],
        true_prob=best_sgm["adjusted_probability"],
        bankroll=1000.0,
        fraction=0.25,
    )

    odds_diff_pct = round(abs(best_sgm["combined_odds"] - eff_target_odds) / eff_target_odds * 100.0, 1)
    payout = round(best_sgm["combined_odds"] * stake, 2) if stake is not None and stake > 0 else None

    rationale = (
        f"Auto-built {len(best_combo)}-leg '{profile_cfg['name']}' multi targeting ${eff_target_odds:.2f} odds. "
        f"Resulting price is ${best_sgm['combined_odds']:.2f} (diff {odds_diff_pct}%) with "
        f"{best_sgm['combined_edge_pct']:+.1f}% EV and Health Grade {best_sgm['health_grade']} "
        f"({best_sgm['health_score']}/100)."
    )

    return {
        "status": "success",
        "risk_profile": profile_cfg["name"],
        "target_odds": round(eff_target_odds, 2),
        "actual_odds": best_sgm["combined_odds"],
        "adjusted_odds": best_sgm["adjusted_odds"],
        "odds_difference_pct": odds_diff_pct,
        "estimated_payout": payout,
        "legs": best_sgm["scored_legs"],
        "leg_count": len(best_combo),
        "combined_edge_pct": best_sgm["combined_edge_pct"],
        "expected_value_10": best_sgm["expected_value_10"],
        "health_grade": best_sgm["health_grade"],
        "health_score": best_sgm["health_score"],
        "correlation_score": best_sgm["correlation_score"],
        "correlation_summary": best_sgm["correlation_summary"],
        "kelly_recommendation": kelly,
        "rationale": rationale,
    }


# ---------------------------------------------------------------------------
# Item 16: Daily Bob's Multis
# ---------------------------------------------------------------------------

def generate_bobs_multis(
    date: str | None = None,
    sports: Sequence[str] | str | None = None,
    candidate_pool: Sequence[Mapping[str, Any]] | None = None,
    bankroll: float = 1000.0,
) -> dict[str, Any]:
    """Generate daily Bob's Multis using live candidates and pricing engine outputs.
    
    Zero mock fallback: returns clean explicit empty state if no qualified candidates.
    """
    card_date = melbourne_date_string(date) if date else melbourne_date_string()

    # Retrieve candidate pool
    if candidate_pool is not None:
        candidates = list(candidate_pool)
    else:
        try:
            import app.storage as storage
            candidates = storage.get_daily_ev_feed(limit=100)
        except Exception:
            candidates = []

    if sports:
        allowed = [s.lower() for s in sports] if isinstance(sports, (list, tuple, set)) else [str(sports).lower()]
        candidates = [c for c in candidates if str(c.get("sport", "")).lower() in allowed]

    # Filter out non-positive EV candidates
    candidates = [
        c for c in candidates
        if float(c.get("edge_pct", 0.0)) > 0 or float(c.get("edge", 0.0)) > 0
    ]

    if not candidates:
        return {
            "date": card_date,
            "status": "no_qualifying_bets",
            "message": f"No qualifying positive-EV bets found for Bob's Daily Multi on {card_date}.",
            "multis": [],
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    generated_multis = []

    # 1. Flagship: Bob's Best Value Multi (Balanced profile, 2-3 legs)
    val_multi = auto_build_multi(
        candidate_pool=candidates,
        target_odds=4.20,
        risk_profile="balanced",
        sports=sports,
        min_legs=2,
        max_legs=3,
    )
    if val_multi["status"] == "success" and val_multi["combined_edge_pct"] > 0:
        val_multi["title"] = "Bob's Best Value Multi"
        val_multi["badge"] = "Flagship Value"
        val_multi["bob_rationale"] = (
            f"Bob's Flagship Multi for {card_date}: {val_multi['leg_count']} legs at ${val_multi['actual_odds']:.2f} odds. "
            f"Delivers +{val_multi['combined_edge_pct']:.1f}% EV with Health Grade {val_multi['health_grade']} "
            f"({val_multi['health_score']}/100). "
            f"Quarter-Kelly allocation: {val_multi['kelly_recommendation']['recommended_fraction']*100:.1f}% (${val_multi['kelly_recommendation']['recommended_stake']:.2f})."
        )
        generated_multis.append(val_multi)

    # 2. Bob's Safe Anchor Multi (Safe profile, 2 legs)
    safe_multi = auto_build_multi(
        candidate_pool=candidates,
        target_odds=2.40,
        risk_profile="safe",
        sports=sports,
        min_legs=2,
        max_legs=2,
    )
    if safe_multi["status"] == "success" and safe_multi["combined_edge_pct"] > -1.0:
        safe_multi["title"] = "Bob's Safe Anchor Multi"
        safe_multi["badge"] = "High Probability"
        safe_multi["bob_rationale"] = (
            f"Bob's Conservative Double for {card_date}: Anchored by high-probability legs totaling ${safe_multi['actual_odds']:.2f} odds. "
            f"Model Health Grade {safe_multi['health_grade']} ({safe_multi['health_score']}/100) with minimal correlation risk."
        )
        generated_multis.append(safe_multi)

    # 3. Bob's Long-Shot Value Multi (Long-shot profile, 3-4 legs)
    long_multi = auto_build_multi(
        candidate_pool=candidates,
        target_odds=9.50,
        risk_profile="long_shot",
        sports=sports,
        min_legs=3,
        max_legs=4,
    )
    if long_multi["status"] == "success" and long_multi["combined_edge_pct"] > 0:
        long_multi["title"] = "Bob's Long-Shot Multi"
        long_multi["badge"] = "High Upside"
        long_multi["bob_rationale"] = (
            f"Bob's High-Upside Multi for {card_date}: {long_multi['leg_count']} legs offering ${long_multi['actual_odds']:.2f} return. "
            f"Backed by +{long_multi['combined_edge_pct']:.1f}% model EV across disciplined positive-edge legs."
        )
        generated_multis.append(long_multi)

    if not generated_multis:
        return {
            "date": card_date,
            "status": "no_qualifying_bets",
            "message": f"Candidate legs did not satisfy multi risk-reward requirements on {card_date}.",
            "multis": [],
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    return {
        "date": card_date,
        "status": "success",
        "multis": generated_multis,
        "count": len(generated_multis),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
