import sys
import os
sys.path.append(os.path.abspath('services/prediction-engine'))
from app.data.scraper import fetch_today_races
races = fetch_today_races()
print(f"Races length: {len(races)}")
