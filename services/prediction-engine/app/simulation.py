"""Game-script simulation service and projection-vs-line edge engine (Items 28 & 38)."""
from __future__ import annotations

from typing import Any, Mapping, Sequence
import numpy as np
from scipy.stats import norm

# Standard sport parameters for game simulation
SPORT_SIM_DEFAULTS: dict[str, dict[str, float]] = {
    "nba": {
        "home_baseline": 112.0,
        "away_baseline": 108.0,
        "home_std": 12.0,
        "away_std": 12.0,
        "rho": 0.35,  # pace couples total points
        "blowout_threshold": 15.0,
        "close_threshold": 5.0,
    },
    "nfl": {
        "home_baseline": 24.0,
        "away_baseline": 21.0,
        "home_std": 10.0,
        "away_std": 10.0,
        "rho": 0.20,
        "blowout_threshold": 14.0,
        "close_threshold": 3.0,
    },
    "afl": {
        "home_baseline": 86.0,
        "away_baseline": 78.0,
        "home_std": 20.0,
        "away_std": 20.0,
        "rho": 0.15,
        "blowout_threshold": 30.0,
        "close_threshold": 12.0,
    },
    "nrl": {
        "home_baseline": 22.0,
        "away_baseline": 18.0,
        "home_std": 8.0,
        "away_std": 8.0,
        "rho": 0.15,
        "blowout_threshold": 16.0,
        "close_threshold": 6.0,
    },
    "soccer": {
        "home_baseline": 1.5,
        "away_baseline": 1.2,
        "home_std": 1.2,
        "away_std": 1.1,
        "rho": 0.10,
        "blowout_threshold": 3.0,
        "close_threshold": 1.0,
    },
}

# Empirical coefficient of variation (CV = std / mean) for player prop categories
STAT_CV_MAPPING: dict[str, float] = {
    "player_points": 0.28,
    "points": 0.28,
    "player_assists": 0.36,
    "assists": 0.36,
    "player_rebounds": 0.32,
    "rebounds": 0.32,
    "player_threes": 0.42,
    "threes": 0.42,
    "player_pass_yds": 0.24,
    "pass_yds": 0.24,
    "player_rush_yds": 0.38,
    "rush_yds": 0.38,
    "player_rec_yds": 0.36,
    "rec_yds": 0.36,
    "player_pass_tds": 0.50,
    "disposals": 0.22,
    "generic": 0.30,
}


def estimate_stat_std(projection: float, stat_type: str = "generic") -> float:
    """Estimate a realistic standard deviation for a stat based on empirical CV."""
    cv = STAT_CV_MAPPING.get(stat_type.lower(), STAT_CV_MAPPING["generic"])
    # Minimum floor based on stat scale
    if "pass_yds" in stat_type:
        min_floor = 18.0
    elif "rush_yds" in stat_type or "rec_yds" in stat_type:
        min_floor = 10.0
    elif "disposals" in stat_type:
        min_floor = 3.0
    elif "threes" in stat_type or "tds" in stat_type:
        min_floor = 0.8
    elif "points" in stat_type:
        min_floor = 2.5
    else:
        min_floor = 1.0

    return float(max(min_floor, projection * cv))


def calculate_projection_edge(
    projection: float,
    line: float,
    odds: float,
    side: str = "over",
    stat_type: str = "generic",
    std_dev: float | None = None,
    under_odds: float | None = None,
) -> dict[str, Any]:
    """Calculate projection vs market line edge, true probability, and confidence (Item 38).

    Edge formula: edge = (true_prob * odds) - 1.0
    """
    if odds <= 1.0:
        raise ValueError("Decimal odds must be strictly greater than 1.0")
    if line < 0:
        raise ValueError("Market line must be non-negative")

    side_lower = side.strip().lower()
    if side_lower not in ("over", "under"):
        raise ValueError("Side must be 'over' or 'under'")

    eff_std = std_dev if (std_dev is not None and std_dev > 0) else estimate_stat_std(projection, stat_type)

    # Compute probability distribution via normal CDF with continuity check
    z = (line - projection) / eff_std
    prob_over = float(np.clip(1.0 - norm.cdf(z), 0.001, 0.999))
    prob_under = float(np.clip(norm.cdf(z), 0.001, 0.999))

    true_prob = prob_over if side_lower == "over" else prob_under
    implied_prob = round(1.0 / odds, 4)

    # Mandatory Edge formula: edge = (true_prob * odds) - 1.0
    edge = (true_prob * odds) - 1.0
    edge_pct = round(edge * 100.0, 2)
    fair_odds = round(1.0 / true_prob, 2) if true_prob > 0 else 0.0

    # Under edge evaluation if under_odds provided
    edge_under_pct = None
    if under_odds is not None and under_odds > 1.0:
        edge_under = (prob_under * under_odds) - 1.0
        edge_under_pct = round(edge_under * 100.0, 2)

    diff = round(projection - line, 2)

    # Confidence classification
    abs_edge = abs(edge_pct)
    if abs_edge >= 12.0 or abs(diff) >= (1.5 * eff_std * 0.4):
        confidence = "high"
    elif abs_edge >= 4.0:
        confidence = "medium"
    else:
        confidence = "low"

    # Recommended side
    if edge_pct > 0 and (edge_under_pct is None or edge_pct >= edge_under_pct):
        recommended_side = side_lower
    elif edge_under_pct is not None and edge_under_pct > 0:
        recommended_side = "under"
    elif edge_pct > 0:
        recommended_side = side_lower
    else:
        recommended_side = "none"

    sign = "+" if diff > 0 else ""
    rationale = (
        f"Projected {projection:.1f} vs line {line:.1f} ({sign}{diff:.1f} diff). "
        f"{side_lower.title()} true prob {true_prob:.1%} vs implied {implied_prob:.1%} "
        f"({edge_pct:+.1f}% edge at ${odds:.2f}) - {confidence} confidence."
    )

    return {
        "projection": round(projection, 2),
        "line": round(line, 2),
        "diff": diff,
        "stat_type": stat_type,
        "side": side_lower,
        "odds": round(odds, 2),
        "std_dev": round(eff_std, 2),
        "true_prob": round(true_prob, 4),
        "implied_prob": implied_prob,
        "edge": round(edge, 4),
        "edge_pct": edge_pct,
        "fair_odds": fair_odds,
        "confidence": confidence,
        "prob_over": round(prob_over, 4),
        "prob_under": round(prob_under, 4),
        "edge_under_pct": edge_under_pct,
        "recommended_side": recommended_side,
        "rationale": rationale,
    }


def batch_evaluate_prop_edges(props: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Evaluate projection vs line edge for a batch of player props."""
    results = []
    for prop in props:
        evaluated = calculate_projection_edge(
            projection=float(prop["projection"]),
            line=float(prop["line"]),
            odds=float(prop.get("odds", 1.90)),
            side=str(prop.get("side", "over")),
            stat_type=str(prop.get("stat_type", "generic")),
            std_dev=float(prop["std_dev"]) if prop.get("std_dev") else None,
            under_odds=float(prop["under_odds"]) if prop.get("under_odds") else None,
        )
        if prop.get("player_name"):
            evaluated["player_name"] = prop["player_name"]
        if prop.get("player_id"):
            evaluated["player_id"] = prop["player_id"]
        results.append(evaluated)
    return results


def simulate_game_script(
    home_team: str = "Home",
    away_team: str = "Away",
    sport: str = "nba",
    home_baseline_score: float | None = None,
    away_baseline_score: float | None = None,
    projected_total: float | None = None,
    projected_spread: float | None = None,
    pace_factor: float = 1.0,
    num_simulations: int = 5000,
    player_baselines: Sequence[Mapping[str, Any]] | None = None,
    random_seed: int | None = None,
) -> dict[str, Any]:
    """Monte Carlo game script simulation service projecting margins, totals, and props (Item 28)."""
    sport_key = sport.lower()
    defaults = SPORT_SIM_DEFAULTS.get(sport_key, SPORT_SIM_DEFAULTS["nba"])

    # Determine baseline team scores
    if home_baseline_score is not None and away_baseline_score is not None:
        home_mu = float(home_baseline_score) * pace_factor
        away_mu = float(away_baseline_score) * pace_factor
    elif projected_total is not None and projected_spread is not None:
        # projected_spread is home spread, e.g. -4.5 means home is favored by 4.5
        # home - away = -spread => home = (total - spread)/2
        home_mu = ((float(projected_total) - float(projected_spread)) / 2.0) * pace_factor
        away_mu = ((float(projected_total) + float(projected_spread)) / 2.0) * pace_factor
    elif projected_total is not None:
        half = (float(projected_total) / 2.0) * pace_factor
        home_mu = half + 1.5
        away_mu = half - 1.5
    else:
        home_mu = defaults["home_baseline"] * pace_factor
        away_mu = defaults["away_baseline"] * pace_factor

    home_std = defaults["home_std"]
    away_std = defaults["away_std"]
    rho = defaults["rho"]

    # Construct bivariate normal covariance matrix
    cov = np.array([
        [home_std**2, rho * home_std * away_std],
        [rho * home_std * away_std, away_std**2],
    ])

    rng = np.random.default_rng(random_seed)
    scores = rng.multivariate_normal([home_mu, away_mu], cov, size=num_simulations)
    # Ensure scores cannot be negative
    scores = np.maximum(scores, 0.0)

    home_scores = scores[:, 0]
    away_scores = scores[:, 1]
    margins = home_scores - away_scores
    totals = home_scores + away_scores

    # Outcomes and probability bounds (0.0 <= p <= 1.0)
    home_win_count = np.sum(margins > 0)
    away_win_count = np.sum(margins < 0)
    tie_count = np.sum(margins == 0)

    home_win_prob = round(float(np.clip(home_win_count / num_simulations, 0.0, 1.0)), 4)
    away_win_prob = round(float(np.clip(away_win_count / num_simulations, 0.0, 1.0)), 4)
    tie_prob = round(float(np.clip(tie_count / num_simulations, 0.0, 1.0)), 4)

    mean_margin = round(float(np.mean(margins)), 2)
    mean_total = round(float(np.mean(totals)), 2)
    mean_home = round(float(np.mean(home_scores)), 2)
    mean_away = round(float(np.mean(away_scores)), 2)

    margin_percentiles = {
        f"p{p}": round(float(np.percentile(margins, p)), 2)
        for p in (10, 25, 50, 75, 90)
    }
    total_percentiles = {
        f"p{p}": round(float(np.percentile(totals, p)), 2)
        for p in (10, 25, 50, 75, 90)
    }

    # Game Script Probabilities
    blowout_th = defaults["blowout_threshold"]
    close_th = defaults["close_threshold"]

    p_blowout_home = float(np.mean(margins >= blowout_th))
    p_blowout_away = float(np.mean(margins <= -blowout_th))
    p_close = float(np.mean(np.abs(margins) <= close_th))
    p_shootout = float(np.mean(totals >= np.percentile(totals, 75)))
    p_grind = float(np.mean(totals <= np.percentile(totals, 25)))

    scripts = {
        "blowout_home": round(float(np.clip(p_blowout_home, 0.0, 1.0)), 4),
        "blowout_away": round(float(np.clip(p_blowout_away, 0.0, 1.0)), 4),
        "close_game": round(float(np.clip(p_close, 0.0, 1.0)), 4),
        "shootout": round(float(np.clip(p_shootout, 0.0, 1.0)), 4),
        "defensive_grind": round(float(np.clip(p_grind, 0.0, 1.0)), 4),
    }
    dominant_script = max(scripts, key=scripts.get)

    # Conditioned Player Projections
    player_projections_out = []
    if player_baselines:
        baseline_total = home_mu + away_mu
        for p in player_baselines:
            base_stat = float(p.get("baseline_mean") or p.get("projection") or 10.0)
            stat_type = str(p.get("stat_type", "generic"))
            stat_std = float(p.get("baseline_std") or estimate_stat_std(base_stat, stat_type))

            # Scale player projection based on simulated game scripts
            corr_total = float(p.get("correlation_with_total", 0.40))
            corr_margin = float(p.get("correlation_with_margin", 0.10))

            # Sample individual player noise
            player_noise = rng.normal(0, stat_std * 0.7, size=num_simulations)
            total_ratio = totals / baseline_total if baseline_total > 0 else 1.0
            margin_norm = (margins - mean_margin) / (home_std + 1e-6)

            is_home = str(p.get("team", "home")).lower() == "home"
            margin_effect = margin_norm if is_home else -margin_norm

            sim_player_stats = np.maximum(
                0.0,
                base_stat * (1.0 + (corr_total * (total_ratio - 1.0)) + (corr_margin * margin_effect * 0.1)) + player_noise,
            )

            sim_mean = round(float(np.mean(sim_player_stats)), 2)
            sim_median = round(float(np.median(sim_player_stats)), 2)

            prop_entry: dict[str, Any] = {
                "player_name": p.get("player_name", "Player"),
                "stat_type": stat_type,
                "baseline_mean": base_stat,
                "projected_stat": sim_mean,
                "median_stat": sim_median,
                "std_dev": round(float(np.std(sim_player_stats)), 2),
            }

            if p.get("line") is not None:
                line_val = float(p["line"])
                odds_val = float(p.get("over_odds") or p.get("odds") or 1.90)
                edge_eval = calculate_projection_edge(
                    projection=sim_mean,
                    line=line_val,
                    odds=odds_val,
                    side="over",
                    stat_type=stat_type,
                    std_dev=prop_entry["std_dev"],
                    under_odds=float(p["under_odds"]) if p.get("under_odds") else None,
                )
                prop_entry["edge_evaluation"] = edge_eval

            player_projections_out.append(prop_entry)

    return {
        "sport": sport_key,
        "home_team": home_team,
        "away_team": away_team,
        "home_win_prob": home_win_prob,
        "away_win_prob": away_win_prob,
        "tie_prob": tie_prob,
        "projected_home_score": mean_home,
        "projected_away_score": mean_away,
        "projected_margin": mean_margin,
        "projected_total": mean_total,
        "margin_percentiles": margin_percentiles,
        "total_percentiles": total_percentiles,
        "game_scripts": scripts,
        "dominant_script": dominant_script,
        "player_projections": player_projections_out,
        "simulations_run": num_simulations,
    }
