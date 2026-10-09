"""Unit tests for BetMate Pricing Core (Phase 1).

Verifies:
- Item 1: leg scoring (probability, edge, confidence, rationale)
- Item 2: correlation-aware multi probability (copula and Monte Carlo simulation)
- Item 3: correlation score between legs (pairwise and multi-wide score)
- Item 10: SGM fair price vs bookie price evaluation (margin and model EV)
- Item 28: game-script simulation service
- Item 38: projection-vs-line edge calculation
- Mathematical properties:
  * probabilities obey bounds (0 <= p <= 1)
  * correlated legs are NOT treated as independent
  * positive correlation boosts probability / reduces payout, negative correlation reduces probability
  * edge formula: edge = (true_prob * odds) - 1.0
"""
from __future__ import annotations

import math
import numpy as np
import pytest

from app.sgm import (
    calculate_copula_joint_probability,
    simulate_copula_joint_probability,
    combine_independent_probabilities,
    build_correlation_matrix,
    get_pairwise_correlation,
    score_multi_leg,
    calculate_multi_correlation_score,
    evaluate_bookie_sgm_price,
    calculate_multi_health_score,
    calculate_sgm_odds,
    probability_from_odds,
)
from app.simulation import (
    calculate_projection_edge,
    batch_evaluate_prop_edges,
    simulate_game_script,
    estimate_stat_std,
)


# =====================================================================
# 1. MATHEMATICAL PROPERTIES & PROBABILITY BOUNDS
# =====================================================================

def test_probability_bounds_copula_and_simulation():
    """Verify all calculated probabilities strictly obey 0 <= p <= 1."""
    # Test cases ranging from longshots to heavy favorites
    test_probs_list = [
        [0.05, 0.10],
        [0.50, 0.50],
        [0.90, 0.85],
        [0.10, 0.50, 0.70],
        [0.01, 0.02, 0.03, 0.04],
    ]

    for probs in test_probs_list:
        k = len(probs)
        corr_pos = np.eye(k)
        for i in range(k):
            for j in range(i + 1, k):
                corr_pos[i, j] = 0.30
                corr_pos[j, i] = 0.30

        # Analytical Copula
        cop_p = calculate_copula_joint_probability(probs, corr_pos)
        assert 0.0 <= cop_p <= 1.0, f"Copula prob {cop_p} out of bounds"
        assert cop_p <= min(probs), f"Joint prob {cop_p} cannot exceed marginal minimum {min(probs)}"

        # Monte Carlo Simulation
        sim_p = simulate_copula_joint_probability(probs, corr_pos, n_samples=10000, seed=42)
        assert 0.0 <= sim_p <= 1.0, f"Simulated prob {sim_p} out of bounds"
        assert sim_p <= min(probs) + 0.01, f"Simulated joint prob {sim_p} exceeded marginal minimum"


def test_game_simulation_probability_bounds():
    """Verify game-script simulation probabilities obey [0, 1] bounds."""
    sim_res = simulate_game_script(
        home_team="Lakers",
        away_team="Celtics",
        sport="nba",
        home_baseline_score=115.0,
        away_baseline_score=110.0,
        num_simulations=3000,
        random_seed=42,
    )

    assert 0.0 <= sim_res["home_win_prob"] <= 1.0
    assert 0.0 <= sim_res["away_win_prob"] <= 1.0
    assert 0.0 <= sim_res["tie_prob"] <= 1.0
    # Sum of win + away + tie probabilities must equal 1.0
    total_outcome_p = sim_res["home_win_prob"] + sim_res["away_win_prob"] + sim_res["tie_prob"]
    assert math.isclose(total_outcome_p, 1.0, abs_tol=1e-3)

    # Game scripts
    scripts = sim_res["game_scripts"]
    for name, p in scripts.items():
        assert 0.0 <= p <= 1.0, f"Script {name} probability {p} out of bounds"


def test_projection_edge_probability_bounds():
    """Verify prop edge probabilities strictly obey 0 < p < 1."""
    for line in [5.5, 22.5, 45.5, 250.5]:
        for proj in [1.0, 22.5, 50.0, 300.0]:
            edge_res = calculate_projection_edge(
                projection=proj,
                line=line,
                odds=1.90,
                side="over",
                stat_type="player_points",
            )
            assert 0.0 <= edge_res["true_prob"] <= 1.0
            assert 0.0 <= edge_res["prob_over"] <= 1.0
            assert 0.0 <= edge_res["prob_under"] <= 1.0
            assert math.isclose(edge_res["prob_over"] + edge_res["prob_under"], 1.0, abs_tol=1e-3)


# =====================================================================
# 2. CORRELATED LEGS NOT TREATED AS INDEPENDENT
# =====================================================================

def test_correlated_legs_differ_from_independent_product():
    """Verify that correlated legs are NOT treated as independent."""
    # NBA: player_points and player_threes have rho = +0.35
    legs = [
        {"market_type": "player_points", "odds": 1.90},
        {"market_type": "player_threes", "odds": 1.90},
    ]

    p1 = probability_from_odds(1.90)
    p2 = probability_from_odds(1.90)
    naive_product = p1 * p2

    result = calculate_sgm_odds(legs, sport="nba")

    assert result["fair_probability"] == pytest.approx(naive_product, rel=1e-4)
    # The adjusted probability under positive correlation MUST differ from naive product
    assert result["adjusted_probability"] != pytest.approx(naive_product, rel=1e-3)
    assert result["adjusted_probability"] > naive_product
    # Positive correlation must generate a positive haircut on payout
    assert result["correlation_haircut"] > 0.0


# =====================================================================
# 3. CORRELATION DIRECTION: POSITIVE BOOSTS PROB, NEGATIVE REDUCES PROB
# =====================================================================

def test_positive_correlation_boosts_probability_and_reduces_payout():
    """Positive correlation boosts joint probability and reduces fair payout/odds."""
    # NFL: QB passing yards and WR receiving yards are positively correlated (rho = +0.45)
    legs_positive = [
        {"market_type": "player_pass_yds", "odds": 1.90, "probability": 0.50},
        {"market_type": "player_rec_yds", "odds": 1.90, "probability": 0.50},
    ]

    indep_p = 0.50 * 0.50  # 0.25
    indep_odds = 1.0 / indep_p  # 4.00

    priced_pos = calculate_sgm_odds(legs_positive, sport="nfl")

    # Joint prob is boosted
    assert priced_pos["adjusted_probability"] > indep_p
    # Fair odds (payout) is reduced because the combined outcome is more likely
    assert priced_pos["adjusted_odds"] < indep_odds
    assert priced_pos["correlation_direction"] == "positive"
    assert priced_pos["correlation_score"] > 0.0


def test_negative_correlation_reduces_probability_and_increases_odds():
    """Negative correlation reduces joint probability and increases fair odds."""
    # NBA: player_points and player_rebounds are negatively correlated (rho = -0.25)
    legs_negative = [
        {"market_type": "player_points", "odds": 1.90, "probability": 0.50},
        {"market_type": "player_rebounds", "odds": 1.90, "probability": 0.50},
    ]

    indep_p = 0.50 * 0.50  # 0.25
    indep_odds = 1.0 / indep_p  # 4.00

    priced_neg = calculate_sgm_odds(legs_negative, sport="nba")

    # Joint prob is reduced
    assert priced_neg["adjusted_probability"] < indep_p
    # Fair odds (payout) must be higher to compensate for lower hit rate
    assert priced_neg["adjusted_odds"] > indep_odds
    assert priced_neg["correlation_direction"] == "negative"
    assert priced_neg["correlation_score"] < 0.0


# =====================================================================
# 4. EDGE CALCULATIONS: edge = (true_prob * odds) - 1.0
# =====================================================================

def test_edge_calculation_formula():
    """Verify edge = (true_prob * odds) - 1.0 across single legs, props, and multis."""
    # Case 1: Positive edge (true_prob = 0.60, odds = 2.00 => edge = +0.20 = +20%)
    leg_pos = {"selection": "Lakers", "odds": 2.00, "true_prob": 0.60}
    scored_pos = score_multi_leg(leg_pos)
    expected_edge_pos = (0.60 * 2.00) - 1.0
    assert scored_pos["edge"] == pytest.approx(expected_edge_pos, abs=1e-4)
    assert scored_pos["edge_pct"] == pytest.approx(expected_edge_pos * 100.0, abs=1e-2)
    assert scored_pos["edge"] == 0.20

    # Case 2: Negative edge (true_prob = 0.40, odds = 2.00 => edge = -0.20 = -20%)
    leg_neg = {"selection": "Warriors", "odds": 2.00, "true_prob": 0.40}
    scored_neg = score_multi_leg(leg_neg)
    expected_edge_neg = (0.40 * 2.00) - 1.0
    assert scored_neg["edge"] == pytest.approx(expected_edge_neg, abs=1e-4)
    assert scored_neg["edge_pct"] == pytest.approx(expected_edge_neg * 100.0, abs=1e-2)
    assert scored_neg["edge"] == -0.20

    # Case 3: Zero edge / fair price (true_prob = 0.50, odds = 2.00 => edge = 0.0)
    leg_even = {"selection": "Fair Coin", "odds": 2.00, "true_prob": 0.50}
    scored_even = score_multi_leg(leg_even)
    assert scored_even["edge"] == pytest.approx(0.0, abs=1e-4)
    assert scored_even["edge_pct"] == pytest.approx(0.0, abs=1e-2)


def test_projection_edge_formula_accuracy():
    """Verify projection-vs-line helper adheres strictly to edge = (true_prob * odds) - 1.0."""
    res = calculate_projection_edge(
        projection=28.5,
        line=24.5,
        odds=1.95,
        side="over",
        stat_type="player_points",
        std_dev=6.0,
    )

    true_prob = res["true_prob"]
    odds = res["odds"]
    expected_edge = (true_prob * odds) - 1.0

    assert res["edge"] == pytest.approx(expected_edge, abs=1e-4)
    assert res["edge_pct"] == pytest.approx(expected_edge * 100.0, abs=1e-2)


# =====================================================================
# 5. ITEM 1: LEG-LEVEL SCORING
# =====================================================================

def test_leg_level_scoring_structure():
    """Verify Item 1: leg-level scoring with calibrated probability, edge %, confidence, and rationale."""
    leg = {
        "selection": "Jayson Tatum Over 26.5 Pts",
        "market_type": "player_points",
        "odds": 1.90,
        "true_prob": 0.60,
    }

    scored = score_multi_leg(leg, sport="nba")

    assert scored["selection"] == "Jayson Tatum Over 26.5 Pts"
    assert scored["market_type"] == "player_points"
    assert scored["odds"] == 1.90
    assert scored["calibrated_prob"] == 0.60
    assert scored["edge_pct"] == pytest.approx(14.0, abs=1e-2)  # (0.60 * 1.90 - 1) = 0.14
    assert scored["confidence"] in ("high", "medium", "low")
    assert isinstance(scored["rationale"], str)
    assert len(scored["rationale"]) > 0
    assert "+14.0% edge" in scored["rationale"]


# =====================================================================
# 6. ITEM 3: OVERALL MULTI CORRELATION SCORE
# =====================================================================

def test_multi_correlation_score():
    """Verify Item 3: overall multi correlation score in [-1.0, 1.0] and normalized 0-100 index."""
    legs = [
        {"market_type": "player_pass_yds"},
        {"market_type": "player_rec_yds"},
        {"market_type": "player_pass_tds"},
    ]

    corr_res = calculate_multi_correlation_score(legs, sport="nfl")

    assert -1.0 <= corr_res["score"] <= 1.0
    assert 0.0 <= corr_res["index"] <= 100.0
    assert corr_res["direction"] == "positive"
    assert corr_res["pairwise_count"] == 3  # C(3, 2) = 3 pairs
    assert "reinforce each other" in corr_res["summary"]


# =====================================================================
# 7. ITEM 10: SGM FAIR PRICE VS BOOKIE PRICE EVALUATION
# =====================================================================

def test_bookie_sgm_price_evaluation():
    """Verify Item 10: bookmaker price vs model fair price, bookmaker margin, and model EV."""
    # Model fair odds are 4.00 (adjusted prob = 0.25)
    # Scenario A: Bookie takes margin and offers 3.20
    comp_a = evaluate_bookie_sgm_price(
        model_fair_odds=4.00,
        adjusted_probability=0.25,
        bookie_odds=3.20,
    )
    assert comp_a["bookie_odds"] == 3.20
    assert comp_a["model_fair_odds"] == 4.00
    assert comp_a["is_value_bet"] is False
    # EV at 3.20 odds with 0.25 prob: (0.25 * 3.20) - 1.0 = -0.20 = -20%
    assert comp_a["model_ev_pct"] == pytest.approx(-20.0, abs=1e-2)
    assert comp_a["model_ev_10"] == pytest.approx(-2.0, abs=1e-2)
    # Bookie margin = (1 - 3.20/4.00) * 100 = 20%
    assert comp_a["bookie_margin_pct"] == pytest.approx(20.0, abs=1e-2)

    # Scenario B: Bookie offers value price 4.50
    comp_b = evaluate_bookie_sgm_price(
        model_fair_odds=4.00,
        adjusted_probability=0.25,
        bookie_odds=4.50,
    )
    assert comp_b["is_value_bet"] is True
    # EV at 4.50 odds with 0.25 prob: (0.25 * 4.50) - 1.0 = +0.125 = +12.5%
    assert comp_b["model_ev_pct"] == pytest.approx(12.5, abs=1e-2)
    assert comp_b["model_ev_10"] == pytest.approx(1.25, abs=1e-2)


# =====================================================================
# 8. ITEM 48: MULTI HEALTH SCORE (A, B, C, D, F)
# =====================================================================

def test_multi_health_score_grading():
    """Verify Item 48: Multi health grade (A-F) based on EV, correlation hazards, and leg quality."""
    # High EV with positive correlation and positive legs -> Grade A
    scored_legs_good = [
        {"edge_pct": 10.0, "confidence": "high"},
        {"edge_pct": 8.0, "confidence": "high"},
    ]
    health_good = calculate_multi_health_score(
        combined_edge_pct=15.0,
        correlation_score=0.25,
        scored_legs=scored_legs_good,
        has_negative_correlation=False,
    )
    assert health_good["grade"] in ("A", "B")
    assert health_good["score"] >= 70

    # Negative EV with conflicting negative correlation -> Grade D or F
    scored_legs_bad = [
        {"edge_pct": -10.0, "confidence": "low"},
        {"edge_pct": -15.0, "confidence": "low"},
        {"edge_pct": -8.0, "confidence": "low"},
    ]
    health_bad = calculate_multi_health_score(
        combined_edge_pct=-25.0,
        correlation_score=-0.25,
        scored_legs=scored_legs_bad,
        has_negative_correlation=True,
    )
    assert health_bad["grade"] in ("D", "F")
    assert health_bad["score"] < 50


# =====================================================================
# 9. ITEM 28: GAME-SCRIPT SIMULATION SERVICE
# =====================================================================

def test_game_script_simulation_projections():
    """Verify Item 28: game script simulation projects margins, totals, and player props."""
    player_props = [
        {
            "player_name": "Patrick Mahomes",
            "stat_type": "player_pass_yds",
            "baseline_mean": 275.0,
            "line": 265.5,
            "over_odds": 1.90,
            "correlation_with_total": 0.50,
        },
        {
            "player_name": "Travis Kelce",
            "stat_type": "player_rec_yds",
            "baseline_mean": 70.0,
            "line": 65.5,
            "over_odds": 1.90,
            "correlation_with_total": 0.45,
        },
    ]

    res = simulate_game_script(
        home_team="Chiefs",
        away_team="Bills",
        sport="nfl",
        home_baseline_score=27.0,
        away_baseline_score=24.0,
        num_simulations=4000,
        player_baselines=player_props,
        random_seed=123,
    )

    assert res["sport"] == "nfl"
    assert res["projected_home_score"] > 0
    assert res["projected_away_score"] > 0
    assert res["projected_total"] > 0
    assert res["simulations_run"] == 4000
    assert len(res["player_projections"]) == 2

    # Check prop edge evaluations attached to player projections
    for p in res["player_projections"]:
        assert "projected_stat" in p
        assert "edge_evaluation" in p
        edge_eval = p["edge_evaluation"]
        assert 0.0 <= edge_eval["true_prob"] <= 1.0
        assert edge_eval["edge"] == pytest.approx((edge_eval["true_prob"] * edge_eval["odds"]) - 1.0, abs=1e-4)


# =====================================================================
# 10. ITEM 2: MONTE CARLO VS ANALYTICAL COPULA CONSISTENCY
# =====================================================================

def test_monte_carlo_vs_analytical_copula():
    """Verify Monte Carlo simulation matches analytical Copula within statistical error."""
    probs = [0.45, 0.55]
    corr = np.array([
        [1.0, 0.25],
        [0.25, 1.0],
    ])

    analytical_p = calculate_copula_joint_probability(probs, corr)
    sim_p = simulate_copula_joint_probability(probs, corr, n_samples=50000, seed=789)

    assert math.isclose(analytical_p, sim_p, abs_tol=0.015)


# =====================================================================
# 11. END-TO-END INTEGRATION: calculate_sgm_odds RICH RETURN PAYLOAD
# =====================================================================

def test_calculate_sgm_odds_full_payload():
    """Verify calculate_sgm_odds returns all rich fields expected by Phase 1."""
    legs = [
        {"market_type": "player_points", "odds": 1.90, "true_prob": 0.58, "selection": "Curry Over 28.5"},
        {"market_type": "player_threes", "odds": 1.90, "true_prob": 0.56, "selection": "Curry Over 4.5 3s"},
    ]

    res = calculate_sgm_odds(legs, sport="nba", bookie_odds=3.10)

    # Core existing fields
    assert res["fair_probability"] > 0
    assert res["adjusted_probability"] > 0
    assert res["combined_odds"] == 3.61
    assert res["adjusted_odds"] > 0

    # Item 1: scored legs
    assert len(res["scored_legs"]) == 2
    assert res["scored_legs"][0]["calibrated_prob"] == 0.58
    assert res["scored_legs"][0]["edge_pct"] > 0
    assert res["scored_legs"][0]["confidence"] in ("high", "medium", "low")

    # Item 3: correlation score
    assert "correlation_score" in res
    assert "correlation_index" in res
    assert res["correlation_score"] > 0

    # Item 10: bookie comparison
    assert res["bookie_odds"] == 3.10
    assert "bookie_comparison" in res
    assert res["bookie_comparison"]["model_ev_pct"] == pytest.approx(
        (res["adjusted_probability"] * 3.10 - 1.0) * 100.0, abs=1e-2
    )

    # Item 48: health grade
    assert res["health_grade"] in ("A", "B", "C", "D", "F")
    assert 0 <= res["health_score"] <= 100
    assert isinstance(res["health_summary"], str)
