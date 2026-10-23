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


def test_nfl_live_fetch_no_fabricated_random_features(monkeypatch):
    fake_markets = [
        {
            "marketId": "1.23456",
            "marketStartTime": "2026-10-20T18:00:00Z",
            "event": {"id": "999", "name": "Kansas City Chiefs v Baltimore Ravens"},
            "runners": [
                {"selectionId": 111, "runnerName": "Kansas City Chiefs"},
                {"selectionId": 222, "runnerName": "Baltimore Ravens"},
            ],
        }
    ]
    fake_prices = {
        "1.23456": {
            "111": {"back": 1.75},
            "222": {"back": 2.15},
        }
    }

    class DummyResp:
        def raise_for_status(self):
            pass
        def json(self):
            return fake_markets

    monkeypatch.setattr(nfl_scraper.requests, "post", lambda *args, **kwargs: DummyResp())
    monkeypatch.setattr(nfl_scraper, "_fetch_prices", lambda headers, m_ids: fake_prices)

    games = nfl_scraper._fetch_live_nfl(headers={"token": "test"}, target_date=date(2026, 10, 20))
    assert len(games) == 1
    game = games[0]

    assert game["home_team"] == "Kansas City Chiefs"
    assert game["away_team"] == "Baltimore Ravens"
    assert game["home_odds"] == 1.75
    assert game["away_odds"] == 2.15
    assert game["date"] == "2026-10-20T18:00:00Z"
    # Features must not contain fabricated random EPA or spread numbers
    assert "epa_diff" not in game["features"]
    assert "spread_line" not in game["features"]


def test_nfl_data_py_preserves_real_kickoff_and_omits_missing_kickoff(monkeypatch):
    import pandas as pd
    schedules_data = pd.DataFrame([
        {
            "game_id": "2026_01_KC_BAL",
            "season": 2026,
            "week": 1,
            "gameday": "2026-09-10",
            "gametime": "20:20",
            "home_team": "KC",
            "away_team": "BAL",
            "home_score": 27.0,
            "away_score": 20.0,
            "home_rest": 7,
            "away_rest": 7,
            "roof": "outdoors",
            "spread_line": -3.0,
            "stadium": "Arrowhead Stadium",
        },
        {
            "game_id": "2026_07_SEA_DEN",
            "season": 2026,
            "week": 7,
            "gameday": "2026-10-22",
            "gametime": "20:15",
            "home_team": "DEN",
            "away_team": "SEA",
            "home_score": float("nan"),
            "away_score": float("nan"),
            "home_rest": 10,
            "away_rest": 7,
            "roof": "outdoors",
            "spread_line": 3.5,
            "stadium": "Empower Field",
        },
        {
            "game_id": "2026_07_UNDATED",
            "season": 2026,
            "week": 7,
            "gameday": "2026-10-25",
            "gametime": None,  # Missing provider kickoff time
            "home_team": "KC",
            "away_team": "LAC",
            "home_score": float("nan"),
            "away_score": float("nan"),
            "home_rest": 7,
            "away_rest": 7,
            "roof": "dome",
            "spread_line": -6.5,
            "stadium": "Arrowhead Stadium",
        },
    ])

    dummy_nfl_module = MagicMock()
    dummy_nfl_module.import_schedules.return_value = schedules_data
    monkeypatch.setitem(nfl_scraper.__builtins__ if isinstance(nfl_scraper.__builtins__, dict) else nfl_scraper.__builtins__.__dict__, "import_module", lambda name: dummy_nfl_module)

    with patch.dict("sys.modules", {"nfl_data_py": dummy_nfl_module}):
        games = nfl_scraper._fetch_nfl_data_py_or_fallback(target_date=date(2026, 10, 20))
        assert len(games) == 2

        # Game 1: Real kickoff time 20:15 US/Eastern converted to UTC ISO (2026-10-23T00:15:00Z)
        game1 = games[0]
        assert game1["date"] == "2026-10-23T00:15:00Z"
        assert game1["features"]["spread_line"] == 3.5
        assert game1["features"]["rest_diff"] == 3.0
        assert game1["features"]["is_dome"] == 0.0

        # Game 2: Missing gametime MUST NOT invent "2026-10-25T00:00:00Z"
        game2 = games[1]
        assert game2["date"] is None
        assert game2["features"]["spread_line"] == -6.5
        assert game2["features"]["rest_diff"] == 0.0
        assert game2["features"]["is_dome"] == 1.0

