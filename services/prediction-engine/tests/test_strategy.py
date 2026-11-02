import app.storage as storage
from app.strategy import (
    StrategyService,
    allocate_candidates,
    build_multi_candidate,
    build_multi_candidates,
    build_place_candidates,
    build_quinella_candidates,
    qualify_candidates,
)


def _rule_set(**overrides):
    base = storage.get_strategy_profile("bob")["rule_set"]
    merged = {**base, **overrides}
    if "sport_weights" not in overrides:
        merged["sport_weights"] = dict(base["sport_weights"])
    return merged


def test_best_edge_cross_sport_selection_beats_strict_sport_fallback():
    candidates = [
        {
            "sport": "racing",
            "event_id": "r1",
            "event_name": "Flemington R1",
            "market_type": "win",
            "selection": "Runner A",
            "model_probability": 0.52,
            "market_odds": 1.95,
            "derived_odds": None,
            "odds_source": "live_market",
            "edge": 0.01,
            "confidence": "medium",
        },
        {
            "sport": "afl",
            "event_id": "a1",
            "event_name": "Cats vs Blues",
            "market_type": "head_to_head",
            "selection": "Cats",
            "model_probability": 0.62,
            "market_odds": None,
            "derived_odds": 2.20,
            "odds_source": "model_implied",
            "edge": 0.17,
            "confidence": "high",
        },
        {
            "sport": "nba",
            "event_id": "n1",
            "event_name": "Lakers vs Suns",
            "market_type": "head_to_head",
            "selection": "Lakers",
            "model_probability": 0.58,
            "market_odds": None,
            "derived_odds": 2.05,
            "odds_source": "model_implied",
            "edge": 0.09,
            "confidence": "medium",
        },
    ]

    qualified, _ = qualify_candidates(candidates, _rule_set(min_edge=0.0, max_bets_per_day=2))
    selected = allocate_candidates(qualified, _rule_set(min_edge=0.0, max_bets_per_day=2), 250.0)

    strict_fallback = [candidate for candidate in candidates if candidate["sport"] == "racing"][:2]

    assert len(selected) == 2
    assert {bet["sport"] for bet in selected} == {"afl", "nba"}
    assert sum(bet["edge"] for bet in selected) > sum(bet["edge"] for bet in strict_fallback)


def test_bankroll_allocation_respects_caps_and_max_stake():
    candidates = []
    for index, sport in enumerate(["racing", "afl", "nba", "nfl", "racing", "afl"]):
        candidates.append(
            {
                "sport": sport,
                "event_id": f"{sport}-{index}",
                "event_name": f"{sport}-{index}",
                "market_type": "head_to_head" if sport != "racing" else "win",
                "selection": f"{sport}-{index}",
                "model_probability": 0.65,
                "market_odds": None,
                "derived_odds": 2.10,
                "odds_source": "model_implied",
                "edge": 0.12,
                "confidence": "high",
            }
        )

    qualified, _ = qualify_candidates(candidates, _rule_set(min_edge=0.05, max_stake_per_bet=25.0, max_bets_per_day=5))
    selected = allocate_candidates(qualified, _rule_set(min_edge=0.05, max_stake_per_bet=25.0, max_bets_per_day=5), 250.0)

    assert selected
    assert all(bet["stake"] <= 25.0 for bet in selected)
    assert round(sum(bet["stake"] for bet in selected), 2) <= 250.0


def test_derived_place_quinella_and_multi_odds_keep_provenance():
    race = {"race_id": "race-1", "venue": "Flemington", "race_number": 1}
    ranked = [
        {"selection": "Alpha", "model_probability": 0.4},
        {"selection": "Bravo", "model_probability": 0.3},
        {"selection": "Charlie", "model_probability": 0.2},
    ]

    place_candidates = build_place_candidates(race, ranked)
    quinella_candidates = build_quinella_candidates(race, ranked)
    multi = build_multi_candidate(
        [
            {
                "market_odds": None,
                "derived_odds": 1.9,
                "odds_source": "harville_derived",
            },
            {
                "market_odds": None,
                "derived_odds": 2.2,
                "odds_source": "model_implied",
            },
        ]
    )

    assert place_candidates
    assert quinella_candidates
    assert all(candidate["odds_source"] == "harville_derived" for candidate in place_candidates)
    assert all(candidate["odds_source"] == "harville_derived" for candidate in quinella_candidates)
    assert multi["market_type"] == "multi"
    assert multi["odds_sources"] == ["harville_derived", "model_implied"]


def test_allocate_candidates_can_select_multi_when_enabled():
    candidates = [
        {
            "sport": "afl",
            "event_id": "a1",
            "event_name": "Cats vs Blues",
            "market_type": "head_to_head",
            "selection": "Cats",
            "model_probability": 0.66,
            "market_odds": None,
            "derived_odds": 2.2,
            "odds_source": "model_implied",
            "edge": 0.2055,
            "confidence": "high",
        },
        {
            "sport": "nba",
            "event_id": "n1",
            "event_name": "Lakers vs Suns",
            "market_type": "head_to_head",
            "selection": "Lakers",
            "model_probability": 0.64,
            "market_odds": None,
            "derived_odds": 2.18,
            "odds_source": "model_implied",
            "edge": 0.1812,
            "confidence": "high",
        },
    ]

    selected = allocate_candidates(candidates, _rule_set(max_bets_per_day=1, allow_multis=True, max_multi_legs=2), 250.0)

    assert len(selected) == 1
    assert selected[0]["market_type"] == "multi"
    assert selected[0]["sport"] == "multi"
    assert "Cats" in selected[0]["selection"]
    assert "Lakers" in selected[0]["selection"]
    assert len(selected[0]["legs"]) == 2
    assert selected[0]["odds_sources"] == ["model_implied", "model_implied"]


def test_build_multi_candidates_only_uses_settleable_markets():
    candidates = [
        {
            "sport": "racing",
            "event_id": "r1",
            "event_name": "Flemington R1",
            "market_type": "place",
            "selection": "Runner A",
            "model_probability": 0.55,
            "market_odds": None,
            "derived_odds": 1.8,
            "odds_source": "harville_derived",
            "edge": 0.05,
            "confidence": "medium",
        },
        {
            "sport": "racing",
            "event_id": "r2",
            "event_name": "Flemington R2",
            "market_type": "quinella",
            "selection": "Runner B / Runner C",
            "model_probability": 0.3,
            "market_odds": None,
            "derived_odds": 3.6,
            "odds_source": "harville_derived",
            "edge": 0.02,
            "confidence": "medium",
        },
        {
            "sport": "afl",
            "event_id": "a1",
            "event_name": "Cats vs Blues",
            "market_type": "head_to_head",
            "selection": "Cats",
            "model_probability": 0.66,
            "market_odds": None,
            "derived_odds": 2.2,
            "odds_source": "model_implied",
            "edge": 0.2055,
            "confidence": "high",
        },
    ]

    multis = build_multi_candidates(candidates, _rule_set(max_bets_per_day=3, allow_multis=True, max_multi_legs=3))

    assert multis == []


def test_collect_candidates_passes_run_date_to_all_scrapers(monkeypatch):
    observed = {}

    def record_run_date(sport):
        def inner(run_date=None):
            observed[sport] = {"run_date": run_date}
            return []
        return inner

    monkeypatch.setattr(
        "app.strategy.racing_scraper.fetch_today_races",
        record_run_date("racing"),
    )
    monkeypatch.setattr(
        "app.strategy.afl_scraper.fetch_this_week_afl",
        record_run_date("afl"),
    )
    monkeypatch.setattr(
        "app.strategy.nba_scraper.fetch_today_nba",
        record_run_date("nba"),
    )

    service = StrategyService(racing_predictor=None, afl_predictor=None, nba_predictor=None)
    candidates = service.collect_candidates_for_date("2026-04-10")

    assert candidates == []
    assert observed == {
        "racing": {"run_date": "2026-04-10"},
        "afl": {"run_date": "2026-04-10"},
        "nba": {"run_date": "2026-04-10"},
    }


def test_mock_backed_existing_card_is_rebuilt(monkeypatch):
    profile = storage.get_strategy_profile("bob")
    existing = {
        "profile_key": "bob",
        "card_date": "2026-04-10",
        "selected_bets": [
            {
                "sport": "racing",
                "event_id": "r_0_1",
                "event_name": "Flemington R1",
                "selection": "Harbour Light",
            }
        ],
    }
    saved = {}

    monkeypatch.setattr(storage, "get_strategy_card", lambda profile_key, run_date: existing)
    monkeypatch.setattr(
        storage,
        "get_strategy_profile",
        lambda profile_key: {
            "profile_key": profile_key,
            "display_name": "Betmate Bob",
            "rule_set": profile["rule_set"],
        },
    )
    monkeypatch.setattr(
        storage,
        "save_strategy_card",
        lambda card, replace=False: saved.setdefault("result", {**card, "replace": replace}),
    )

    service = StrategyService(racing_predictor=None, afl_predictor=None, nba_predictor=None)
    monkeypatch.setattr(service, "collect_candidates_for_date", lambda run_date: [])

    card = service.get_or_create_card("bob", "2026-04-10")

    assert card["replace"] is True
    assert card["card_date"] == "2026-04-10"


def test_confidence_bucket_purely_on_probability():
    from app.strategy import confidence_bucket
    assert confidence_bucket(0.55, edge=0.0) == "high"
    assert confidence_bucket(0.35, edge=0.0) == "medium"
    assert confidence_bucket(0.20, edge=0.20) == "low"  # Edge does not boost bucket


def test_benter_blended_probability_edge_and_no_market():
    from app.strategy import calculate_benter_blended_probability
    # Missing or invalid market odds must yield strictly 0.0 edge
    p_blend, edge = calculate_benter_blended_probability(0.60, None, sport="racing")
    assert edge == 0.0
    assert p_blend == 0.60

    # With valid market odds (e.g. odds=2.50 -> p_market=0.40)
    p_blend, edge = calculate_benter_blended_probability(0.60, 2.50, sport="racing")
    assert p_blend > 0.40
    assert edge > 0.0


def test_overlap_policy_caps_selection_at_two_profiles():
    from app.strategy import allocate_candidates
    candidates = [
        {
            "sport": "racing",
            "event_id": "r100",
            "event_name": "Caulfield R1",
            "market_type": "win",
            "selection": "Super Star",
            "model_probability": 0.50,
            "market_odds": 3.0,
            "derived_odds": None,
            "odds_source": "live_market",
            "edge": 0.15,
            "confidence": "high",
        },
        {
            "sport": "racing",
            "event_id": "r101",
            "event_name": "Caulfield R2",
            "market_type": "win",
            "selection": "Next Best",
            "model_probability": 0.45,
            "market_odds": 2.8,
            "derived_odds": None,
            "odds_source": "live_market",
            "edge": 0.10,
            "confidence": "medium",
        },
    ]

    shared_usage = {}
    rule_set = _rule_set(min_edge=0.05, max_bets_per_day=1)

    # First profile allocates candidate
    sel1 = allocate_candidates(candidates, rule_set, 1000.0, selection_usage=shared_usage, max_overlap=2)
    assert len(sel1) == 1
    assert sel1[0]["selection"] == "Super Star"

    # Second profile allocates same candidate
    sel2 = allocate_candidates(candidates, rule_set, 1000.0, selection_usage=shared_usage, max_overlap=2)
    assert len(sel2) == 1
    assert sel2[0]["selection"] == "Super Star"

    # Third profile must be capped and fall back to Next Best
    sel3 = allocate_candidates(candidates, rule_set, 1000.0, selection_usage=shared_usage, max_overlap=2)
    assert len(sel3) == 1
    assert sel3[0]["selection"] == "Next Best"


def test_tiered_staking_and_no_zero_kelly_fallbacks():
    from app.strategy import suggested_stake
    # When Kelly <= 0, stake must be strictly 0.0 (no fallback)
    neg_ev_cand = {
        "model_probability": 0.20,
        "market_odds": 2.0,
        "edge": -0.10,
    }
    assert suggested_stake(neg_ev_cand, 1000.0, {"profile_key": "aggressive", "kelly_fraction": 0.75}) == 0.0

    # Aggressive profile: 0.75x Kelly with $50 floor on high EV
    pos_ev_cand = {
        "model_probability": 0.60,
        "market_odds": 2.20,
        "edge": 0.12,
    }
    agg_stake = suggested_stake(pos_ev_cand, 1000.0, {"profile_key": "aggressive", "max_stake_per_bet": 250.0})
    assert agg_stake >= 50.0
    assert agg_stake <= 250.0

    # Conservative profile: capped at $40
    con_stake = suggested_stake(pos_ev_cand, 10000.0, {"profile_key": "conservative", "max_stake_per_bet": 40.0})
    assert con_stake <= 40.0


def test_empty_card_waterfall_and_resting_rationales():
    from app.strategy import build_strategy_card
    # Disciplined profile Bob with no +EV candidates rests cleanly
    bob_profile = storage.get_strategy_profile("bob")
    bob_card = build_strategy_card(bob_profile, [], "2026-11-01")
    assert len(bob_card["selected_bets"]) == 0
    assert "Betmate Bob passed today" in bob_card["resting_rationale"]

    # Aggressive profile waterfalls to Action Play guaranteeing >= 1 bet
    agg_profile = storage.get_strategy_profile("aggressive")
    cand = [{
        "sport": "nba",
        "event_id": "game-1",
        "event_name": "Celtics vs Heat",
        "market_type": "head_to_head",
        "selection": "Celtics",
        "model_probability": 0.55,
        "market_odds": 1.90,
        "odds_source": "live_market",
        "edge": 0.01,
        "confidence": "high",
    }]
    agg_card = build_strategy_card(agg_profile, cand, "2026-11-01")
    assert len(agg_card["selected_bets"]) >= 1
    assert "Action Play" in agg_card["selected_bets"][0]["writeup"]


def test_nba_multi_and_sgm_profiles_generate_daily_bets_when_games_present():
    from app.strategy import build_strategy_card
    nba_multi_profile = storage.get_strategy_profile("nba_multi")
    sgm_profile = storage.get_strategy_profile("sgm_exclusive")

    candidates = [
        {
            "sport": "nba",
            "event_id": "game-101",
            "event_name": "Lakers vs Warriors",
            "market_type": "head_to_head",
            "selection": "Lakers",
            "model_probability": 0.58,
            "market_odds": 1.95,
            "odds_source": "live_market",
            "edge": 0.067,
            "confidence": "high",
        },
        {
            "sport": "nba",
            "event_id": "game-101",
            "event_name": "Lakers vs Warriors",
            "market_type": "total_points",
            "selection": "Over 224.5 Total Points",
            "model_probability": 0.55,
            "market_odds": 1.91,
            "odds_source": "live_market",
            "edge": 0.026,
            "confidence": "medium",
        },
        {
            "sport": "nba",
            "event_id": "game-102",
            "event_name": "Celtics vs Knicks",
            "market_type": "head_to_head",
            "selection": "Celtics",
            "model_probability": 0.62,
            "market_odds": 1.85,
            "odds_source": "live_market",
            "edge": 0.079,
            "confidence": "high",
        },
    ]

    # NBA Multi profile generates a cross-event multi
    nba_card = build_strategy_card(nba_multi_profile, candidates, "2026-11-01")
    assert len(nba_card["selected_bets"]) >= 1
    assert any(b.get("market_type") == "multi" for b in nba_card["selected_bets"])

    # SGM Exclusive generates a same-game multi
    sgm_card = build_strategy_card(sgm_profile, candidates, "2026-11-01")
    assert len(sgm_card["selected_bets"]) >= 1
    assert any(b.get("market_type") == "sgm" for b in sgm_card["selected_bets"])


