import requests
import json
import os
import random
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

BETFAIR_APP_KEY = os.getenv("BETFAIR_APP_KEY", "")
BETFAIR_USERNAME = os.getenv("BETFAIR_USERNAME", "")
BETFAIR_PASSWORD = os.getenv("BETFAIR_PASSWORD", "")

_session_token = None

def _login():
    """Authenticate with Betfair AU and cache the session token."""
    global _session_token
    
    if not BETFAIR_APP_KEY or not BETFAIR_USERNAME or not BETFAIR_PASSWORD:
        print("[Betfair] Missing credentials, falling back to mock data")
        return None
    
    login_url = 'https://identitysso.betfair.com.au/api/login'
    login_payload = {
        'username': BETFAIR_USERNAME,
        'password': BETFAIR_PASSWORD
    }
    login_headers = {
        'X-Application': BETFAIR_APP_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
    }

    try:
        res = requests.post(login_url, data=login_payload, headers=login_headers, timeout=10)
        res.raise_for_status()
        auth_data = res.json()
        token = auth_data.get('token')
        if token:
            _session_token = token
            print(f"[Betfair] Authenticated successfully")
            return token
        else:
            print(f"[Betfair] Login failed: {auth_data.get('error', 'unknown')}")
            return None
    except Exception as e:
        print(f"[Betfair] Login error: {e}")
        return None


def _get_api_headers():
    """Get authenticated headers, logging in if needed."""
    global _session_token
    if not _session_token:
        _login()
    if not _session_token:
        return None
    return {
        'X-Application': BETFAIR_APP_KEY,
        'X-Authentication': _session_token,
        'Content-Type': 'application/json'
    }


def fetch_today_races():
    """
    Fetch upcoming Australian horse races from Betfair.
    Falls back to mock data if API is unavailable.
    """
    headers = _get_api_headers()
    
    if headers:
        try:
            return _fetch_live_races(headers)
        except Exception as e:
            print(f"[Betfair] Live fetch failed ({e}), falling back to mock data")
    
    return _generate_mock_races()


def _fetch_live_races(headers):
    """Fetch real race data from Betfair Exchange API."""
    api_url = "https://api.betfair.com/exchange/betting/rest/v1.0/listMarketCatalogue/"
    
    # Get upcoming AU horse racing Win markets
    market_filter = {
        "filter": {
            "eventTypeIds": ["7"],  # Horse Racing
            "marketCountries": ["AU"],
            "marketTypeCodes": ["WIN"]
        },
        "maxResults": "30",
        "sort": "FIRST_TO_START",
        "marketProjection": [
            "EVENT",
            "RUNNER_DESCRIPTION",
            "MARKET_START_TIME",
            "MARKET_DESCRIPTION"
        ]
    }
    
    response = requests.post(
        api_url,
        data=json.dumps(market_filter),
        headers=headers,
        timeout=15
    )
    response.raise_for_status()
    markets = response.json()
    
    if not markets:
        print("[Betfair] No markets returned, using mock data")
        return _generate_mock_races()
    
    # Also fetch live prices for each market
    market_ids = [m['marketId'] for m in markets]
    prices = _fetch_prices(headers, market_ids)
    
    races = []
    for market in markets:
        event = market.get('event', {})
        venue_raw = event.get('venue', event.get('name', 'Unknown'))
        market_name = market.get('marketName', '')
        market_id = market.get('marketId', '')
        start_time = market.get('marketStartTime', '')
        description = market.get('description', {})
        
        # Parse race number and distance from marketName
        # Format is typically "R1 1100m 2yo" or "R3 1415m Mdn"
        race_number = 0
        distance = 1200
        parts = market_name.split()
        for part in parts:
            if part.startswith('R') and part[1:].isdigit():
                race_number = int(part[1:])
            if part.endswith('m') and part[:-1].isdigit():
                distance = int(part[:-1])
        
        # Build horse data from runners
        runners = market.get('runners', [])
        market_prices = prices.get(market_id, {})
        
        horses = []
        for idx, runner in enumerate(runners):
            runner_name = runner.get('runnerName', f'Runner {idx+1}')
            selection_id = str(runner.get('selectionId', ''))
            handicap = runner.get('handicap', 0)
            
            # Get Betfair back price if available
            runner_price = market_prices.get(selection_id, {})
            back_price = runner_price.get('back', 0)
            implied_prob = (1 / back_price) if back_price > 1 else 0
            
            horses.append({
                "horse_id": selection_id or f"bf_{market_id}_{idx}",
                "name": runner_name,
                "barrier": idx + 1,  # Betfair doesn't give barrier, approximate
                "weight": round(random.uniform(54, 61), 1),  # Not in Betfair data
                "past_win_rate": round(implied_prob * 0.8, 3),  # Derive from market price
                "jockey_win_rate": round(random.uniform(0.05, 0.25), 3),
                "track_condition": random.randint(1, 4),
                "days_since_last_race": random.randint(7, 45),
                "betfair_back_price": back_price,
                "betfair_implied_prob": round(implied_prob, 4)
            })
        
        races.append({
            "race_id": market_id,
            "venue": venue_raw,
            "race_number": race_number,
            "distance": distance,
            "start_time": start_time,
            "market_name": market_name,
            "horses": horses,
            "source": "betfair_live"
        })
    
    print(f"[Betfair] Loaded {len(races)} live races from {len(set(r['venue'] for r in races))} venues")
    return races


def _fetch_prices(headers, market_ids):
    """Fetch live prices (back/lay) for a batch of markets."""
    if not market_ids:
        return {}
    
    api_url = "https://api.betfair.com/exchange/betting/rest/v1.0/listMarketBook/"
    payload = {
        "marketIds": market_ids[:10],  # Limit to 10 at a time
        "priceProjection": {
            "priceData": ["EX_BEST_OFFERS"]
        }
    }
    
    try:
        response = requests.post(
            api_url,
            data=json.dumps(payload),
            headers=headers,
            timeout=15
        )
        response.raise_for_status()
        books = response.json()
        
        result = {}
        for book in books:
            mid = book.get('marketId', '')
            runners_map = {}
            for runner in book.get('runners', []):
                sel_id = str(runner.get('selectionId', ''))
                ex = runner.get('ex', {})
                back_prices = ex.get('availableToBack', [])
                lay_prices = ex.get('availableToLay', [])
                
                best_back = back_prices[0].get('price', 0) if back_prices else 0
                best_lay = lay_prices[0].get('price', 0) if lay_prices else 0
                
                runners_map[sel_id] = {
                    'back': best_back,
                    'lay': best_lay
                }
            result[mid] = runners_map
        return result
    except Exception as e:
        print(f"[Betfair] Price fetch error: {e}")
        return {}


def _generate_mock_races():
    """Fallback mock data when Betfair API is unavailable."""
    venues = ["Flemington", "Randwick", "Caulfield", "Moonee Valley"]
    races = []
    
    for v_idx, venue in enumerate(venues):
        for race_num in range(1, random.randint(4, 9)):
            num_horses = random.randint(8, 14)
            horses = []
            for h in range(1, num_horses + 1):
                horses.append({
                    "horse_id": f"h_{v_idx}_{race_num}_{h}",
                    "name": f"Horse {h}",
                    "barrier": h,
                    "weight": round(random.uniform(54, 61), 1),
                    "past_win_rate": round(random.uniform(0.05, 0.4), 3),
                    "jockey_win_rate": round(random.uniform(0.05, 0.3), 3),
                    "track_condition": random.randint(1, 4),
                    "days_since_last_race": random.randint(7, 45),
                    "betfair_back_price": 0,
                    "betfair_implied_prob": 0
                })
            
            races.append({
                "race_id": f"r_{v_idx}_{race_num}",
                "venue": venue,
                "race_number": race_num,
                "distance": random.choice([1000, 1200, 1400, 1600, 2000]),
                "start_time": "",
                "market_name": f"R{race_num} {random.choice([1000, 1200, 1400])}m",
                "horses": horses,
                "source": "mock"
            })
            
    return races
