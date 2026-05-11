import os
from pathlib import Path

APP_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_MODEL_DIR = os.path.join(APP_ROOT, "models")
MODEL_DIR = os.path.abspath(os.getenv("MODEL_ARTIFACT_DIR", DEFAULT_MODEL_DIR))
LEGACY_MODEL_DIR = os.path.dirname(__file__)


def model_path(filename):
    return os.path.join(MODEL_DIR, filename)


def legacy_model_path(filename):
    return os.path.join(LEGACY_MODEL_DIR, filename)


def ensure_model_dir():
    Path(MODEL_DIR).mkdir(parents=True, exist_ok=True)


def ensure_volume_mount() -> str:
    ensure_model_dir()
    return MODEL_DIR
