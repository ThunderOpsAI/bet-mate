"""Comprehensive test suite for BetMate Multi Recommendations.

Verifies:
- Item 4: auto-build to target payout / odds
- Item 5: risk profile constraints (Safe, Balanced, Long-shot)
- Item 7: leg-swap recommendations
- Item 8: weakest-leg detector
- Item 16: daily Bob's Multis generation and transparent rationales
- Item 46: fractional Kelly criterion stake sizing and bounds
- Item 48: Multi health score A-F rating integration
- REST API endpoints in FastAPI
"""
import os
import pytest
from fastapi.testclient import TestClient

# SQLite test configuration
os.environ["DATABASE_URL"] = ""
os.environ["BETMATE_DB_PATH"] = ":memory:"
os.environ["BETMATE_ALLOW_SQLITE"] = "1"

from app.main import app
from app.recommendations import (
    auto_build_multi,
    calculate_kelly_stake,
    detect_weakest_leg,
    generate_bobs_multis,
    recommend_leg_swaps,
)
from app.bob import get_bobs_daily_multis


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def sample_candidates():
    return [
        {
            "id": "leg_1",
            "selection": "Lakers H2H",
            "market_type": "head_to_head",
            "odds": 1.75,
            "true_prob": 0.65,
            "edge_pct": 13.75,
            "sport": "nba",
        },
        {
            "id": "leg_2",
            "selection": "Lakers -3.5 Spread",
            "market_type": "spread",
            "odds": 1.90,
            "true_prob": 0.58,
            "edge_pct": 10.20,
            "sport": "nba",
        },
        {
            "id": "leg_3",
            "selection": "Over 224.5 Total Points",
            "market_type": "total_points",
            "odds": 1.95,
            "true_prob": 0.56,
            "edge_pct": 9.20,
            "sport": "nba",
        },
        {
            "id": "leg_4",
            "selection": "LeBron 25+ Points",
            "market_type": "player_points",
            "odds": 1.85,
            "true_prob": 0.60,
            "edge_pct": 11.00,
            "sport": "nba",
        },
        {
            "id": "leg_5",
            "selection": "Curry 5+ Threes",
            "market_type": "player_threes",
            "odds": 2.50,
            "true_prob": 0.45,
            "edge_pct": 12.50,
            "sport": "nba",
        },
        {
            "id": "leg_6",
            "selection": "Davis 12+ Rebounds",
            "market_type": "player_rebounds",
            "odds": 1.80,
            "true_prob": 0.58,
            "edge_pct": 4.40,
            "sport": "nba",
        },
        {
            "id": "leg_longshot",
            "selection": "Longshot Triple Double",
            "market_type": "player_points",
            "odds": 5.50,
            "true_prob": 0.22,
            "edge_pct": 21.00,
            "sport": "nba",
        },
    ]


# ---------------------------------------------------------------------------
# Item 46: Kelly Criterion Tests
# ---------------------------------------------------------------------------

class TestKellyStakeCalculations:
    def test_positive_ev_quarter_kelly_calculation(self):
        # Odds 2.0, true prob 0.55 -> Edge = 10%, b = 1.0 -> raw Kelly = 0.10
        # Quarter Kelly (0.25x) = 0.025 -> 2.5% of $1,000 = $25.00
        res = calculate_kelly_stake(
            combined_odds=2.0,
            true_prob=0.55,
            bankroll=1000.0,
            fraction=0.25,
            max_stake_pct=0.05,
        )
        assert res["is_positive_ev"] is True
        assert res["raw_kelly_fraction"] == 0.10
        assert res["adjusted_fraction"] == 0.025
        assert res["recommended_stake"] == 25.00
        assert res["edge_pct"] == 10.0
        assert res["expected_profit"] == 2.50
        assert "Fractional Kelly (0.25x)" in res["rationale"]

    def test_kelly_stake_cap_enforcement(self):
        # Very high edge: Odds 3.0, true prob 0.60 -> Edge = 80%, b = 2.0 -> raw Kelly = 0.40
        # Quarter Kelly = 0.10 (10%). Max stake cap is 5% (0.05).
        res = calculate_kelly_stake(
            combined_odds=3.0,
            true_prob=0.60,
            bankroll=1000.0,
            fraction=0.25,
            max_stake_pct=0.05,
        )
        assert res["is_positive_ev"] is True
        assert res["raw_kelly_fraction"] == 0.40
        assert res["adjusted_fraction"] == 0.10
        assert res["recommended_fraction"] == 0.05
        assert res["recommended_stake"] == 50.00
        assert "capped at max limit" in res["rationale"]

    def test_negative_or_zero_ev_suggests_zero_stake(self):
        # Negative EV: Odds 2.0, true prob 0.45 -> Edge = -10%
        res = calculate_kelly_stake(
            combined_odds=2.0,
            true_prob=0.45,
            bankroll=1000.0,
        )
        assert res["is_positive_ev"] is False
        assert res["recommended_stake"] == 0.0
        assert res["edge_pct"] == -10.0
        assert "Kelly criterion recommends $0.00" in res["rationale"]

    def test_manual_max_stake_override_bound(self):
        # Raw calculated stake would be $25.00, but manual max_stake is $15.00
        res = calculate_kelly_stake(
            combined_odds=2.0,
            true_prob=0.55,
            bankroll=1000.0,
            fraction=0.25,
            max_stake=15.0,
        )
        assert res["recommended_stake"] == 15.00

    def test_below_minimum_stake_threshold(self):
        # Bankroll $20.0, stake 2.5% = $0.50, min_stake = $1.0
        res = calculate_kelly_stake(
            combined_odds=2.0,
            true_prob=0.55,
            bankroll=20.0,
            fraction=0.25,
            min_stake=1.0,
        )
        assert res["recommended_stake"] == 0.0
        assert "below minimum bet size" in res["rationale"]

    def test_invalid_input_safety(self):
        res = calculate_kelly_stake(combined_odds=1.0, true_prob=0.5, bankroll=1000.0)
        assert res["is_positive_ev"] is False
        assert res["recommended_stake"] == 0.0

        res_zero_prob = calculate_kelly_stake(combined_odds=2.0, true_prob=0.0, bankroll=1000.0)
        assert res_zero_prob["is_positive_ev"] is False


# ---------------------------------------------------------------------------
# Item 8: Weakest-Leg Detector Tests
# ---------------------------------------------------------------------------

class TestWeakestLegDetector:
    def test_identifies_negative_ev_leg_as_weakest(self):
        legs = [
            {"selection": "Leg A", "market_type": "head_to_head", "odds": 1.90, "true_prob": 0.58},  # +10.2% EV
            {"selection": "Leg B", "market_type": "total_points", "odds": 1.90, "true_prob": 0.44},  # -16.4% EV
            {"selection": "Leg C", "market_type": "spread", "odds": 1.90, "true_prob": 0.55},        # +4.5% EV
        ]
        result = detect_weakest_leg(legs, sport="nba")
        assert result["weakest_leg_index"] == 1
        assert result["weakest_leg"]["selection"] == "Leg B"
        assert result["severity"] == "critical"
        assert "Negative EV" in result["reason"]

    def test_identifies_negative_correlation_conflict(self):
        # In NBA correlation matrix: player_points and player_rebounds have rho = -0.25
        legs = [
            {"selection": "Star Over 30 Points", "market_type": "player_points", "odds": 1.90, "true_prob": 0.55},
            {"selection": "Star Over 14 Rebounds", "market_type": "player_rebounds", "odds": 1.90, "true_prob": 0.55},
        ]
        result = detect_weakest_leg(legs, sport="nba")
        assert result["severity"] == "critical"
        assert "Severe negative correlation" in result["reason"]
        assert any(p["rho"] == -0.25 for p in result["pairwise_impacts"])

    def test_identifies_lowest_edge_leg_when_all_positive(self):
        legs = [
            {"selection": "Strong Leg", "market_type": "head_to_head", "odds": 1.80, "true_prob": 0.65},  # +17% EV
            {"selection": "Moderate Leg", "market_type": "spread", "odds": 1.90, "true_prob": 0.56},      # +6.4% EV
            {"selection": "Thin Leg", "market_type": "total_points", "odds": 1.90, "true_prob": 0.53},     # +0.7% EV
        ]
        result = detect_weakest_leg(legs, sport="nba")
        assert result["weakest_leg_index"] == 2
        assert result["weakest_leg"]["selection"] == "Thin Leg"
        assert result["severity"] in ["warning", "minor"]

    def test_empty_and_single_leg_safety(self):
        empty_res = detect_weakest_leg([], sport="nba")
        assert empty_res["weakest_leg_index"] == -1
        assert empty_res["severity"] == "none"

        single_res = detect_weakest_leg([{"selection": "Solo", "odds": 1.9, "true_prob": 0.6}], sport="nba")
        assert single_res["weakest_leg_index"] == 0
        assert single_res["weakest_leg"] is not None


# ---------------------------------------------------------------------------
# Item 7: Leg-Swap Recommendation Tests
# ---------------------------------------------------------------------------

class TestLegSwapRecommendations:
    def test_replaces_negative_ev_leg_with_positive_ev_alternative(self, sample_candidates):
        # Current multi contains a bad negative EV leg
        current_legs = [
            {"selection": "Lakers H2H", "market_type": "head_to_head", "odds": 1.75, "true_prob": 0.65},  # +13.7% EV
            {"selection": "Bad Dog Under", "market_type": "total_points", "odds": 1.90, "true_prob": 0.40},  # -24% EV
        ]
        result = recommend_leg_swaps(current_legs, candidate_pool=sample_candidates, sport="nba")
        assert result["status"] == "swaps_found"
        assert len(result["swaps"]) > 0

        top_swap = result["swaps"][0]
        assert top_swap["original_leg_index"] == 1
        assert top_swap["ev_improvement"] > 0
        assert top_swap["health_score_after"] > top_swap["health_score_before"]
        assert "Replaces Bad Dog Under" in top_swap["rationale"]

    def test_empty_candidates_returns_explicit_clean_state(self):
        current_legs = [
            {"selection": "Leg A", "market_type": "head_to_head", "odds": 1.8, "true_prob": 0.6},
            {"selection": "Leg B", "market_type": "spread", "odds": 1.9, "true_prob": 0.55},
        ]
        result = recommend_leg_swaps(current_legs, candidate_pool=[], sport="nba")
        assert result["status"] == "no_candidates"
        assert result["swaps"] == []
        assert result["count"] == 0

    def test_insufficient_legs_returns_clean_state(self, sample_candidates):
        result = recommend_leg_swaps([{"selection": "Solo", "odds": 2.0}], sample_candidates)
        assert result["status"] == "insufficient_legs"
        assert result["swaps"] == []


# ---------------------------------------------------------------------------
# Items 4 & 5: Auto-Build Multi & Risk Profiles Tests
# ---------------------------------------------------------------------------

class TestAutoBuildMulti:
    def test_auto_build_target_odds_balanced_profile(self, sample_candidates):
        target = 4.50
        result = auto_build_multi(
            candidate_pool=sample_candidates,
            target_odds=target,
            risk_profile="balanced",
            min_legs=2,
            max_legs=4,
        )
        assert result["status"] == "success"
        assert result["risk_profile"] == "Balanced"
        assert result["leg_count"] >= 2
        assert result["actual_odds"] > 1.0
        assert result["combined_edge_pct"] > 0
        assert result["health_grade"] in ["A", "B", "C"]
        assert result["kelly_recommendation"] is not None
        assert "Auto-built" in result["rationale"]

    def test_auto_build_target_payout_with_stake(self, sample_candidates):
        # Target payout $50 for $10 stake -> Target odds 5.0
        result = auto_build_multi(
            candidate_pool=sample_candidates,
            target_payout=50.0,
            stake=10.0,
            risk_profile="balanced",
        )
        assert result["status"] == "success"
        assert result["target_odds"] == 5.0
        assert result["estimated_payout"] is not None
        assert result["estimated_payout"] > 0

    def test_auto_build_safe_profile_constraints(self, sample_candidates):
        result = auto_build_multi(
            candidate_pool=sample_candidates,
            target_odds=2.50,
            risk_profile="safe",
            min_legs=2,
            max_legs=2,
        )
        assert result["status"] == "success"
        assert result["risk_profile"] == "Safe"
        assert result["leg_count"] == 2
        # Verify legs have high probability and reasonable odds
        for leg in result["legs"]:
            assert leg["calibrated_prob"] >= 0.40

    def test_auto_build_long_shot_profile(self, sample_candidates):
        result = auto_build_multi(
            candidate_pool=sample_candidates,
            target_odds=10.00,
            risk_profile="long_shot",
            min_legs=3,
            max_legs=5,
        )
        assert result["status"] == "success"
        assert result["risk_profile"] == "Long Shot"
        assert result["actual_odds"] >= 5.0

    def test_zero_mock_fallback_when_empty_candidate_pool(self):
        result = auto_build_multi(
            candidate_pool=[],
            target_odds=4.0,
            risk_profile="balanced",
        )
        assert result["status"] == "no_qualifying_candidates"
        assert result["legs"] == []
        assert result["actual_odds"] == 0.0

    def test_zero_mock_fallback_when_insufficient_candidates(self):
        single_candidate = [
            {"selection": "Solo", "market_type": "head_to_head", "odds": 1.8, "true_prob": 0.6, "edge_pct": 8.0}
        ]
        result = auto_build_multi(
            candidate_pool=single_candidate,
            target_odds=4.0,
            min_legs=2,
        )
        assert result["status"] == "no_qualifying_candidates"
        assert result["legs"] == []


# ---------------------------------------------------------------------------
# Item 16: Daily Bob's Multis Tests
# ---------------------------------------------------------------------------

class TestBobsDailyMultis:
    def test_bobs_daily_multis_empty_feed_clean_state(self):
        result = generate_bobs_multis(candidate_pool=[])
        assert result["status"] == "no_qualifying_bets"
        assert result["multis"] == []
        assert "No qualifying" in result["message"]

    def test_bobs_daily_multis_generation_with_candidates(self, sample_candidates):
        result = generate_bobs_multis(candidate_pool=sample_candidates)
        assert result["status"] == "success"
        assert result["count"] > 0
        assert len(result["multis"]) > 0

        # Validate multi attributes
        flagship = result["multis"][0]
        assert "title" in flagship
        assert "bob_rationale" in flagship
        assert flagship["actual_odds"] > 1.0
        assert flagship["health_grade"] in ["A", "B", "C"]
        assert flagship["kelly_recommendation"]["recommended_stake"] >= 0
        assert "Quarter-Kelly allocation" in flagship["bob_rationale"] or "Health Grade" in flagship["bob_rationale"]

    def test_bob_helper_delegation(self, sample_candidates):
        res = get_bobs_daily_multis(candidate_pool=sample_candidates)
        assert res["status"] == "success"
        assert res["count"] > 0


# ---------------------------------------------------------------------------
# REST API Endpoints Integration Tests
# ---------------------------------------------------------------------------

class TestRecommendationsEndpoints:
    def test_post_auto_build_endpoint(self, client, sample_candidates):
        payload = {
            "target_odds": 4.5,
            "risk_profile": "balanced",
            "candidate_pool": sample_candidates,
            "min_legs": 2,
            "max_legs": 3,
        }
        response = client.post("/api/recommendations/auto-build", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["risk_profile"] == "Balanced"
        assert len(data["legs"]) >= 2
        assert "kelly_recommendation" in data

    def test_post_weakest_leg_endpoint(self, client):
        payload = {
            "sport": "nba",
            "legs": [
                {"selection": "Good Leg", "market_type": "head_to_head", "odds": 1.85, "true_prob": 0.62},
                {"selection": "Bad Leg", "market_type": "total_points", "odds": 1.95, "true_prob": 0.45},
            ],
        }
        response = client.post("/api/recommendations/weakest-leg", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["weakest_leg_index"] == 1
        assert data["weakest_leg"]["selection"] == "Bad Leg"
        assert data["severity"] == "critical"

    def test_post_leg_swaps_endpoint(self, client, sample_candidates):
        payload = {
            "sport": "nba",
            "legs": [
                {"selection": "Lakers H2H", "market_type": "head_to_head", "odds": 1.75, "true_prob": 0.65},
                {"selection": "Horrible Leg", "market_type": "total_points", "odds": 1.90, "true_prob": 0.40},
            ],
            "candidate_pool": sample_candidates,
            "max_swaps": 2,
        }
        response = client.post("/api/recommendations/leg-swaps", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "swaps_found"
        assert len(data["swaps"]) > 0

    def test_post_kelly_stake_endpoint(self, client):
        payload = {
            "combined_odds": 2.20,
            "true_prob": 0.55,
            "bankroll": 1000.0,
            "fraction": 0.25,
            "max_stake_pct": 0.05,
        }
        response = client.post("/api/recommendations/kelly-stake", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["is_positive_ev"] is True
        assert data["recommended_stake"] > 0
        assert data["edge_pct"] > 0

    def test_get_bobs_daily_endpoint_empty_db(self, client):
        response = client.get("/api/recommendations/bobs-daily")
        assert response.status_code == 200
        data = response.json()
        assert "multis" in data
        assert "date" in data
