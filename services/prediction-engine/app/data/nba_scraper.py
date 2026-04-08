import requests
import random
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

BDL_API_KEY = os.getenv("BDL_API_KEY", "")
BDL_BASE = "https://api.balldontlie.io/nba/v1"
USER_AGENT = "BetMate - james.jones2086@gmail.com"


def _bdl_get(endpoint: str, params: dict = None) -> dict:
    """Make an authenticated request to the Ball Don't Lie API."""
    if not BDL_API_KEY:
        return {}
    
    headers = {
        "Authorization": BDL_API_KEY,
        "User-Agent": USER_AGENT,
    }
    try:
        response = requests.get(
            f"{BDL_BASE}/{endpoint}",
            params=params or {},
            headers=headers,
            timeout=15,
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"[BallDontLie] API error on {endpoint}: {e}")
        return {}


def fetch_today_nba():
    """
    Fetch today's NBA games from Ball Don't Lie API.
    Falls back to mock data if API is unavailable or no key is set.
    """
    if BDL_API_KEY:
        try:
            return _fetch_live_nba()
        except Exception as e:
            print(f"[BallDontLie] Live fetch failed ({e}), using mock data")
    
    return _generate_mock_nba()


def _fetch_live_nba():
    """Fetch real NBA games and team stats from Ball Don't Lie."""
    today = datetime.now().strftime("%Y-%m-%d")
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    
    # Try today first, then tomorrow if no games today
    data = _bdl_get("games", {"dates[]": today})
    games_raw = data.get("data", [])
    
    if not games_raw:
        data = _bdl_get("games", {"dates[]": tomorrow})
        games_raw = data.get("data", [])
    
    if not games_raw:
        # Try getting next few days
        for i in range(2, 5):
            future = (datetime.now() + timedelta(days=i)).strftime("%Y-%m-%d")
            data = _bdl_get("games", {"dates[]": future})
            games_raw = data.get("data", [])
            if games_raw:
                break
    
    if not games_raw:
        print("[BallDontLie] No upcoming games found, using mock data")
        return _generate_mock_nba()
    
    # Fetch season stats for team strength estimation
    season = datetime.now().year if datetime.now().month >= 10 else datetime.now().year - 1
    standings = _get_team_season_stats(season)
    
    games = []
    for g in games_raw:
        home_team_data = g.get("home_team", {})
        away_team_data = g.get("visitor_team", {})
        
        home_name = home_team_data.get("full_name", "Unknown")
        away_name = away_team_data.get("full_name", "Unknown")
        home_id = home_team_data.get("id", 0)
        away_id = away_team_data.get("id", 0)
        
        home_stats = standings.get(home_id, {})
        away_stats = standings.get(away_id, {})
        
        # Build features for XGBoost model
        features = {
            "home_b2b": 0,  # Would need yesterday's schedule to determine
            "away_b2b": 0,
            "home_win_pct": home_stats.get("win_pct", 0.5),
            "away_win_pct": away_stats.get("win_pct", 0.5),
            "home_ortg": home_stats.get("ortg", 110.0),
            "home_drtg": home_stats.get("drtg", 110.0),
            "away_ortg": away_stats.get("ortg", 110.0),
            "away_drtg": away_stats.get("drtg", 110.0),
            "home_injuries_impact": 0,  # Not available from BDL
            "away_injuries_impact": 0,
        }
        
        games.append({
            "game_id": str(g.get("id", f"bdl_{len(games)}")),
            "home_team": home_name,
            "away_team": away_name,
            "features": features,
            "date": g.get("date", ""),
            "status": g.get("status", ""),
            "home_score": g.get("home_team_score", 0),
            "away_score": g.get("visitor_team_score", 0),
            "source": "balldontlie_live",
        })
    
    print(f"[BallDontLie] Loaded {len(games)} NBA games")
    return games


def _get_team_season_stats(season: int) -> dict:
    """
    Estimate team strength from recent game results.
    Returns a dict of team_id -> {win_pct, ortg, drtg}.
    """
    # Get recent completed games to estimate team performance
    data = _bdl_get("games", {"seasons[]": season, "per_page": 100})
    games_raw = data.get("data", [])
    
    team_stats = {}
    
    for g in games_raw:
        if g.get("status") != "Final":
            continue
            
        h_id = g.get("home_team", {}).get("id", 0)
        a_id = g.get("visitor_team", {}).get("id", 0)
        h_score = g.get("home_team_score", 0) or 0
        a_score = g.get("visitor_team_score", 0) or 0
        
        if h_id not in team_stats:
            team_stats[h_id] = {"wins": 0, "games": 0, "pts_for": 0, "pts_against": 0}
        if a_id not in team_stats:
            team_stats[a_id] = {"wins": 0, "games": 0, "pts_for": 0, "pts_against": 0}
        
        team_stats[h_id]["games"] += 1
        team_stats[h_id]["pts_for"] += h_score
        team_stats[h_id]["pts_against"] += a_score
        if h_score > a_score:
            team_stats[h_id]["wins"] += 1
        
        team_stats[a_id]["games"] += 1
        team_stats[a_id]["pts_for"] += a_score
        team_stats[a_id]["pts_against"] += h_score
        if a_score > h_score:
            team_stats[a_id]["wins"] += 1
    
    result = {}
    for tid, s in team_stats.items():
        gp = max(s["games"], 1)
        result[tid] = {
            "win_pct": round(s["wins"] / gp, 3),
            "ortg": round(s["pts_for"] / gp, 1),  # Simplified as ppg
            "drtg": round(s["pts_against"] / gp, 1),
        }
    
    return result


def _generate_mock_nba():
    """Fallback mock data when Ball Don't Lie API is unavailable."""
    teams = [
        "Los Angeles Lakers", "Golden State Warriors", "Boston Celtics",
        "Milwaukee Bucks", "Phoenix Suns", "Denver Nuggets",
        "Miami Heat", "Philadelphia 76ers", "Dallas Mavericks",
        "LA Clippers", "New York Knicks", "Minnesota Timberwolves"
    ]
    random.shuffle(teams)
    games = []
    
    for i in range(0, 10, 2):
        games.append({
            "game_id": f"nba_game_{i // 2 + 1}",
            "home_team": teams[i],
            "away_team": teams[i + 1],
            "features": {
                "home_b2b": random.choice([0, 0, 0, 1]),
                "away_b2b": random.choice([0, 0, 0, 1]),
                "home_win_pct": round(random.uniform(0.3, 0.75), 3),
                "away_win_pct": round(random.uniform(0.3, 0.75), 3),
                "home_ortg": round(random.uniform(105, 120), 1),
                "home_drtg": round(random.uniform(105, 120), 1),
                "away_ortg": round(random.uniform(105, 120), 1),
                "away_drtg": round(random.uniform(105, 120), 1),
                "home_injuries_impact": round(random.uniform(0, 10), 1),
                "away_injuries_impact": round(random.uniform(0, 10), 1),
            },
            "source": "mock",
        })
    
    return games
