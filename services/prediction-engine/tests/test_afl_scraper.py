import app.data.afl_scraper as afl_scraper


def test_fetch_this_week_afl_scopes_to_requested_run_date(monkeypatch):
    def fake_squiggle_get(params):
        if params.get("q") == "games":
            return {
                "games": [
                    {
                        "id": 101,
                        "date": "2026-04-10 19:50:00",
                        "complete": 0,
                        "round": 5,
                        "venue": "MCG",
                        "hteamid": 1,
                        "ateamid": 2,
                        "hteam": "Geelong Cats",
                        "ateam": "Carlton",
                    },
                    {
                        "id": 102,
                        "date": "2026-04-11 19:50:00",
                        "complete": 0,
                        "round": 5,
                        "venue": "SCG",
                        "hteamid": 3,
                        "ateamid": 4,
                        "hteam": "Sydney Swans",
                        "ateam": "Brisbane Lions",
                    },
                ]
            }
        if params.get("q") == "standings":
            return {
                "standings": [
                    {"id": 1, "wins": 3, "losses": 1, "for": 340, "against": 300, "played": 4},
                    {"id": 2, "wins": 2, "losses": 2, "for": 320, "against": 315, "played": 4},
                    {"id": 3, "wins": 4, "losses": 0, "for": 360, "against": 280, "played": 4},
                    {"id": 4, "wins": 1, "losses": 3, "for": 295, "against": 345, "played": 4},
                ]
            }
        if params.get("q") == "tips":
            return {
                "tips": [
                    {"gameid": 101, "tip": "Geelong Cats", "confidence": 62, "tipteamid": 1},
                    {"gameid": 102, "tip": "Sydney Swans", "confidence": 58, "tipteamid": 3},
                ]
            }
        return {}

    monkeypatch.setattr(afl_scraper, "_squiggle_get", fake_squiggle_get)
    monkeypatch.setattr(afl_scraper, "_get_team_map", lambda: {})

    games = afl_scraper.fetch_this_week_afl(run_date="2026-04-10")

    assert len(games) == 1
    assert games[0]["game_id"] == "101"
    assert games[0]["home_team"] == "Geelong Cats"
    assert afl_scraper.fetch_this_week_afl(run_date="2026-04-12") == []


def test_fetch_this_week_afl_can_disable_mock_fallback(monkeypatch):
    monkeypatch.setattr(afl_scraper, "_squiggle_get", lambda params: {})

    games = afl_scraper.fetch_this_week_afl(run_date=None, allow_mock=False)

    assert games == []
