import sys
import os
sys.path.append(os.path.abspath('services/prediction-engine'))
from app.data import scraper

races = scraper.fetch_today_races()
if races:
    race = races[0].copy()
    if 'horses' in race:
        race['horses'] = "HIDDEN"
    print(race)
