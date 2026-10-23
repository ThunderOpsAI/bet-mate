import random
import requests
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

from app.time_utils import melbourne_date_string, resolve_melbourne_date, today_melbourne
from app.data.scraper import _get_api_headers, betfair_catalogue_url, _fetch_prices

load_dotenv()

GOLF_COURSES = [
    "Valhalla Golf Club", "Augusta National", "Pinehurst No. 2", "Royal Troon",
    "TPC Sawgrass", "Muirfield Village", "Bay Hill Club"
]


def fetch_today_golf(run_date=None):
    target_date = resolve_melbourne_date(run_date) if run_date else today_melbourne()
    headers = _get_api_headers()

    if not headers:
        print("[Betfair Golf] Authentication unavailable")
        return []

    try:
        return _fetch_live_golf(headers, target_date)
    except Exception as exc:
        print(f"[Betfair Golf] Live fetch failed: {exc}")
        return []


def _fetch_live_golf(headers, target_date):
    api_url = betfair_catalogue_url()
    start_time = (datetime.combine(target_date, datetime.min.time()) - timedelta(days=2)).isoformat() + "Z"
    end_time = (datetime.combine(target_date, datetime.max.time()) + timedelta(days=4)).isoformat() + "Z"

    payload = {
        "filter": {
            "eventTypeIds": ["3"],
            "marketStartTime": {"from": start_time, "to": end_time}
        },
        "maxResults": "20",
        "marketProjection": ["EVENT", "RUNNER_DESCRIPTION", "MARKET_START_TIME", "MARKET_DESCRIPTION"]
    }

    response = requests.post(api_url, data=json.dumps(payload), headers=headers, timeout=15)
    response.raise_for_status()
    markets = response.json()

    if not markets:
        print(f"[Betfair Golf] No markets returned for {target_date.isoformat()}")
        return []

    tournaments = []
    market_ids = [m["marketId"] for m in markets]
    prices = _fetch_prices(headers, market_ids)

    for m in markets:
        event = m.get("event", {})
        event_name = event.get("name", "")
        market_id = m.get("marketId")
        runners = m.get("runners", [])
        market_prices = prices.get(market_id, {})

        players = []
        for idx, runner in enumerate(runners):
            p_name = runner.get("runnerName", "")
            sel_id = str(runner.get("selectionId", ""))
            back_price = market_prices.get(sel_id, {}).get("back", 0)
            if back_price <= 1:
                back_price = float(10 + idx * 5)

            players.append({
                "player_id": sel_id,
                "name": p_name,
                "betfair_back_price": back_price
            })

        players.sort(key=lambda x: x["betfair_back_price"])
        players = players[:40]

        tournaments.append({
            "tournament_id": f"golf_{market_id}",
            "name": event_name,
            "players": players,
            "venue": event.get("venue") or random.choice(GOLF_COURSES),
            "start_time": event.get("openDate") or m.get("marketStartTime"),
            "meeting_date": melbourne_date_string(event.get("openDate") or m.get("marketStartTime")),
            "source": "betfair_live"
        })

    return tournaments
