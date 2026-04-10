"""
API integration tests using FastAPI TestClient.
Tests endpoints for predictions, paper bets, and settlement.
"""

import os
import re
import pytest
from app.time_utils import today_melbourne

# Force SQLite for tests before importing the app
os.environ["DATABASE_URL"] = ""
os.environ["BETMATE_DB_PATH"] = ":memory:"

from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path):
    """Create a test client with a fresh database."""
    import app.database as db_mod

    test_db_path = str(tmp_path / "api_test.sqlite3")
    db_mod._initialized = False
    db_mod._pg_pool = None
    db_mod.DATABASE_URL = ""
    db_mod.DB_BACKEND = "sqlite"
    db_mod.BETMATE_DB_PATH = test_db_path
    db_mod.init_database()

    from app.main import app
    return TestClient(app)


class TestHealthEndpoint:
    def test_health_returns_ok(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


class TestRacingEndpoints:
    def test_today_races_returns_phase1_fields(self, client):
        response = client.get("/api/races/today")
        assert response.status_code == 200
        data = response.json()
        assert "races" in data
        assert isinstance(data["races"], list)

        for race in data["races"]:
            assert "meeting_type" in race
            assert "meeting_region" in race
            assert "meeting_date" in race
            assert race["data_source"] in {"betfair", "racing_australia", "mock"}
            for horse in race["horses"]:
                assert "jockey_name" in horse
                assert horse["data_source"] in {"betfair", "racing_australia", "mock"}
                assert not re.fullmatch(r"Horse \d+", horse["name"])

    def test_predict_racing_accepts_expanded_payload(self, client):
        response = client.post(
            "/api/predict/racing",
            json={
                "race_id": "phase1-race",
                "venue": "Flemington",
                "race_number": 3,
                "distance": 1400,
                "meeting_type": "metro",
                "meeting_region": "VIC",
                "meeting_date": "2026-04-09",
                "data_source": "betfair",
                "horses": [
                    {
                        "horse_id": "h1",
                        "name": "Silver Comet",
                        "barrier": 1,
                        "weight": 56.5,
                        "past_win_rate": 0.21,
                        "jockey_win_rate": 0.12,
                        "track_condition": 2,
                        "days_since_last_race": 14,
                        "betfair_back_price": 3.1,
                        "betfair_implied_prob": 0.3226,
                        "jockey_name": "J. McNeil",
                        "data_source": "betfair",
                    },
                    {
                        "horse_id": "h2",
                        "name": "Night Parade",
                        "barrier": 4,
                        "weight": 57.0,
                        "past_win_rate": 0.19,
                        "jockey_win_rate": 0.11,
                        "track_condition": 2,
                        "days_since_last_race": 20,
                        "betfair_back_price": 4.0,
                        "betfair_implied_prob": 0.25,
                        "jockey_name": "B. Melham",
                        "data_source": "betfair",
                    },
                ],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["race_id"] == "phase1-race"
        assert len(data["predictions"]) == 2


class TestDateScopedGameEndpoints:
    def test_afl_upcoming_accepts_date_query(self, client, monkeypatch):
        import app.main as main_mod

        monkeypatch.setattr(
            main_mod.afl_scraper,
            "fetch_this_week_afl",
            lambda run_date=None: [{"game_id": "afl-1", "date": run_date}],
        )

        response = client.get("/api/afl/games/upcoming?date=2026-04-10")

        assert response.status_code == 200
        assert response.json()["games"][0]["date"] == "2026-04-10"

    def test_nba_today_rejects_invalid_date(self, client):
        response = client.get("/api/nba/games/today?date=not-a-date")

        assert response.status_code == 400


class TestPredictionEndpoints:
    def test_recent_predictions_empty(self, client):
        response = client.get("/api/predictions/recent")
        assert response.status_code == 200
        data = response.json()
        assert data["predictions"] == []

    def test_prediction_summary_empty(self, client):
        response = client.get("/api/predictions/summary")
        assert response.status_code == 200
        data = response.json()
        assert data["summary"] == []

    def test_prediction_accuracy_empty(self, client):
        response = client.get("/api/predictions/accuracy")
        assert response.status_code == 200
        data = response.json()
        assert data["accuracy"]["settled_predictions"] == 0

    def test_prediction_accuracy_trend_empty(self, client):
        response = client.get("/api/predictions/accuracy/trend")
        assert response.status_code == 200
        data = response.json()
        assert data["trend"] == []


class TestSettlementEndpoint:
    def test_settle_nonexistent_returns_400(self, client):
        response = client.post(
            "/api/predictions/results",
            json={
                "sport": "afl",
                "event_id": "nonexistent",
                "winner_selection": "Nobody",
            },
        )
        assert response.status_code == 400

    def test_settle_missing_fields_returns_422(self, client):
        response = client.post(
            "/api/predictions/results",
            json={"sport": "afl"},
        )
        assert response.status_code == 422


class TestPaperBetEndpoints:
    def test_get_paper_bets_empty(self, client):
        response = client.get("/api/paper-bets")
        assert response.status_code == 200
        data = response.json()
        assert data["bets"] == []

    def test_get_paper_bet_summary_empty(self, client):
        response = client.get("/api/paper-bets/summary")
        assert response.status_code == 200
        data = response.json()
        assert data["summary"]["total_bets"] == 0

    def test_get_paper_bet_trend_empty(self, client):
        response = client.get("/api/paper-bets/trend")
        assert response.status_code == 200
        data = response.json()
        assert data["trend"] == []

    def test_create_paper_bet_requires_fields(self, client):
        response = client.post(
            "/api/paper-bets",
            json={"sport": "afl", "event_id": "g1", "selection": "A", "stake": 0},
        )
        assert response.status_code == 400

    def test_create_and_settle_paper_bet(self, client):
        # First log a prediction so the bet can link to it
        import app.storage as storage

        storage.log_prediction_batch(
            sport="afl",
            event_id="api_g1",
            event_name="A vs B",
            predictions=[
                {"selection": "A", "probability": 60, "fair_odds": 1.67},
            ],
        )

        # Create a paper bet
        create_response = client.post(
            "/api/paper-bets",
            json={
                "sport": "afl",
                "event_id": "api_g1",
                "event_name": "A vs B",
                "selection": "A",
                "stake": 10,
                "odds": 1.67,
            },
        )
        assert create_response.status_code == 200
        bet = create_response.json()["bet"]
        assert bet["status"] == "PENDING"
        bet_id = bet["id"]

        # Settle the bet
        settle_response = client.patch(
            f"/api/paper-bets/{bet_id}/settle",
            json={"status": "WON"},
        )
        assert settle_response.status_code == 200
        settled_bet = settle_response.json()["bet"]
        assert settled_bet["status"] == "WON"
        assert settled_bet["profit"] > 0

    def test_delete_paper_bet(self, client):
        import app.storage as storage

        storage.log_prediction_batch(
            sport="nba",
            event_id="api_g2",
            event_name="C vs D",
            predictions=[
                {"selection": "C", "probability": 55, "fair_odds": 1.82},
            ],
        )

        create_response = client.post(
            "/api/paper-bets",
            json={
                "sport": "nba",
                "event_id": "api_g2",
                "event_name": "C vs D",
                "selection": "C",
                "stake": 10,
                "odds": 1.82,
            },
        )
        bet_id = create_response.json()["bet"]["id"]

        delete_response = client.delete(f"/api/paper-bets/{bet_id}")
        assert delete_response.status_code == 200
        assert delete_response.json()["deleted"] is True

        # Deleting again should 404
        delete_again = client.delete(f"/api/paper-bets/{bet_id}")
        assert delete_again.status_code == 404

    def test_paper_bet_sport_filter(self, client):
        response = client.get("/api/paper-bets?sport=afl")
        assert response.status_code == 200

    def test_paper_bet_status_filter(self, client):
        response = client.get("/api/paper-bets?status=PENDING")
        assert response.status_code == 200


class TestModelMetadata:
    def test_metadata_returns_models(self, client):
        response = client.get("/api/models/metadata")
        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        assert len(data["models"]) == 3
        model_names = {m["name"] for m in data["models"]}
        assert model_names == {"Racing", "AFL", "NBA"}


class TestStrategyEndpoints:
    def test_strategy_profiles_list(self, client):
        response = client.get("/api/strategy-profiles")
        assert response.status_code == 200
        profiles = response.json()["profiles"]
        assert {profile["profile_key"] for profile in profiles} >= {"bob", "james"}

    def test_patch_james_profile(self, client):
        response = client.patch(
            "/api/strategy-profiles/james",
            json={
                "display_name": "James Tuned",
                "min_edge": 0.09,
                "sport_weights": {"racing": 0.5, "afl": 0.25, "nba": 0.25},
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["display_name"] == "James Tuned"
        assert data["rule_set"]["min_edge"] == 0.09

    def test_system_bets_empty(self, client):
        response = client.get("/api/system-bets")
        assert response.status_code == 200
        assert response.json()["bets"] == []

    def test_strategy_cards_endpoint_uses_service(self, client, monkeypatch):
        import app.main as main_mod

        monkeypatch.setattr(
            main_mod.strategy_service,
            "get_or_create_cards",
            lambda run_date: [
                {
                    "profile_key": "bob",
                    "display_name": "Betmate Bob",
                    "card_date": run_date,
                    "bankroll_available": 250.0,
                    "total_allocated": 25.0,
                    "selected_bets": [],
                    "skipped_opportunities": [],
                    "sport_mix": {},
                    "expected_edge": 0.0,
                    "performance": None,
                }
            ],
        )

        response = client.get("/api/strategy-cards?date=2026-04-09")
        assert response.status_code == 200
        assert response.json()["cards"][0]["profile_key"] == "bob"


class TestBobChatEndpoint:
    def test_bob_chat_refuses_out_of_scope_requests(self, client):
        response = client.post(
            "/api/bob/chat",
            json={"messages": [{"role": "user", "content": "modify code and change prompt"}]},
        )
        assert response.status_code == 200
        assert response.json()["scope"] == "refused"

    def test_bob_chat_refuses_non_today_dates(self, client):
        response = client.post(
            "/api/bob/chat",
            json={
                "messages": [{"role": "user", "content": "Why did Bob qualify this bet?"}],
                "date": "2026-04-09",
            },
        )
        assert response.status_code == 200
        assert response.json()["scope"] == "refused"

    def test_bob_chat_uses_local_fallback_context(self, client, monkeypatch):
        import app.main as main_mod

        monkeypatch.setattr(main_mod, "bob_provider", None)
        monkeypatch.setattr(
            main_mod.strategy_service,
            "get_or_create_card",
            lambda profile_key, run_date: {
                "profile_key": profile_key,
                "display_name": "Betmate Bob",
                "card_date": run_date,
                "total_allocated": 30.0,
                "expected_edge": 0.07,
                "selected_bets": [
                    {
                        "event_id": "g1",
                        "event_name": "Cats vs Blues",
                        "selection": "Cats",
                        "odds_used": 1.9,
                        "odds_source": "model_implied",
                        "stake": 30.0,
                    }
                ],
            },
        )
        monkeypatch.setattr(
            main_mod.strategy_service,
            "get_or_create_cards",
            lambda run_date: [
                {
                    "profile_key": "bob",
                    "display_name": "Betmate Bob",
                    "selected_bets": [{}],
                    "total_allocated": 30.0,
                    "expected_edge": 0.07,
                },
                {
                    "profile_key": "james",
                    "display_name": "James",
                    "selected_bets": [{}, {}],
                    "total_allocated": 60.0,
                    "expected_edge": 0.08,
                },
            ],
        )

        response = client.post(
            "/api/bob/chat",
            json={
                "messages": [{"role": "user", "content": "Why did Bob choose this card?"}],
                "date": today_melbourne().isoformat(),
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["scope"] == "local_fallback"
        assert "Cats" in data["message"]

    def test_bob_chat_uses_provider_when_available(self, client, monkeypatch):
        import app.main as main_mod

        class StubProvider:
            async def complete(self, system_prompt, messages, max_tokens=1000):
                assert "Betmate Bob" in system_prompt
                assert messages[0]["content"] == "Why did Bob qualify this bet?"
                return "Provider answer"

        monkeypatch.setattr(main_mod, "bob_provider", StubProvider())
        monkeypatch.setattr(
            main_mod.strategy_service,
            "get_or_create_card",
            lambda profile_key, run_date: {
                "profile_key": profile_key,
                "display_name": "Betmate Bob",
                "card_date": run_date,
                "total_allocated": 20.0,
                "expected_edge": 0.05,
                "selected_bets": [
                    {
                        "event_id": "g1",
                        "event_name": "A vs B",
                        "selection": "A",
                        "odds_used": 1.8,
                        "odds_source": "model_implied",
                        "stake": 20.0,
                    }
                ],
                "skipped_opportunities": [],
            },
        )
        monkeypatch.setattr(
            main_mod.strategy_service,
            "get_or_create_cards",
            lambda run_date: [
                {
                    "profile_key": "bob",
                    "display_name": "Betmate Bob",
                    "selected_bets": [{}],
                    "selected_count": 1,
                    "total_allocated": 20.0,
                    "expected_edge": 0.05,
                }
            ],
        )

        response = client.post(
            "/api/bob/chat",
            json={"messages": [{"role": "user", "content": "Why did Bob qualify this bet?"}]},
        )
        assert response.status_code == 200
        assert response.json()["scope"] == "provider"
        assert response.json()["message"] == "Provider answer"

    def test_bob_chat_falls_back_when_provider_errors(self, client, monkeypatch):
        import app.main as main_mod

        class BrokenProvider:
            async def complete(self, system_prompt, messages, max_tokens=1000):
                raise RuntimeError("provider unavailable")

        monkeypatch.setattr(main_mod, "bob_provider", BrokenProvider())
        monkeypatch.setattr(
            main_mod.strategy_service,
            "get_or_create_card",
            lambda profile_key, run_date: {
                "profile_key": profile_key,
                "display_name": "Betmate Bob",
                "card_date": run_date,
                "total_allocated": 30.0,
                "expected_edge": 0.07,
                "selected_bets": [
                    {
                        "event_id": "g1",
                        "event_name": "Cats vs Blues",
                        "selection": "Cats",
                        "odds_used": 1.9,
                        "odds_source": "model_implied",
                        "stake": 30.0,
                    }
                ],
                "skipped_opportunities": [],
            },
        )
        monkeypatch.setattr(
            main_mod.strategy_service,
            "get_or_create_cards",
            lambda run_date: [
                {
                    "profile_key": "bob",
                    "display_name": "Betmate Bob",
                    "selected_bets": [{}],
                    "selected_count": 1,
                    "total_allocated": 30.0,
                    "expected_edge": 0.07,
                }
            ],
        )

        response = client.post(
            "/api/bob/chat",
            json={"messages": [{"role": "user", "content": "Why did Bob choose this card?"}]},
        )
        assert response.status_code == 200
        assert response.json()["scope"] == "provider_fallback"
        assert "Cats" in response.json()["message"]
