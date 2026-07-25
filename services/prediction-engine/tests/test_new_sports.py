import pytest
from app.data.nrl_scraper import fetch_upcoming_nrl
from app.data.soccer_scraper import fetch_today_soccer
from app.data.golf_scraper import fetch_today_golf
from app.data.mma_scraper import fetch_today_mma

from app.ml.nrl import NRLPredictor
from app.ml.soccer import SoccerPredictor
from app.ml.golf import GolfPredictor
from app.ml.mma import MMAPredictor

def test_nrl_scraper_and_predictor():
    games = fetch_upcoming_nrl(allow_mock=True)
    assert len(games) > 0
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

def test_soccer_scraper_and_predictor():
    games = fetch_today_soccer(allow_mock=True)
    assert len(games) > 0
    game = games[0]
    assert "game_id" in game
    assert "home_team" in game
    
    predictor = SoccerPredictor()
    predictor.load_or_train()
    res = predictor.predict(game["features"])
    assert "home_win_prob" in res
    assert "away_win_prob" in res
    assert abs(res["home_win_prob"] + res["away_win_prob"] - 1.0) < 1e-5

def test_golf_scraper_and_predictor():
    tournaments = fetch_today_golf(allow_mock=True)
    assert len(tournaments) > 0
    t = tournaments[0]
    assert "tournament_id" in t
    assert "players" in t
    assert len(t["players"]) > 0
    
    predictor = GolfPredictor()
    predictor.load_or_train()
    res = predictor.predict(t)
    assert "tournament_id" in res
    assert "predictions" in res
    assert len(res["predictions"]) > 0
    pick = res["predictions"][0]
    assert "player_id" in pick
    assert "win_probability" in pick
    assert "fair_odds" in pick

def test_mma_scraper_and_predictor():
    games = fetch_today_mma(allow_mock=True)
    assert len(games) > 0
    game = games[0]
    assert "game_id" in game
    
    predictor = MMAPredictor()
    predictor.load_or_train()
    res = predictor.predict(game["features"])
    assert "home_win_prob" in res
    assert "away_win_prob" in res
    assert abs(res["home_win_prob"] + res["away_win_prob"] - 1.0) < 1e-5
