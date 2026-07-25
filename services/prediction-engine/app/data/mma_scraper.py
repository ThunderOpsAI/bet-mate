import os
import random
import requests
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

from app.time_utils import melbourne_date_string, resolve_melbourne_date, today_melbourne
from app.data.scraper import _get_api_headers

load_dotenv()

MMA_FIGHTERS = [
    "Jon Jones", "Stipe Miocic", "Alex Pereira", "Israel Adesanya",
    "Islam Makhachev", "Arman Tsarukyan", "Leon Edwards", "Belal Muhammad",
    "Sean O'Malley", "Merab Dvalishvili", "Ilia Topuria", "Max Holloway",
    "Conor McGregor", "Michael Chandler", "Dustin Poirier", "Justin Gaethje"
]

MMA_VENUES = [
    "T-Mobile Arena", "Madison Square Garden", "Honda Center", "Jeunesse Arena",
    "Etihad Arena", "Apex Las Vegas", "Toyota Center", "RAC Arena"
]

MMA_WEIGHTS = [
    "Heavyweight", "Light Heavyweight", "Middleweight", "Welterweight",
    "Lightweight", "Featherweight", "Bantamweight"
]

def fetch_today_mma(run_date=None, allow_mock=True):
    target_date = resolve_melbourne_date(run_date) if run_date else today_melbourne()
    headers = _get_api_headers()
    
    if headers:
        try:
            return _fetch_live_mma(headers, target_date)
        except Exception as e:
            print(f"[Betfair MMA] Live fetch failed: {e}")
            
    if allow_mock:
        return _generate_mock_mma(target_date)
    return []

def _fetch_live_mma(headers, target_date):
    api_url = "https://api.betfair.com/exchange/betting/rest/v1.0/listMarketCatalogue/"
    start_time = (datetime.combine(target_date, datetime.min.time()) - timedelta(days=1)).isoformat() + "Z"
    end_time = (datetime.combine(target_date, datetime.max.time()) + timedelta(days=2)).isoformat() + "Z"
    
    payload = {
        "filter": {
            "eventTypeIds": ["26420387"],
            "marketStartTime": {"from": start_time, "to": end_time}
        },
        "maxResults": "50",
        "marketProjection": ["EVENT", "RUNNER_DESCRIPTION", "MARKET_START_TIME", "MARKET_DESCRIPTION"]
    }
    
    response = requests.post(api_url, data=json.dumps(payload), headers=headers, timeout=15)
    response.raise_for_status()
    markets = response.json()
    
    if not markets:
        return _generate_mock_mma(target_date)
        
    games = []
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
            "striking_accuracy": round(float(random.uniform(0.4, 0.7)), 2),
            "takedown_defense": round(float(random.uniform(0.4, 0.85)), 2),
            "reach_advantage": round(float(random.uniform(-4.0, 4.0)), 1),
            "recent_form": round(float(random.uniform(-0.5, 0.5)), 2),
            "live_odds_signal": round(1.0 / home_back, 4) if home_back > 1 else 0.5,
        }
        
        games.append({
            "game_id": f"mma_{event_id}",
            "home_team": home,
            "away_team": away,
            "features": features,
            "date": event.get("openDate") or m.get("marketStartTime"),
            "weight_class": random.choice(MMA_WEIGHTS),
            "venue": event.get("venue") or random.choice(MMA_VENUES),
            "complete": 0,
            "hscore": None,
            "ascore": None,
            "source": "betfair_live"
        })
        
    return games

def _generate_mock_mma(target_date):
    games = []
    random.seed(target_date.toordinal() + 200)
    shuffled_fighters = list(MMA_FIGHTERS)
    random.shuffle(shuffled_fighters)
    
    for i in range(4):
        home = shuffled_fighters[2*i]
        away = shuffled_fighters[2*i+1]
        venue = random.choice(MMA_VENUES)
        game_id = f"mma_mock_{target_date.strftime('%Y%m%d')}_{i}"
        
        features = {
            "striking_accuracy": round(float(random.uniform(0.45, 0.65)), 2),
            "takedown_defense": round(float(random.uniform(0.5, 0.8)), 2),
            "reach_advantage": round(float(random.uniform(-3.0, 3.0)), 1),
            "recent_form": round(float(random.uniform(-0.4, 0.4)), 2),
            "live_odds_signal": round(float(random.uniform(0.3, 0.7)), 4),
        }
        
        game_time = datetime.combine(target_date, datetime.min.time()) + timedelta(hours=18 + i)
        
        games.append({
            "game_id": game_id,
            "home_team": home,
            "away_team": away,
            "features": features,
            "date": game_time.isoformat() + "Z",
            "weight_class": random.choice(MMA_WEIGHTS),
            "venue": venue,
            "complete": 0,
            "hscore": None,
            "ascore": None,
            "source": "betfair_mock"
        })
    return games
