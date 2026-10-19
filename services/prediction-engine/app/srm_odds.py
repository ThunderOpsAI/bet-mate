"""Same Race Multi pricing.

Primary source: live Ladbrokes fixed-win prices (unofficial site API) fed into
the Harville SRM model. Fallback: Betfair/model inputs supplied by the caller.

NOTE: neither source is a bookmaker-quoted SRM price. Results are always model
estimates; ``input_source`` says where the runner prices came from so the UI
can tell the user whether live bookmaker inputs were used.
"""
from __future__ import annotations

import logging
import re
import time
from typing import Any, Mapping, Sequence

import requests

from app.exotics import same_race_multi_odds

LOGGER = logging.getLogger(__name__)

LADBROKES_BASE = "https://api.ladbrokes.com.au/rest/v1/racing/"
REQUEST_TIMEOUT = 6
CACHE_TTL_SECONDS = 30
BLOCK_COOLDOWN_SECONDS = 300
HEADERS = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}

POSITION_TOP_N = {"win": 1, "top2": 2, "top3": 3, "top4": 4}

_cache: dict[str, tuple[float, Any]] = {}
_blocked_until: float = 0.0


class LiveOddsUnavailable(Exception):
    """Raised when live bookmaker inputs cannot be used."""

    def __init__(self, reason: str, blocked: bool = False):
        super().__init__(reason)
        self.reason = reason
        self.blocked = blocked


def normalise_name(name: str) -> str:
    name = re.sub(r"^\s*\d+\.\s*", "", name or "")  # strip "3. " saddlecloth prefix
    name = re.sub(r"\(.*?\)", "", name)
    return re.sub(r"[^a-z0-9]", "", name.lower())


def _get_json(params: Mapping[str, Any]) -> dict:
    global _blocked_until
    if time.time() < _blocked_until:
        raise LiveOddsUnavailable("Ladbrokes temporarily blocked (cooldown)", blocked=True)

    key = repr(sorted(params.items()))
    cached = _cache.get(key)
    if cached and time.time() - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]

    try:
        resp = requests.get(LADBROKES_BASE, params=params, headers=HEADERS, timeout=REQUEST_TIMEOUT)
    except requests.RequestException as exc:
        raise LiveOddsUnavailable(f"Ladbrokes unreachable: {exc.__class__.__name__}") from exc

    content_type = resp.headers.get("content-type", "")
    if resp.status_code in (401, 403, 429) or "text/html" in content_type:
        _blocked_until = time.time() + BLOCK_COOLDOWN_SECONDS
        raise LiveOddsUnavailable(f"Ladbrokes blocked request (HTTP {resp.status_code})", blocked=True)
    if resp.status_code != 200:
        raise LiveOddsUnavailable(f"Ladbrokes HTTP {resp.status_code}")

    try:
        payload = resp.json()["data"]
    except (ValueError, KeyError, TypeError) as exc:
        raise LiveOddsUnavailable("Ladbrokes response format changed") from exc

    _cache[key] = (time.time(), payload)
    return payload


def _find_race_id(venue: str, race_number: int) -> str:
    data = _get_json({"method": "nextraces", "count": 200})
    summaries = (data or {}).get("race_summaries") or {}
    target = normalise_name(venue)
    for race in summaries.values():
        if int(race.get("race_number") or 0) == int(race_number) and normalise_name(race.get("meeting_name", "")) == target:
            return race["race_id"]
    raise LiveOddsUnavailable("Race not listed on Ladbrokes")


def fetch_ladbrokes_win_odds(venue: str, race_number: int) -> dict[str, float]:
    """Return {normalised runner name: current fixed-win decimal odds}."""
    race_id = _find_race_id(venue, race_number)
    data = _get_json({"method": "racecard", "id": race_id})
    entrants = data.get("entrants") or {}
    flucs = data.get("price_fluctuations") or {}
    odds: dict[str, float] = {}
    for entrant_id, entrant in entrants.items():
        if entrant.get("is_scratched") or entrant.get("scratch_time"):
            continue
        history = flucs.get(entrant_id) or []
        if history and float(history[-1]) > 1:
            odds[normalise_name(entrant.get("name", ""))] = float(history[-1])
    if len(odds) < 2:
        raise LiveOddsUnavailable("Ladbrokes has no usable fixed-win prices for this race")
    return odds


def _probabilities_from_odds(odds_by_runner: Mapping[str, float]) -> dict[str, float]:
    return {runner_id: 1.0 / price for runner_id, price in odds_by_runner.items() if price and price > 1}


def price_srm(
    venue: str,
    race_number: int,
    legs: Sequence[Mapping[str, Any]],
    runners: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    """Price an SRM.

    legs: [{runner_id, position: win|top2|top3|top4}]
    runners: every runner in the race: [{runner_id, name, win_price?, win_probability?}]
    """
    if len(legs) < 2:
        raise ValueError("SRM requires at least two legs")
    model_legs = []
    for leg in legs:
        position = str(leg.get("position", ""))
        if position not in POSITION_TOP_N:
            raise ValueError(f"Unknown SRM position: {position}")
        model_legs.append({"runner_id": str(leg["runner_id"]), "top_n": POSITION_TOP_N[position]})

    leg_ids = {leg["runner_id"] for leg in model_legs}
    fallback_reason: str | None = None
    blocked = False

    try:
        live = fetch_ladbrokes_win_odds(venue, race_number)
        mapped = {
            str(r["runner_id"]): live[normalise_name(str(r.get("name", "")))]
            for r in runners
            if normalise_name(str(r.get("name", ""))) in live
        }
        if not leg_ids.issubset(mapped):
            raise LiveOddsUnavailable("Could not match all SRM runners to Ladbrokes")
        result = same_race_multi_odds(model_legs, _probabilities_from_odds(mapped))
        return {**result, "input_source": "LADBROKES", "is_live": True, "fallback_reason": None, "fetched_at": time.time()}
    except LiveOddsUnavailable as exc:
        fallback_reason, blocked = exc.reason, exc.blocked
        LOGGER.info("[SRM] Falling back to model inputs: %s", exc.reason)

    probabilities: dict[str, float] = {}
    for r in runners:
        rid = str(r["runner_id"])
        if r.get("win_probability"):
            probabilities[rid] = float(r["win_probability"])
        elif r.get("win_price") and float(r["win_price"]) > 1:
            probabilities[rid] = 1.0 / float(r["win_price"])
    if not leg_ids.issubset(probabilities):
        raise ValueError("No live or model prices available for every SRM runner")

    result = same_race_multi_odds(model_legs, probabilities)
    return {
        **result,
        "input_source": "MODEL",
        "is_live": False,
        "fallback_reason": fallback_reason,
        "blocked": blocked,
        "fetched_at": time.time(),
    }
