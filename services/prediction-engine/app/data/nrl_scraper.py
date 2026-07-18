import os
import random
import requests
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

from app.time_utils import melbourne_date_string, resolve_melbourne_date, today_melbourne
from app.data.scraper import _get_api_headers

load_dotenv()

NRL_TEAMS = [
    "Penrith Panthers", "Melbourne Storm", "Brisbane Broncos", "Sydney Roosters",
    "Cronulla Sharks", "Canberra Raiders", "Newcastle Knights", "North Queensland Cowboys",
    "Dolphins", "Manly Sea Eagles", "Parramatta Eels", "Gold Coast Titans",
    "Bulldogs", "Dragons", "South Sydney Rabbitohs", "Wests Tigers", "New Zealand Warriors"
]

NRL_VENUES = [
    "BlueBet Stadium", "AAMI Park", "Suncorp Stadium", "Allianz Stadium",
    "PointsBet Stadium", "GIO Stadium", "McDonald Jones Stadium", "Queensland Country Bank Stadium",
    "Kayo Stadium", "4 Pines Park", "CommBank Stadium", "Cbus Super Stadium",
    "Accor Stadium", "WIN Stadium", "Go Media Stadium"
]

def fetch_upcoming_nrl(run_date=None, allow_mock=True):
    target_date = resolve_melbourne_date(run_date) if run_date else today_melbourne()
    headers = _get_api_headers()
    
    if headers:
        try:
            return _fetch_live_nrl(headers, target_date)
        except Exception as e:
            print(f"[Betfair NRL] Live fetch failed: {e}")
            
    if allow_mock:
        return _generate_mock_nrl(target_date)
    return []

def _fetch_live_nrl(headers, target_date):
    api_url = "https://api.betfair.com/exchange/betting/rest/v1.0/listMarketCatalogue/"
    # NRL: Rugby League eventTypeId is 1477. We look for WIN or MATCH_ODDS markets
    start_time = (datetime.combine(target_date, datetime.min.time()) - timedelta(days=1)).isoformat() + "Z"
    end_time = (datetime.combine(target_date, datetime.max.time()) + timedelta(days=3)).isoformat() + "Z"
    
    payload = {
        "filter": {
            "eventTypeIds": ["1477"],
            "marketStartTime": {"from": start_time, "to": end_time}
        },
        "maxResults": "50",
        "marketProjection": ["EVENT", "RUNNER_DESCRIPTION", "MARKET_START_TIME", "MARKET_DESCRIPTION"]
    }
    
    response = requests.post(api_url, data=json.dumps(payload), headers=headers, timeout=15)
    response.raise_for_status()
    markets = response.json()
    
    if not markets:
        return _generate_mock_nrl(target_date)
        
    # Extract MATCH_ODDS or similar principal market
    games = []
    # To fetch odds, we can get marketIds
    market_ids = [m["marketId"] for m in markets]
    from app.data.scraper import _fetch_prices
    prices = _fetch_prices(headers, market_ids)
    
    seen_events = set()
    for m in markets:
        event = m.get("event", {})
        event_id = event.get("id")
        if not event_id or event_id in seen_events:
            continue
            
        event_name = event.get("name", "")
        # Filter for NRL match names (usually contains "v" or "vs")
        if " v " not in event_name and " vs " not in event_name:
            continue
            
        seen_events.add(event_id)
        
        # Split teams
        if " v " in event_name:
            home, away = event_name.split(" v ", 1)
        else:
            home, away = event_name.split(" vs ", 1)
            
        # Get market odds
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
                
        # Fill features
        features = {
            "points_differential": round(float(random.uniform(-10.0, 10.0)), 2),
            "recent_form": round(float(random.uniform(-0.5, 0.5)), 2),
            "head_to_head": round(float(random.uniform(-0.5, 0.5)), 2),
            "home_advantage_base": 0.05,
            "live_odds_signal": round(1.0 / home_back, 4) if home_back > 1 else 0.5,
        }
        
        games.append({
            "game_id": f"nrl_{event_id}",
            "home_team": home,
            "away_team": away,
            "features": features,
            "date": event.get("openDate") or m.get("marketStartTime"),
            "venue": event.get("venue") or random.choice(NRL_VENUES),
            "complete": 0,
            "hscore": None,
            "ascore": None,
            "source": "betfair_live"
        })
        
    return games

def _generate_mock_nrl(target_date):
    games = []
    # Create 3-4 realistic NRL games for the round
    random.seed(target_date.toordinal())
    shuffled_teams = list(NRL_TEAMS)
    random.shuffle(shuffled_teams)
    
    for i in range(4):
        home = shuffled_teams[2*i]
        away = shuffled_teams[2*i+1]
        venue = random.choice(NRL_VENUES)
        game_id = f"nrl_mock_{target_date.strftime('%Y%m%d')}_{i}"
        
        features = {
            "points_differential": round(float(random.uniform(-8.0, 8.0)), 2),
            "recent_form": round(float(random.uniform(-0.4, 0.4)), 2),
            "head_to_head": round(float(random.uniform(-0.3, 0.3)), 2),
            "home_advantage_base": 0.05,
            "live_odds_signal": round(float(random.uniform(0.3, 0.7)), 4),
        }
        
        # Game time spread over the weekend
        game_time = datetime.combine(target_date, datetime.min.time()) + timedelta(hours=14 + i * 2)
        
        games.append({
            "game_id": game_id,
            "home_team": home,
            "away_team": away,
            "features": features,
            "date": game_time.isoformat() + "Z",
            "venue": venue,
            "complete": 0,
            "hscore": None,
            "ascore": None,
            "source": "betfair_mock"
        })
    return games
