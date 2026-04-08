import os

APP_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_MODEL_DIR = os.path.join(APP_ROOT, "models")
MODEL_DIR = os.path.abspath(os.getenv("MODEL_ARTIFACT_DIR", DEFAULT_MODEL_DIR))
LEGACY_MODEL_DIR = os.path.dirname(__file__)


def model_path(filename):
    return os.path.join(MODEL_DIR, filename)


def legacy_model_path(filename):
    return os.path.join(LEGACY_MODEL_DIR, filename)


def ensure_model_dir():
    os.makedirs(MODEL_DIR, exist_ok=True)
