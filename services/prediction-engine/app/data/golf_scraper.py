import os
import random
import requests
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

from app.time_utils import melbourne_date_string, resolve_melbourne_date, today_melbourne
from app.data.scraper import _get_api_headers

load_dotenv()

GOLF_PLAYERS = [
    "Scottie Scheffler", "Rory McIlroy", "Xander Schauffele", "Ludvig Aberg",
    "Bryson DeChambeau", "Collin Morikawa", "Viktor Hovland", "Jon Rahm",
    "Brooks Koepka", "Tommy Fleetwood", "Patrick Cantlay", "Wyndham Clark",
    "Hideki Matsuyama", "Sahith Theegala", "Max Homa", "Matt Fitzpatrick"
]

GOLF_TOURNAMENTS = [
    "PGA Championship", "The Masters", "U.S. Open", "The Open Championship",
    "The Players Championship", "Memorial Tournament", "Arnold Palmer Invitational"
]

GOLF_COURSES = [
    "Valhalla Golf Club", "Augusta National", "Pinehurst No. 2", "Royal Troon",
    "TPC Sawgrass", "Muirfield Village", "Bay Hill Club"
]

def fetch_today_golf(run_date=None, allow_mock=True):
    target_date = resolve_melbourne_date(run_date) if run_date else today_melbourne()
    headers = _get_api_headers()
    
    if headers:
        try:
            return _fetch_live_golf(headers, target_date)
        except Exception as e:
            print(f"[Betfair Golf] Live fetch failed: {e}")
            
    if allow_mock:
        return _generate_mock_golf(target_date)
    return []

def _fetch_live_golf(headers, target_date):
    api_url = "https://api.betfair.com/exchange/betting/rest/v1.0/listMarketCatalogue/"
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
        return _generate_mock_golf(target_date)
        
    tournaments = []
    market_ids = [m["marketId"] for m in markets]
    from app.data.scraper import _fetch_prices
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
                # Assign generic high price if odds are missing
                back_price = float(10 + idx * 5)
                
            players.append({
                "player_id": sel_id,
                "name": p_name,
                "betfair_back_price": back_price
            })
            
        # Limit field to top 40 for responsiveness
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

def _generate_mock_golf(target_date):
    random.seed(target_date.toordinal() + 100)
    idx = random.randint(0, len(GOLF_TOURNAMENTS)-1)
    name = GOLF_TOURNAMENTS[idx]
    venue = GOLF_COURSES[idx]
    
    players = []
    shuffled_players = list(GOLF_PLAYERS)
    random.shuffle(shuffled_players)
    
    for idx, p in enumerate(shuffled_players):
        # Generate realistic win-odds (e.g. favorite is 5.0 to 10.0, rest range up to 100.0)
        back_price = round(float(6.0 + idx * 4.5 + random.uniform(-2, 2)), 1)
        players.append({
            "player_id": f"golf_player_{idx}",
            "name": p,
            "betfair_back_price": max(2.0, back_price)
        })
        
    players.sort(key=lambda x: x["betfair_back_price"])
    
    tournament_time = datetime.combine(target_date, datetime.min.time()) + timedelta(hours=8)
    
    return [{
        "tournament_id": f"golf_mock_{target_date.strftime('%Y%m%d')}",
        "name": name,
        "players": players,
        "venue": venue,
        "start_time": tournament_time.isoformat() + "Z",
        "meeting_date": target_date.isoformat(),
        "source": "betfair_mock"
    }]
