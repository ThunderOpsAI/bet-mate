import app.nightly as nightly


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
