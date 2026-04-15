import app.data.nba_scraper as nba_scraper
from app.time_utils import today_melbourne


def test_fetch_today_nba_scopes_to_requested_run_date(monkeypatch):
    def fake_bdl_get(endpoint, params=None):
        params = params or {}
        if endpoint == "games" and "dates[]" in params:
            if params["dates[]"] == "2026-04-10":
                return {
                    "data": [
                        {
                            "id": 201,
                            "date": "2026-04-10T09:00:00Z",
                            "status": "Scheduled",
                            "home_team": {"id": 1, "full_name": "Los Angeles Lakers"},
                            "visitor_team": {"id": 2, "full_name": "Phoenix Suns"},
                            "home_team_score": 0,
                            "visitor_team_score": 0,
                        }
                    ]
                }
            return {"data": []}

        if endpoint == "games" and "seasons[]" in params:
            return {
                "data": [
                    {
                        "id": 301,
                        "date": "2026-03-20T09:00:00Z",
                        "status": "Final",
                        "home_team": {"id": 1, "full_name": "Los Angeles Lakers"},
                        "visitor_team": {"id": 2, "full_name": "Phoenix Suns"},
                        "home_team_score": 112,
                        "visitor_team_score": 108,
                    }
                ]
            }
        return {}

    monkeypatch.setattr(nba_scraper, "BDL_API_KEY", "test-key")
    monkeypatch.setattr(nba_scraper, "_bdl_get", fake_bdl_get)

    games = nba_scraper.fetch_today_nba(run_date="2026-04-10")

    assert len(games) == 1
    assert games[0]["game_id"] == "201"
    assert games[0]["home_team"] == "Los Angeles Lakers"
    assert nba_scraper.fetch_today_nba(run_date="2026-04-11") == []


def test_fetch_today_nba_can_disable_mock_fallback(monkeypatch):
    monkeypatch.setattr(nba_scraper, "BDL_API_KEY", "")

    games = nba_scraper.fetch_today_nba(run_date=today_melbourne().isoformat(), allow_mock=False)

    assert games == []
