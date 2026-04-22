"""
API integration tests using FastAPI TestClient.
Tests endpoints for predictions, paper bets, and settlement.
"""

import os
import re
import json
import base64
import hashlib
import hmac
import pytest
from app.time_utils import today_melbourne

# Force SQLite for tests before importing the app
os.environ["DATABASE_URL"] = ""
os.environ["BETMATE_DB_PATH"] = ":memory:"

from fastapi.testclient import TestClient


def _jwt_for_user(user_id: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {"sub": user_id}

    def _b64(data: dict) -> str:
        raw = json.dumps(data, separators=(",", ":"), sort_keys=True).encode("utf-8")
        return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")

    header_b64 = _b64(header)
    payload_b64 = _b64(payload)
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    secret = os.getenv("JWT_SECRET", "change-me-in-production").encode("utf-8")
    signature = hmac.new(secret, signing_input, hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(signature).decode("utf-8").rstrip("=")
    return f"{header_b64}.{payload_b64}.{sig_b64}"


def _auth_headers(user_id: str) -> dict:
    return {"Authorization": f"Bearer {_jwt_for_user(user_id)}"}


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
            assert "state" in race
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
                "state": "VIC",
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
            lambda run_date=None, allow_mock=None: [{"game_id": "afl-1", "date": run_date}],
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
    def test_create_paper_bet_requires_bearer_token(self, client):
        response = client.post(
            "/api/paper-bets",
            json={
                "sport": "afl",
                "event_id": "auth_required_1",
                "event_name": "A vs B",
                "selection": "A",
                "stake": 10,
                "odds": 1.9,
            },
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Missing bearer token"

    def test_get_paper_bets_empty(self, client):
        response = client.get("/api/paper-bets", headers=_auth_headers("user_a"))
        assert response.status_code == 200
        data = response.json()
        assert data["bets"] == []

    def test_get_paper_bet_summary_empty(self, client):
        response = client.get("/api/paper-bets/summary", headers=_auth_headers("user_a"))
        assert response.status_code == 200
        data = response.json()
        assert data["summary"]["total_bets"] == 0

    def test_get_paper_bet_trend_empty(self, client):
        response = client.get("/api/paper-bets/trend", headers=_auth_headers("user_a"))
        assert response.status_code == 200
        data = response.json()
        assert data["trend"] == []

    def test_create_paper_bet_requires_fields(self, client):
        response = client.post(
            "/api/paper-bets",
            json={"sport": "afl", "event_id": "g1", "selection": "A", "stake": 0},
            headers=_auth_headers("user_a"),
        )
        assert response.status_code == 400

    def test_create_paper_bet_enforces_stake_bounds(self, client):
        low_response = client.post(
            "/api/paper-bets",
            json={
                "sport": "afl",
                "event_id": "g_stake_low",
                "event_name": "Low Stake",
                "selection": "A",
                "stake": 0.5,
                "odds": 1.9,
            },
            headers=_auth_headers("user_a"),
        )
        high_response = client.post(
            "/api/paper-bets",
            json={
                "sport": "afl",
                "event_id": "g_stake_high",
                "event_name": "High Stake",
                "selection": "A",
                "stake": 10001,
                "odds": 1.9,
            },
            headers=_auth_headers("user_a"),
        )

        assert low_response.status_code == 400
        assert "stake must be between 1 and 10000" in low_response.json()["detail"]
        assert high_response.status_code == 400
        assert "stake must be between 1 and 10000" in high_response.json()["detail"]

    def test_create_paper_bet_rejects_incompatible_bet_type_for_sport(self, client):
        response = client.post(
            "/api/paper-bets",
            json={
                "sport": "nba",
                "event_id": "nba_bet_type_1",
                "event_name": "Lakers vs Celtics",
                "selection": "Lakers",
                "stake": 10,
                "odds": 2.1,
                "bet_type": "quinella",
            },
            headers=_auth_headers("user_a"),
        )

        assert response.status_code == 400
        assert "not supported for sport 'nba'" in response.json()["detail"]

    def test_create_paper_bet_allows_compatible_bet_type_for_sport(self, client):
        response = client.post(
            "/api/paper-bets",
            json={
                "sport": "racing",
                "event_id": "race_bet_type_1",
                "event_name": "Flemington R5",
                "selection": "Runner A",
                "stake": 15,
                "odds": 2.1,
                "bet_type": "place",
            },
            headers=_auth_headers("user_a"),
        )

        assert response.status_code == 200
        assert response.json()["bet"]["bet_type"] == "place"

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
            headers=_auth_headers("user_a"),
        )
        assert create_response.status_code == 200
        bet = create_response.json()["bet"]
        assert bet["status"] == "PENDING"
        bet_id = bet["id"]

        # Settle the bet
        settle_response = client.patch(
            f"/api/paper-bets/{bet_id}/settle",
            json={"status": "WON"},
            headers=_auth_headers("user_a"),
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
            headers=_auth_headers("user_a"),
        )
        bet_id = create_response.json()["bet"]["id"]

        delete_response = client.delete(f"/api/paper-bets/{bet_id}", headers=_auth_headers("user_a"))
        assert delete_response.status_code == 200
        assert delete_response.json()["deleted"] is True

        # Deleting again should 404
        delete_again = client.delete(f"/api/paper-bets/{bet_id}", headers=_auth_headers("user_a"))
        assert delete_again.status_code == 404

    def test_paper_bet_sport_filter(self, client):
        response = client.get("/api/paper-bets?sport=afl", headers=_auth_headers("user_a"))
        assert response.status_code == 200

    def test_paper_bet_status_filter(self, client):
        response = client.get("/api/paper-bets?status=PENDING", headers=_auth_headers("user_a"))
        assert response.status_code == 200

    def test_paper_bets_are_user_scoped_for_list_create_and_void(self, client):
        create_user_a = client.post(
            "/api/paper-bets",
            json={
                "sport": "afl",
                "event_id": "authz_g1",
                "event_name": "Team A vs Team B",
                "selection": "Team A",
                "stake": 10,
                "odds": 2.0,
            },
            headers=_auth_headers("user_a"),
        )
        assert create_user_a.status_code == 200
        bet_id = create_user_a.json()["bet"]["id"]

        create_user_b = client.post(
            "/api/paper-bets",
            json={
                "sport": "afl",
                "event_id": "authz_g2",
                "event_name": "Team C vs Team D",
                "selection": "Team C",
                "stake": 8,
                "odds": 1.9,
            },
            headers=_auth_headers("user_b"),
        )
        assert create_user_b.status_code == 200

        list_user_a = client.get("/api/paper-bets", headers=_auth_headers("user_a"))
        assert list_user_a.status_code == 200
        assert all(bet["user_id"] == "user_a" for bet in list_user_a.json()["bets"])
        assert all(bet["id"] != create_user_b.json()["bet"]["id"] for bet in list_user_a.json()["bets"])

        void_cross_user = client.patch(
            f"/api/paper-bets/{bet_id}/settle",
            json={"status": "VOID"},
            headers=_auth_headers("user_b"),
        )
        assert void_cross_user.status_code == 400

        void_owner = client.patch(
            f"/api/paper-bets/{bet_id}/settle",
            json={"status": "VOID"},
            headers=_auth_headers("user_a"),
        )
        assert void_owner.status_code == 200
        assert void_owner.json()["bet"]["status"] == "VOID"

    def test_paper_bet_summary_aggregates_pending_and_settled(self, client):
        import app.storage as storage

        storage.log_prediction_batch(
            sport="afl",
            event_id="sum_afl_1",
            event_name="A vs B",
            predictions=[
                {"selection": "A", "probability": 60, "fair_odds": 2.0},
                {"selection": "B", "probability": 40, "fair_odds": 2.5},
            ],
        )
        storage.log_prediction_batch(
            sport="afl",
            event_id="sum_afl_2",
            event_name="C vs D",
            predictions=[
                {"selection": "C", "probability": 55, "fair_odds": 1.9},
                {"selection": "D", "probability": 45, "fair_odds": 2.2},
            ],
        )

        won_bet = client.post(
            "/api/paper-bets",
            json={
                "sport": "afl",
                "event_id": "sum_afl_1",
                "event_name": "A vs B",
                "selection": "A",
                "stake": 20,
                "odds": 2.0,
            },
            headers=_auth_headers("user_a"),
        ).json()["bet"]
        client.patch(f"/api/paper-bets/{won_bet['id']}/settle", json={"status": "WON"}, headers=_auth_headers("user_a"))

        lost_bet = client.post(
            "/api/paper-bets",
            json={
                "sport": "afl",
                "event_id": "sum_afl_1",
                "event_name": "A vs B",
                "selection": "B",
                "stake": 15,
                "odds": 2.5,
            },
            headers=_auth_headers("user_a"),
        ).json()["bet"]
        client.patch(f"/api/paper-bets/{lost_bet['id']}/settle", json={"status": "LOST"}, headers=_auth_headers("user_a"))

        client.post(
            "/api/paper-bets",
            json={
                "sport": "afl",
                "event_id": "sum_afl_2",
                "event_name": "C vs D",
                "selection": "C",
                "stake": 12,
                "odds": 1.9,
            },
            headers=_auth_headers("user_a"),
        )

        summary_response = client.get("/api/paper-bets/summary?sport=afl", headers=_auth_headers("user_a"))
        assert summary_response.status_code == 200
        summary = summary_response.json()["summary"]
        assert summary["total_bets"] == 3
        assert summary["pending_bets"] == 1
        assert summary["settled_bets"] == 2
        assert summary["won_bets"] == 1
        assert summary["lost_bets"] == 1
        assert summary["total_staked"] == 47.0
        assert summary["settled_staked"] == 35.0
        assert summary["pending_exposure"] == 12.0
        assert summary["net_profit"] == 5.0


class TestResultIngestionSettlement:
    def test_ingested_racing_and_nba_results_settle_pending_bets(self, client, monkeypatch):
        import app.main as main_mod
        import app.storage as storage

        storage.log_prediction_batch(
            sport="nba",
            event_id="nba_ingest_1",
            event_name="Lakers vs Celtics",
            predictions=[
                {"selection": "Lakers", "probability": 57, "fair_odds": 1.75},
                {"selection": "Celtics", "probability": 43, "fair_odds": 2.33},
            ],
        )
        storage.log_prediction_batch(
            sport="racing",
            event_id="race_ingest_1",
            event_name="Randwick R6",
            predictions=[
                {
                    "selection": "Swift Star",
                    "probability": 35,
                    "fair_odds": 2.85,
                    "payload": {
                        "venue": "Randwick",
                        "canonical_venue": "Randwick",
                        "race_number": 6,
                        "meeting_date": "2026-04-09",
                        "state": "NSW",
                    },
                },
                {
                    "selection": "Late Charger",
                    "probability": 65,
                    "fair_odds": 1.54,
                    "payload": {
                        "venue": "Randwick",
                        "canonical_venue": "Randwick",
                        "race_number": 6,
                        "meeting_date": "2026-04-09",
                        "state": "NSW",
                    },
                },
            ],
        )

        nba_bet = client.post(
            "/api/paper-bets",
            json={
                "sport": "nba",
                "event_id": "nba_ingest_1",
                "event_name": "Lakers vs Celtics",
                "selection": "Lakers",
                "stake": 20,
                "odds": 1.75,
            },
            headers=_auth_headers("user_a"),
        ).json()["bet"]
        racing_bet = client.post(
            "/api/paper-bets",
            json={
                "sport": "racing",
                "event_id": "race_ingest_1",
                "event_name": "Randwick R6",
                "selection": "Swift Star",
                "stake": 10,
                "odds": 1.85,
                "bet_type": "place",
            },
            headers=_auth_headers("user_a"),
        ).json()["bet"]

        monkeypatch.setattr(main_mod.afl_scraper, "fetch_completed_afl_results", lambda **kwargs: [])
        monkeypatch.setattr(
            main_mod.nba_scraper,
            "fetch_completed_nba_results",
            lambda **kwargs: [
                {
                    "sport": "nba",
                    "event_id": "nba_ingest_1",
                    "event_name": "Lakers vs Celtics",
                    "winner_selection": "Lakers",
                }
            ],
        )
        monkeypatch.setattr(
            main_mod.storage,
            "list_pending_racing_result_targets",
            lambda limit=50: [
                {
                    "event_id": "race_ingest_1",
                    "event_name": "Randwick R6",
                    "venue": "Randwick",
                    "meeting_date": "2026-04-09",
                    "state": "NSW",
                    "race_number": 6,
                }
            ],
        )
        monkeypatch.setattr(
            main_mod.racing_scraper,
            "fetch_completed_racing_results",
            lambda targets, max_results=50: [
                {
                    "sport": "racing",
                    "event_id": "race_ingest_1",
                    "event_name": "Randwick R6",
                    "winner_selection": "Late Charger",
                    "result_payload": {
                        "finish_order": ["Late Charger", "Swift Star", "Harbour Light"],
                        "place_getters": ["Late Charger", "Swift Star", "Harbour Light"],
                        "starter_count": 9,
                        "exotic_outcomes": {
                            "quinella": ["Late Charger", "Swift Star"],
                            "exacta": ["Late Charger", "Swift Star"],
                            "trifecta": ["Late Charger", "Swift Star", "Harbour Light"],
                        },
                    },
                }
            ],
        )

        ingest_response = client.post("/api/predictions/results/ingest", json={"sports": ["nba", "racing"], "max_results": 10})
        assert ingest_response.status_code == 200
        assert ingest_response.json()["ingestion"]["settled"] == 2

        bets = {bet["id"]: bet for bet in client.get("/api/paper-bets", headers=_auth_headers("user_a")).json()["bets"]}
        assert bets[nba_bet["id"]]["status"] == "WON"
        assert bets[nba_bet["id"]]["profit"] == 15.0
        assert bets[racing_bet["id"]]["status"] == "WON"
        assert bets[racing_bet["id"]]["profit"] == 8.5


class TestBlackbookAutoBetEndpoints:
    def test_blackbook_auto_bet_validates_config(self, client):
        response = client.put(
            "/blackbook/Swift%20Star/auto-bet",
            json={
                "user_id": "alice",
                "sport": "nba",
                "bet_type": "quinella",
                "stake": 10,
                "enabled": True,
            },
        )
        assert response.status_code == 400
        assert "not supported for sport 'nba'" in response.json()["detail"]

    def test_blackbook_auto_bet_persists_and_reads_back(self, client):
        create_response = client.put(
            "/blackbook/Swift%20Star/auto-bet",
            json={
                "user_id": "alice",
                "sport": "racing",
                "bet_type": "win",
                "stake": 25,
                "enabled": True,
                "probability_threshold": 45.0,
                "notify_email": "alice@example.com",
            },
        )
        assert create_response.status_code == 200
        created = create_response.json()["config"]
        assert created["runner"] == "Swift Star"
        assert created["stake"] == 25.0
        assert created["probability_threshold"] == 45.0
        assert created["notify_email"] == "alice@example.com"

        fetch_response = client.get("/blackbook/Swift%20Star/auto-bet?user_id=alice")
        assert fetch_response.status_code == 200
        fetched = fetch_response.json()["config"]
        assert fetched["user_id"] == "alice"
        assert fetched["sport"] == "racing"
        assert fetched["bet_type"] == "win"
        assert fetched["enabled"] is True
        assert fetched["probability_threshold"] == 45.0

    def test_blackbook_trigger_creates_paper_bet_when_above_threshold(self, client, monkeypatch):
        import app.main as main_mod

        # Register a blackbook config for "Trigger Horse" at 40% threshold, $30 stake
        client.put(
            "/blackbook/Trigger%20Horse/auto-bet",
            json={"user_id": "bob", "sport": "racing", "bet_type": "win", "stake": 30, "probability_threshold": 40.0},
        )

        # Force the predictor to return 75% for Trigger Horse, 25% for the other
        monkeypatch.setattr(
            main_mod.racing_predictor,
            "predict",
            lambda horses: ([0.75, 0.25], [0.1] * 8),
        )

        race_payload = {
            "race_id": "trig-race-1",
            "venue": "Randwick",
            "race_number": 5,
            "distance": 1200,
            "horses": [
                {"horse_id": "h1", "name": "Trigger Horse", "barrier": 2, "weight": 57.0,
                 "past_win_rate": 0.3, "jockey_win_rate": 0.15, "track_condition": 1,
                 "days_since_last_race": 14, "betfair_back_price": 2.0, "betfair_implied_prob": 0.5},
                {"horse_id": "h2", "name": "Other Horse", "barrier": 5, "weight": 56.0,
                 "past_win_rate": 0.1, "jockey_win_rate": 0.1, "track_condition": 1,
                 "days_since_last_race": 21, "betfair_back_price": 5.0, "betfair_implied_prob": 0.2},
            ],
        }
        predict_response = client.post("/api/predict/racing", json=race_payload)
        assert predict_response.status_code == 200

        # Bob should have an auto paper bet for Trigger Horse
        bets = client.get("/api/paper-bets", headers=_auth_headers("bob")).json()["bets"]
        trigger_bets = [b for b in bets if b["selection"] == "Trigger Horse" and b["sport"] == "racing"]
        assert len(trigger_bets) == 1
        assert trigger_bets[0]["stake"] == 30.0
        assert trigger_bets[0]["bet_type"] == "win"

    def test_blackbook_trigger_skips_when_below_threshold(self, client, monkeypatch):
        import app.main as main_mod

        # Register a blackbook config with a high threshold (80%)
        client.put(
            "/blackbook/Slow%20Poke/auto-bet",
            json={"user_id": "carol", "sport": "racing", "bet_type": "win", "stake": 20, "probability_threshold": 80.0},
        )

        # Force predictor to return only 55% — below the 80% threshold
        monkeypatch.setattr(
            main_mod.racing_predictor,
            "predict",
            lambda horses: ([0.55, 0.45], [0.1] * 8),
        )

        race_payload = {
            "race_id": "trig-race-2",
            "venue": "Flemington",
            "race_number": 3,
            "distance": 1600,
            "horses": [
                {"horse_id": "h1", "name": "Slow Poke", "barrier": 1, "weight": 56.0,
                 "past_win_rate": 0.2, "jockey_win_rate": 0.12, "track_condition": 1,
                 "days_since_last_race": 7, "betfair_back_price": 3.0, "betfair_implied_prob": 0.33},
                {"horse_id": "h2", "name": "Fast Lane", "barrier": 3, "weight": 56.5,
                 "past_win_rate": 0.15, "jockey_win_rate": 0.11, "track_condition": 1,
                 "days_since_last_race": 10, "betfair_back_price": 4.0, "betfair_implied_prob": 0.25},
            ],
        }
        client.post("/api/predict/racing", json=race_payload)

        # Carol should have NO auto paper bet (55% < 80% threshold)
        bets = client.get("/api/paper-bets", headers=_auth_headers("carol")).json()["bets"]
        assert len(bets) == 0

    def test_blackbook_trigger_skips_disabled_config(self, client, monkeypatch):
        import app.main as main_mod

        # Register a DISABLED blackbook config
        client.put(
            "/blackbook/Ghost%20Runner/auto-bet",
            json={"user_id": "dave", "sport": "racing", "bet_type": "win", "stake": 15,
                  "probability_threshold": 30.0, "enabled": False},
        )

        # Force high probability — would trigger if enabled
        monkeypatch.setattr(
            main_mod.racing_predictor,
            "predict",
            lambda horses: ([0.90, 0.10], [0.1] * 8),
        )

        race_payload = {
            "race_id": "trig-race-3",
            "venue": "Caulfield",
            "race_number": 7,
            "distance": 1400,
            "horses": [
                {"horse_id": "h1", "name": "Ghost Runner", "barrier": 4, "weight": 57.0,
                 "past_win_rate": 0.35, "jockey_win_rate": 0.18, "track_condition": 1,
                 "days_since_last_race": 5, "betfair_back_price": 1.5, "betfair_implied_prob": 0.67},
                {"horse_id": "h2", "name": "Trailing", "barrier": 8, "weight": 55.5,
                 "past_win_rate": 0.05, "jockey_win_rate": 0.08, "track_condition": 1,
                 "days_since_last_race": 30, "betfair_back_price": 9.0, "betfair_implied_prob": 0.11},
            ],
        }
        client.post("/api/predict/racing", json=race_payload)

        # Dave should have NO bet (config is disabled)
        bets = client.get("/api/paper-bets", headers=_auth_headers("dave")).json()["bets"]
        assert len(bets) == 0


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
