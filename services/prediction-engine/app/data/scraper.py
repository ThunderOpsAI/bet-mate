from __future__ import annotations

import base64
import html
import hashlib
import json
import os
import random
import re
import tempfile
import unicodedata
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Union
from urllib.parse import quote

import requests
from dotenv import load_dotenv
import time

from app.time_utils import MELBOURNE_TZ, melbourne_date_string, melbourne_weekday, today_melbourne
from app.alerts import calculate_minutes_until_jump
load_dotenv()

BETFAIR_APP_KEY = os.getenv("BETFAIR_APP_KEY", "")
BETFAIR_USERNAME = os.getenv("BETFAIR_USERNAME", "")
BETFAIR_PASSWORD = os.getenv("BETFAIR_PASSWORD", "")

ALLOWLIST_PATH = Path(__file__).with_name("metro_allowlist.json")
RA_BASE_URL = "https://racingaustralia.horse/ozracing/Acceptances.aspx"
RA_RESULTS_BASE_URL = "https://racingaustralia.horse/FreeFields/Results.aspx"
DEFAULT_TIMEOUT_SECONDS = 10
BETFAIR_INTERACTIVE_LOGIN_URL = "https://identitysso.betfair.com.au/api/login"
BETFAIR_CERT_LOGIN_URL = "https://identitysso-cert.betfair.com.au/api/certlogin"
BETFAIR_AUTH_MODES = {"auto", "interactive", "certificate"}
BETFAIR_API_BASE_URL = os.getenv("BETFAIR_API_BASE_URL", "https://api.betfair.com.au").rstrip("/")
BETFAIR_CERT_TEMP_DIR = Path(tempfile.gettempdir()) / "betmate-betfair"


def betfair_catalogue_url() -> str:
    return f"{BETFAIR_API_BASE_URL}/exchange/betting/rest/v1.0/listMarketCatalogue/"


def betfair_market_book_url() -> str:
    return f"{BETFAIR_API_BASE_URL}/exchange/betting/rest/v1.0/listMarketBook/"

_session_token = None
_metro_allowlist_cache: Optional[dict] = None
TRUE_VALUES = {"1", "true", "yes", "on"}

_race_card_cache = {}

def race_window_ttl(start_time_iso: Optional[str]) -> int:
    """Return cache TTL in seconds based on proximity to jump."""
    if not start_time_iso:
        return 1800
    mins = calculate_minutes_until_jump(start_time_iso)
    if mins is None or mins > 120:  return 1800   # >2h:   30 min
    if mins > 30:                   return 300    # 30–120m: 5 min
    if mins > 5:                    return 60     # 5–30m:   60 sec
    if mins > 0:                    return 15     # <5m:     15 sec
    return 86400                                  # post-jump: 24h (results)



def _login():
    global _session_token

    auth_mode = _betfair_auth_mode()

    if auth_mode in {"auto", "certificate"}:
        client_cert = _betfair_client_certificate()
        if client_cert:
            print(f"[Betfair] Login mode {auth_mode}: using certificate auth ({_betfair_certificate_status()})")
            token = _login_with_certificate(client_cert)
            if token:
                _session_token = token
                return token
            if auth_mode == "certificate":
                return None
            print("[Betfair] Certificate auth failed, falling back to interactive login")
        elif auth_mode == "certificate":
            print(
                f"[Betfair] Certificate auth requested but certificate material is missing "
                f"({_betfair_certificate_status()})"
            )
            return None

    if not _betfair_credentials_present():
        print(f"[Betfair] Credentials missing for interactive login ({_betfair_credential_status()})")
        return None

    if auth_mode == "interactive":
        print(f"[Betfair] Login mode interactive ({_betfair_credential_status()})")
    else:
        print(f"[Betfair] Login mode auto: using interactive login ({_betfair_credential_status()})")

    token = _login_interactive()
    if token:
        _session_token = token
    return token


def _login_interactive() -> Optional[str]:
    login_payload = {
        "username": BETFAIR_USERNAME,
        "password": BETFAIR_PASSWORD,
    }

    try:
        res = requests.post(
            BETFAIR_INTERACTIVE_LOGIN_URL,
            data=login_payload,
            headers=_betfair_login_headers(),
            timeout=DEFAULT_TIMEOUT_SECONDS,
        )
        return _extract_session_token(res, mode="interactive")
    except Exception as exc:
        print(f"[Betfair] Interactive login error ({_betfair_credential_status()}): {exc}")
        return None


def _login_with_certificate(client_cert: Union[str, tuple[str, str]]) -> Optional[str]:
    if not _betfair_credentials_present():
        print(f"[Betfair] Credentials missing for certificate login ({_betfair_credential_status()})")
        return None

    login_payload = {
        "username": BETFAIR_USERNAME,
        "password": BETFAIR_PASSWORD,
    }

    try:
        res = requests.post(
            BETFAIR_CERT_LOGIN_URL,
            data=login_payload,
            headers=_betfair_login_headers(),
            timeout=DEFAULT_TIMEOUT_SECONDS,
            cert=client_cert,
        )
        return _extract_session_token(res, mode="certificate")
    except Exception as exc:
        print(
            "[Betfair] Certificate login error "
            f"({_betfair_credential_status()}; {_betfair_certificate_status()}): {exc}"
        )
        return None


def _betfair_login_headers() -> dict[str, str]:
    return {
        "X-Application": BETFAIR_APP_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
    }


def _extract_session_token(response, mode: str) -> Optional[str]:
    response.raise_for_status()
    auth_data = response.json()
    token = auth_data.get("token") or auth_data.get("sessionToken")
    if token:
        print(f"[Betfair] Authenticated successfully via {mode} login")
        return token

    failure = auth_data.get("error") or auth_data.get("loginStatus") or auth_data.get("status") or "unknown"
    print(f"[Betfair] {mode.capitalize()} login failed: {failure}")
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

    try:
        with ALLOWLIST_PATH.open("r", encoding="utf-8") as handle:
            raw = json.load(handle)
    except FileNotFoundError as exc:
        print(f"[Warning] Metro allowlist file not found at {ALLOWLIST_PATH}: {exc}")
        _metro_allowlist_cache = {}
        return _metro_allowlist_cache

    alias_map = {}
    for entry in raw.values():
        normalized_entry = {
            **entry,
            "meeting_type": entry.get("meeting_type", "unknown"),
            "region": entry.get("region") or entry.get("state", ""),
            "active_days": [day.casefold() for day in entry.get("active_days", [])],
        }
        aliases = set(entry.get("aliases", []))
        aliases.add(entry.get("venue", ""))
        for alias in aliases:
            if not alias:
                continue
            alias_map[_normalize_name(alias)] = normalized_entry

    _metro_allowlist_cache = alias_map
    return _metro_allowlist_cache


def _resolve_race_type_event_ids(race_type: Optional[str]) -> List[str]:
    if not race_type:
        return ["7"]
    rt = str(race_type).strip().upper()
    if rt in {"T", "7", "THOROUGHBRED", "THOROUGHBREDS"}:
        return ["7"]
    if rt in {"G", "4339", "GREYHOUND", "GREYHOUNDS"}:
        return ["4339"]
    if rt in {"H", "4337", "HARNESS"}:
        return ["4337"]
    if rt in {"ALL"}:
        return ["7", "4339", "4337"]
    return ["7"]



def fetch_today_races(run_date: Optional[str] = None, race_type: Optional[str] = None):
    target_date = _resolve_run_date(run_date)
    target_date_str = target_date.isoformat()
    
    cache_key = f"{target_date_str}_{race_type or 'ALL'}"
    if cache_key in _race_card_cache:
        cached_races, timestamp = _race_card_cache[cache_key]
        now = time.time()
        
        next_jump_time = None
        for r in cached_races:
            start_time = r.get("start_time")
            if not start_time:
                continue
            mins = calculate_minutes_until_jump(start_time)
            if mins is not None and mins > 0:
                if next_jump_time is None or start_time < next_jump_time:
                    next_jump_time = start_time
                    
        ttl = race_window_ttl(next_jump_time) if next_jump_time else 1800
        
        if now - timestamp < ttl:
            return cached_races

    headers = _get_api_headers()
    event_type_ids = _resolve_race_type_event_ids(race_type)

    if headers:
        try:
            try:
                races = _fetch_live_races(headers, target_date, event_type_ids=event_type_ids)
            except TypeError:
                races = _fetch_live_races(headers, target_date)
        except requests.exceptions.HTTPError as exc:
            if exc.response is not None and exc.response.status_code in (400, 401):
                print(f"[Betfair] Session expired or invalid ({exc.response.status_code}). Retrying...")
                global _session_token
                _session_token = None
                headers = _get_api_headers()
                if headers:
                    try:
                        races = _fetch_live_races(headers, target_date, event_type_ids=event_type_ids)
                    except Exception as retry_exc:
                        print(f"[Betfair] Retry live fetch failed ({retry_exc})")
                        races = []
                else:
                    print("[Betfair] Authentication unavailable on retry")
                    races = []
            else:
                print(f"[Betfair] Live fetch HTTP error ({exc})")
                races = []
        except Exception as exc:
            print(f"[Betfair] Live fetch failed ({exc})")
            races = []
    else:
        print("[Betfair] authentication unavailable")
        races = []

    from concurrent.futures import ThreadPoolExecutor
    
    prepared_races = []
    for race in races:
        prepared = _prepare_race_card(race, default_meeting_date=target_date_str)
        if prepared.get("meeting_date") and prepared.get("meeting_date") != target_date_str:
            continue
        if not _allowlist_allows_meeting(prepared):
            continue
        prepared_races.append(prepared)
        
    prepared_races.sort(key=lambda race: race.get("start_time") or "")
    
    _race_card_cache[cache_key] = (prepared_races, time.time())
    
    return prepared_races


def _betfair_auth_mode() -> str:
    raw = os.getenv("BETFAIR_AUTH_MODE", "auto").strip().lower()
    if raw in BETFAIR_AUTH_MODES:
        return raw
    if raw:
        print(f"[Betfair] Unknown BETFAIR_AUTH_MODE={raw!r}, defaulting to auto")
    return "auto"


def _betfair_credentials_present() -> bool:
    return bool(BETFAIR_APP_KEY and BETFAIR_USERNAME and BETFAIR_PASSWORD)


def _betfair_client_certificate() -> Optional[Union[str, tuple[str, str]]]:
    cert_path = _betfair_cert_file_path()
    key_path = _betfair_key_file_path()

    if key_path and not cert_path:
        print("[Betfair] Key material configured without a matching certificate")
        return None
    if cert_path and key_path:
        return cert_path, key_path
    return cert_path or None


def _betfair_cert_file_path() -> str:
    return _resolve_betfair_material_path(
        path_var="BETFAIR_CERT_PATH",
        raw_var="BETFAIR_CERT_PEM",
        b64_var="BETFAIR_CERT_PEM_B64",
        label="cert",
    )


def _betfair_key_file_path() -> str:
    return _resolve_betfair_material_path(
        path_var="BETFAIR_KEY_PATH",
        raw_var="BETFAIR_KEY_PEM",
        b64_var="BETFAIR_KEY_PEM_B64",
        label="key",
    )


def _resolve_betfair_material_path(path_var: str, raw_var: str, b64_var: str, label: str) -> str:
    raw_path = os.getenv(path_var, "").strip()
    if raw_path:
        candidate = Path(raw_path).expanduser()
        if candidate.is_file():
            return str(candidate)
        print(f"[Betfair] {path_var} does not exist or is not a file: {candidate}")
        return ""

    raw_pem = os.getenv(raw_var, "").strip()
    if raw_pem:
        return _write_betfair_temp_material(_normalize_pem_text(raw_pem), label=label)

    encoded_pem = os.getenv(b64_var, "").strip()
    if encoded_pem:
        try:
            decoded = base64.b64decode(encoded_pem).decode("utf-8")
        except Exception as exc:
            print(f"[Betfair] Invalid {b64_var}: {exc}")
            return ""
        return _write_betfair_temp_material(_normalize_pem_text(decoded), label=label)

    return ""


def _normalize_pem_text(value: str) -> str:
    normalized = value.strip().replace("\\n", "\n")
    return normalized if normalized.endswith("\n") else f"{normalized}\n"


def _write_betfair_temp_material(value: str, label: str) -> str:
    BETFAIR_CERT_TEMP_DIR.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]
    path = BETFAIR_CERT_TEMP_DIR / f"betfair-{label}-{digest}.pem"
    if not path.exists():
        path.write_text(value, encoding="utf-8")
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass
    return str(path)


def _betfair_credential_status() -> str:
    return ", ".join(
        [
            f"app_key={'yes' if bool(BETFAIR_APP_KEY) else 'no'}",
            f"username={'yes' if bool(BETFAIR_USERNAME) else 'no'}",
            f"password={'yes' if bool(BETFAIR_PASSWORD) else 'no'}",
        ]
    )


def _betfair_certificate_status() -> str:
    return ", ".join(
        [
            f"cert_path={'yes' if bool(os.getenv('BETFAIR_CERT_PATH', '').strip()) else 'no'}",
            f"key_path={'yes' if bool(os.getenv('BETFAIR_KEY_PATH', '').strip()) else 'no'}",
            f"cert_content={'yes' if bool(os.getenv('BETFAIR_CERT_PEM', '').strip() or os.getenv('BETFAIR_CERT_PEM_B64', '').strip()) else 'no'}",
            f"key_content={'yes' if bool(os.getenv('BETFAIR_KEY_PEM', '').strip() or os.getenv('BETFAIR_KEY_PEM_B64', '').strip()) else 'no'}",
        ]
    )


def _fetch_live_races(headers, target_date: date, event_type_ids: Optional[List[str]] = None):
    api_url = betfair_catalogue_url()
    market_start_time = _betfair_market_time_window(target_date)
    if not event_type_ids:
        event_type_ids = ["7"]
    
    all_markets = []
    from_record = 0
    page_size = 50

    market_filter = {
        "filter": {
            "eventTypeIds": event_type_ids,
            "marketCountries": ["AU", "NZ", "GB", "IE", "FR", "ZA", "KR", "JP", "HK", "CN", "US", "SG"],
            "marketTypeCodes": ["WIN"],
            "marketStartTime": market_start_time,
        },
        "maxResults": page_size,
        "sort": "FIRST_TO_START",
        "marketProjection": [
            "EVENT",
            "RUNNER_DESCRIPTION",
            "MARKET_START_TIME",
            "MARKET_DESCRIPTION",
            "RUNNER_METADATA",
        ],
    }

    response = requests.post(
        api_url,
        data=json.dumps(market_filter),
        headers=headers,
        timeout=15,
    )
    if response.status_code != 200:
        print(f"[Betfair] listMarketCatalogue error: {response.text}")
    response.raise_for_status()
    all_markets = response.json()

    if not all_markets:
        print(f"[Betfair] No markets returned for {target_date.isoformat()} within window {market_start_time}")
        return []

    market_ids = [market["marketId"] for market in all_markets]
    prices = _fetch_prices(headers, market_ids)

    races = []
    for market in all_markets:
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

            metadata = runner.get("metadata", {})
            jockey_name = metadata.get("JOCKEY_NAME")
            trainer_name = metadata.get("TRAINER_NAME")

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
                "jockey_name": jockey_name,
                "trainer_name": trainer_name,
                "meeting_type": "unknown",
                "meeting_region": "",
                "meeting_date": melbourne_date_string(start_time or None),
                "data_source": "betfair",
            })

        country_code = event.get("countryCode") or market.get("marketCountry") or "AU"

        races.append({
            "race_id": market_id,
            "venue": venue_raw,
            "race_number": race_number,
            "distance": distance,
            "start_time": start_time,
            "market_name": market_name,
            "country_code": country_code,
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
    start_local = datetime.combine(target_date, datetime.min.time(), tzinfo=MELBOURNE_TZ)
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

    api_url = betfair_market_book_url()
    result = {}

    try:
        for start in range(0, len(market_ids), 40):
            payload = {
                "marketIds": market_ids[start:start + 40],
                "priceProjection": {"priceData": ["EX_BEST_OFFERS"]},
            }
            response = requests.post(
                api_url,
                data=json.dumps(payload),
                headers=headers,
                timeout=15,
            )
            response.raise_for_status()
            books = response.json()

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
    country_code = race.get("country_code", "AU")
    meeting_region = (
        allowlist_entry.get("region", "")
        if allowlist_entry
        else country_code
    )
    meeting_type = allowlist_entry.get("meeting_type", "unknown") if allowlist_entry else "unknown"
    state = allowlist_entry.get("state", "") if allowlist_entry else ""
    canonical_venue = allowlist_entry.get("venue", race.get("venue", "")) if allowlist_entry else race.get("venue", "")
    data_source = "betfair"

    prepared_horses = []
    for horse in race.get("horses", []):
        prepared_horse = dict(horse)
        prepared_horse["jockey_name"] = horse.get("jockey_name")
        prepared_horse["trainer_name"] = horse.get("trainer_name")
        prepared_horse["meeting_type"] = horse.get("meeting_type") or meeting_type
        prepared_horse["meeting_region"] = horse.get("meeting_region") or meeting_region
        prepared_horse["meeting_date"] = horse.get("meeting_date") or meeting_date
        prepared_horse["data_source"] = horse.get("data_source") or data_source
        prepared_horses.append(prepared_horse)

    return {
        **race,
        "meeting_type": meeting_type,
        "meeting_region": meeting_region,
        "state": state,
        "canonical_venue": canonical_venue,
        "meeting_date": meeting_date,
        "data_source": data_source,
        "horses": prepared_horses,
    }





def _lookup_allowlist_entry(venue: str) -> Optional[dict]:
    if not venue:
        return None
    registry = load_metro_allowlist()
    for key in _venue_lookup_keys(venue):
        entry = registry.get(key)
        if entry:
            return entry
    return None


def _allowlist_allows_meeting(race: dict) -> bool:
    allowlist_entry = _lookup_allowlist_entry(race.get("venue", ""))
    if not allowlist_entry:
        return True

    active_days = allowlist_entry.get("active_days") or []
    if not active_days:
        return True

    meeting_context = _meeting_context_for_start_time(race.get("start_time") or None)
    return meeting_context.get("weekday", "") in active_days


def _enrich_with_racing_australia(race: dict) -> dict:
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
        enriched["meeting_type"] = allowlist_entry.get("meeting_type", "unknown")
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
        "meeting_type": allowlist_entry.get("meeting_type", "unknown"),
        "meeting_region": allowlist_entry.get("region", ""),
        "state": allowlist_entry.get("state", race.get("state", "")),
        "canonical_venue": allowlist_entry.get("venue", race.get("canonical_venue", race.get("venue", ""))),
        "meeting_date": race["meeting_date"],
        "data_source": "racing_australia" if matched_any else race.get("data_source", "betfair"),
        "horses": enriched_horses,
    }


from functools import lru_cache

@lru_cache(maxsize=128)
def _fetch_racing_australia_acceptances(meeting_date: str, state: str, venue: str) -> list[dict]:
    date_key = datetime.fromisoformat(meeting_date).strftime("%Y%b%d").upper()
    url = f"{RA_BASE_URL}?key={date_key}%2C{state.upper()}%2C{venue.upper().replace(' ', '+')}"
    return _parse_racing_australia_html(_fetch_racing_australia_html(url))


def fetch_completed_racing_results(targets: Iterable[Dict[str, Any]], max_results: int = 50) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    page_cache: Dict[tuple[str, str, str], Dict[int, Dict[str, Any]]] = {}

    for target in list(targets)[: max(1, min(int(max_results), 200))]:
        meeting_date = str(target.get("meeting_date") or "").strip()
        state = str(target.get("state") or "").strip().upper()
        venue = str(target.get("venue") or "").strip()
        event_id = str(target.get("event_id") or "").strip()
        event_name = str(target.get("event_name") or "").strip()
        try:
            race_number = int(target.get("race_number") or 0)
        except (TypeError, ValueError):
            race_number = 0

        if not meeting_date or not state or not venue or not event_id or race_number <= 0:
            continue

        cache_key = (meeting_date, state, venue)
        meeting_results = page_cache.get(cache_key)
        if meeting_results is None:
            try:
                meeting_results = _fetch_racing_australia_results(meeting_date=meeting_date, state=state, venue=venue)
            except Exception as exc:
                print(f"[RacingAustralia] Results fetch skipped for {venue} {meeting_date}: {exc}")
                meeting_results = {}
            page_cache[cache_key] = meeting_results

        race_result = meeting_results.get(race_number)
        winner_selection = race_result.get("winner_selection") if race_result else None
        if not race_result or not winner_selection:
            continue

        results.append(
            {
                "sport": "racing",
                "event_id": event_id,
                "event_name": event_name or f"{venue} R{race_number}",
                "winner_selection": winner_selection,
                "result_payload": {
                    "meeting_date": meeting_date,
                    "state": state,
                    "venue": venue,
                    **race_result,
                },
            }
        )

    return results


def _fetch_racing_australia_results(meeting_date: str, state: str, venue: str) -> Dict[int, Dict[str, Any]]:
    date_key = datetime.fromisoformat(meeting_date).strftime("%Y%b%d").upper()
    encoded_key = quote(f"{date_key},{state.upper()},{venue.upper()}")
    url = f"{RA_RESULTS_BASE_URL}?Key={encoded_key}"
    return _parse_racing_australia_results_html(_fetch_racing_australia_html(url))


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


def _parse_racing_australia_results_html(html_text: str) -> Dict[int, Dict[str, Any]]:
    tokens = re.finditer(
        r"(?P<heading><h[1-6][^>]*>.*?</h[1-6]>)|(?P<row><tr[^>]*>.*?</tr>)",
        html_text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    current_race_number = None
    headers: list[str] = []
    races: Dict[int, Dict[str, Any]] = {}

    for match in tokens:
        heading_html = match.group("heading")
        row_html = match.group("row")

        if heading_html:
            heading_text = _clean_html_text(heading_html)
            current_race_number = _extract_race_number(heading_text) or current_race_number
            headers = []
            continue

        cells = [
            _clean_html_text(cell)
            for cell in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row_html or "", flags=re.IGNORECASE | re.DOTALL)
        ]
        cells = [cell for cell in cells if cell]
        if not cells or current_race_number is None:
            continue

        lowered = [_normalize_header(cell) for cell in cells]
        if "finish" in lowered and any(header in {"horse", "runner", "horse_name", "runner_name"} for header in lowered):
            headers = lowered
            continue

        row = _extract_racing_result_row(cells, headers)
        if not row:
            continue

        race_bucket = races.setdefault(
            current_race_number,
            {"finishers": [], "starter_count": 0},
        )
        if row["is_starter"]:
            race_bucket["starter_count"] += 1
        if row["finish_position"] is not None:
            race_bucket["finishers"].append((row["finish_position"], row["runner_name"]))

    parsed: Dict[int, Dict[str, Any]] = {}
    for race_number, bucket in races.items():
        ordered = [
            runner_name
            for _, runner_name in sorted(bucket["finishers"], key=lambda item: item[0])
            if runner_name
        ]
        if not ordered:
            continue

        starter_count = max(int(bucket["starter_count"]), len(ordered))
        place_depth = 3 if starter_count >= 8 else 2 if starter_count >= 5 else 1
        parsed[race_number] = {
            "winner_selection": ordered[0],
            "finish_order": ordered,
            "place_getters": ordered[:place_depth],
            "top_4_finishers": ordered[:4],
            "starter_count": starter_count,
            "exotic_outcomes": _build_exotic_outcomes(ordered),
        }

    return parsed


def _extract_racing_result_row(cells: list[str], headers: list[str]) -> Optional[Dict[str, Any]]:
    mapping: Dict[str, str]
    if headers and len(headers) == len(cells):
        mapping = dict(zip(headers, cells))
    else:
        mapping = {}
        if len(cells) >= 4:
            mapping = {
                "finish": cells[1],
                "horse": cells[3],
            }

    runner_name = _clean_results_runner_name(
        mapping.get("horse") or mapping.get("runner") or mapping.get("horse_name") or mapping.get("runner_name")
    )
    if not runner_name:
        return None

    finish_value = str(mapping.get("finish") or "").strip().upper()
    finish_position = int(finish_value) if finish_value.isdigit() else None
    non_starter_codes = {"", "SB", "SCR", "SCRATCHED", "NS"}
    is_starter = finish_value not in non_starter_codes

    return {
        "runner_name": runner_name,
        "finish_position": finish_position,
        "is_starter": is_starter,
    }


def _clean_results_runner_name(value: Optional[str]) -> Optional[str]:
    cleaned = _clean_runner_name(value)
    if not cleaned:
        return None
    cleaned = re.sub(r"\s+Image:.*$", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip() or None


def _build_exotic_outcomes(finish_order: List[str]) -> Dict[str, List[str]]:
    outcomes: Dict[str, List[str]] = {}
    if len(finish_order) >= 2:
        outcomes["quinella"] = finish_order[:2]
        outcomes["exacta"] = finish_order[:2]
    if len(finish_order) >= 3:
        outcomes["trifecta"] = finish_order[:3]
    if len(finish_order) >= 4:
        outcomes["first4"] = finish_order[:4]
    return outcomes


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


def _venue_lookup_keys(venue: str) -> list[str]:
    seen = set()
    keys = []

    def add(candidate: str) -> None:
        normalized = _normalize_name(candidate)
        if normalized and normalized not in seen:
            seen.add(normalized)
            keys.append(normalized)

    add(venue)
    without_brackets = re.sub(r"\([^)]*\)", " ", venue)
    add(without_brackets)
    without_state_suffix = re.sub(r"\b(?:vic|nsw|qld|wa|sa|tas|nt|act)\b", " ", without_brackets, flags=re.IGNORECASE)
    add(without_state_suffix)
    return keys


def filter_allowed_races(races: Iterable[dict]) -> list[dict]:
    return [_prepare_race_card(race) for race in races]
