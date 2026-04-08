"""
Test fixtures for BetMate prediction engine tests.
Uses in-memory SQLite for fast, isolated test runs.
"""

import os
import pytest

# Force SQLite backend for tests (in-memory)
os.environ["DATABASE_URL"] = ""
os.environ["BETMATE_DB_PATH"] = ":memory:"


@pytest.fixture(autouse=True)
def _reset_db():
    """Reset the database module state before each test."""
    import app.database as db_mod

    db_mod._initialized = False
    db_mod._pg_pool = None
    db_mod.DATABASE_URL = ""
    db_mod.DB_BACKEND = "sqlite"
    db_mod.BETMATE_DB_PATH = ":memory:"

    # Re-init with fresh in-memory DB
    db_mod.init_database()
    yield
