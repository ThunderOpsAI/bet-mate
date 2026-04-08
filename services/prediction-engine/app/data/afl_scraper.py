import requests
import json
import random
from datetime import datetime

SQUIGGLE_BASE = "https://api.squiggle.com.au"
USER_AGENT = "BetMate - james.jones2086@gmail.com"
DEFAULT_AVG_POINTS_FOR = 85.0
DEFAULT_AVG_POINTS_AGAINST = 80.0
DEFAULT_REST_DAYS = 7.0


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


def _confidence_to_probability(confidence) -> float:
    """Normalize Squiggle confidence to a 0-1 probability-like value."""
    try:
        value = float(confidence)
    except (TypeError, ValueError):
        return 0.5

    if value <= 0:
        return 0.5
    if value > 1:
        value = value / 100
    return max(0.0, min(value, 1.0))


def _home_signal_from_tip(
    tip: str,
    home_team: str,
    away_team: str,
    confidence,
    tip_team_id=None,
    home_team_id=None,
    away_team_id=None,
    home_confidence=None,
) -> float:
    if home_confidence not in (None, ""):
        return _confidence_to_probability(home_confidence)

    confidence_prob = _confidence_to_probability(confidence)
    if tip_team_id is not None:
        if str(tip_team_id) == str(home_team_id):
            return confidence_prob
        if str(tip_team_id) == str(away_team_id):
            return 1 - confidence_prob

    normalized_tip = (tip or "").strip().lower()
    normalized_home = home_team.strip().lower()
    normalized_away = away_team.strip().lower()

    if not normalized_tip:
        return 0.5
    if _tip_matches_team(normalized_tip, normalized_home):
        return confidence_prob
    if _tip_matches_team(normalized_tip, normalized_away):
        return 1 - confidence_prob

    return 0.5


def _tip_matches_team(normalized_tip: str, normalized_team: str) -> bool:
    return normalized_tip == normalized_team or normalized_team.startswith(f"{normalized_tip} ")


def _parse_game_datetime(value):
    if not value:
        return None

    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue

    return None


def _numeric(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _team_state():
    return {
        "played": 0,
        "wins": 0,
        "points_for": 0.0,
        "points_against": 0.0,
        "win_streak": 0,
        "last_game_at": None,
    }


def _avg_points(state, key: str, default: float) -> float:
    if state["played"] <= 0:
        return default

    return state[key] / state["played"]


def _rest_days(state, game_at) -> float:
    last_game_at = state.get("last_game_at")
    if not last_game_at or not game_at:
        return DEFAULT_REST_DAYS

    return float(max(4, min((game_at - last_game_at).days, 21)))


def fetch_historical_afl_training_data(start_year=None, end_year=None, min_rows=80):
    """
    Build supervised training rows from completed Squiggle games.
    Features use each team's state before the current game, then update state
    after the result so completed scores do not leak into their own prediction.
    """
    current_year = datetime.now().year
    start_year = start_year or max(2018, current_year - 5)
    end_year = end_year or current_year

    raw_games = []
    tips_by_game = {}

    for year in range(start_year, end_year + 1):
        games_data = _squiggle_get({"q": "games", "year": year})
        raw_games.extend(games_data.get("games", []))

        tips_data = _squiggle_get({"q": "tips", "year": year, "source": "1"})
        for tip in tips_data.get("tips", []):
            game_id = tip.get("gameid")
            if game_id is not None and game_id not in tips_by_game:
                tips_by_game[game_id] = tip

    completed_games = [
        game for game in raw_games
        if game.get("complete") == 100 and game.get("hscore") is not None and game.get("ascore") is not None
    ]
    completed_games.sort(key=lambda game: (game.get("unixtime") or 0, game.get("id") or 0))

    team_states = {}
    rows = []

    for game in completed_games:
        hscore = _numeric(game.get("hscore"))
        ascore = _numeric(game.get("ascore"))
        if hscore == ascore:
            continue

        home_team_id = game.get("hteamid")
        away_team_id = game.get("ateamid")
        if home_team_id is None or away_team_id is None:
            continue

        game_at = _parse_game_datetime(game.get("date"))
        home_state = team_states.setdefault(home_team_id, _team_state())
        away_state = team_states.setdefault(away_team_id, _team_state())
        tip = tips_by_game.get(game.get("id"), {})

        rows.append({
            "home_win_streak": float(home_state["win_streak"]),
            "away_win_streak": float(away_state["win_streak"]),
            "home_avg_points_for": round(_avg_points(home_state, "points_for", DEFAULT_AVG_POINTS_FOR), 1),
            "away_avg_points_for": round(_avg_points(away_state, "points_for", DEFAULT_AVG_POINTS_FOR), 1),
            "home_avg_points_against": round(_avg_points(home_state, "points_against", DEFAULT_AVG_POINTS_AGAINST), 1),
            "away_avg_points_against": round(_avg_points(away_state, "points_against", DEFAULT_AVG_POINTS_AGAINST), 1),
            "home_rest_days": _rest_days(home_state, game_at),
            "away_rest_days": _rest_days(away_state, game_at),
            "weather_condition": 1.0,
            "travel_distance_away": 500.0,
            "squiggle_home_signal": round(_home_signal_from_tip(
                tip.get("tip", ""),
                game.get("hteam", ""),
                game.get("ateam", ""),
                tip.get("confidence", 0),
                tip_team_id=tip.get("tipteamid"),
                home_team_id=home_team_id,
                away_team_id=away_team_id,
                home_confidence=tip.get("hconfidence"),
            ), 4),
            "home_win": int(hscore > ascore),
        })

        _record_game(home_state, points_for=hscore, points_against=ascore, won=hscore > ascore, game_at=game_at)
        _record_game(away_state, points_for=ascore, points_against=hscore, won=ascore > hscore, game_at=game_at)

    if len(rows) < min_rows:
        print(f"[Squiggle] Historical AFL training rows below threshold ({len(rows)} < {min_rows})")
        return []

    print(f"[Squiggle] Built {len(rows)} historical AFL training rows from {start_year}-{end_year}")
    return rows


def _record_game(state, points_for: float, points_against: float, won: bool, game_at):
    state["played"] += 1
    state["wins"] += 1 if won else 0
    state["points_for"] += points_for
    state["points_against"] += points_against
    state["win_streak"] = state["win_streak"] + 1 if won else 0
    state["last_game_at"] = game_at


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

        # Add Squiggle's own predictions as context and as an ensemble model input
        tip = tips_by_game.get(g.get("id"), {})
        squiggle_confidence = tip.get("confidence", 0)
        squiggle_tip = tip.get("tip", "")
        squiggle_home_signal = _home_signal_from_tip(
            squiggle_tip,
            hteam_name,
            ateam_name,
            squiggle_confidence,
            tip_team_id=tip.get("tipteamid"),
            home_team_id=hteam_id,
            away_team_id=ateam_id,
            home_confidence=tip.get("hconfidence"),
        )

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
            "squiggle_home_signal": round(squiggle_home_signal, 4),
        }

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
                "squiggle_home_signal": round(random.uniform(0.35, 0.65), 4),
            },
            "squiggle_tip": "",
            "squiggle_confidence": 0,
            "source": "mock",
        })

    return games
