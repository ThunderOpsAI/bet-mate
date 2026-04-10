from __future__ import annotations

import argparse
import json
from datetime import datetime, time, timedelta
from typing import Any, Dict, List, Optional, Sequence

import app.data.afl_scraper as afl_scraper
import app.data.nba_scraper as nba_scraper
import app.storage as storage
from app.ml.afl import AFLPredictor
from app.ml.nba import NBAPredictor
from app.ml.racing import RacingPredictor
from app.strategy import StrategyService
from app.time_utils import MELBOURNE_TZ, now_melbourne, today_melbourne


DEFAULT_SCHEDULER_TIME = "05:00"


def _settle_ingested_results(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    settled = []
    errors = []
    skipped_unmatched = 0

    for result in results:
        try:
            settled.append(storage.settle_prediction_result(**result))
        except ValueError as exc:
            if "no logged predictions" in str(exc):
                skipped_unmatched += 1
            else:
                errors.append(
                    {
                        "sport": result.get("sport"),
                        "event_id": result.get("event_id"),
                        "message": str(exc),
                    }
                )

    return {
        "fetched": len(results),
        "settled": len(settled),
        "skipped_unmatched": skipped_unmatched,
        "errors": errors,
        "results": settled,
    }


def ingest_completed_results(
    sports: Optional[Sequence[str]] = None,
    max_results: int = 50,
    afl_year: Optional[int] = None,
    nba_days_back: int = 7,
) -> Dict[str, Any]:
    requested = {sport.strip().lower() for sport in (sports or ("afl", "nba")) if str(sport).strip()}
    if "all" in requested:
        requested = {"afl", "nba"}

    unsupported = sorted(requested - {"afl", "nba"})
    if unsupported:
        raise ValueError(f"Result ingestion is not available for: {', '.join(unsupported)}")

    summary = {
        "sports": {},
        "fetched": 0,
        "settled": 0,
        "skipped_unmatched": 0,
        "errors": [],
    }

    if "afl" in requested:
        afl_results = afl_scraper.fetch_completed_afl_results(
            year=afl_year,
            max_results=max_results,
        )
        summary["sports"]["afl"] = _settle_ingested_results(afl_results)

    if "nba" in requested:
        nba_results = nba_scraper.fetch_completed_nba_results(
            days_back=nba_days_back,
            max_results=max_results,
        )
        summary["sports"]["nba"] = _settle_ingested_results(nba_results)

    for sport_result in summary["sports"].values():
        summary["fetched"] += sport_result["fetched"]
        summary["settled"] += sport_result["settled"]
        summary["skipped_unmatched"] += sport_result["skipped_unmatched"]
        summary["errors"].extend(sport_result["errors"])

    return summary


def build_nightly_strategy_service(load_models: bool = True) -> StrategyService:
    racing_predictor = RacingPredictor()
    afl_predictor = AFLPredictor()
    nba_predictor = NBAPredictor()

    if load_models:
        racing_predictor.load_or_train()
        afl_predictor.load_or_train()
        nba_predictor.load_or_train()

    return StrategyService(
        racing_predictor=racing_predictor,
        afl_predictor=afl_predictor,
        nba_predictor=nba_predictor,
    )


def parse_scheduler_time(value: str = DEFAULT_SCHEDULER_TIME) -> time:
    hour_text, minute_text = value.strip().split(":", 1)
    hour = int(hour_text)
    minute = int(minute_text)
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise ValueError("scheduler time must be HH:MM in 24-hour format")
    return time(hour=hour, minute=minute, tzinfo=MELBOURNE_TZ)


def next_scheduler_run(after: Optional[datetime] = None, scheduled_time: Optional[time] = None) -> datetime:
    run_time = scheduled_time or parse_scheduler_time()
    current = (after or now_melbourne()).astimezone(MELBOURNE_TZ)
    next_run = current.replace(
        hour=run_time.hour,
        minute=run_time.minute,
        second=0,
        microsecond=0,
    )
    if next_run <= current:
        next_run += timedelta(days=1)
    return next_run


def run_nightly_cycle(
    strategy_service: StrategyService,
    run_date: Optional[str] = None,
    profile_keys: Optional[Sequence[str]] = None,
    ingest_sports: Optional[Sequence[str]] = None,
    ingest_results_enabled: bool = True,
    tune_enabled: bool = True,
    max_results: int = 50,
    afl_year: Optional[int] = None,
    nba_days_back: int = 7,
) -> Dict[str, Any]:
    storage.init_db()
    effective_date = run_date or today_melbourne().isoformat()
    target_profiles = [key.strip() for key in (profile_keys or []) if key and key.strip()]

    if target_profiles:
        cards = [strategy_service.get_or_create_card(profile_key, effective_date) for profile_key in target_profiles]
    else:
        cards = strategy_service.get_or_create_cards(effective_date)
        target_profiles = [card["profile_key"] for card in cards]

    ingestion = {
        "skipped": True,
        "reason": "ingestion disabled",
        "sports": list(ingest_sports or ("afl", "nba")),
    }
    if ingest_results_enabled:
        ingestion = ingest_completed_results(
            sports=ingest_sports or ("afl", "nba"),
            max_results=max_results,
            afl_year=afl_year,
            nba_days_back=nba_days_back,
        )

    tuning: Dict[str, Any] = {}
    if tune_enabled:
        for profile_key in target_profiles:
            tuning[profile_key] = storage.auto_tune_strategy_profile(
                profile_key,
                reference_date=effective_date,
            )

    return {
        "run_date": effective_date,
        "generated_cards": [
            {
                "profile_key": card["profile_key"],
                "card_date": card["card_date"],
                "selected_count": len(card.get("selected_bets", [])),
                "total_allocated": card.get("total_allocated", 0.0),
            }
            for card in cards
        ],
        "ingestion": ingestion,
        "auto_tune": tuning,
    }


def _parse_csv(value: str) -> List[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate daily strategy cards, optionally ingest completed results, and run gated auto-tune.",
    )
    parser.add_argument("--date", dest="run_date", help="AEST run date in YYYY-MM-DD format. Defaults to today in Australia/Melbourne.")
    parser.add_argument("--profiles", help="Comma-separated profile keys to process. Defaults to all strategy profiles.")
    parser.add_argument("--sports", default="afl,nba", help="Comma-separated settlement ingestion sports. Defaults to afl,nba.")
    parser.add_argument("--skip-ingest", action="store_true", help="Skip completed-result ingestion.")
    parser.add_argument("--skip-tune", action="store_true", help="Skip auto-tune.")
    parser.add_argument("--max-results", type=int, default=50, help="Maximum completed results to ingest per sport.")
    parser.add_argument("--afl-year", type=int, help="Optional AFL year override for completed result ingestion.")
    parser.add_argument("--nba-days-back", type=int, default=7, help="How many days of NBA completed results to inspect.")
    args = parser.parse_args(argv)

    strategy_service = build_nightly_strategy_service(load_models=True)
    summary = run_nightly_cycle(
        strategy_service=strategy_service,
        run_date=args.run_date,
        profile_keys=_parse_csv(args.profiles) if args.profiles else None,
        ingest_sports=_parse_csv(args.sports) if args.sports else None,
        ingest_results_enabled=not args.skip_ingest,
        tune_enabled=not args.skip_tune,
        max_results=args.max_results,
        afl_year=args.afl_year,
        nba_days_back=args.nba_days_back,
    )
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
