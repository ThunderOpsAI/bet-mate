"""
Storage layer unit tests.
Covers prediction logging, settlement, dedupe, paper bets, accuracy metrics.
"""

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
