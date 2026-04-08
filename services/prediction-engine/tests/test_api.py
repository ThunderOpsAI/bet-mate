"""
API integration tests using FastAPI TestClient.
Tests endpoints for predictions, paper bets, and settlement.
"""

import os
import pytest

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
