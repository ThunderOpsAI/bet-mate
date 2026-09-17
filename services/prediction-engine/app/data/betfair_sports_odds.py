from __future__ import annotations

import difflib
import json
import logging
import re
import requests
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from app.data.scraper import _get_api_headers, _fetch_prices, betfair_catalogue_url, race_window_ttl

SPORT_EVENT_TYPE_IDS = {
    "afl": "61420",
    "nrl": "1477",
    "nba": "7522",
    "mma": "26420387",
    "soccer": "1",
    "cricket": "4",
    "golf": "3",
}

_odds_cache: Dict[str, Tuple[Dict, float]] = {}


def _normalize_team_name(name: str) -> str:
    name = name.strip().lower()
    name = re.sub(r'\b(fc|city|united|rovers|wanderers)\b', '', name)
    name = re.sub(r'[^\w\s]', '', name)
    return name.strip()


def _fuzzy_match(name_a: str, name_b: str, threshold: float = 0.6) -> bool:
    ratio = difflib.SequenceMatcher(None, name_a, name_b).ratio()
    return ratio >= threshold


def fetch_sport_market_odds(sport: str, lookback_days: int = 1, lookahead_days: int = 3) -> Dict[str, Dict[str, Any]]:
    event_type_id = SPORT_EVENT_TYPE_IDS.get(sport.lower())
    if not event_type_id:
        LOGGER.error("Unknown sport for Betfair odds: %s", sport)
        return {}

    headers = _get_api_headers()
    if not headers:
        LOGGER.error("Failed to get Betfair API headers for %s", sport)
        return {}

    now = datetime.utcnow()
    start_time = (now - timedelta(days=lookback_days)).strftime("%Y-%m-%dT%H:%M:%SZ")
    end_time = (now + timedelta(days=lookahead_days)).strftime("%Y-%m-%dT%H:%M:%SZ")

    payload = {
        "filter": {
            "eventTypeIds": [event_type_id],
            "marketStartTime": {
                "from": start_time,
                "to": end_time
            },
            "marketTypeCodes": ["MATCH_ODDS", "MATCH_WINNER", "WIN"]
        },
        "maxResults": "100",
        "marketProjection": ["EVENT", "RUNNER_DESCRIPTION", "MARKET_START_TIME"]
    }

    try:
        response = requests.post(betfair_catalogue_url(), headers=headers, json=payload, timeout=10)
        response.raise_for_status()
        catalogue = response.json()
    except Exception as exc:
        LOGGER.error("Error fetching market catalogue for %s: %s", sport, exc)
        return {}

    if not catalogue:
        return {}

    market_ids = [m["marketId"] for m in catalogue]
    prices = _fetch_prices(headers, market_ids)
    
    odds_cache = {}
    seen_event_ids = set()

    for market in catalogue:
        event = market.get("event", {})
        event_id = event.get("id")
        
        if not event_id or event_id in seen_event_ids:
            continue
            
        seen_event_ids.add(event_id)
        
        event_name = event.get("name", "")
        market_id = market.get("marketId")
        runners = market.get("runners", [])
        
        market_prices = prices.get(market_id, {})
        
        runner_odds = {}
        for runner in runners:
            selection_id = str(runner.get("selectionId"))
            runner_name = runner.get("runnerName", "")
            
            runner_price_data = market_prices.get(selection_id, {})
            back_price = runner_price_data.get("back")
            if back_price:
                runner_odds[runner_name] = back_price
                
        odds_cache[event_name] = {
            "event_id": event_id,
            "market_id": market_id,
            "start_time": market.get("marketStartTime"),
            "odds": runner_odds
        }
        
    return odds_cache


def get_cached_sport_odds(sport: str) -> Dict[str, Dict[str, Any]]:
    sport = sport.lower()
    now = time.time()
    
    if sport in _odds_cache:
        cached_data, timestamp = _odds_cache[sport]
        
        next_jump_time = None
        for event_name, event_data in cached_data.items():
            start_time = event_data.get("start_time")
            if not start_time:
                continue
            if next_jump_time is None or start_time < next_jump_time:
                next_jump_time = start_time
                
        ttl = race_window_ttl(next_jump_time) if next_jump_time else 1800
        
        if now - timestamp < ttl:
            return cached_data
            
    try:
        fresh_data = fetch_sport_market_odds(sport)
        _odds_cache[sport] = (fresh_data, now)
        return fresh_data
    except Exception as exc:
        LOGGER.error("Failed to update odds cache for %s: %s", sport, exc)
        if sport in _odds_cache:
            return _odds_cache[sport][0]
        return {}


def match_event_odds(sport: str, home_team: str, away_team: str, odds_cache: Dict) -> Tuple[Optional[float], Optional[float]]:
    if not odds_cache:
        return None, None
        
    norm_home = _normalize_team_name(home_team)
    norm_away = _normalize_team_name(away_team)
    
    best_event = None
    best_score = 0
    
    for event_name, event_data in odds_cache.items():
        if " v " in event_name or " vs " in event_name:
            parts = re.split(r'\s+v\s+|\s+vs\s+', event_name, maxsplit=1, flags=re.IGNORECASE)
            if len(parts) == 2:
                e_home, e_away = _normalize_team_name(parts[0]), _normalize_team_name(parts[1])
                
                # Check normal order
                score1 = (difflib.SequenceMatcher(None, norm_home, e_home).ratio() + 
                         difflib.SequenceMatcher(None, norm_away, e_away).ratio()) / 2
                         
                # Check reversed order (sometimes Betfair swaps them)
                score2 = (difflib.SequenceMatcher(None, norm_home, e_away).ratio() + 
                         difflib.SequenceMatcher(None, norm_away, e_home).ratio()) / 2
                         
                max_score = max(score1, score2)
                if max_score > best_score and max_score >= 0.6:
                    best_score = max_score
                    best_event = event_data
                    
    if not best_event:
        return None, None
        
    odds = best_event.get("odds", {})
    home_odds, away_odds = None, None
    
    for runner_name, price in odds.items():
        norm_runner = _normalize_team_name(runner_name)
        if _fuzzy_match(norm_home, norm_runner, 0.6):
            home_odds = price
        elif _fuzzy_match(norm_away, norm_runner, 0.6):
            away_odds = price
            
    return home_odds, away_odds


def match_golfer_odds(player_name: str, odds_cache: Dict) -> Optional[float]:
    if not odds_cache:
        return None
        
    norm_player = _normalize_team_name(player_name)
    
    # In golf, there's typically one or a few big tournament events.
    # We just search all runners across all events in the cache.
    best_price = None
    best_score = 0
    
    for event_name, event_data in odds_cache.items():
        for runner_name, price in event_data.get("odds", {}).items():
            norm_runner = _normalize_team_name(runner_name)
            score = difflib.SequenceMatcher(None, norm_player, norm_runner).ratio()
            if score > best_score and score >= 0.6:
                best_score = score
                best_price = price
                
    return best_price
