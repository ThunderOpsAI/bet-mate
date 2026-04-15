import app.nightly as nightly
from app.time_utils import MELBOURNE_TZ
from datetime import datetime


class DummyStrategyService:
    def get_or_create_cards(self, run_date):
        return [
            {
                "profile_key": "bob",
                "card_date": run_date,
                "selected_bets": [{"selection": "A"}],
                "total_allocated": 25.0,
            },
            {
                "profile_key": "james",
                "card_date": run_date,
                "selected_bets": [{"selection": "B"}, {"selection": "C"}],
                "total_allocated": 45.0,
            },
        ]

    def get_or_create_card(self, profile_key, run_date):
        return {
            "profile_key": profile_key,
            "card_date": run_date,
            "selected_bets": [{"selection": profile_key}],
            "total_allocated": 20.0,
        }


def test_run_nightly_cycle_generates_cards_and_propagates_gate(monkeypatch):
    monkeypatch.setattr(nightly.storage, "init_db", lambda: None)
    monkeypatch.setattr(
        nightly,
        "ingest_completed_results",
        lambda **kwargs: {
            "sports": {"afl": {"fetched": 2, "settled": 1, "skipped_unmatched": 1, "errors": [], "results": []}},
            "fetched": 2,
            "settled": 1,
            "skipped_unmatched": 1,
            "errors": [],
        },
    )
    monkeypatch.setattr(
        nightly.storage,
        "auto_tune_strategy_profile",
        lambda profile_key, reference_date=None: {
            "ran": False,
            "reason": "minimum 30 settled calendar days not met",
            "profile_key": profile_key,
            "reference_date": reference_date,
        },
    )

    summary = nightly.run_nightly_cycle(
        strategy_service=DummyStrategyService(),
        run_date="2026-04-10",
        ingest_sports=("afl",),
    )

    assert [card["profile_key"] for card in summary["generated_cards"]] == ["bob", "james"]
    assert summary["ingestion"]["settled"] == 1
    assert summary["auto_tune"]["bob"]["reason"] == "minimum 30 settled calendar days not met"
    assert summary["auto_tune"]["james"]["reference_date"] == "2026-04-10"


def test_run_nightly_cycle_can_target_single_profile_without_ingest_or_tune(monkeypatch):
    monkeypatch.setattr(nightly.storage, "init_db", lambda: None)

    summary = nightly.run_nightly_cycle(
        strategy_service=DummyStrategyService(),
        run_date="2026-04-10",
        profile_keys=("james",),
        ingest_results_enabled=False,
        tune_enabled=False,
    )

    assert [card["profile_key"] for card in summary["generated_cards"]] == ["james"]
    assert summary["ingestion"]["skipped"] is True
    assert summary["auto_tune"] == {}


def test_parse_scheduler_time_validates_format():
    parsed = nightly.parse_scheduler_time("05:30")

    assert parsed.hour == 5
    assert parsed.minute == 30


def test_next_scheduler_run_uses_melbourne_calendar_boundary():
    current = datetime(2026, 4, 10, 5, 1, tzinfo=MELBOURNE_TZ)

    next_run = nightly.next_scheduler_run(after=current, scheduled_time=nightly.parse_scheduler_time("05:00"))

    assert next_run.isoformat() == "2026-04-11T05:00:00+10:00"


def test_nightly_reruns_keep_single_system_bet_per_profile_event_selection(monkeypatch):
    import app.storage as storage

    class ReRunStrategyService:
        def get_or_create_cards(self, run_date):
            card = {
                "profile_key": "bob",
                "card_date": run_date,
                "display_name": "Betmate Bob",
                "bankroll_standard": 250.0,
                "bankroll_premium": 500.0,
                "bankroll_available": 250.0,
                "total_allocated": 20.0,
                "candidate_count": 1,
                "selected_bets": [
                    {
                        "sport": "racing",
                        "event_id": "race_auto_1",
                        "event_name": "Flemington R3",
                        "market_type": "win",
                        "selection": "Star Runner",
                        "model_probability": 0.42,
                        "odds_used": 2.5,
                        "odds_source": "model_implied",
                        "edge": 0.02,
                        "stake": 20.0,
                        "status": "pending",
                    }
                ],
                "skipped_opportunities": [],
                "sport_mix": {"racing": 20.0},
                "expected_edge": 0.02,
            }
            return [storage.save_strategy_card(card, replace=True)]

        def get_or_create_card(self, profile_key, run_date):
            raise NotImplementedError

    monkeypatch.setattr(
        nightly,
        "ingest_completed_results",
        lambda **kwargs: {"sports": {}, "fetched": 0, "settled": 0, "skipped_unmatched": 0, "errors": []},
    )
    nightly.run_nightly_cycle(
        strategy_service=ReRunStrategyService(),
        run_date="2026-04-10",
        ingest_results_enabled=False,
        tune_enabled=False,
    )
    nightly.run_nightly_cycle(
        strategy_service=ReRunStrategyService(),
        run_date="2026-04-10",
        ingest_results_enabled=False,
        tune_enabled=False,
    )

    bets = [
        bet for bet in storage.list_system_bets(profile_key="bob")
        if bet["event_id"] == "race_auto_1" and bet["selection"] == "Star Runner"
    ]
    assert len(bets) == 1


def test_weekly_retrain_runs_once_on_configured_day(monkeypatch):
    calls = []
    monkeypatch.setattr(nightly.storage, "init_db", lambda: None)
    monkeypatch.setattr(
        nightly,
        "ingest_completed_results",
        lambda **kwargs: {"sports": {}, "fetched": 0, "settled": 0, "skipped_unmatched": 0, "errors": []},
    )
    monkeypatch.setattr(nightly.storage, "auto_tune_strategy_profile", lambda *args, **kwargs: {"ran": False})
    monkeypatch.setattr(nightly.storage, "get_weekly_retrain_run", lambda run_date: None)
    monkeypatch.setattr(
        nightly.storage,
        "run_weekly_retrain",
        lambda reference_date, profile_keys=None: calls.append((reference_date, tuple(profile_keys or []))) or {
            "run_date": reference_date,
            "profile_count": len(profile_keys or []),
            "tuned_profiles": 0,
            "profiles": {},
        },
    )

    summary = nightly.run_nightly_cycle(
        strategy_service=DummyStrategyService(),
        run_date="2026-04-12",
        ingest_results_enabled=False,
        tune_enabled=False,
        weekly_retrain_enabled=True,
        weekly_retrain_day="sun",
    )
    assert summary["weekly_retrain"]["ran"] is True
    assert len(calls) == 1

    monkeypatch.setattr(
        nightly.storage,
        "get_weekly_retrain_run",
        lambda run_date: {"run_date": run_date, "profile_count": 2, "tuned_profiles": 0, "summary": {}},
    )
    second = nightly.run_nightly_cycle(
        strategy_service=DummyStrategyService(),
        run_date="2026-04-12",
        ingest_results_enabled=False,
        tune_enabled=False,
        weekly_retrain_enabled=True,
        weekly_retrain_day="sun",
    )
    assert second["weekly_retrain"]["ran"] is False
    assert second["weekly_retrain"]["reason"] == "already ran for date"
    assert len(calls) == 1


def test_weekly_retrain_skips_on_non_matching_weekday(monkeypatch):
    monkeypatch.setattr(nightly.storage, "init_db", lambda: None)
    monkeypatch.setattr(
        nightly,
        "ingest_completed_results",
        lambda **kwargs: {"sports": {}, "fetched": 0, "settled": 0, "skipped_unmatched": 0, "errors": []},
    )
    monkeypatch.setattr(nightly.storage, "auto_tune_strategy_profile", lambda *args, **kwargs: {"ran": False})

    summary = nightly.run_nightly_cycle(
        strategy_service=DummyStrategyService(),
        run_date="2026-04-10",
        ingest_results_enabled=False,
        tune_enabled=False,
        weekly_retrain_enabled=True,
        weekly_retrain_day="sun",
    )
    assert summary["weekly_retrain"]["ran"] is False
    assert summary["weekly_retrain"]["reason"] == "not scheduled weekday"
