from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, time, timedelta
from typing import Any, Dict, List, Optional, Sequence

import app.data.afl_scraper as afl_scraper
import app.data.nba_scraper as nba_scraper
import app.data.scraper as racing_scraper
import app.database as database
import app.storage as storage
from app.ml.afl import AFLPredictor
from app.ml.nba import NBAPredictor
from app.ml.racing import RacingPredictor
from app.strategy import StrategyService
from app.time_utils import MELBOURNE_TZ, now_melbourne, today_melbourne


DEFAULT_SCHEDULER_TIME = "05:00"
DEFAULT_WEEKLY_RETRAIN_DAY = "sun"


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
    requested = {sport.strip().lower() for sport in (sports or ("afl", "nba", "racing")) if str(sport).strip()}
    if "all" in requested:
        requested = {"afl", "nba", "racing"}

    unsupported = sorted(requested - {"afl", "nba", "racing"})
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

    if "racing" in requested:
        racing_targets = storage.list_pending_racing_result_targets(limit=max_results)
        racing_results = racing_scraper.fetch_completed_racing_results(racing_targets, max_results=max_results)
        summary["sports"]["racing"] = _settle_ingested_results(racing_results)

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
    weekly_retrain_enabled: bool = False,
    weekly_retrain_day: str = DEFAULT_WEEKLY_RETRAIN_DAY,
    backup_dir: Optional[str] = None,
) -> Dict[str, Any]:
    database.user_id_ctx.set("automated_agent")
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
        "sports": list(ingest_sports or ("afl", "nba", "racing")),
    }
    if ingest_results_enabled:
        ingestion = ingest_completed_results(
            sports=ingest_sports or ("afl", "nba", "racing"),
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

    weekly_retrain = _run_weekly_retrain_if_due(
        effective_date=effective_date,
        target_profiles=target_profiles,
        enabled=weekly_retrain_enabled,
        scheduled_day=weekly_retrain_day,
    )

    # Automated betting loop: log all selected_bets from generated cards to paper_bet_log
    automated_bets_logged = []
    for card in cards:
        for bet in card.get("selected_bets", []):
            try:
                if not storage.automated_bet_exists(
                    sport=bet["sport"],
                    event_id=bet["event_id"],
                    selection=bet["selection"],
                    bet_type=bet["market_type"],
                ):
                    logged = storage.create_paper_bet(
                        sport=bet["sport"],
                        event_id=bet["event_id"],
                        event_name=bet["event_name"],
                        selection=bet["selection"],
                        stake=bet["stake"],
                        odds=bet.get("odds_used"),
                        bet_type=bet["market_type"],
                        origin="automated_agent",
                        user_id="automated_agent",
                    )
                    automated_bets_logged.append({
                        "id": logged["id"],
                        "sport": bet["sport"],
                        "event_name": bet["event_name"],
                        "selection": bet["selection"],
                        "stake": bet["stake"],
                    })
            except Exception as e:
                print(f"Error logging automated bet for {bet.get('selection')}: {e}")

    backup_path = None
    if backup_dir:
        backup_path = database.create_sqlite_backup(backup_dir)

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
        "weekly_retrain": weekly_retrain,
        "automated_bets": automated_bets_logged,
        "backup": {"path": backup_path, "created": bool(backup_path)} if backup_dir else {"created": False},
    }


def _run_weekly_retrain_if_due(
    effective_date: str,
    target_profiles: Sequence[str],
    enabled: bool,
    scheduled_day: str,
) -> Dict[str, Any]:
    if not enabled:
        return {"ran": False, "reason": "weekly retrain disabled"}

    run_day = _weekday_from_iso_date(effective_date)
    scheduled_weekday = _weekday_from_name(scheduled_day)
    if run_day != scheduled_weekday:
        return {"ran": False, "reason": "not scheduled weekday", "scheduled_day": scheduled_day}

    existing = storage.get_weekly_retrain_run(effective_date)
    if existing:
        return {"ran": False, "reason": "already ran for date", "run": existing}

    summary = storage.run_weekly_retrain(effective_date, profile_keys=list(target_profiles))
    return {"ran": True, "summary": summary}


def _weekday_from_iso_date(value: str) -> int:
    return datetime.strptime(value, "%Y-%m-%d").weekday()


def _weekday_from_name(value: str) -> int:
    weekdays = {
        "mon": 0,
        "monday": 0,
        "tue": 1,
        "tues": 1,
        "tuesday": 1,
        "wed": 2,
        "wednesday": 2,
        "thu": 3,
        "thursday": 3,
        "fri": 4,
        "friday": 4,
        "sat": 5,
        "saturday": 5,
        "sun": 6,
        "sunday": 6,
    }
    normalized = value.strip().lower()
    if normalized not in weekdays:
        raise ValueError("weekly retrain day must be mon..sun")
    return weekdays[normalized]


def _parse_csv(value: str) -> List[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def sunday_betfair_import(run_date: Optional[str] = None) -> Dict[str, Any]:
    import requests
    from app.time_utils import resolve_melbourne_date

    database.user_id_ctx.set("automated_agent")
    storage.init_db()

    sunday_date = resolve_melbourne_date(run_date)
    saturday_date = sunday_date - timedelta(days=1)
    saturday_date_str = saturday_date.isoformat()

    url = os.getenv("BETFAIR_SUNDAY_INGEST_URL")
    if not url:
        url = "https://storage.googleapis.com/betmate-betfair-ingest/{date}_saturday_markets_results.json"

    if "{date}" in url:
        url = url.format(date=saturday_date_str)
    elif "saturday_markets_results.json" in url:
        # Fallback if the {date} placeholder was missing from the env var
        url = url.replace("saturday_markets_results.json", f"{saturday_date_str}_saturday_markets_results.json")

    print(f"[Sunday Ingest] Fetching Saturday data from: {url}")
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        payload = response.json()
    except Exception as e:
        print(f"[Sunday Ingest] Failed to fetch payload: {e}")
        raise RuntimeError(f"Failed to fetch Saturday Betfair payload from {url}: {e}")

    markets = payload.get("markets", [])
    results = payload.get("results", [])

    print(f"[Sunday Ingest] Fetched {len(markets)} markets and {len(results)} results")

    predictor = RacingPredictor()
    predictor.load_or_train()

    predictions_logged = 0
    results_settled = 0
    errors = []

    for race in markets:
        try:
            horses = race.get("horses", [])
            if not horses:
                continue

            feature_rows = [
                {
                    "barrier": horse["barrier"],
                    "weight": horse["weight"],
                    "past_win_rate": horse["past_win_rate"],
                    "jockey_win_rate": horse["jockey_win_rate"],
                    "track_condition": horse["track_condition"],
                    "days_since_last_race": horse["days_since_last_race"],
                }
                for horse in horses
            ]
            probabilities, importances = predictor.predict(feature_rows)
            feature_impact = {
                name: round(float(value), 4)
                for name, value in zip(getattr(predictor, "feature_columns", []), importances)
            }

            predictions = []
            for idx, horse in enumerate(horses):
                probability = float(probabilities[idx])
                live_odds = float(horse.get("betfair_back_price") or 0.0) or None
                fair_odds = round(1 / probability, 2) if probability > 0 else None

                venue = race.get("venue", "Unknown")
                race_number = race.get("race_number", 0)

                predictions.append({
                    "selection": horse["name"],
                    "probability": round(probability * 100, 2),
                    "fair_odds": live_odds or fair_odds,
                    "payload": {
                        "selection": horse["name"],
                        "venue": venue,
                        "canonical_venue": race.get("canonical_venue") or venue,
                        "race_number": race_number,
                        "meeting_date": race.get("meeting_date") or saturday_date_str,
                        "state": race.get("state", ""),
                        "meeting_region": race.get("meeting_region", ""),
                        "market_name": race.get("market_name", ""),
                        "start_time": race.get("start_time"),
                        "distance": race.get("distance", 1200),
                        "data_source": "betfair",
                        "barrier": horse["barrier"],
                        "weight": horse["weight"],
                        "past_win_rate": horse["past_win_rate"],
                        "jockey_win_rate": horse["jockey_win_rate"],
                        "track_condition": horse["track_condition"],
                        "days_since_last_race": horse["days_since_last_race"],
                    }
                })

            storage.log_prediction_batch(
                sport="racing",
                event_id=race["race_id"],
                event_name=f"{race.get('venue')} R{race.get('race_number')}",
                predictions=predictions,
                feature_impact=feature_impact,
            )
            predictions_logged += 1
        except Exception as e:
            msg = f"Failed to log prediction batch for race {race.get('race_id')}: {e}"
            print(f"[Sunday Ingest] {msg}")
            errors.append(msg)

    for res in results:
        try:
            storage.settle_prediction_result(
                sport=res.get("sport", "racing"),
                event_id=res["event_id"],
                winner_selection=res.get("winner_selection"),
                selection_results=res.get("selection_results"),
                event_name=res.get("event_name"),
                completed_at=res.get("completed_at"),
                result_payload=res.get("result_payload"),
            )
            results_settled += 1
        except Exception as e:
            msg = f"Failed to settle result for event {res.get('event_id')}: {e}"
            print(f"[Sunday Ingest] {msg}")
            errors.append(msg)

    return {
        "run_date": sunday_date.isoformat(),
        "target_date": saturday_date_str,
        "status": "success" if not errors else "partial_success",
        "markets_fetched": len(markets),
        "results_fetched": len(results),
        "predictions_logged": predictions_logged,
        "results_settled": results_settled,
        "errors": errors,
    }


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
    parser.add_argument("--weekly-retrain", action="store_true", help="Enable weekly retrain run when the run date matches --weekly-retrain-day.")
    parser.add_argument("--weekly-retrain-day", default=DEFAULT_WEEKLY_RETRAIN_DAY, help="Weekly retrain day name (mon..sun).")
    parser.add_argument("--backup-dir", help="Optional SQLite backup directory after cycle.")
    parser.add_argument("--sunday-import", action="store_true", help="Run the Sunday Betfair market and results import task.")
    args = parser.parse_args(argv)

    if args.sunday_import:
        summary = sunday_betfair_import(run_date=args.run_date)
        print(json.dumps(summary, indent=2, sort_keys=True))
        return 0

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
        weekly_retrain_enabled=args.weekly_retrain,
        weekly_retrain_day=args.weekly_retrain_day,
        backup_dir=args.backup_dir or os.getenv("BETMATE_SQLITE_BACKUP_DIR"),
    )
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
