"""
Database connection factory for BetMate prediction engine.

Supports two backends:
- **PostgreSQL** (Neon) — when DATABASE_URL starts with "postgres"
- **SQLite** (local dev fallback) — file-based at BETMATE_DB_PATH

Usage:
    from app.database import get_connection, init_database, DB_BACKEND

    init_database()  # Call once at startup

    with get_connection() as conn:
        conn.execute("SELECT ...")
"""

import os
import sqlite3
from contextlib import contextmanager
from typing import Optional

APP_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DEFAULT_SQLITE_PATH = os.path.join(APP_ROOT, "runtime", "betmate.sqlite3")

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
BETMATE_DB_PATH = os.path.abspath(os.getenv("BETMATE_DB_PATH", DEFAULT_SQLITE_PATH))

# Determine backend
DB_BACKEND = "postgresql" if DATABASE_URL.startswith("postgres") else "sqlite"

_pg_pool = None
_initialized = False


def _get_pg_pool():
    """Lazy-init a psycopg2 connection pool."""
    global _pg_pool
    if _pg_pool is not None:
        return _pg_pool

    try:
        import psycopg2
        import psycopg2.pool
        import psycopg2.extras

        # Neon requires sslmode=require
        conn_str = DATABASE_URL
        if "sslmode" not in conn_str:
            sep = "&" if "?" in conn_str else "?"
            conn_str += f"{sep}sslmode=require"

        _pg_pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=5,
            dsn=conn_str,
        )
        print(f"[Database] PostgreSQL pool created (Neon)")
        return _pg_pool
    except ImportError:
        raise RuntimeError(
            "psycopg2 is required for PostgreSQL. "
            "Install with: pip install psycopg2-binary"
        )
    except Exception as e:
        raise RuntimeError(f"Failed to create PostgreSQL pool: {e}")


class _PgCursorWrapper:
    """
    Wraps a psycopg2 cursor to provide a sqlite3-Row-like interface.
    Translates ? placeholders to %s for PostgreSQL.
    """

    def __init__(self, conn):
        import psycopg2.extras
        self._conn = conn
        self._cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    def execute(self, sql: str, params=None):
        sql = _translate_sql(sql)
        self._cursor.execute(sql, params or ())
        return self

    def executemany(self, sql: str, params_list):
        sql = _translate_sql(sql)
        for params in params_list:
            self._cursor.execute(sql, params)
        return self

    def fetchone(self):
        row = self._cursor.fetchone()
        if row is None:
            return None
        return _DictRow(row)

    def fetchall(self):
        rows = self._cursor.fetchall()
        return [_DictRow(row) for row in rows]

    @property
    def lastrowid(self):
        return self._cursor.fetchone()["id"] if self._cursor.description else None

    @property
    def rowcount(self):
        return self._cursor.rowcount

    def commit(self):
        self._conn.commit()

    def close(self):
        self._cursor.close()


class _DictRow:
    """Provides sqlite3.Row-compatible dict-like access for PostgreSQL rows."""

    def __init__(self, data: dict):
        self._data = data

    def __getitem__(self, key):
        if isinstance(key, int):
            return list(self._data.values())[key]
        return self._data[key]

    def __contains__(self, key):
        return key in self._data

    def keys(self):
        return self._data.keys()

    def values(self):
        return self._data.values()

    def items(self):
        return self._data.items()


def _translate_sql(sql: str) -> str:
    """
    Translate SQLite-style SQL to PostgreSQL.
    - ? placeholders → %s
    - AUTOINCREMENT → (removed, SERIAL handles it)
    - Handle IF NOT EXISTS for indexes
    """
    # Replace ? with %s for parameter binding
    result = sql.replace("?", "%s")
    return result


@contextmanager
def get_connection():
    """
    Context manager that yields a connection-like object.
    For SQLite: returns the native connection.
    For PostgreSQL: returns a wrapped connection with dict-cursor.
    """
    if DB_BACKEND == "postgresql":
        pool = _get_pg_pool()
        conn = pool.getconn()
        try:
            wrapper = _PgCursorWrapper(conn)
            yield wrapper
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            pool.putconn(conn)
    else:
        os.makedirs(os.path.dirname(BETMATE_DB_PATH), exist_ok=True)
        conn = sqlite3.connect(BETMATE_DB_PATH)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()


def init_database() -> None:
    """
    Initialize the database schema. Safe to call multiple times.
    Runs the appropriate schema for the active backend.
    """
    global _initialized
    if _initialized:
        return

    if DB_BACKEND == "postgresql":
        _init_postgresql()
    else:
        _init_sqlite()

    _initialized = True
    print(f"[Database] Initialized ({DB_BACKEND})")


def _init_sqlite():
    """Run SQLite schema creation."""
    os.makedirs(os.path.dirname(BETMATE_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(BETMATE_DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        _run_sqlite_schema(conn)
        conn.commit()
    finally:
        conn.close()


def _init_postgresql():
    """Run PostgreSQL schema creation."""
    pool = _get_pg_pool()
    conn = pool.getconn()
    try:
        import psycopg2.extras
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        _run_pg_schema(cursor)
        conn.commit()
        cursor.close()
    finally:
        pool.putconn(conn)


def _run_sqlite_schema(conn):
    """Create SQLite tables and indexes."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS prediction_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            updated_at TEXT,
            sport TEXT NOT NULL,
            event_id TEXT NOT NULL,
            event_name TEXT NOT NULL,
            selection TEXT NOT NULL,
            probability REAL NOT NULL,
            fair_odds REAL,
            payload_json TEXT NOT NULL,
            feature_impact_json TEXT NOT NULL,
            actual_outcome REAL,
            result_status TEXT,
            settled_at TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS prediction_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            completed_at TEXT NOT NULL,
            sport TEXT NOT NULL,
            event_id TEXT NOT NULL,
            event_name TEXT NOT NULL,
            winner_selection TEXT,
            result_payload_json TEXT NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS paper_bet_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            settled_at TEXT,
            prediction_log_id INTEGER,
            sport TEXT NOT NULL,
            event_id TEXT NOT NULL,
            event_name TEXT NOT NULL,
            selection TEXT NOT NULL,
            bet_type TEXT NOT NULL,
            odds REAL NOT NULL,
            stake REAL NOT NULL,
            status TEXT NOT NULL,
            payout REAL,
            profit REAL,
            notes TEXT
        )
    """)

    # Ensure columns exist for schema migrations
    _ensure_sqlite_column(conn, "prediction_log", "updated_at", "TEXT")
    _ensure_sqlite_column(conn, "prediction_log", "actual_outcome", "REAL")
    _ensure_sqlite_column(conn, "prediction_log", "result_status", "TEXT")
    _ensure_sqlite_column(conn, "prediction_log", "settled_at", "TEXT")

    # Indexes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_sport ON prediction_log (sport)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_event ON prediction_log (sport, event_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_created_at ON prediction_log (created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_settled_at ON prediction_log (settled_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_paper_bet_log_status ON paper_bet_log (status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_paper_bet_log_event ON paper_bet_log (sport, event_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_paper_bet_log_created_at ON paper_bet_log (created_at)")
    conn.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_prediction_log_unique_selection
        ON prediction_log (sport, event_id, selection)
    """)
    conn.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_prediction_results_unique_event
        ON prediction_results (sport, event_id)
    """)

    # One-time dedupe of any legacy duplicates
    conn.execute("""
        DELETE FROM prediction_log
        WHERE id NOT IN (
            SELECT MAX(id)
            FROM prediction_log
            GROUP BY sport, event_id, selection
        )
    """)


def _run_pg_schema(cursor):
    """Create PostgreSQL tables and indexes."""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS prediction_log (
            id SERIAL PRIMARY KEY,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ,
            sport TEXT NOT NULL,
            event_id TEXT NOT NULL,
            event_name TEXT NOT NULL,
            selection TEXT NOT NULL,
            probability DOUBLE PRECISION NOT NULL,
            fair_odds DOUBLE PRECISION,
            payload_json JSONB NOT NULL DEFAULT '{}',
            feature_impact_json JSONB NOT NULL DEFAULT '{}',
            actual_outcome DOUBLE PRECISION,
            result_status TEXT,
            settled_at TIMESTAMPTZ
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS prediction_results (
            id SERIAL PRIMARY KEY,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMPTZ NOT NULL,
            sport TEXT NOT NULL,
            event_id TEXT NOT NULL,
            event_name TEXT NOT NULL,
            winner_selection TEXT,
            result_payload_json JSONB NOT NULL DEFAULT '{}'
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS paper_bet_log (
            id SERIAL PRIMARY KEY,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            settled_at TIMESTAMPTZ,
            prediction_log_id INTEGER,
            sport TEXT NOT NULL,
            event_id TEXT NOT NULL,
            event_name TEXT NOT NULL,
            selection TEXT NOT NULL,
            bet_type TEXT NOT NULL,
            odds DOUBLE PRECISION NOT NULL,
            stake DOUBLE PRECISION NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING',
            payout DOUBLE PRECISION,
            profit DOUBLE PRECISION,
            notes TEXT
        )
    """)

    # Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_sport ON prediction_log (sport)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_event ON prediction_log (sport, event_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_created_at ON prediction_log (created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_settled_at ON prediction_log (settled_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_paper_bet_log_status ON paper_bet_log (status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_paper_bet_log_event ON paper_bet_log (sport, event_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_paper_bet_log_created_at ON paper_bet_log (created_at)")
    cursor.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_prediction_log_unique_selection
        ON prediction_log (sport, event_id, selection)
    """)
    cursor.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_prediction_results_unique_event
        ON prediction_results (sport, event_id)
    """)


def _ensure_sqlite_column(conn, table_name: str, column_name: str, column_type: str) -> None:
    columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()}
    if column_name not in columns:
        conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")
