from __future__ import annotations

import html
import json
import os
import random
import re
import unicodedata
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Dict, Iterable, Optional

import requests
from dotenv import load_dotenv

from app.time_utils import MELBOURNE_TZ, melbourne_date_string, melbourne_weekday, today_melbourne

load_dotenv()

BETFAIR_APP_KEY = os.getenv("BETFAIR_APP_KEY", "")
BETFAIR_USERNAME = os.getenv("BETFAIR_USERNAME", "")
BETFAIR_PASSWORD = os.getenv("BETFAIR_PASSWORD", "")

ALLOWLIST_PATH = Path(__file__).with_name("metro_allowlist.json")
RA_BASE_URL = "https://racingaustralia.horse/ozracing/Acceptances.aspx"
DEFAULT_TIMEOUT_SECONDS = 10

_session_token = None
_metro_allowlist_cache: Optional[dict] = None

MOCK_RUNNER_NAMES = [
    "Southern Crown",
    "Midnight Signal",
    "Velvet Charge",
    "Golden Static",
    "Harbour Light",
    "Coastal Theory",
    "Desert Anthem",
    "Silver Borough",
    "Quick Stepper",
    "Sunline Echo",
    "Orbit Parade",
    "North Harbour",
    "Rapid Current",
    "Royal Ledger",
]
MOCK_JOCKEYS = [
    "J. McNeil",
    "D. Oliver",
    "J. Kah",
    "T. Clark",
    "C. Williams",
    "B. Melham",
]


def _login():
    global _session_token

    if not BETFAIR_APP_KEY or not BETFAIR_USERNAME or not BETFAIR_PASSWORD:
        print("[Betfair] Missing credentials, falling back to mock data")
        return None

    login_url = "https://identitysso.betfair.com.au/api/login"
    login_payload = {
        "username": BETFAIR_USERNAME,
        "password": BETFAIR_PASSWORD,
    }
    login_headers = {
        "X-Application": BETFAIR_APP_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
    }

    try:
        res = requests.post(login_url, data=login_payload, headers=login_headers, timeout=DEFAULT_TIMEOUT_SECONDS)
        res.raise_for_status()
        auth_data = res.json()
        token = auth_data.get("token")
        if token:
            _session_token = token
            print("[Betfair] Authenticated successfully")
            return token
        print(f"[Betfair] Login failed: {auth_data.get('error', 'unknown')}")
        return None
    except Exception as exc:
        print(f"[Betfair] Login error: {exc}")
        return None


def _get_api_headers():
    global _session_token
    if not _session_token:
        _login()
    if not _session_token:
        return None
    return {
        "X-Application": BETFAIR_APP_KEY,
        "X-Authentication": _session_token,
        "Content-Type": "application/json",
    }


def load_metro_allowlist(force_reload: bool = False) -> dict:
    global _metro_allowlist_cache
    if _metro_allowlist_cache is not None and not force_reload:
        return _metro_allowlist_cache

    with ALLOWLIST_PATH.open("r", encoding="utf-8") as handle:
        raw = json.load(handle)

    alias_map = {}
    for entry in raw.values():
        for alias in entry.get("aliases", []):
            alias_map[_normalize_name(alias)] = entry
        alias_map[_normalize_name(entry.get("venue", ""))] = entry

    _metro_allowlist_cache = alias_map
    return _metro_allowlist_cache


def fetch_today_races(run_date: Optional[str] = None):
    target_date = _resolve_run_date(run_date)
    target_date_str = target_date.isoformat()
    headers = _get_api_headers()

    if headers:
        try:
            races = _fetch_live_races(headers, target_date)
        except Exception as exc:
            print(f"[Betfair] Live fetch failed ({exc}), falling back to mock data")
            races = _generate_mock_races(target_date)
    else:
        races = _generate_mock_races(target_date)

    final_races = []
    for race in races:
        prepared = _prepare_race_card(race, default_meeting_date=target_date_str)
        if prepared.get("meeting_date") != target_date_str:
            continue
        if not _is_allowed_meeting(prepared):
            continue
        final_races.append(_enrich_with_racing_australia(prepared))

    return final_races


def _fetch_live_races(headers, target_date: date):
    api_url = "https://api.betfair.com/exchange/betting/rest/v1.0/listMarketCatalogue/"
    market_start_time = _betfair_market_time_window(target_date)
    market_filter = {
        "filter": {
            "eventTypeIds": ["7"],
            "marketCountries": ["AU"],
            "marketTypeCodes": ["WIN"],
            "marketStartTime": market_start_time,
        },
        "maxResults": "200",
        "sort": "FIRST_TO_START",
        "marketProjection": [
            "EVENT",
            "RUNNER_DESCRIPTION",
            "MARKET_START_TIME",
            "MARKET_DESCRIPTION",
        ],
    }

    response = requests.post(
        api_url,
        data=json.dumps(market_filter),
        headers=headers,
        timeout=15,
    )
    response.raise_for_status()
    markets = response.json()

    if not markets:
        print("[Betfair] No markets returned, using mock data")
        return _generate_mock_races()

    market_ids = [market["marketId"] for market in markets]
    prices = _fetch_prices(headers, market_ids)

    races = []
    for market in markets:
        event = market.get("event", {})
        venue_raw = event.get("venue", event.get("name", "Unknown"))
        market_name = market.get("marketName", "")
        market_id = market.get("marketId", "")
        start_time = market.get("marketStartTime", "")

        race_number = 0
        distance = 1200
        for part in market_name.split():
            if part.startswith("R") and part[1:].isdigit():
                race_number = int(part[1:])
            if part.endswith("m") and part[:-1].isdigit():
                distance = int(part[:-1])

        runners = market.get("runners", [])
        market_prices = prices.get(market_id, {})

        horses = []
        for idx, runner in enumerate(runners):
            runner_name = runner.get("runnerName") or f"Runner {idx + 1}"
            selection_id = str(runner.get("selectionId", ""))
            runner_price = market_prices.get(selection_id, {})
            back_price = runner_price.get("back", 0)
            implied_prob = (1 / back_price) if back_price > 1 else 0

            horses.append({
                "horse_id": selection_id or f"bf_{market_id}_{idx}",
                "name": runner_name,
                "barrier": idx + 1,
                "weight": round(random.uniform(54, 61), 1),
                "past_win_rate": round(implied_prob * 0.8, 3),
                "jockey_win_rate": round(random.uniform(0.05, 0.25), 3),
                "track_condition": random.randint(1, 4),
                "days_since_last_race": random.randint(7, 45),
                "betfair_back_price": back_price,
                "betfair_implied_prob": round(implied_prob, 4),
                "jockey_name": None,
                "meeting_type": "unknown",
                "meeting_region": "",
                "meeting_date": melbourne_date_string(start_time or None),
                "data_source": "betfair",
            })

        races.append({
            "race_id": market_id,
            "venue": venue_raw,
            "race_number": race_number,
            "distance": distance,
            "start_time": start_time,
            "market_name": market_name,
            "horses": horses,
            "source": "betfair_live",
        })

    print(f"[Betfair] Loaded {len(races)} live races from {len(set(r['venue'] for r in races))} venues")
    return races


def _resolve_run_date(run_date: Optional[str]) -> date:
    if not run_date:
        return today_melbourne()
    return date.fromisoformat(run_date)


def _betfair_market_time_window(target_date: date) -> dict:
    start_local = datetime.combine(target_date, time.min, tzinfo=MELBOURNE_TZ)
    end_local = start_local + timedelta(days=1)
    start_utc = start_local.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    end_utc = end_local.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return {
        "from": start_utc,
        "to": end_utc,
    }


def _fetch_prices(headers, market_ids):
    if not market_ids:
        return {}

    api_url = "https://api.betfair.com/exchange/betting/rest/v1.0/listMarketBook/"
    payload = {
        "marketIds": market_ids[:10],
        "priceProjection": {"priceData": ["EX_BEST_OFFERS"]},
    }

    try:
        response = requests.post(
            api_url,
            data=json.dumps(payload),
            headers=headers,
            timeout=15,
        )
        response.raise_for_status()
        books = response.json()

        result = {}
        for book in books:
            mid = book.get("marketId", "")
            runners_map = {}
            for runner in book.get("runners", []):
                sel_id = str(runner.get("selectionId", ""))
                ex = runner.get("ex", {})
                back_prices = ex.get("availableToBack", [])
                lay_prices = ex.get("availableToLay", [])
                runners_map[sel_id] = {
                    "back": back_prices[0].get("price", 0) if back_prices else 0,
                    "lay": lay_prices[0].get("price", 0) if lay_prices else 0,
                }
            result[mid] = runners_map
        return result
    except Exception as exc:
        print(f"[Betfair] Price fetch error: {exc}")
        return {}


def _prepare_race_card(race: dict, default_meeting_date: Optional[str] = None) -> dict:
    allowlist_entry = _lookup_allowlist_entry(race.get("venue", ""))
    meeting_context = _meeting_context_for_start_time(race.get("start_time") or None)
    meeting_date = meeting_context["date"] if race.get("start_time") else (default_meeting_date or meeting_context["date"])
    meeting_region = allowlist_entry.get("region", "") if allowlist_entry else ""
    meeting_type = "metro" if allowlist_entry else "unknown"
    data_source = "mock" if race.get("source") == "mock" else "betfair"

    prepared_horses = []
    for horse in race.get("horses", []):
        prepared_horse = dict(horse)
        prepared_horse["jockey_name"] = horse.get("jockey_name")
        prepared_horse["meeting_type"] = horse.get("meeting_type") or meeting_type
        prepared_horse["meeting_region"] = horse.get("meeting_region") or meeting_region
        prepared_horse["meeting_date"] = horse.get("meeting_date") or meeting_date
        prepared_horse["data_source"] = horse.get("data_source") or data_source
        prepared_horses.append(prepared_horse)

    return {
        **race,
        "meeting_type": meeting_type,
        "meeting_region": meeting_region,
        "meeting_date": meeting_date,
        "data_source": data_source,
        "horses": prepared_horses,
    }


def _is_allowed_meeting(race: dict) -> bool:
    entry = _lookup_allowlist_entry(race.get("venue", ""))
    if not entry:
        return True
    weekday = _meeting_context_for_start_time(race.get("start_time") or None)["weekday"]
    return weekday in set(entry.get("active_days", []))


def _lookup_allowlist_entry(venue: str) -> Optional[dict]:
    if not venue:
        return None
    return load_metro_allowlist().get(_normalize_name(venue))


def _enrich_with_racing_australia(race: dict) -> dict:
    if race.get("data_source") == "mock":
        return race

    allowlist_entry = _lookup_allowlist_entry(race.get("venue", ""))
    if not allowlist_entry:
        return race

    try:
        ra_rows = _fetch_racing_australia_acceptances(
            meeting_date=race["meeting_date"],
            state=allowlist_entry["state"],
            venue=allowlist_entry["venue"],
        )
    except Exception as exc:
        print(f"[RacingAustralia] Enrichment skipped for {race.get('venue')}: {exc}")
        return race

    if not ra_rows:
        return race

    row_map = {
        _normalize_name(row["runner_name"]): row
        for row in ra_rows
        if row.get("runner_name")
    }

    enriched_horses = []
    matched_any = False
    for horse in race.get("horses", []):
        normalized_name = _normalize_name(horse.get("name", ""))
        matched = row_map.get(normalized_name)
        enriched = dict(horse)
        enriched["meeting_type"] = "metro"
        enriched["meeting_region"] = allowlist_entry.get("region", "")
        enriched["meeting_date"] = race["meeting_date"]
        if matched:
            enriched["jockey_name"] = matched.get("jockey_name")
            enriched["data_source"] = "racing_australia"
            matched_any = True
        else:
            enriched["jockey_name"] = None
        enriched_horses.append(enriched)

    return {
        **race,
        "meeting_type": "metro",
        "meeting_region": allowlist_entry.get("region", ""),
        "meeting_date": race["meeting_date"],
        "data_source": "racing_australia" if matched_any else race.get("data_source", "betfair"),
        "horses": enriched_horses,
    }


def _fetch_racing_australia_acceptances(meeting_date: str, state: str, venue: str) -> list[dict]:
    date_key = datetime.fromisoformat(meeting_date).strftime("%Y%b%d").upper()
    url = f"{RA_BASE_URL}?key={date_key}%2C{state.upper()}%2C{venue.upper().replace(' ', '+')}"
    return _parse_racing_australia_html(_fetch_racing_australia_html(url))


def _fetch_racing_australia_html(url: str) -> str:
    response = requests.get(url, timeout=DEFAULT_TIMEOUT_SECONDS)
    response.raise_for_status()
    return response.text


def _meeting_context_for_start_time(start_time: Optional[str]) -> dict:
    return {
        "date": melbourne_date_string(start_time or None),
        "weekday": melbourne_weekday(start_time or None),
    }


def _parse_racing_australia_html(html_text: str) -> list[dict]:
    tokens = re.finditer(r"(?P<heading><h[1-6][^>]*>.*?</h[1-6]>)|(?P<row><tr[^>]*>.*?</tr>)", html_text, flags=re.IGNORECASE | re.DOTALL)
    current_race_number = None
    headers: list[str] = []
    rows = []

    for match in tokens:
        heading_html = match.group("heading")
        row_html = match.group("row")

        if heading_html:
            heading_text = _clean_html_text(heading_html)
            current_race_number = _extract_race_number(heading_text) or current_race_number
            continue

        cells = [_clean_html_text(cell) for cell in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row_html or "", flags=re.IGNORECASE | re.DOTALL)]
        cells = [cell for cell in cells if cell]
        if not cells:
            continue

        lowered = [_normalize_header(cell) for cell in cells]
        if any(header in {"horse", "runner", "jockey", "horse_name", "runner_name"} for header in lowered):
            headers = lowered
            continue

        race_number = _extract_race_number(" ".join(cells)) or current_race_number
        runner_name, jockey_name = _extract_runner_and_jockey(cells, headers)
        if not runner_name:
            continue

        rows.append({
            "race_number": race_number,
            "runner_name": runner_name,
            "jockey_name": jockey_name,
        })

    return rows


def _extract_runner_and_jockey(cells: list[str], headers: list[str]) -> tuple[Optional[str], Optional[str]]:
    if headers and len(headers) == len(cells):
        mapping = dict(zip(headers, cells))
        runner_name = mapping.get("horse") or mapping.get("runner") or mapping.get("horse_name") or mapping.get("runner_name")
        jockey_name = mapping.get("jockey") or mapping.get("rider")
        return _clean_runner_name(runner_name), jockey_name or None

    if len(cells) >= 3 and cells[0].isdigit():
        return _clean_runner_name(cells[1]), cells[2] or None
    if len(cells) >= 2:
        return _clean_runner_name(cells[0]), cells[1] or None
    if len(cells) == 1:
        return _clean_runner_name(cells[0]), None
    return None, None


def _extract_race_number(value: str) -> Optional[int]:
    match = re.search(r"\bR(?:ACE)?\s*(\d+)\b", value, flags=re.IGNORECASE)
    if match:
        return int(match.group(1))
    return None


def _normalize_header(value: str) -> str:
    return re.sub(r"[^a-z]+", "_", value.strip().lower()).strip("_")


def _clean_runner_name(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    cleaned = re.sub(r"^\d+\s*", "", value).strip()
    return cleaned or None


def _clean_html_text(fragment: str) -> str:
    text = re.sub(r"<br\s*/?>", " ", fragment, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _normalize_name(value: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "", ascii_text.casefold())


def _generate_mock_races(target_date: Optional[date] = None):
    active_date = target_date or today_melbourne()
    rng = random.Random(f"mock-races:{active_date.isoformat()}")
    venues = ["Flemington", "Randwick", "Caulfield", "Moonee Valley", "Eagle Farm", "Ascot"]
    races = []

    for venue_index, venue in enumerate(venues):
        for race_num in range(1, rng.randint(3, 6)):
            num_horses = rng.randint(8, 12)
            horses = []
            runner_names = rng.sample(MOCK_RUNNER_NAMES, k=min(num_horses, len(MOCK_RUNNER_NAMES)))
            while len(runner_names) < num_horses:
                runner_names.append(f"{rng.choice(MOCK_RUNNER_NAMES)} {len(runner_names) + 1}")

            for horse_index in range(num_horses):
                horses.append({
                    "horse_id": f"h_{venue_index}_{race_num}_{horse_index + 1}",
                    "name": runner_names[horse_index],
                    "barrier": horse_index + 1,
                    "weight": round(rng.uniform(54, 61), 1),
                    "past_win_rate": round(rng.uniform(0.05, 0.4), 3),
                    "jockey_win_rate": round(rng.uniform(0.05, 0.3), 3),
                    "track_condition": rng.randint(1, 4),
                    "days_since_last_race": rng.randint(7, 45),
                    "betfair_back_price": round(rng.uniform(2.2, 16.0), 2),
                    "betfair_implied_prob": 0,
                    "jockey_name": rng.choice(MOCK_JOCKEYS),
                    "meeting_type": "metro",
                    "meeting_region": _lookup_allowlist_entry(venue).get("region", "") if _lookup_allowlist_entry(venue) else "",
                    "meeting_date": active_date.isoformat(),
                    "data_source": "mock",
                })

            for horse in horses:
                horse["betfair_implied_prob"] = round(1 / horse["betfair_back_price"], 4)

            races.append({
                "race_id": f"r_{venue_index}_{race_num}",
                "venue": venue,
                "race_number": race_num,
                "distance": rng.choice([1000, 1200, 1400, 1600, 2000]),
                "start_time": "",
                "market_name": f"R{race_num} {rng.choice([1000, 1200, 1400])}m",
                "horses": horses,
                "source": "mock",
            })

    return races


def filter_allowed_races(races: Iterable[dict]) -> list[dict]:
    return [_prepare_race_card(race) for race in races if _is_allowed_meeting(_prepare_race_card(race))]
