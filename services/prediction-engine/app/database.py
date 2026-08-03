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
import shutil
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Optional

APP_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DEFAULT_SQLITE_PATH = os.path.join(APP_ROOT, "runtime", "betmate.sqlite3")

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
db_path = os.getenv("BETMATE_DB_PATH", DEFAULT_SQLITE_PATH)
BETMATE_DB_PATH = db_path if db_path == ":memory:" else os.path.abspath(db_path)

# Determine backend
DB_BACKEND = "postgresql" if DATABASE_URL.startswith("postgres") else "sqlite"

user_id_ctx: ContextVar[Optional[str]] = ContextVar("user_id_ctx", default=None)

_pg_pool = None
_initialized = False
TRUE_VALUES = {"1", "true", "yes", "on"}


def refresh_runtime_configuration() -> None:
    global DATABASE_URL, BETMATE_DB_PATH, DB_BACKEND
    DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
    db_path = os.getenv("BETMATE_DB_PATH", DEFAULT_SQLITE_PATH)
    BETMATE_DB_PATH = db_path if db_path == ":memory:" else os.path.abspath(db_path)
    DB_BACKEND = "postgresql" if DATABASE_URL.startswith("postgres") else "sqlite"


def sqlite_fallback_allowed() -> bool:
    return os.getenv("BETMATE_ALLOW_SQLITE", "").strip().lower() in TRUE_VALUES


def require_database_url() -> None:
    refresh_runtime_configuration()
    if DATABASE_URL:
        return
    if sqlite_fallback_allowed():
        return
    raise RuntimeError("DATABASE_URL required in production")


def _get_pg_pool():
    """Lazy-init a psycopg2 connection pool."""
    global _pg_pool
    refresh_runtime_configuration()
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
    # Handle AUTOINCREMENT
    result = result.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
    result = result.replace("AUTOINCREMENT", "")
    result = result.replace("ADD COLUMN", "ADD COLUMN IF NOT EXISTS")
    return result


@contextmanager
def get_connection():
    """
    Context manager that yields a connection-like object.
    For SQLite: returns the native connection.
    For PostgreSQL: returns a wrapped connection with dict-cursor.
    """
    refresh_runtime_configuration()
    if DB_BACKEND == "postgresql":
        pool = _get_pg_pool()
        conn = pool.getconn()
        try:
            user_id = user_id_ctx.get()
            if user_id is not None:
                with conn.cursor() as cursor:
                    cursor.execute("SET LOCAL request.jwt.claim.sub = %s", (user_id,))
            wrapper = _PgCursorWrapper(conn)
            yield wrapper
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            pool.putconn(conn)
    else:
        dir_name = os.path.dirname(BETMATE_DB_PATH)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
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
    refresh_runtime_configuration()
    if _initialized:
        return

    if DB_BACKEND == "postgresql":
        _init_postgresql()
    else:
        _init_sqlite()

    _initialized = True
    print(f"[Database] Initialized ({DB_BACKEND})")


def validate_persistence_configuration() -> None:
    """Validate storage durability assumptions before serving traffic."""
    refresh_runtime_configuration()
    if DB_BACKEND != "sqlite":
        return

    require_persistent = os.getenv("BETMATE_REQUIRE_PERSISTENT_STORAGE", "").strip().lower() in TRUE_VALUES
    if not require_persistent:
        return

    normalized = BETMATE_DB_PATH.strip()
    if normalized == ":memory:":
        raise RuntimeError("BETMATE_REQUIRE_PERSISTENT_STORAGE is enabled but SQLite is configured in-memory")

    temp_roots = ("/tmp/", "/private/tmp/", "/var/folders/")
    if any(normalized.startswith(root) for root in temp_roots):
        raise RuntimeError(
            "BETMATE_REQUIRE_PERSISTENT_STORAGE is enabled but BETMATE_DB_PATH points to a temporary directory"
        )


def create_sqlite_backup(backup_dir: str) -> Optional[str]:
    """Snapshot SQLite database file for disaster recovery. Returns backup path."""
    refresh_runtime_configuration()
    if DB_BACKEND != "sqlite":
        return None

    source = BETMATE_DB_PATH
    if source == ":memory:" or not os.path.exists(source):
        return None

    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_path = os.path.join(backup_dir, f"betmate-backup-{timestamp}.sqlite3")
    shutil.copy2(source, backup_path)
    return backup_path


def restore_sqlite_backup(backup_path: str) -> None:
    """Restore SQLite database file from a backup snapshot."""
    refresh_runtime_configuration()
    if DB_BACKEND != "sqlite":
        raise RuntimeError("restore_sqlite_backup is only supported for sqlite backend")
    if not os.path.exists(backup_path):
        raise FileNotFoundError(backup_path)
    if BETMATE_DB_PATH == ":memory:":
        raise RuntimeError("cannot restore backup into in-memory sqlite database")

    os.makedirs(os.path.dirname(BETMATE_DB_PATH), exist_ok=True)
    shutil.copy2(backup_path, BETMATE_DB_PATH)


def _init_sqlite():
    """Run SQLite schema creation."""
    refresh_runtime_configuration()
    dir_name = os.path.dirname(BETMATE_DB_PATH)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    conn = sqlite3.connect(BETMATE_DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        _run_sqlite_schema(conn)
        conn.commit()
    finally:
        conn.close()


def verify_database_connection() -> None:
    refresh_runtime_configuration()
    with get_connection() as conn:
        conn.execute("SELECT 1")


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
            user_id TEXT NOT NULL DEFAULT 'legacy',
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

    conn.execute("""
        CREATE TABLE IF NOT EXISTS strategy_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_key TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            rule_set_json TEXT NOT NULL,
            is_editable INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS daily_strategy_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_key TEXT NOT NULL,
            run_date TEXT NOT NULL,
            bankroll_standard REAL NOT NULL DEFAULT 250.00,
            bankroll_premium REAL NOT NULL DEFAULT 500.00,
            total_allocated REAL,
            candidate_count INTEGER,
            selected_count INTEGER,
            skipped_count INTEGER,
            run_payload_json TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(profile_key, run_date)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS system_bets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id INTEGER NOT NULL,
            profile_key TEXT NOT NULL,
            sport TEXT NOT NULL,
            event_id TEXT NOT NULL,
            event_name TEXT NOT NULL,
            market_type TEXT NOT NULL,
            selection TEXT NOT NULL,
            model_probability REAL NOT NULL,
            odds_used REAL NOT NULL,
            odds_source TEXT NOT NULL,
            edge REAL NOT NULL,
            stake REAL NOT NULL,
            legs_json TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            payout REAL,
            profit REAL,
            settled_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(run_id) REFERENCES daily_strategy_runs(id)
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS auto_tune_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_key TEXT NOT NULL,
            tuned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            window_start TEXT NOT NULL,
            window_end TEXT NOT NULL,
            settled_bets_in_window INTEGER NOT NULL,
            params_before TEXT NOT NULL,
            params_after TEXT NOT NULL,
            improvement_metric REAL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS weekly_retrain_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_date TEXT NOT NULL UNIQUE,
            started_at TEXT NOT NULL,
            completed_at TEXT NOT NULL,
            profile_count INTEGER NOT NULL,
            tuned_profiles INTEGER NOT NULL,
            summary_json TEXT NOT NULL
        )
    """)

    # Ensure columns exist for schema migrations
    _ensure_sqlite_column(conn, "prediction_log", "updated_at", "TEXT")
    _ensure_sqlite_column(conn, "prediction_log", "actual_outcome", "REAL")
    _ensure_sqlite_column(conn, "prediction_log", "result_status", "TEXT")
    _ensure_sqlite_column(conn, "prediction_log", "settled_at", "TEXT")
    _ensure_sqlite_column(conn, "paper_bet_log", "origin", "TEXT DEFAULT 'user'")
    _ensure_sqlite_column(conn, "paper_bet_log", "system_bet_id", "INTEGER")
    _ensure_sqlite_column(conn, "paper_bet_log", "user_id", "TEXT DEFAULT 'legacy'")
    _ensure_sqlite_column(conn, "system_bets", "legs_json", "TEXT")

    # Indexes
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_sport ON prediction_log (sport)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_event ON prediction_log (sport, event_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_created_at ON prediction_log (created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_settled_at ON prediction_log (settled_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_paper_bet_log_status ON paper_bet_log (status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_paper_bet_log_user_created_at ON paper_bet_log (user_id, created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_paper_bet_log_event ON paper_bet_log (sport, event_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_paper_bet_log_created_at ON paper_bet_log (created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_system_bets_run ON system_bets (run_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_system_bets_event ON system_bets (sport, event_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_system_bets_profile ON system_bets (profile_key, created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_weekly_retrain_log_run_date ON weekly_retrain_log (run_date)")
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
            user_id TEXT NOT NULL DEFAULT 'legacy',
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

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS strategy_profiles (
            id SERIAL PRIMARY KEY,
            profile_key TEXT UNIQUE NOT NULL,
            display_name TEXT NOT NULL,
            rule_set_json JSONB NOT NULL,
            is_editable BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_strategy_runs (
            id SERIAL PRIMARY KEY,
            profile_key TEXT NOT NULL REFERENCES strategy_profiles(profile_key),
            run_date DATE NOT NULL,
            bankroll_standard DOUBLE PRECISION NOT NULL DEFAULT 250.00,
            bankroll_premium DOUBLE PRECISION NOT NULL DEFAULT 500.00,
            total_allocated DOUBLE PRECISION,
            candidate_count INTEGER,
            selected_count INTEGER,
            skipped_count INTEGER,
            run_payload_json JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(profile_key, run_date)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS system_bets (
            id SERIAL PRIMARY KEY,
            run_id INTEGER NOT NULL REFERENCES daily_strategy_runs(id),
            profile_key TEXT NOT NULL,
            sport TEXT NOT NULL,
            event_id TEXT NOT NULL,
            event_name TEXT NOT NULL,
            market_type TEXT NOT NULL,
            selection TEXT NOT NULL,
            model_probability DOUBLE PRECISION NOT NULL,
            odds_used DOUBLE PRECISION NOT NULL,
            odds_source TEXT NOT NULL,
            edge DOUBLE PRECISION NOT NULL,
            stake DOUBLE PRECISION NOT NULL,
            legs_json JSONB,
            status TEXT NOT NULL DEFAULT 'pending',
            payout DOUBLE PRECISION,
            profit DOUBLE PRECISION,
            settled_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS auto_tune_log (
            id SERIAL PRIMARY KEY,
            profile_key TEXT NOT NULL,
            tuned_at TIMESTAMPTZ DEFAULT NOW(),
            window_start DATE NOT NULL,
            window_end DATE NOT NULL,
            settled_bets_in_window INTEGER NOT NULL,
            params_before JSONB NOT NULL,
            params_after JSONB NOT NULL,
            improvement_metric DOUBLE PRECISION
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS weekly_retrain_log (
            id SERIAL PRIMARY KEY,
            run_date DATE NOT NULL UNIQUE,
            started_at TIMESTAMPTZ NOT NULL,
            completed_at TIMESTAMPTZ NOT NULL,
            profile_count INTEGER NOT NULL,
            tuned_profiles INTEGER NOT NULL,
            summary_json JSONB NOT NULL DEFAULT '{}'
        )
    """)

    cursor.execute("ALTER TABLE paper_bet_log ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'user'")
    cursor.execute("ALTER TABLE paper_bet_log ADD COLUMN IF NOT EXISTS system_bet_id INTEGER REFERENCES system_bets(id)")
    cursor.execute("ALTER TABLE paper_bet_log ADD COLUMN IF NOT EXISTS user_id TEXT")
    cursor.execute("UPDATE paper_bet_log SET user_id = 'legacy' WHERE user_id IS NULL")
    cursor.execute("ALTER TABLE paper_bet_log ALTER COLUMN user_id SET DEFAULT 'legacy'")
    cursor.execute("ALTER TABLE paper_bet_log ALTER COLUMN user_id SET NOT NULL")
    cursor.execute("ALTER TABLE system_bets ADD COLUMN IF NOT EXISTS legs_json JSONB")

    # Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_sport ON prediction_log (sport)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_event ON prediction_log (sport, event_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_created_at ON prediction_log (created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_settled_at ON prediction_log (settled_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_paper_bet_log_status ON paper_bet_log (status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_paper_bet_log_user_created_at ON paper_bet_log (user_id, created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_paper_bet_log_event ON paper_bet_log (sport, event_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_paper_bet_log_created_at ON paper_bet_log (created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_system_bets_run ON system_bets (run_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_system_bets_event ON system_bets (sport, event_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_system_bets_profile ON system_bets (profile_key, created_at)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_weekly_retrain_log_run_date ON weekly_retrain_log (run_date)")
    cursor.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_prediction_log_unique_selection
        ON prediction_log (sport, event_id, selection)
    """)
    cursor.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_prediction_results_unique_event
        ON prediction_results (sport, event_id)
    """)
    cursor.execute("ALTER TABLE paper_bet_log ENABLE ROW LEVEL SECURITY")
    cursor.execute("ALTER TABLE paper_bet_log FORCE ROW LEVEL SECURITY")
    cursor.execute("DROP POLICY IF EXISTS paper_bet_log_user_isolation ON paper_bet_log")
    cursor.execute(
        """
        CREATE POLICY paper_bet_log_user_isolation
        ON paper_bet_log
        USING (current_setting('request.jwt.claim.sub', true) = user_id)
        WITH CHECK (current_setting('request.jwt.claim.sub', true) = user_id)
        """
    )


def _ensure_sqlite_column(conn, table_name: str, column_name: str, column_type: str) -> None:
    columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()}
    if column_name not in columns:
        conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")
