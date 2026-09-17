import pytest

from app.data import golf_scraper, mma_scraper, nrl_scraper, soccer_scraper
from app.data.golf_scraper import fetch_today_golf
from app.data.mma_scraper import fetch_today_mma
from app.data.nrl_scraper import fetch_upcoming_nrl
from app.data.soccer_scraper import fetch_today_soccer
from app.ml.golf import GolfPredictor
from app.ml.mma import MMAPredictor
from app.ml.nrl import NRLPredictor
from app.ml.soccer import SoccerPredictor


def test_nrl_scraper_and_predictor(monkeypatch):
    sample_game = {
        "game_id": "nrl_123",
        "home_team": "Storm",
        "away_team": "Panthers",
        "features": {
            "points_differential": 2.5,
            "recent_form": 0.1,
            "head_to_head": -0.2,
            "home_advantage_base": 0.05,
            "live_odds_signal": 0.55,
        },
        "date": "2026-07-31T10:00:00Z",
        "venue": "AAMI Park",
        "complete": 0,
        "hscore": None,
        "ascore": None,
        "source": "betfair_live",
    }
    monkeypatch.setattr(nrl_scraper, "_get_api_headers", lambda: {"ok": True})
    monkeypatch.setattr(nrl_scraper, "_fetch_live_nrl", lambda _headers, _target_date: [sample_game])

    games = fetch_upcoming_nrl()
    assert len(games) == 1
    game = games[0]
    assert "game_id" in game
    assert "home_team" in game
    assert "away_team" in game
    assert "features" in game

    predictor = NRLPredictor()
    predictor.load_or_train()
    res = predictor.predict(game["features"])
    assert "home_win_prob" in res
    assert "away_win_prob" in res
    assert "feature_impact" in res
    assert "feature_names" in res
    assert abs(res["home_win_prob"] + res["away_win_prob"] - 1.0) < 1e-5


def test_soccer_scraper_and_predictor(monkeypatch):
    sample_game = {
        "game_id": "soccer_456",
        "home_team": "Arsenal",
        "away_team": "Chelsea",
        "features": {
            "goal_difference": 1.0,
            "recent_form": 0.2,
            "head_to_head": 0.1,
            "home_advantage_base": 0.05,
            "live_odds_signal": 0.52,
        },
        "date": "2026-07-31T10:00:00Z",
        "venue": "Emirates Stadium",
        "complete": 0,
        "hscore": None,
        "ascore": None,
        "source": "betfair_live",
    }
    monkeypatch.setattr(soccer_scraper, "_get_api_headers", lambda: {"ok": True})
    monkeypatch.setattr(soccer_scraper, "_fetch_live_soccer", lambda _headers, _target_date: [sample_game])

    games = fetch_today_soccer()
    assert len(games) == 1
    game = games[0]
    assert "game_id" in game
    assert "home_team" in game

    predictor = SoccerPredictor()
    predictor.load_or_train()
    res = predictor.predict(game["features"])
    assert "home_win_prob" in res
    assert "away_win_prob" in res
    assert abs(res["home_win_prob"] + res["away_win_prob"] - 1.0) < 1e-5


def test_golf_scraper_and_predictor(monkeypatch):
    sample_tournament = {
        "tournament_id": "golf_789",
        "name": "Example Open",
        "players": [
            {"player_id": "1", "name": "Player One", "betfair_back_price": 8.0},
            {"player_id": "2", "name": "Player Two", "betfair_back_price": 12.0},
        ],
        "venue": "Augusta National",
        "start_time": "2026-07-31T10:00:00Z",
        "meeting_date": "2026-07-31",
        "source": "betfair_live",
    }
    monkeypatch.setattr(golf_scraper, "_get_api_headers", lambda: {"ok": True})
    monkeypatch.setattr(golf_scraper, "_fetch_live_golf", lambda _headers, _target_date: [sample_tournament])

    tournaments = fetch_today_golf()
    assert len(tournaments) == 1
    tournament = tournaments[0]
    assert "tournament_id" in tournament
    assert "players" in tournament
    assert len(tournament["players"]) > 0

    predictor = GolfPredictor()
    predictor.load_or_train()
    res = predictor.predict(tournament)
    assert "tournament_id" in res
    assert "predictions" in res
    assert len(res["predictions"]) > 0
    pick = res["predictions"][0]
    assert "player_id" in pick
    assert "win_probability" in pick
    assert "fair_odds" in pick


def test_mma_scraper_and_predictor(monkeypatch):
    sample_game = {
        "game_id": "mma_321",
        "home_team": "Fighter A",
        "away_team": "Fighter B",
        "features": {
            "striking_accuracy": 0.55,
            "takedown_defense": 0.7,
            "reach_advantage": 1.5,
            "recent_form": 0.1,
            "live_odds_signal": 0.58,
        },
        "date": "2026-07-31T10:00:00Z",
        "weight_class": "Lightweight",
        "venue": "T-Mobile Arena",
        "complete": 0,
        "hscore": None,
        "ascore": None,
        "source": "betfair_live",
    }
    monkeypatch.setattr(mma_scraper, "_get_api_headers", lambda: {"ok": True})
    monkeypatch.setattr(mma_scraper, "_fetch_live_mma", lambda _headers, _target_date: [sample_game])

    games = fetch_today_mma()
    assert len(games) == 1
    game = games[0]
    assert "game_id" in game

    predictor = MMAPredictor()
    predictor.load_or_train()
    res = predictor.predict(game["features"])
    assert "home_win_prob" in res
    assert "away_win_prob" in res
    assert abs(res["home_win_prob"] + res["away_win_prob"] - 1.0) < 1e-5
