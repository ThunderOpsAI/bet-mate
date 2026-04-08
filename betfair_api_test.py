#Betfair API test
import requests
import json

import requests
import json

# --- CONFIG ---
APP_KEY = "YPBdcbzr5gjzEnTQ"
USERNAME = "khookt88"
PASSWORD = 'Quinn123$'

def get_betfair_data():
    print("--- Step 1: Logging in to Betfair AU ---")
    
    # 1. AUTHENTICATION
    login_url = 'https://identitysso.betfair.com.au/api/login'
    login_payload = {
        'username': USERNAME,
        'password': PASSWORD
    }
    login_headers = {
        'X-Application': APP_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
    }

    try:
        res = requests.post(login_url, data=login_payload, headers=login_headers)
        res.raise_for_status()
        auth_data = res.json()
    except Exception as e:
        print(f"Connection Error: {e}")
        return

    session_token = auth_data.get('token')
    if not session_token:
        print(f"Login Failed! Status: {auth_data.get('status')}")
        print(f"Error: {auth_data.get('error')}")
        return

    print(f"Success! Session: {session_token[:10]}...")

    # 2. FETCH NEXT RACES
    print("\n--- Step 2: Fetching Next 5 AU Horse Races ---")
    api_url = "https://api.betfair.com/exchange/betting/rest/v1.0/listMarketCatalogue/"
    
    api_headers = {
        'X-Application': APP_KEY,
        'X-Authentication': session_token,
        'Content-Type': 'application/json'
    }

    # Filter for Horse Racing (7), Australia (AU), Win Markets (WIN)
    market_filter = {
        "filter": {
            "eventTypeIds": ["7"],
            "marketCountries": ["AU"],
            "marketTypeCodes": ["WIN"]
        },
        "maxResults": "5",
        "marketProjection": ["EVENT", "RUNNER_DESCRIPTION"]
    }

    try:
        response = requests.post(api_url, data=json.dumps(market_filter), headers=api_headers)
        response.raise_for_status()
        markets = response.json()
        
        print(f"Found {len(markets)} upcoming races:\n")
        for m in markets:
            event_name = m.get('event', {}).get('name', 'Unknown Track')
            market_name = m.get('marketName', 'Unknown Race')
            print(f" - {event_name}: {market_name}")
            
    except Exception as e:
        print(f"Data Fetch Failed: {e}")

if __name__ == "__main__":
    get_betfair_data()
