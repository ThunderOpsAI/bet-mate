"""
Test fixtures for BetMate prediction engine tests.
Uses in-memory SQLite for fast, isolated test runs.
"""

import os
import sqlite3
import pytest

# Force SQLite backend for tests
os.environ["DATABASE_URL"] = ""
os.environ["BETMATE_DB_PATH"] = ":memory:"
os.environ["BETMATE_ALLOW_SQLITE"] = "1"


@pytest.fixture(autouse=True)
def fresh_db(tmp_path):
    """
    Provide a fresh SQLite database for each test.
    Uses a temp file because :memory: doesn't persist across connections.
    """
    import app.database as db_mod

    test_db_path = str(tmp_path / "test_betmate.sqlite3")
    os.environ["BETMATE_DB_PATH"] = test_db_path
    os.environ["MODEL_ARTIFACT_DIR"] = str(tmp_path / "models")

    db_mod._initialized = False
    db_mod._pg_pool = None
    db_mod.DATABASE_URL = ""
    db_mod.DB_BACKEND = "sqlite"
    db_mod.BETMATE_DB_PATH = test_db_path

    db_mod.init_database()
    yield test_db_path
    os.environ["BETMATE_DB_PATH"] = ":memory:"
