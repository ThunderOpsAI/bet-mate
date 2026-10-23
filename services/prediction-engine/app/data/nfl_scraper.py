import requests
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

from zoneinfo import ZoneInfo

from app.time_utils import resolve_melbourne_date, today_melbourne
from app.data.scraper import _get_api_headers, betfair_catalogue_url, _fetch_prices

load_dotenv()


def fetch_upcoming_nfl(run_date=None):
    """Fetch upcoming NFL games using Betfair market catalogue or nfl-data-py schedule provider."""
    target_date = resolve_melbourne_date(run_date) if run_date else today_melbourne()
    headers = _get_api_headers()

    if not headers:
        print("[Betfair NFL] Authentication unavailable, attempting nfl_data_py schedule provider")
        return _fetch_nfl_data_py_or_fallback(target_date)

    try:
        games = _fetch_live_nfl(headers, target_date)
        if not games:
            return _fetch_nfl_data_py_or_fallback(target_date)
        return games
    except Exception as exc:
        print(f"[Betfair NFL] Live fetch failed: {exc}")
        return _fetch_nfl_data_py_or_fallback(target_date)


def _fetch_live_nfl(headers, target_date):
    api_url = betfair_catalogue_url()
    start_time = (datetime.combine(target_date, datetime.min.time()) - timedelta(days=1)).isoformat() + "Z"
    end_time = (datetime.combine(target_date, datetime.max.time()) + timedelta(days=7)).isoformat() + "Z"

    payload = {
        "filter": {
            "eventTypeIds": ["6423"],  # NFL Betfair event type id
            "marketStartTime": {"from": start_time, "to": end_time}
        },
        "maxResults": "50",
        "marketProjection": ["EVENT", "RUNNER_DESCRIPTION", "MARKET_START_TIME", "MARKET_DESCRIPTION"]
    }

    response = requests.post(api_url, data=json.dumps(payload), headers=headers, timeout=15)
    response.raise_for_status()
    markets = response.json()

    if not markets:
        print(f"[Betfair NFL] No markets returned for {target_date.isoformat()}")
        return []

    games = []
    market_ids = [m["marketId"] for m in markets]
    prices = _fetch_prices(headers, market_ids)

    seen_events = set()
    for m in markets:
        event = m.get("event", {})
        event_id = event.get("id")
        if not event_id or event_id in seen_events:
            continue

        event_name = event.get("name", "")
        if " v " not in event_name and " vs " not in event_name:
            continue

        seen_events.add(event_id)

        if " v " in event_name:
            home, away = [s.strip() for s in event_name.split(" v ", 1)]
        else:
            home, away = [s.strip() for s in event_name.split(" vs ", 1)]

        market_id = m.get("marketId")
        runners = m.get("runners", [])
        market_prices = prices.get(market_id, {})

        home_back = 0
        away_back = 0
        for runner in runners:
            r_name = runner.get("runnerName", "").lower()
            sel_id = str(runner.get("selectionId", ""))
            r_price = market_prices.get(sel_id, {}).get("back", 0)
            if home.lower() in r_name:
                home_back = r_price
            elif away.lower() in r_name:
                away_back = r_price

        # Real kickoff timestamp preserved from provider
        kickoff_time = m.get("marketStartTime") or event.get("openDate") or None

        # Betfair market catalogue provides prices and event metadata, but does not provide
        # EPA differentials or team schedule features. Do not fabricate random or synthetic numbers.
        features = {}

        games.append({
            "game_id": f"nfl_{event_id}",
            "sport": "nfl",
            "home_team": home,
            "away_team": away,
            "features": features,
            "date": kickoff_time,
            "complete": 0,
            "source": "betfair_nfl",
            "home_odds": home_back if home_back > 1 else None,
            "away_odds": away_back if away_back > 1 else None,
        })

    print(f"[Betfair NFL] Loaded {len(games)} live NFL games")
    return games


def _compute_team_recent_margins(schedules_df, target_gameday: str) -> dict[str, float]:
    """Compute recent rolling average margin (last 5 games) from completed games strictly before target_gameday."""
    import numpy as np
    import pandas as pd

    completed = schedules_df.dropna(subset=["home_score", "away_score"]).copy()
    if completed.empty:
        return {}

    completed = completed[completed["gameday"] < target_gameday].sort_values(by=["season", "week", "gameday"])
    team_history: dict[str, list[float]] = {}
    for _, row in completed.iterrows():
        home = str(row["home_team"])
        away = str(row["away_team"])
        h_score = float(row["home_score"])
        a_score = float(row["away_score"])
        team_history.setdefault(home, []).append(h_score - a_score)
        team_history.setdefault(away, []).append(a_score - h_score)

    return {team: float(np.mean(margins[-5:])) for team, margins in team_history.items() if margins}


def _fetch_nfl_data_py_or_fallback(target_date):
    try:
        import nfl_data_py as nfl
        import pandas as pd
        year = target_date.year if target_date else datetime.now().year
        schedules = nfl.import_schedules([year])
        if not schedules.empty:
            target_str = target_date.isoformat() if target_date else today_melbourne().isoformat()
            upcoming = schedules[
                (schedules["home_score"].isna()) &
                (schedules["gameday"] >= target_str)
            ].head(10)
            if not upcoming.empty:
                recent_margins = _compute_team_recent_margins(schedules, target_str)
                games = []
                for _, row in upcoming.iterrows():
                    gameday = str(row["gameday"])
                    gametime = row.get("gametime")
                    date_str = None
                    if gametime and isinstance(gametime, str) and ":" in gametime:
                        try:
                            dt_et = datetime.strptime(f"{gameday} {gametime.strip()}", "%Y-%m-%d %H:%M").replace(tzinfo=ZoneInfo("America/New_York"))
                            date_str = dt_et.astimezone(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ")
                        except Exception:
                            # Do not invent 00:00:00Z if parsing fails
                            date_str = None
                    else:
                        # Omit kickoff timestamp if provider has no usable time
                        date_str = None

                    home = str(row["home_team"])
                    away = str(row["away_team"])

                    features = {}
                    if home in recent_margins and away in recent_margins:
                        h_net = recent_margins[home]
                        a_net = recent_margins[away]
                        features["epa_diff"] = round(float((h_net - a_net) / 10.0), 3)

                    home_rest = row.get("home_rest")
                    away_rest = row.get("away_rest")
                    if pd.notna(home_rest) and pd.notna(away_rest):
                        try:
                            features["rest_diff"] = float(home_rest) - float(away_rest)
                        except (TypeError, ValueError):
                            pass

                    roof_val = row.get("roof")
                    if pd.notna(roof_val) and str(roof_val).strip():
                        features["is_dome"] = 1.0 if str(roof_val).lower() in ["dome", "closed"] else 0.0

                    spread_val = row.get("spread_line")
                    if pd.notna(spread_val):
                        try:
                            features["spread_line"] = float(spread_val)
                        except (TypeError, ValueError):
                            pass

                    games.append({
                        "game_id": f"nfl_{row.get('game_id', len(games))}",
                        "sport": "nfl",
                        "home_team": home,
                        "away_team": away,
                        "features": features,
                        "date": date_str,
                        "venue": str(row.get("stadium", "") or "NFL Stadium"),
                        "complete": 0,
                        "source": "nfl_data_py",
                    })
                return games
    except Exception as exc:
        print(f"[NFL Scraper] nfl_data_py fetch error: {exc}")

    print("[NFL Scraper] No schedule data available from provider, returning empty list")
    return []
