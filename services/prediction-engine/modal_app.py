from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, List

import modal

import app.database as database
from app.main import app as fastapi_app

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
