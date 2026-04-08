import requests
import random
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

BDL_API_KEY = os.getenv("BDL_API_KEY", "")
BDL_BASE = "https://api.balldontlie.io/nba/v1"
USER_AGENT = "BetMate - james.jones2086@gmail.com"
DEFAULT_WIN_PCT = 0.5
DEFAULT_RATING = 110.0


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


def _parse_game_datetime(game: dict):
    value = game.get("datetime") or game.get("date")
    if not value:
        return None

    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        try:
            return datetime.strptime(value, "%Y-%m-%d")
        except ValueError:
            return None


def _team_state():
    return {
        "games": 0,
        "wins": 0,
        "points_for": 0.0,
        "points_against": 0.0,
        "last_game_at": None,
    }


def _win_pct(state) -> float:
    if state["games"] <= 0:
        return DEFAULT_WIN_PCT

    return state["wins"] / state["games"]


def _avg_points(state, key: str) -> float:
    if state["games"] <= 0:
        return DEFAULT_RATING

    return state[key] / state["games"]


def _is_back_to_back(state, game_at) -> int:
    last_game_at = state.get("last_game_at")
    if not last_game_at or not game_at:
        return 0

    return int((game_at.date() - last_game_at.date()).days == 1)


def fetch_historical_nba_training_data(start_season=None, end_season=None, min_rows=200, max_pages_per_season=2):
    """
    Build supervised training rows from completed Ball Don't Lie games.
    Features use each team's state before the current game, then update state
    after the result so completed scores do not leak into their own prediction.
    """
    current_year = datetime.now().year
    current_season = current_year if datetime.now().month >= 10 else current_year - 1
    end_season = end_season or current_season
    start_season = start_season or end_season

    raw_games = []
    for season in range(start_season, end_season + 1):
        cursor = None
        pages = 0
        while pages < max_pages_per_season:
            params = {"seasons[]": season, "per_page": 100}
            if cursor:
                params["cursor"] = cursor

            data = _bdl_get("games", params)
            games = data.get("data", [])
            if not games:
                break

            raw_games.extend(games)
            cursor = data.get("meta", {}).get("next_cursor")
            pages += 1
            if not cursor:
                break

    completed_games = [
        game for game in raw_games
        if game.get("status") == "Final"
        and game.get("home_team_score") is not None
        and game.get("visitor_team_score") is not None
    ]
    completed_games.sort(key=lambda game: (_parse_game_datetime(game) or datetime.min, game.get("id") or 0))

    team_states = {}
    rows = []

    for game in completed_games:
        home_score = float(game.get("home_team_score") or 0)
        away_score = float(game.get("visitor_team_score") or 0)
        if home_score == away_score:
            continue

        home_team_id = game.get("home_team", {}).get("id")
        away_team_id = game.get("visitor_team", {}).get("id")
        if home_team_id is None or away_team_id is None:
            continue

        game_at = _parse_game_datetime(game)
        home_state = team_states.setdefault(home_team_id, _team_state())
        away_state = team_states.setdefault(away_team_id, _team_state())

        rows.append({
            "home_b2b": _is_back_to_back(home_state, game_at),
            "away_b2b": _is_back_to_back(away_state, game_at),
            "home_win_pct": round(_win_pct(home_state), 3),
            "away_win_pct": round(_win_pct(away_state), 3),
            "home_ortg": round(_avg_points(home_state, "points_for"), 1),
            "home_drtg": round(_avg_points(home_state, "points_against"), 1),
            "away_ortg": round(_avg_points(away_state, "points_for"), 1),
            "away_drtg": round(_avg_points(away_state, "points_against"), 1),
            "home_injuries_impact": 0.0,
            "away_injuries_impact": 0.0,
            "home_win": int(home_score > away_score),
        })

        _record_game(home_state, points_for=home_score, points_against=away_score, won=home_score > away_score, game_at=game_at)
        _record_game(away_state, points_for=away_score, points_against=home_score, won=away_score > home_score, game_at=game_at)

    if len(rows) < min_rows:
        print(f"[BallDontLie] Historical NBA training rows below threshold ({len(rows)} < {min_rows})")
        return []

    print(f"[BallDontLie] Built {len(rows)} historical NBA training rows from {start_season}-{end_season}")
    return rows


def _record_game(state, points_for: float, points_against: float, won: bool, game_at):
    state["games"] += 1
    state["wins"] += 1 if won else 0
    state["points_for"] += points_for
    state["points_against"] += points_against
    state["last_game_at"] = game_at


def fetch_completed_nba_results(days_back=7, max_results=50):
    """Fetch recent completed NBA results from Ball Don't Lie in settlement shape."""
    if not BDL_API_KEY:
        return []

    days_back = max(0, min(int(days_back), 30))
    max_results = max(1, min(int(max_results), 200))
    raw_games = []
    today = datetime.now()

    for offset in range(days_back + 1):
        day = (today - timedelta(days=offset)).strftime("%Y-%m-%d")
        data = _bdl_get("games", {"dates[]": day})
        raw_games.extend(data.get("data", []))

    completed_games = [
        game for game in raw_games
        if game.get("status") == "Final"
        and game.get("home_team_score") is not None
        and game.get("visitor_team_score") is not None
        and game.get("id") is not None
    ]
    completed_games.sort(key=lambda game: (_parse_game_datetime(game) or datetime.min, game.get("id") or 0), reverse=True)

    results = []
    seen_ids = set()
    for game in completed_games:
        game_id = str(game.get("id"))
        if game_id in seen_ids:
            continue
        seen_ids.add(game_id)

        home_team = game.get("home_team", {}).get("full_name", "")
        away_team = game.get("visitor_team", {}).get("full_name", "")
        if not home_team or not away_team:
            continue

        home_score = float(game.get("home_team_score") or 0)
        away_score = float(game.get("visitor_team_score") or 0)
        winner_selection = None
        if home_score > away_score:
            winner_selection = home_team
            selection_results = {home_team: 1.0, away_team: 0.0}
        elif away_score > home_score:
            winner_selection = away_team
            selection_results = {home_team: 0.0, away_team: 1.0}
        else:
            selection_results = {home_team: 0.5, away_team: 0.5}

        game_at = _parse_game_datetime(game)
        results.append({
            "sport": "nba",
            "event_id": game_id,
            "event_name": f"{home_team} vs {away_team}",
            "winner_selection": winner_selection,
            "selection_results": selection_results,
            "completed_at": game_at.isoformat() if game_at else None,
            "result_payload": {
                "source": "balldontlie",
                "date": game.get("date", ""),
                "status": game.get("status", ""),
                "home_team": home_team,
                "away_team": away_team,
                "home_score": home_score,
                "away_score": away_score,
            },
        })

        if len(results) >= max_results:
            break

    print(f"[BallDontLie] Loaded {len(results)} completed NBA results for settlement")
    return results


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
