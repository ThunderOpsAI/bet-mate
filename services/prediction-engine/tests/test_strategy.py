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
    for index, sport in enumerate(["racing", "afl", "nba", "racing", "afl"]):
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
