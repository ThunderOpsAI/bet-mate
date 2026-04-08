import requests
import json
import random
from datetime import datetime

SQUIGGLE_BASE = "https://api.squiggle.com.au"
USER_AGENT = "BetMate - james.jones2086@gmail.com"


def _squiggle_get(params: dict) -> dict:
    """Make a request to the Squiggle API with proper User-Agent."""
    headers = {"User-Agent": USER_AGENT}
    try:
        response = requests.get(SQUIGGLE_BASE, params=params, headers=headers, timeout=15)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"[Squiggle] API error: {e}")
        return {}


def _get_team_map() -> dict:
    """Fetch team ID→name map from Squiggle."""
    data = _squiggle_get({"q": "teams"})
    teams = data.get("teams", [])
    return {t["id"]: t["name"] for t in teams}


def fetch_this_week_afl():
    """
    Fetch upcoming/recent AFL games from Squiggle and build feature dicts
    that our XGBoost model can consume.
    Falls back to mock data if the API is unreachable.
    """
    year = datetime.now().year

    # 1. Get current/upcoming games
    games_data = _squiggle_get({"q": "games", "year": year, "complete": "!100"})
    raw_games = games_data.get("games", [])

    if not raw_games:
        # Try getting most recent completed round instead
        games_data = _squiggle_get({"q": "games", "year": year})
        raw_games = games_data.get("games", [])
        if raw_games:
            # Get last round
            max_round = max(g.get("round", 0) for g in raw_games)
            raw_games = [g for g in raw_games if g.get("round") == max_round]

    if not raw_games:
        print("[Squiggle] No games found, falling back to mock data")
        return _generate_mock_afl()

    # 2. Get standings for form data
    standings_data = _squiggle_get({"q": "standings", "year": year})
    standings = standings_data.get("standings", [])
    standings_map = {}
    for s in standings:
        tid = s.get("id")
        standings_map[tid] = {
            "wins": s.get("wins", 0),
            "losses": s.get("losses", 0),
            "draws": s.get("draws", 0),
            "pts_for": s.get("for", 0),
            "pts_against": s.get("against", 0),
            "played": s.get("played", 1),
            "percentage": s.get("percentage", 100),
        }

    # 3. Get tips/predictions from computer models (Aggregate source)
    # We fetch tips for this year's incomplete games
    tips_data = _squiggle_get({"q": "tips", "year": year, "source": "1"})
    tips = tips_data.get("tips", [])
    tips_by_game = {}
    for tip in tips:
        gid = tip.get("gameid")
        if gid not in tips_by_game:
            tips_by_game[gid] = tip

    # 4. Build the game list with features for our ML model
    team_map = _get_team_map()
    games = []

    for g in raw_games[:9]:  # Limit to 9 games (a full round)
        hteam_id = g.get("hteamid", 0)
        ateam_id = g.get("ateamid", 0)
        hteam_name = g.get("hteam") or team_map.get(hteam_id, f"Team {hteam_id}")
        ateam_name = g.get("ateam") or team_map.get(ateam_id, f"Team {ateam_id}")

        # Skip finals games that don't have teams assigned yet
        if not hteam_name or not ateam_name:
            continue

        h_standings = standings_map.get(hteam_id, {})
        a_standings = standings_map.get(ateam_id, {})

        h_played = max(h_standings.get("played", 1), 1)
        a_played = max(a_standings.get("played", 1), 1)

        h_avg_for = h_standings.get("pts_for", 80 * h_played) / h_played
        h_avg_against = h_standings.get("pts_against", 80 * h_played) / h_played
        a_avg_for = a_standings.get("pts_for", 80 * a_played) / a_played
        a_avg_against = a_standings.get("pts_against", 80 * a_played) / a_played

        # Build features compatible with our AFL XGBoost model
        features = {
            "home_win_streak": float(h_standings.get("wins", 0)),
            "away_win_streak": float(a_standings.get("wins", 0)),
            "home_avg_points_for": round(h_avg_for, 1),
            "away_avg_points_for": round(a_avg_for, 1),
            "home_avg_points_against": round(h_avg_against, 1),
            "away_avg_points_against": round(a_avg_against, 1),
            "home_rest_days": 7.0,  # Default, Squiggle doesn't provide this
            "away_rest_days": 7.0,
            "weather_condition": 1.0,  # Default clear
            "travel_distance_away": 500.0,  # Default moderate
        }

        # Add Squiggle's own predictions as context
        tip = tips_by_game.get(g.get("id"), {})
        squiggle_confidence = tip.get("confidence", 0)
        squiggle_tip = tip.get("tip", "")

        game_entry = {
            "game_id": str(g.get("id", f"afl_{len(games)}")),
            "home_team": hteam_name,
            "away_team": ateam_name,
            "features": features,
            "round": g.get("round"),
            "venue": g.get("venue", ""),
            "date": g.get("date", ""),
            "complete": g.get("complete", 0),
            "hscore": g.get("hscore"),
            "ascore": g.get("ascore"),
            "squiggle_tip": squiggle_tip,
            "squiggle_confidence": squiggle_confidence,
            "source": "squiggle_live",
        }

        games.append(game_entry)

    print(f"[Squiggle] Loaded {len(games)} AFL games (Round {games[0].get('round', '?') if games else '?'})")
    return games


def _generate_mock_afl():
    """Fallback mock data when Squiggle is unreachable."""
    teams = [
        "Collingwood", "Brisbane Lions", "Carlton", "Melbourne", "Sydney Swans",
        "St Kilda", "GWS Giants", "Port Adelaide", "Western Bulldogs", "Essendon",
        "Geelong Cats", "Richmond", "Adelaide Crows", "Gold Coast Suns", "Fremantle",
        "Hawthorn", "North Melbourne", "West Coast Eagles"
    ]
    random.shuffle(teams)
    games = []

    for i in range(0, 18, 2):
        games.append({
            "game_id": f"afl_game_{i // 2 + 1}",
            "home_team": teams[i],
            "away_team": teams[i + 1],
            "features": {
                "home_win_streak": float(random.randint(0, 5)),
                "away_win_streak": float(random.randint(0, 5)),
                "home_avg_points_for": round(random.uniform(70, 100), 1),
                "away_avg_points_for": round(random.uniform(70, 100), 1),
                "home_avg_points_against": round(random.uniform(65, 95), 1),
                "away_avg_points_against": round(random.uniform(65, 95), 1),
                "home_rest_days": float(random.randint(6, 9)),
                "away_rest_days": float(random.randint(6, 9)),
                "weather_condition": float(random.randint(1, 3)),
                "travel_distance_away": round(random.uniform(0, 3000), 0),
            },
            "source": "mock",
        })

    return games
