import random
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

        features = {
            "epa_diff": round(float(random.uniform(-0.5, 0.5)), 2),
            "rest_diff": 0.0,
            "is_dome": 0.0,
            "spread_line": round(float(random.uniform(-7.0, 7.0)), 1),
        }

        games.append({
            "game_id": f"nfl_{event_id}",
            "sport": "nfl",
            "home_team": home,
            "away_team": away,
            "features": features,
            "date": m.get("marketStartTime") or event.get("openDate", ""),
            "complete": 0,
            "source": "betfair_nfl",
            "home_odds": home_back if home_back > 1 else None,
            "away_odds": away_back if away_back > 1 else None,
        })

    print(f"[Betfair NFL] Loaded {len(games)} live NFL games")
    return games


def _fetch_nfl_data_py_or_fallback(target_date):
    try:
        import nfl_data_py as nfl
        year = target_date.year if target_date else datetime.now().year
        schedules = nfl.import_schedules([year])
        if not schedules.empty:
            target_str = target_date.isoformat() if target_date else today_melbourne().isoformat()
            upcoming = schedules[
                (schedules["home_score"].isna()) &
                (schedules["gameday"] >= target_str)
            ].head(10)
            if not upcoming.empty:
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
                            date_str = f"{gameday}T00:00:00Z"
                    else:
                        date_str = f"{gameday}T00:00:00Z"

                    games.append({
                        "game_id": f"nfl_{row.get('game_id', len(games))}",
                        "sport": "nfl",
                        "home_team": str(row["home_team"]),
                        "away_team": str(row["away_team"]),
                        "features": {
                            "epa_diff": 0.1,
                            "rest_diff": 0.0,
                            "is_dome": 1.0 if str(row.get("roof", "")).lower() in ["dome", "closed"] else 0.0,
                            "spread_line": float(row.get("spread_line", 0.0) or 0.0),
                        },
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
