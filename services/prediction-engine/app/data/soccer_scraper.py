import random
import requests
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

from app.time_utils import resolve_melbourne_date, today_melbourne
from app.data.scraper import _get_api_headers, betfair_catalogue_url, _fetch_prices

load_dotenv()

SOCCER_STADIUMS = [
    "Etihad Stadium", "Emirates Stadium", "Anfield", "Villa Park",
    "Tottenham Hotspur Stadium", "Stamford Bridge", "Old Trafford", "St James' Park",
    "Santiago Bernabeu", "Camp Nou", "Metropolitano", "Allianz Arena",
    "BayArena", "Signal Iduna Park", "Parc des Princes", "San Siro", "Juventus Stadium"
]


def fetch_today_soccer(run_date=None):
    target_date = resolve_melbourne_date(run_date) if run_date else today_melbourne()
    headers = _get_api_headers()

    if not headers:
        print("[Betfair Soccer] Authentication unavailable")
        return []

    try:
        return _fetch_live_soccer(headers, target_date)
    except Exception as exc:
        print(f"[Betfair Soccer] Live fetch failed: {exc}")
        return []


def _fetch_live_soccer(headers, target_date):
    api_url = betfair_catalogue_url()
    start_time = (datetime.combine(target_date, datetime.min.time()) - timedelta(days=1)).isoformat() + "Z"
    end_time = (datetime.combine(target_date, datetime.max.time()) + timedelta(days=2)).isoformat() + "Z"

    payload = {
        "filter": {
            "eventTypeIds": ["1"],
            "marketStartTime": {"from": start_time, "to": end_time}
        },
        "maxResults": "50",
        "marketProjection": ["EVENT", "RUNNER_DESCRIPTION", "MARKET_START_TIME", "MARKET_DESCRIPTION"]
    }

    response = requests.post(api_url, data=json.dumps(payload), headers=headers, timeout=15)
    response.raise_for_status()
    markets = response.json()

    if not markets:
        print(f"[Betfair Soccer] No markets returned for {target_date.isoformat()}")
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
            home, away = event_name.split(" v ", 1)
        else:
            home, away = event_name.split(" vs ", 1)

        market_id = m.get("marketId")
        runners = m.get("runners", [])
        market_prices = prices.get(market_id, {})

        home_back = 0
        for runner in runners:
            r_name = runner.get("runnerName", "").lower()
            sel_id = str(runner.get("selectionId", ""))
            r_price = market_prices.get(sel_id, {}).get("back", 0)
            if home.lower() in r_name:
                home_back = r_price
                break

        features = {
            "goal_difference": round(float(random.uniform(-3.0, 3.0)), 2),
            "recent_form": round(float(random.uniform(-0.5, 0.5)), 2),
            "head_to_head": round(float(random.uniform(-0.4, 0.4)), 2),
            "home_advantage_base": 0.05,
            "live_odds_signal": round(1.0 / home_back, 4) if home_back > 1 else 0.5,
        }

        games.append({
            "game_id": f"soccer_{event_id}",
            "home_team": home,
            "away_team": away,
            "features": features,
            "date": event.get("openDate") or m.get("marketStartTime"),
            "venue": event.get("venue") or random.choice(SOCCER_STADIUMS),
            "complete": 0,
            "hscore": None,
            "ascore": None,
            "source": "betfair_live"
        })

    return games
