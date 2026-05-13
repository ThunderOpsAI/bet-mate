from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Callable, Dict, List

import modal

import app.data.afl_scraper as afl_scraper
import app.data.nba_scraper as nba_scraper
import app.data.scraper as racing_scraper
import app.database as database
import app.nightly as nightly
from app.main import app as fastapi_app
from app.ml.afl import AFLPredictor
from app.ml.nba import NBAPredictor
from app.ml.racing import RacingPredictor
from app.time_utils import today_melbourne

LOGGER = logging.getLogger("betmate.modal")
APP_NAME = "betmate-prediction-engine"
MODEL_VOLUME_NAME = "betmate-prediction-engine-models"
MODEL_VOLUME_PATH = "/vol/betmate-models"
MODAL_SECRET_NAME = "betmate-prediction-engine-secrets"
ALLOWLIST_REMOTE_PATH = "/root/app/data/metro_allowlist.json"
MODAL_SECRET_KEYS = [
    "DATABASE_URL",
    "JWT_SECRET",
    "BETMATE_CORS_ORIGINS",
    "BETMATE_WEEKLY_RETRAIN_DAY",
    "BETMATE_BOB_MODEL",
    "BETMATE_BOB_TIMEOUT_SECONDS",
    "LOG_LEVEL",
    "BETMATE_SQLITE_BACKUP_DIR",
    "BETFAIR_APP_KEY",
    "BETFAIR_USERNAME",
    "BETFAIR_PASSWORD",
    "BETFAIR_AUTH_MODE",
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
]


def _requirements() -> List[str]:
    requirements_path = Path(__file__).with_name("requirements.txt")
    packages: List[str] = []
    for line in requirements_path.read_text(encoding="utf-8").splitlines():
        requirement = line.strip()
        if not requirement or requirement.startswith("#"):
            continue
        if requirement in {"pytest", "modal"}:
            continue
        packages.append(requirement)
    return packages


image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(*_requirements())
    .add_local_python_source("app")
    .add_local_file(
        Path(__file__).with_name("app").joinpath("data", "metro_allowlist.json"),
        remote_path=ALLOWLIST_REMOTE_PATH,
    )
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
            weekly_retrain_day=os.getenv(
                "BETMATE_WEEKLY_RETRAIN_DAY",
                nightly.DEFAULT_WEEKLY_RETRAIN_DAY,
            ),
            backup_dir=os.getenv("BETMATE_SQLITE_BACKUP_DIR") or None,
        )

    return _run_logged_job("nightly_strategy_refresh", _job)


@app.function(
    image=image,
    secrets=secrets,
    volumes={MODEL_VOLUME_PATH: volume},
    env=_common_env(),
    schedule=modal.Cron("0 4 * * *", timezone="Australia/Melbourne"),
    timeout=60 * 10,
)
def race_data_refresh():
    def _job() -> Dict[str, object]:
        run_date = today_melbourne().isoformat()
        predictor = RacingPredictor()
        predictor.load_or_train()
        races = racing_scraper.fetch_today_races(run_date=run_date)
        return {
            "run_date": run_date,
            "races": len(races),
            "training_source": predictor.training_source,
            "training_rows": predictor.training_rows,
        }

    return _run_logged_job("race_data_refresh", _job)


@app.function(
    image=image,
    secrets=secrets,
    volumes={MODEL_VOLUME_PATH: volume},
    env=_common_env(),
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
