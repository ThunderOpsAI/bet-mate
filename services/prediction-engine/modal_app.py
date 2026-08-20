from __future__ import annotations

import logging
from pathlib import Path
from typing import Callable, Dict, List

import modal


LOGGER = logging.getLogger("betmate.modal")
APP_NAME = "betmate-prediction-engine"
MODEL_VOLUME_NAME = "betmate-prediction-engine-models"
MODEL_VOLUME_PATH = "/vol/betmate-models"
MODAL_SECRET_NAME = "betmate-prediction-engine-secrets"
MODAL_SECRET_KEYS = [
    "DATABASE_URL",
    "JWT_SECRET",
    "BETFAIR_APP_KEY",
    "BETFAIR_USERNAME",
    "BETFAIR_PASSWORD",
    "BETFAIR_CERT_PATH",
    "BETFAIR_KEY_PATH",
    "BETFAIR_CERT_PEM",
    "BETFAIR_KEY_PEM",
    "BETFAIR_CERT_PEM_B64",
    "BETFAIR_KEY_PEM_B64",
    "BETFAIR_AUTH_MODE",
    "BETFAIR_API_BASE_URL",
    "BDL_API_KEY",
    "GEMINI_API_KEY",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM_NUMBER",
    "RESEND_API_KEY",
    "NOTIFY_EMAIL_FROM",
    "PUSHOVER_APP_TOKEN",
    "BETFAIR_SUNDAY_INGEST_URL",
]


def _requirements() -> List[str]:
    requirements_path = Path(__file__).with_name("requirements.txt")
    if not requirements_path.exists():
        return []
    packages: List[str] = []
    for line in requirements_path.read_text(encoding="utf-8").splitlines():
        requirement = line.strip()
        if not requirement or requirement.startswith("#"):
            continue
        if requirement in {"pytest", "modal"}:
            continue
        packages.append(requirement)
    return packages


_reqs = _requirements()
image = modal.Image.debian_slim(python_version="3.11")
if _reqs:
    image = image.pip_install(*_reqs)
image = image.add_local_python_source("app", ignore=["*.pyc", "__pycache__"])
local_allowlist = Path(__file__).parent / "app" / "data" / "metro_allowlist.json"
image = image.add_local_file(
    local_allowlist,
    "/root/app/data/metro_allowlist.json"
)
volume = modal.Volume.from_name(MODEL_VOLUME_NAME, create_if_missing=True)
secrets = [modal.Secret.from_name(MODAL_SECRET_NAME)]
app = modal.App(APP_NAME)


def _common_env() -> Dict[str, str]:
    return {
        "MODEL_ARTIFACT_DIR": f"{MODEL_VOLUME_PATH}/models",
        "BETMATE_ALLOW_SQLITE": "0",
        "BETMATE_REQUIRE_PERSISTENT_STORAGE": "1",
    }


def _prepare_runtime() -> None:
    import app.database as database
    logging.basicConfig(
        level="INFO",
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        force=True,
    )
    database.require_database_url()
    database.verify_database_connection()
    LOGGER.info("Database connection verified successfully.")
    LOGGER.info("Model volume mounted at %s", MODEL_VOLUME_PATH)


def _run_logged_job(name: str, job: Callable[[], Dict[str, object]]) -> Dict[str, object]:
    _prepare_runtime()
    LOGGER.info("%s start", name)
    try:
        summary = job()
        LOGGER.info("%s completed: %s", name, summary)
        return summary
    except Exception as exc:
        LOGGER.exception("%s failed: %s", name, exc)
        raise


@app.function(
    image=image,
    secrets=secrets,
    volumes={MODEL_VOLUME_PATH: volume},
    env=_common_env(),
    region="ap-southeast-2",
    timeout=60 * 15,
)
@modal.asgi_app()
def web():
    _prepare_runtime()
    from app.main import app as fastapi_app
    return fastapi_app


@app.function(
    image=image,
    secrets=secrets,
    volumes={MODEL_VOLUME_PATH: volume},
    env=_common_env(),
    region="ap-southeast-2",
    timeout=60 * 20,
)
def nightly_strategy_refresh():
    def _job() -> Dict[str, object]:
        import app.nightly as nightly
        from app.time_utils import today_melbourne
        strategy_service = nightly.build_nightly_strategy_service(load_models=True)
        run_date = today_melbourne().isoformat()
        return nightly.run_nightly_cycle(
            strategy_service=strategy_service,
            run_date=run_date,
            ingest_sports=("afl", "nba", "racing"),
            ingest_results_enabled=True,
            tune_enabled=True,
            weekly_retrain_enabled=True,
            weekly_retrain_day=nightly.DEFAULT_WEEKLY_RETRAIN_DAY,
            backup_dir=None,
        )

    return _run_logged_job("nightly_strategy_refresh", _job)


@app.function(
    image=image,
    secrets=secrets,
    volumes={MODEL_VOLUME_PATH: volume},
    env=_common_env(),
    region="ap-southeast-2",
    timeout=60 * 10,
)
def race_data_refresh():
    def _job() -> Dict[str, object]:
        run_date = today_melbourne().isoformat()
        from app.ml.racing import RacingPredictor
        from app.time_utils import today_melbourne
        import app.data.scraper as racing_scraper
        import app.database as database
        predictor = RacingPredictor()
        predictor.load_or_train()
        races = racing_scraper.fetch_today_races(run_date=run_date)
        
        import app.storage as storage
        database.user_id_ctx.set("automated_agent")
        storage.init_db()
        
        predictions_logged = 0
        errors = []
        for race in races:
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
                        "days_since_since_last_race": horse.get("days_since_last_race", 14), # fallback
                        "days_since_last_race": horse.get("days_since_last_race", 14)
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
                    predictions.append({
                        "selection": horse["name"],
                        "probability": round(probability * 100, 2),
                        "fair_odds": live_odds or fair_odds,
                        "payload": {
                            "selection": horse["name"],
                            "venue": race["venue"],
                            "canonical_venue": race.get("canonical_venue") or race["venue"],
                            "race_number": race["race_number"],
                            "meeting_date": race.get("meeting_date") or run_date,
                            "state": race.get("state", ""),
                            "meeting_region": race.get("meeting_region", ""),
                            "market_name": race.get("market_name", ""),
                            "start_time": race.get("start_time"),
                            "distance": race.get("distance", 1200),
                            "data_source": race.get("data_source", "betfair"),
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
                errors.append(f"Failed to run predictions for race {race.get('race_id')}: {e}")
                
        return {
            "run_date": run_date,
            "races": len(races),
            "predictions_logged": predictions_logged,
            "errors": errors,
            "training_source": predictor.training_source,
            "training_rows": predictor.training_rows,
        }

    return _run_logged_job("race_data_refresh", _job)


@app.function(
    image=image,
    secrets=secrets,
    volumes={MODEL_VOLUME_PATH: volume},
    env=_common_env(),
    region="ap-southeast-2",
    timeout=60 * 15,
)
def afl_model_refresh():
    def _job() -> Dict[str, object]:
        run_date = today_melbourne().isoformat()
        from app.ml.afl import AFLPredictor
        from app.time_utils import today_melbourne
        import app.data.afl_scraper as afl_scraper
        predictor = AFLPredictor()
        predictor.train()
        games = afl_scraper.fetch_this_week_afl(run_date=run_date)
        return {
            "run_date": run_date,
            "games": len(games),
            "training_source": predictor.training_source,
            "training_rows": predictor.training_rows,
        }

    return _run_logged_job("afl_model_refresh", _job)


@app.function(
    image=image,
    secrets=secrets,
    volumes={MODEL_VOLUME_PATH: volume},
    env=_common_env(),
    region="ap-southeast-2",
    timeout=60 * 15,
)
def nba_model_refresh():
    def _job() -> Dict[str, object]:
        run_date = today_melbourne().isoformat()
        from app.ml.nba import NBAPredictor
        from app.time_utils import today_melbourne
        import app.data.nba_scraper as nba_scraper
        predictor = NBAPredictor()
        predictor.train()
        games = nba_scraper.fetch_today_nba(run_date=run_date)
        return {
            "run_date": run_date,
            "games": len(games),
            "training_source": predictor.training_source,
            "training_rows": predictor.training_rows,
        }

    return _run_logged_job("nba_model_refresh", _job)


@app.function(
    image=image,
    secrets=secrets,
    volumes={MODEL_VOLUME_PATH: volume},
    env=_common_env(),
    region="ap-southeast-2",
    timeout=60 * 5,
)
def prewarm_upcoming_races():
    def _job() -> Dict[str, object]:
        from app.alerts import calculate_minutes_until_jump
        import app.data.scraper as racing_scraper
        races = racing_scraper.fetch_today_races()
        upcoming = [r for r in races if r.get("start_time") and 0 < (calculate_minutes_until_jump(r["start_time"]) or 0) <= 60]
        return {"fetched_races": len(races), "upcoming_races": len(upcoming)}

    return _run_logged_job("prewarm_upcoming_races", _job)


@app.function(
    image=image,
    secrets=secrets,
    volumes={MODEL_VOLUME_PATH: volume},
    env=_common_env(),
    region="ap-southeast-2",
    timeout=60 * 15,
)
def sunday_betfair_import():
    def _job() -> Dict[str, object]:
        import app.nightly as nightly
        from app.time_utils import today_melbourne
        run_date = today_melbourne().isoformat()
        return nightly.sunday_betfair_import(run_date=run_date)

    return _run_logged_job("sunday_betfair_import", _job)

@app.function(
    image=image,
    secrets=secrets,
    volumes={MODEL_VOLUME_PATH: volume},
    env=_common_env(),
    region="ap-southeast-2",
    timeout=60 * 5,
)
def evaluate_blackbook_rules():
    def _job() -> Dict[str, object]:
        import json
        import app.storage as storage
        import app.database as database
        import app.data.scraper as racing_scraper
        database.require_database_url()
        database.verify_database_connection()
        
        matches = 0
        evaluations = 0
        try:
            with database.get_connection() as conn:
                items = conn.execute('SELECT * FROM "BlackbookItem"').fetchall()
                if not items:
                    return {"items": 0, "evaluations": 0, "matches": 0}
                    
                rules = conn.execute('SELECT * FROM "BlackbookRule" WHERE "isActive" = true').fetchall()
                rules_by_item = {}
                for r in rules:
                    rules_by_item.setdefault(r["blackbookItemId"], []).append(r)
                
                # Fetch today's race card
                races = racing_scraper.fetch_today_races()
                
                for item in items:
                    item_id = item["id"]
                    target_name = item.get("targetName", "").lower()
                    target_type = item.get("targetType", "")
                    entity_type = item.get("entityType", "RUNNER")
                    
                    conditions_str = item.get("conditions", "{}")
                    try:
                        conditions = json.loads(conditions_str) if isinstance(conditions_str, str) else conditions_str
                    except Exception:
                        conditions = {}
                        
                    item_rules = rules_by_item.get(item_id, [])
                    
                    for race in races:
                        # Check if running
                        is_running = False
                        matched_horse = None
                        venue = race.get("venue", "").lower()
                        
                        for horse in race.get("horses", []):
                            if entity_type == "RUNNER" and target_name in horse.get("name", "").lower():
                                is_running = True
                                matched_horse = horse
                                break
                            elif entity_type == "JOCKEY" and target_name in horse.get("jockey_name", "").lower():
                                is_running = True
                                matched_horse = horse
                                break
                            elif entity_type == "TRAINER" and target_name in horse.get("trainer_name", "").lower():
                                is_running = True
                                matched_horse = horse
                                break
                                
                        if not is_running:
                            continue
                            
                        # Basic conditions evaluation
                        passed = True
                        if conditions.get("metro") and not race.get("is_metro", False):
                            passed = False
                        
                        if passed and conditions.get("minOdds"):
                            odds = float(matched_horse.get("betfair_back_price", 0) or 0)
                            if odds < float(conditions["minOdds"]):
                                passed = False
                                
                        if passed and conditions.get("tracks"):
                            if venue not in [t.lower() for t in conditions["tracks"]]:
                                passed = False

                        # Sprint 2 Combo Conditions
                        if passed and conditions.get("jockeyTrainerCombo"):
                            combo = conditions["jockeyTrainerCombo"]
                            c_jockey = combo.get("jockey", "").lower()
                            c_trainer = combo.get("trainer", "").lower()
                            h_jockey = matched_horse.get("jockey_name", "").lower()
                            h_trainer = matched_horse.get("trainer_name", "").lower()
                            if c_jockey not in h_jockey or c_trainer not in h_trainer:
                                passed = False

                        if passed and conditions.get("jockeyHorse"):
                            combo = conditions["jockeyHorse"]
                            c_jockey = combo.get("jockey", "").lower()
                            c_horse = combo.get("horse", "").lower()
                            h_jockey = matched_horse.get("jockey_name", "").lower()
                            h_name = matched_horse.get("name", "").lower()
                            if c_jockey not in h_jockey or c_horse not in h_name:
                                passed = False

                        if passed and conditions.get("trainerTrack"):
                            combo = conditions["trainerTrack"]
                            c_trainer = combo.get("trainer", "").lower()
                            c_track = combo.get("track", "").lower()
                            h_trainer = matched_horse.get("trainer_name", "").lower()
                            if c_trainer not in h_trainer or c_track not in venue:
                                passed = False

                        if passed and conditions.get("jockeyTrack"):
                            combo = conditions["jockeyTrack"]
                            c_jockey = combo.get("jockey", "").lower()
                            c_track = combo.get("track", "").lower()
                            h_jockey = matched_horse.get("jockey_name", "").lower()
                            if c_jockey not in h_jockey or c_track not in venue:
                                passed = False

                        if passed and conditions.get("horseFavourite"):
                            # Check if horse is market favourite
                            min_odds = float('inf')
                            fav_name = None
                            for h in race.get("horses", []):
                                h_odds = float(h.get("betfair_back_price", 0) or 0)
                                if h_odds > 0 and h_odds < min_odds:
                                    min_odds = h_odds
                                    fav_name = h.get("name")
                            if matched_horse.get("name") != fav_name:
                                passed = False

                        if passed and conditions.get("dogBox"):
                            box = matched_horse.get("barrier")
                            if box not in conditions["dogBox"]:
                                passed = False

                        if passed and (conditions.get("firstUp") or conditions.get("secondUp") or conditions.get("maxDaysSinceRun")):
                            days = matched_horse.get("days_since_last_race")
                            if days is not None:
                                if conditions.get("firstUp") and days <= 60:
                                    passed = False
                                if conditions.get("secondUp") and (days <= 30 or days > 60):
                                    passed = False
                                if conditions.get("maxDaysSinceRun") and days > conditions["maxDaysSinceRun"]:
                                    passed = False

                        if passed and (conditions.get("distanceMin") or conditions.get("distanceMax")):
                            dist = race.get("distance")
                            if dist is not None:
                                if conditions.get("distanceMin") and dist < conditions["distanceMin"]:
                                    passed = False
                                if conditions.get("distanceMax") and dist > conditions["distanceMax"]:
                                    passed = False

                        if passed and conditions.get("trackCondition"):
                            c_cond = conditions["trackCondition"].lower()
                            h_cond = matched_horse.get("track_condition", "").lower()
                            if c_cond not in h_cond:
                                passed = False
                                
                        if passed:
                            evaluations += 1
                            matches += 1
                            LOGGER.info(f"Blackbook match: {target_name} is running today at {race.get('venue')} R{race.get('race_number')}")
                            # For Sprint 1, just log to console
                
        except Exception as e:
            LOGGER.error(f"Blackbook evaluation failed: {e}")
            return {"error": str(e), "matches": matches, "evaluations": evaluations}
            
        return {"items": len(items), "evaluations": evaluations, "matches": matches}

    return _run_logged_job("evaluate_blackbook_rules", _job)



@app.function(
    image=image,
    region="ap-southeast-2",
    timeout=60,
    schedule=modal.Cron("*/5 * * * *", timezone="Australia/Melbourne"),
)
def master_scheduler():
    from datetime import datetime
    import pytz
    now = datetime.now(pytz.timezone("Australia/Melbourne"))
    
    print(f"Master scheduler tick at {now}")
    
    # 10 min jobs
    if now.minute % 10 == 0:
        prewarm_upcoming_races.spawn()
        
    # 15 min jobs
    if now.minute % 15 == 0:
        evaluate_blackbook_rules.spawn()
        
    # 4:00 AM jobs
    if now.hour == 4 and now.minute == 0:
        race_data_refresh.spawn()
        
    # 4:15 AM jobs
    if now.hour == 4 and now.minute == 15:
        afl_model_refresh.spawn()
        
    # 4:30 AM jobs
    if now.hour == 4 and now.minute == 30:
        nba_model_refresh.spawn()
        
    # 5:00 AM jobs
    if now.hour == 5 and now.minute == 0:
        nightly_strategy_refresh.spawn()
        
    # Sunday 6:00 AM jobs
    if now.weekday() == 6 and now.hour == 6 and now.minute == 0:
        sunday_betfair_import.spawn()
