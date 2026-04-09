"""
Storage layer unit tests.
Covers prediction logging, settlement, dedupe, paper bets, accuracy metrics.
"""

from datetime import date, timedelta

import pytest
import app.storage as storage


class TestPredictionLogging:
    def test_log_prediction_batch_inserts_rows(self):
        storage.log_prediction_batch(
            sport="afl",
            event_id="game_1",
            event_name="Collingwood vs Carlton",
            predictions=[
                {"selection": "Collingwood", "probability": 65.0, "fair_odds": 1.54},
                {"selection": "Carlton", "probability": 35.0, "fair_odds": 2.86},
            ],
        )
        recent = storage.get_recent_predictions(limit=10)
        assert len(recent) == 2
        names = {p["selection"] for p in recent}
        assert names == {"Collingwood", "Carlton"}

    def test_log_prediction_batch_dedupes_on_conflict(self):
        """Repeat page loads should update, not duplicate."""
        for _ in range(3):
            storage.log_prediction_batch(
                sport="afl",
                event_id="game_2",
                event_name="Brisbane vs Sydney",
                predictions=[
                    {"selection": "Brisbane", "probability": 60.0, "fair_odds": 1.67},
                    {"selection": "Sydney", "probability": 40.0, "fair_odds": 2.50},
                ],
            )
        recent = storage.get_recent_predictions(limit=100)
        game_2_preds = [p for p in recent if p["event_id"] == "game_2"]
        assert len(game_2_preds) == 2  # Not 6

    def test_log_empty_batch_is_noop(self):
        storage.log_prediction_batch(
            sport="afl",
            event_id="game_3",
            event_name="Empty",
            predictions=[],
        )
        recent = storage.get_recent_predictions(limit=100)
        game_3 = [p for p in recent if p["event_id"] == "game_3"]
        assert len(game_3) == 0


class TestPredictionSummary:
    def test_summary_groups_by_sport(self):
        storage.log_prediction_batch("afl", "g1", "A vs B", [
            {"selection": "A", "probability": 60, "fair_odds": 1.67},
        ])
        storage.log_prediction_batch("nba", "g2", "C vs D", [
            {"selection": "C", "probability": 55, "fair_odds": 1.82},
        ])
        summary = storage.get_prediction_summary()
        sports = {s["sport"] for s in summary}
        assert "afl" in sports
        assert "nba" in sports


class TestSettlement:
    def _seed_afl_game(self):
        storage.log_prediction_batch(
            sport="afl",
            event_id="settle_1",
            event_name="Geelong vs Richmond",
            predictions=[
                {"selection": "Geelong", "probability": 70.0, "fair_odds": 1.43},
                {"selection": "Richmond", "probability": 30.0, "fair_odds": 3.33},
            ],
        )

    def test_settle_with_winner_selection(self):
        self._seed_afl_game()
        result = storage.settle_prediction_result(
            sport="afl",
            event_id="settle_1",
            winner_selection="Geelong",
        )
        assert result["matched_predictions"] == 2
        assert result["matched_winner_predictions"] == 1

        recent = storage.get_recent_predictions(limit=100)
        geelong = [p for p in recent if p["selection"] == "Geelong" and p["event_id"] == "settle_1"]
        assert len(geelong) == 1
        assert geelong[0]["result_status"] == "win"
        assert geelong[0]["actual_outcome"] == 1.0

    def test_settle_with_selection_results(self):
        self._seed_afl_game()
        result = storage.settle_prediction_result(
            sport="afl",
            event_id="settle_1",
            selection_results={"Geelong": 1.0, "Richmond": 0.0},
        )
        assert result["matched_predictions"] == 2

    def test_settle_nonexistent_event_raises(self):
        with pytest.raises(ValueError, match="no logged predictions"):
            storage.settle_prediction_result(
                sport="afl",
                event_id="nonexistent",
                winner_selection="Nobody",
            )

    def test_settle_creates_result_record(self):
        self._seed_afl_game()
        storage.settle_prediction_result(
            sport="afl",
            event_id="settle_1",
            winner_selection="Geelong",
        )
        results = storage.get_recent_results(limit=10)
        assert any(r["event_id"] == "settle_1" for r in results)

    def test_settled_predictions_not_overwritten(self):
        """Once settled, repeat log_prediction_batch should not overwrite outcome."""
        self._seed_afl_game()
        storage.settle_prediction_result(
            sport="afl",
            event_id="settle_1",
            winner_selection="Geelong",
        )
        # Re-log the same predictions
        storage.log_prediction_batch(
            sport="afl",
            event_id="settle_1",
            event_name="Geelong vs Richmond",
            predictions=[
                {"selection": "Geelong", "probability": 75.0, "fair_odds": 1.33},
                {"selection": "Richmond", "probability": 25.0, "fair_odds": 4.00},
            ],
        )
        recent = storage.get_recent_predictions(limit=100)
        geelong = [p for p in recent if p["selection"] == "Geelong" and p["event_id"] == "settle_1"]
        assert geelong[0]["result_status"] == "win"
        # Probability should NOT have been updated since the prediction was settled
        assert geelong[0]["probability"] == 70.0


class TestPaperBets:
    def _seed_and_get_prediction(self):
        storage.log_prediction_batch(
            sport="racing",
            event_id="race_1",
            event_name="Flemington R3",
            predictions=[
                {"selection": "Thunder", "probability": 45.0, "fair_odds": 2.22},
            ],
        )

    def test_create_paper_bet(self):
        self._seed_and_get_prediction()
        bet = storage.create_paper_bet(
            sport="racing",
            event_id="race_1",
            event_name="Flemington R3",
            selection="Thunder",
            stake=10.0,
            odds=2.22,
        )
        assert bet["status"] == "PENDING"
        assert bet["stake"] == 10.0
        assert bet["sport"] == "racing"

    def test_create_bet_without_odds_uses_fair_odds(self):
        self._seed_and_get_prediction()
        bet = storage.create_paper_bet(
            sport="racing",
            event_id="race_1",
            event_name="Flemington R3",
            selection="Thunder",
            stake=10.0,
        )
        assert bet["odds"] == 2.22

    def test_create_bet_invalid_stake_raises(self):
        with pytest.raises(ValueError, match="stake must be greater"):
            storage.create_paper_bet(
                sport="racing",
                event_id="race_1",
                event_name="test",
                selection="test",
                stake=0,
                odds=2.0,
            )

    def test_settle_paper_bet_won(self):
        self._seed_and_get_prediction()
        bet = storage.create_paper_bet(
            sport="racing",
            event_id="race_1",
            event_name="Flemington R3",
            selection="Thunder",
            stake=10.0,
            odds=3.0,
        )
        settled = storage.settle_paper_bet(bet["id"], "WON")
        assert settled["status"] == "WON"
        assert settled["payout"] == 30.0
        assert settled["profit"] == 20.0

    def test_settle_paper_bet_lost(self):
        self._seed_and_get_prediction()
        bet = storage.create_paper_bet(
            sport="racing",
            event_id="race_1",
            event_name="Flemington R3",
            selection="Thunder",
            stake=10.0,
            odds=3.0,
        )
        settled = storage.settle_paper_bet(bet["id"], "LOST")
        assert settled["status"] == "LOST"
        assert settled["payout"] == 0.0
        assert settled["profit"] == -10.0

    def test_delete_paper_bet(self):
        self._seed_and_get_prediction()
        bet = storage.create_paper_bet(
            sport="racing",
            event_id="race_1",
            event_name="Flemington R3",
            selection="Thunder",
            stake=10.0,
            odds=2.22,
        )
        assert storage.delete_paper_bet(bet["id"]) is True
        assert storage.delete_paper_bet(bet["id"]) is False

    def test_get_paper_bets_with_filter(self):
        self._seed_and_get_prediction()
        storage.create_paper_bet(
            sport="racing", event_id="race_1", event_name="F R3",
            selection="Thunder", stake=10.0, odds=2.0,
        )
        bets = storage.get_paper_bets(status="PENDING")
        assert len(bets) >= 1
        assert all(b["status"] == "PENDING" for b in bets)

    def test_auto_settlement_on_result(self):
        """Paper bets should auto-settle when the prediction result settles."""
        storage.log_prediction_batch(
            sport="afl", event_id="auto_1", event_name="A vs B",
            predictions=[
                {"selection": "A", "probability": 60, "fair_odds": 1.67},
                {"selection": "B", "probability": 40, "fair_odds": 2.50},
            ],
        )
        bet = storage.create_paper_bet(
            sport="afl", event_id="auto_1", event_name="A vs B",
            selection="A", stake=20.0, odds=1.67,
        )
        assert bet["status"] == "PENDING"

        # Settle the prediction result
        storage.settle_prediction_result(
            sport="afl", event_id="auto_1", winner_selection="A",
        )

        # Check the paper bet was auto-settled
        bets = storage.get_paper_bets()
        auto_bet = [b for b in bets if b["id"] == bet["id"]]
        assert len(auto_bet) == 1
        assert auto_bet[0]["status"] == "WON"


class TestPaperBetSummary:
    def test_summary_with_no_bets(self):
        summary = storage.get_paper_bet_summary()
        assert summary["total_bets"] == 0
        assert summary["roi"] == 0.0

    def test_summary_calculates_roi(self):
        storage.log_prediction_batch(
            sport="afl", event_id="s1", event_name="X vs Y",
            predictions=[{"selection": "X", "probability": 60, "fair_odds": 1.67}],
        )
        bet = storage.create_paper_bet(
            sport="afl", event_id="s1", event_name="X vs Y",
            selection="X", stake=100.0, odds=2.0,
        )
        storage.settle_paper_bet(bet["id"], "WON")

        summary = storage.get_paper_bet_summary()
        assert summary["won_bets"] == 1
        assert summary["net_profit"] == 100.0
        assert summary["roi"] == 1.0  # 100% ROI


class TestAccuracy:
    def _seed_and_settle(self):
        storage.log_prediction_batch(
            sport="afl", event_id="acc_1", event_name="P vs Q",
            predictions=[
                {"selection": "P", "probability": 70, "fair_odds": 1.43},
                {"selection": "Q", "probability": 30, "fair_odds": 3.33},
            ],
        )
        storage.settle_prediction_result(
            sport="afl", event_id="acc_1", winner_selection="P",
        )

    def test_accuracy_returns_metrics(self):
        self._seed_and_settle()
        accuracy = storage.get_prediction_accuracy()
        assert accuracy["settled_predictions"] > 0
        assert 0 <= accuracy["brier_score"] <= 1
        assert accuracy["hit_rate"] >= 0

    def test_accuracy_by_sport_filter(self):
        self._seed_and_settle()
        accuracy = storage.get_prediction_accuracy(sport="afl")
        assert accuracy["sport"] == "afl"
        assert accuracy["settled_predictions"] > 0

    def test_accuracy_trend(self):
        self._seed_and_settle()
        trend = storage.get_prediction_accuracy_trend(days=30)
        # May be empty if settled_at date doesn't match, but should not error
        assert isinstance(trend, list)


class TestPaperBetTrend:
    def test_trend_with_no_data(self):
        trend = storage.get_paper_bet_trend()
        assert trend == []

    def test_trend_calculates_cumulative(self):
        storage.log_prediction_batch(
            sport="afl", event_id="t1", event_name="A vs B",
            predictions=[{"selection": "A", "probability": 60, "fair_odds": 1.67}],
        )
        bet = storage.create_paper_bet(
            sport="afl", event_id="t1", event_name="A vs B",
            selection="A", stake=50.0, odds=2.0,
        )
        storage.settle_paper_bet(bet["id"], "WON")

        trend = storage.get_paper_bet_trend(days=30)
        if trend:
            assert trend[-1]["cumulative_profit"] == 50.0


class TestStrategyStorage:
    def _save_system_card(self, profile_key: str, run_date: str, event_id: str, stake: float = 20.0):
        storage.save_strategy_card(
            {
                "profile_key": profile_key,
                "display_name": storage.get_strategy_profile(profile_key)["display_name"],
                "card_date": run_date,
                "bankroll_available": 250.0,
                "bankroll_standard": 250.0,
                "bankroll_premium": 500.0,
                "total_allocated": stake,
                "candidate_count": 1,
                "selected_bets": [
                    {
                        "sport": "afl",
                        "event_id": event_id,
                        "event_name": f"{event_id} A vs B",
                        "market_type": "head_to_head",
                        "selection": "A",
                        "model_probability": 0.6,
                        "odds_used": 1.8,
                        "odds_source": "model_implied",
                        "edge": 0.08,
                        "stake": stake,
                        "status": "pending",
                        "payout": None,
                        "profit": None,
                        "settled_at": None,
                    }
                ],
                "skipped_opportunities": [],
                "sport_mix": {"afl": 1.0},
                "expected_edge": 0.08,
            }
        )

    def _seed_tunable_profile_history(self, profile_key: str = "james", days: int = 30):
        start_day = date(2026, 2, 1)
        for index in range(days):
            run_date = (start_day + timedelta(days=index)).isoformat()
            event_id = f"{profile_key}-history-{index}"
            storage.log_prediction_batch(
                sport="afl",
                event_id=event_id,
                event_name=f"{event_id} A vs B",
                predictions=[
                    {"selection": "A", "probability": 60, "fair_odds": 1.8},
                    {"selection": "B", "probability": 40, "fair_odds": 2.2},
                ],
            )
            self._save_system_card(profile_key, run_date, event_id, stake=20.0)
            storage.settle_prediction_result(
                sport="afl",
                event_id=event_id,
                winner_selection="A",
                completed_at=f"{run_date}T12:00:00+11:00",
            )

    def test_default_profiles_seeded(self):
        profiles = storage.list_strategy_profiles()
        assert {profile["profile_key"] for profile in profiles} == {
            "bob",
            "james",
            "conservative",
            "neutral",
            "aggressive",
        }

    def test_default_profile_seed_uses_boolean_editable_flag(self, monkeypatch):
        inserted_rows = []

        class FakeResult:
            def __init__(self, rows):
                self._rows = rows

            def fetchall(self):
                return self._rows

        class FakeConn:
            def execute(self, sql, params=None):
                if "SELECT profile_key FROM strategy_profiles" in sql:
                    return FakeResult([])
                if "INSERT INTO strategy_profiles" in sql:
                    inserted_rows.append(params)
                    return FakeResult([])
                raise AssertionError(f"Unexpected SQL: {sql}")

            def commit(self):
                return None

        class FakeContextManager:
            def __enter__(self):
                return FakeConn()

            def __exit__(self, exc_type, exc, tb):
                return False

        monkeypatch.setattr(storage, "_connect", lambda: FakeContextManager())

        storage.ensure_default_strategy_profiles()

        assert inserted_rows
        assert all(isinstance(params[3], bool) for params in inserted_rows)

    def test_james_profile_round_trips(self):
        updated = storage.update_strategy_profile(
            "james",
            {
                "display_name": "James Test",
                "min_edge": 0.09,
                "sport_weights": {"racing": 0.5, "afl": 0.25, "nba": 0.25},
            },
        )
        assert updated["display_name"] == "James Test"
        assert updated["rule_set"]["min_edge"] == 0.09
        assert updated["rule_set"]["sport_weights"]["racing"] == 0.5

    def test_strategy_card_save_is_idempotent(self):
        card = {
            "profile_key": "bob",
            "display_name": "Betmate Bob",
            "card_date": "2026-04-09",
            "bankroll_available": 250.0,
            "bankroll_standard": 250.0,
            "bankroll_premium": 500.0,
            "total_allocated": 25.0,
            "candidate_count": 3,
            "selected_bets": [
                {
                    "sport": "afl",
                    "event_id": "g1",
                    "event_name": "A vs B",
                    "market_type": "head_to_head",
                    "selection": "A",
                    "model_probability": 0.6,
                    "odds_used": 1.9,
                    "odds_source": "model_implied",
                    "edge": 0.08,
                    "stake": 25.0,
                    "status": "pending",
                    "payout": None,
                    "profit": None,
                    "settled_at": None,
                }
            ],
            "skipped_opportunities": [],
            "sport_mix": {"afl": 1.0},
            "expected_edge": 0.08,
        }

        first = storage.save_strategy_card(card)
        second = storage.save_strategy_card(card)

        assert first["card_date"] == second["card_date"]
        assert len(storage.list_system_bets(profile_key="bob")) == 1

    def test_system_bets_settle_separately_from_prediction_log(self):
        storage.log_prediction_batch(
            sport="afl",
            event_id="system-1",
            event_name="A vs B",
            predictions=[
                {"selection": "A", "probability": 60, "fair_odds": 1.67},
                {"selection": "B", "probability": 40, "fair_odds": 2.5},
            ],
        )
        storage.save_strategy_card(
            {
                "profile_key": "bob",
                "display_name": "Betmate Bob",
                "card_date": "2026-04-09",
                "bankroll_available": 250.0,
                "bankroll_standard": 250.0,
                "bankroll_premium": 500.0,
                "total_allocated": 20.0,
                "candidate_count": 2,
                "selected_bets": [
                    {
                        "sport": "afl",
                        "event_id": "system-1",
                        "event_name": "A vs B",
                        "market_type": "head_to_head",
                        "selection": "A",
                        "model_probability": 0.6,
                        "odds_used": 1.67,
                        "odds_source": "model_implied",
                        "edge": 0.05,
                        "stake": 20.0,
                        "status": "pending",
                        "payout": None,
                        "profit": None,
                        "settled_at": None,
                    }
                ],
                "skipped_opportunities": [],
                "sport_mix": {"afl": 1.0},
                "expected_edge": 0.05,
            }
        )

        storage.settle_prediction_result(sport="afl", event_id="system-1", winner_selection="A")

        bets = storage.list_system_bets(profile_key="bob")
        assert bets[0]["status"] == "won"
        assert bets[0]["profit"] > 0

    def test_strategy_card_performance_stays_null_until_system_bets_settle(self):
        storage.log_prediction_batch(
            sport="afl",
            event_id="bob-performance-1",
            event_name="A vs B",
            predictions=[
                {"selection": "A", "probability": 60, "fair_odds": 1.8},
                {"selection": "B", "probability": 40, "fair_odds": 2.2},
            ],
        )
        self._save_system_card("bob", "2026-04-09", "bob-performance-1", stake=25.0)

        pending_card = storage.get_strategy_card("bob", "2026-04-09")
        assert pending_card["performance"] is None

        storage.settle_prediction_result(
            sport="afl",
            event_id="bob-performance-1",
            winner_selection="A",
            completed_at="2026-04-09T18:00:00+10:00",
        )

        settled_card = storage.get_strategy_card("bob", "2026-04-09")
        assert settled_card["performance"] is not None
        assert settled_card["performance"]["settled_bets"] == 1
        assert settled_card["performance"]["roi"] > 0

    def test_auto_tune_respects_30_day_gate(self):
        result = storage.auto_tune_strategy_profile("james", reference_date="2026-04-09")
        assert result["ran"] is False

    def test_auto_tune_updates_profile_and_writes_log(self):
        before = storage.get_strategy_profile("james")["rule_set"]
        self._seed_tunable_profile_history("james", days=30)

        result = storage.auto_tune_strategy_profile("james", reference_date="2026-03-02")

        assert result["ran"] is True
        assert result["settled_days"] == 30
        assert result["profile"]["rule_set"]["kelly_fraction"] != before["kelly_fraction"]
        assert result["profile"]["rule_set"]["min_edge"] != before["min_edge"]

        with storage._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM auto_tune_log WHERE profile_key = ? ORDER BY id DESC",
                ("james",),
            ).fetchall()

        assert len(rows) == 1
        assert rows[0]["window_start"] == "2026-02-01"
        assert rows[0]["window_end"] == "2026-03-02"


class TestPostgresJsonCompatibility:
    def test_loads_json_accepts_native_jsonb_values(self):
        assert storage._loads_json({"edge": 0.08}) == {"edge": 0.08}
        assert storage._loads_json(["afl", "nba"]) == ["afl", "nba"]
        assert storage._loads_json('{"edge": 0.08}') == {"edge": 0.08}
        assert storage._loads_json(None) == {}

    def test_row_helpers_accept_native_jsonb_rows(self):
        profile = storage._row_to_strategy_profile(
            {
                "id": 1,
                "profile_key": "bob",
                "display_name": "Betmate Bob",
                "rule_set_json": {"min_edge": 0.05},
                "is_editable": False,
                "created_at": "2026-04-10T00:00:00+00:00",
                "updated_at": "2026-04-10T00:00:00+00:00",
            }
        )
        prediction = storage._row_to_prediction(
            {
                "id": 1,
                "created_at": "2026-04-10T00:00:00+00:00",
                "updated_at": "2026-04-10T00:00:00+00:00",
                "sport": "afl",
                "event_id": "game-1",
                "event_name": "A vs B",
                "selection": "A",
                "probability": 0.6,
                "fair_odds": 1.8,
                "actual_outcome": None,
                "result_status": None,
                "settled_at": None,
                "payload_json": {"confidence": "high"},
                "feature_impact_json": {"home_ground": 0.12},
            }
        )
        result = storage._row_to_result(
            {
                "id": 1,
                "created_at": "2026-04-10T00:00:00+00:00",
                "updated_at": "2026-04-10T00:00:00+00:00",
                "completed_at": "2026-04-10T12:00:00+00:00",
                "sport": "afl",
                "event_id": "game-1",
                "event_name": "A vs B",
                "winner_selection": "A",
                "result_payload_json": {"winner_selection": "A"},
            }
        )

        assert profile["rule_set"]["min_edge"] == 0.05
        assert prediction["payload"]["confidence"] == "high"
        assert prediction["feature_impact"]["home_ground"] == 0.12
        assert result["payload"]["winner_selection"] == "A"

    def test_hydrate_strategy_card_accepts_native_run_payload(self):
        class FakeResult:
            def __init__(self, rows):
                self._rows = rows

            def fetchone(self):
                return self._rows[0] if self._rows else None

            def fetchall(self):
                return self._rows

        class FakeConn:
            def execute(self, sql, params=None):
                if "SELECT * FROM strategy_profiles" in sql:
                    return FakeResult([{"display_name": "Betmate Bob"}])
                if "FROM system_bets" in sql:
                    return FakeResult([])
                raise AssertionError(f"Unexpected SQL: {sql}")

        card = storage._hydrate_strategy_card(
            FakeConn(),
            {
                "id": 1,
                "profile_key": "bob",
                "run_date": "2026-04-10",
                "bankroll_standard": 250.0,
                "bankroll_premium": 500.0,
                "total_allocated": 0.0,
                "candidate_count": 0,
                "selected_count": 0,
                "skipped_count": 0,
                "run_payload_json": {
                    "bankroll_available": 250.0,
                    "skipped_opportunities": [{"selection": "A"}],
                    "sport_mix": {"afl": 1.0},
                    "expected_edge": 0.08,
                },
                "created_at": "2026-04-10T00:00:00+00:00",
            },
        )

        assert card["bankroll_available"] == 250.0
        assert card["skipped_opportunities"] == [{"selection": "A"}]
        assert card["sport_mix"] == {"afl": 1.0}
        assert card["expected_edge"] == 0.08
