import os
import random
import requests
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv

from app.time_utils import melbourne_date_string, resolve_melbourne_date, today_melbourne
from app.data.scraper import _get_api_headers

load_dotenv()

SOCCER_TEAMS = [
    "Manchester City", "Arsenal", "Liverpool", "Aston Villa",
    "Tottenham Hotspur", "Chelsea", "Manchester United", "Newcastle United",
    "Real Madrid", "Barcelona", "Atletico Madrid", "Bayern Munich",
    "Bayer Leverkusen", "Borussia Dortmund", "Paris Saint-Germain",
    "Juventus", "AC Milan", "Inter Milan"
]

SOCCER_STADIUMS = [
    "Etihad Stadium", "Emirates Stadium", "Anfield", "Villa Park",
    "Tottenham Hotspur Stadium", "Stamford Bridge", "Old Trafford", "St James' Park",
    "Santiago Bernabeu", "Camp Nou", "Metropolitano", "Allianz Arena",
    "BayArena", "Signal Iduna Park", "Parc des Princes", "San Siro", "Juventus Stadium"
]

def fetch_today_soccer(run_date=None, allow_mock=True):
    target_date = resolve_melbourne_date(run_date) if run_date else today_melbourne()
    headers = _get_api_headers()
    
    if headers:
        try:
            return _fetch_live_soccer(headers, target_date)
        except Exception as e:
            print(f"[Betfair Soccer] Live fetch failed: {e}")
            
    if allow_mock:
        return _generate_mock_soccer(target_date)
    return []

def _fetch_live_soccer(headers, target_date):
    api_url = "https://api.betfair.com/exchange/betting/rest/v1.0/listMarketCatalogue/"
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
        return _generate_mock_soccer(target_date)
        
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

def _generate_mock_soccer(target_date):
    games = []
    random.seed(target_date.toordinal() + 50)
    shuffled_teams = list(SOCCER_TEAMS)
    random.shuffle(shuffled_teams)
    
    for i in range(5):
        home = shuffled_teams[2*i]
        away = shuffled_teams[2*i+1]
        venue = random.choice(SOCCER_STADIUMS)
        game_id = f"soccer_mock_{target_date.strftime('%Y%m%d')}_{i}"
        
        features = {
            "goal_difference": round(float(random.uniform(-2.5, 2.5)), 2),
            "recent_form": round(float(random.uniform(-0.35, 0.35)), 2),
            "head_to_head": round(float(random.uniform(-0.3, 0.3)), 2),
            "home_advantage_base": 0.05,
            "live_odds_signal": round(float(random.uniform(0.3, 0.7)), 4),
        }
        
        game_time = datetime.combine(target_date, datetime.min.time()) + timedelta(hours=12 + i * 2)
        
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
