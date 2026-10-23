import asyncio
import json
import app.data.scraper as scraper
import requests

headers = scraper._get_api_headers()
market_filter = {
    "filter": {
        "eventTypeIds": ["7", "4339", "4337"],
        "marketCountries": ["AU"],
        "marketTypeCodes": ["WIN"],
    },
    "maxResults": 1,
    "sort": "FIRST_TO_START",
    "marketProjection": [
        "EVENT",
        "EVENT_TYPE",
        "RUNNER_DESCRIPTION",
        "MARKET_START_TIME",
        "MARKET_DESCRIPTION",
        "RUNNER_METADATA",
    ],
}
response = requests.post(scraper.betfair_catalogue_url(), data=json.dumps(market_filter), headers=headers)
print(json.dumps(response.json(), indent=2))

