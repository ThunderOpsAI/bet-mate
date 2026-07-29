from __future__ import annotations

import logging
from pathlib import Path
from typing import Callable, Dict, List

import modal

import app.data.afl_scraper as afl_scraper
import app.data.nba_scraper as nba_scraper
import app.data.scraper as racing_scraper
import app.data.nrl_scraper as nrl_scraper
import app.data.soccer_scraper as soccer_scraper
import app.data.golf_scraper as golf_scraper
import app.data.mma_scraper as mma_scraper
import app.database as database
import app.nightly as nightly
from app.main import app as fastapi_app
from app.ml.afl import AFLPredictor
from app.ml.nba import NBAPredictor
from app.ml.racing import RacingPredictor
from app.ml.nrl import NRLPredictor
from app.ml.soccer import SoccerPredictor
from app.ml.golf import GolfPredictor
from app.ml.mma import MMAPredictor
from app.time_utils import today_melbourne

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
    return fastapi_app


@app.function(
    image=image,
    secrets=secrets,
    volumes={MODEL_VOLUME_PATH: volume},
    env=_common_env(),
    region="ap-southeast-2",
    schedule=modal.Cron("0 5 * * *", timezone="Australia/Melbourne"),
    timeout=60 * 20,
)
def nightly_strategy_refresh():
    def _job() -> Dict[str, object]:
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
    schedule=modal.Cron("0 4 * * *", timezone="Australia/Melbourne"),
    timeout=60 * 10,
)
def race_data_refresh():
    def _job() -> Dict[str, object]:
        run_date = today_melbourne().isoformat()
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
    schedule=modal.Cron("15 4 * * *", timezone="Australia/Melbourne"),
    timeout=60 * 15,
)
def afl_model_refresh():
    def _job() -> Dict[str, object]:
        run_date = today_melbourne().isoformat()
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
    schedule=modal.Cron("30 4 * * *", timezone="Australia/Melbourne"),
    timeout=60 * 15,
)
def nba_model_refresh():
    def _job() -> Dict[str, object]:
        run_date = today_melbourne().isoformat()
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
    schedule=modal.Cron("0 6 * * 0", timezone="Australia/Melbourne"),
    timeout=60 * 15,
)
def sunday_betfair_import():
    def _job() -> Dict[str, object]:
        run_date = today_melbourne().isoformat()
        return nightly.sunday_betfair_import(run_date=run_date)

    return _run_logged_job("sunday_betfair_import", _job)
