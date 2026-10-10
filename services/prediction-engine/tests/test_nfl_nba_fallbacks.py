from datetime import date
from zoneinfo import ZoneInfo
from unittest.mock import MagicMock, patch

from app.data import nfl_scraper, nba_scraper
from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_nfl_no_data_returns_empty_list(monkeypatch):
    monkeypatch.setattr(nfl_scraper, "_get_api_headers", lambda: None)
    monkeypatch.setattr(nfl_scraper, "_fetch_nfl_data_py_or_fallback", lambda target_date: [])

    games = nfl_scraper.fetch_upcoming_nfl()
    assert games == []


def test_nba_no_data_returns_empty_list(monkeypatch):
    monkeypatch.setattr(nba_scraper, "BDL_API_KEY", "")

    games = nba_scraper.fetch_today_nba()
    assert games == []


def test_api_endpoints_return_empty_games_on_missing_data(monkeypatch):
    monkeypatch.setattr(nfl_scraper, "fetch_upcoming_nfl", lambda run_date=None: [])
    monkeypatch.setattr(nba_scraper, "fetch_today_nba", lambda run_date=None: [])

    nfl_res = client.get("/api/nfl/games/upcoming")
    assert nfl_res.status_code == 200
    assert nfl_res.json() == {"games": []}

    nba_res = client.get("/api/nba/games/today")
    assert nba_res.status_code == 200
    assert nba_res.json() == {"games": []}


def test_nba_is_preseason_uses_provider_metadata():
    game_preseason = {
        "id": 1,
        "home_team": {"full_name": "Boston Celtics"},
        "visitor_team": {"full_name": "New York Knicks"},
        "status": "Preseason",
        "date": "2026-10-15T00:00:00Z",
    }
    game_regular = {
        "id": 2,
        "home_team": {"full_name": "Boston Celtics"},
        "visitor_team": {"full_name": "New York Knicks"},
        "status": "Final",
        "date": "2026-10-15T00:00:00Z",
    }

    with patch.object(nba_scraper, "_bdl_get", side_effect=lambda ep, params=None: {"data": [game_preseason, game_regular]} if ep == "games" else {}):
        games = nba_scraper._fetch_live_nba(target_date=date(2026, 10, 15))
        assert len(games) == 2
        assert games[0]["is_preseason"] == 1
        # Game 2 before Oct 22 is NOT marked as preseason because date heuristic is removed
        assert games[1]["is_preseason"] == 0
