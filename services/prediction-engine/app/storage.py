import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

APP_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DEFAULT_DB_PATH = os.path.join(APP_ROOT, "runtime", "betmate.sqlite3")
DB_PATH = os.path.abspath(os.getenv("BETMATE_DB_PATH", DEFAULT_DB_PATH))


def log_prediction_batch(
    sport: str,
    event_id: str,
    event_name: str,
    predictions: Iterable[Dict[str, Any]],
    feature_impact: Optional[Dict[str, Any]] = None,
) -> None:
    rows = list(predictions)
    if not rows:
        return

    try:
        created_at = datetime.now(timezone.utc).isoformat()
        with _connect() as conn:
            conn.executemany(
                """
                INSERT INTO prediction_log (
                    created_at,
                    sport,
                    event_id,
                    event_name,
                    selection,
                    probability,
                    fair_odds,
                    payload_json,
                    feature_impact_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        created_at,
                        sport,
                        event_id,
                        event_name,
                        str(row.get("selection", "")),
                        float(row.get("probability", 0.0)),
                        _optional_float(row.get("fair_odds")),
                        _dumps_json(row.get("payload", row)),
                        _dumps_json(feature_impact or {}),
                    )
                    for row in rows
                ],
            )
            conn.commit()
    except Exception as e:
        print(f"[Storage] Prediction log write failed: {e}")


def get_recent_predictions(limit: int = 50) -> List[Dict[str, Any]]:
    limit = max(1, min(int(limit), 200))
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT
                id,
                created_at,
                sport,
                event_id,
                event_name,
                selection,
                probability,
                fair_odds,
                payload_json,
                feature_impact_json
            FROM prediction_log
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return [_row_to_prediction(row) for row in rows]


def get_prediction_summary() -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT
                sport,
                COUNT(*) AS prediction_count,
                MAX(created_at) AS latest_at,
                AVG(probability) AS avg_probability
            FROM prediction_log
            GROUP BY sport
            ORDER BY prediction_count DESC, sport ASC
            """
        ).fetchall()

    return [
        {
            "sport": row["sport"],
            "prediction_count": int(row["prediction_count"]),
            "latest_at": row["latest_at"],
            "avg_probability": round(float(row["avg_probability"] or 0.0), 2),
        }
        for row in rows
    ]


def _connect():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    _ensure_schema(conn)
    return conn


def _ensure_schema(conn) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS prediction_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            sport TEXT NOT NULL,
            event_id TEXT NOT NULL,
            event_name TEXT NOT NULL,
            selection TEXT NOT NULL,
            probability REAL NOT NULL,
            fair_odds REAL,
            payload_json TEXT NOT NULL,
            feature_impact_json TEXT NOT NULL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_sport ON prediction_log (sport)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_created_at ON prediction_log (created_at)")
    conn.commit()


def _row_to_prediction(row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "created_at": row["created_at"],
        "sport": row["sport"],
        "event_id": row["event_id"],
        "event_name": row["event_name"],
        "selection": row["selection"],
        "probability": row["probability"],
        "fair_odds": row["fair_odds"],
        "payload": _loads_json(row["payload_json"]),
        "feature_impact": _loads_json(row["feature_impact_json"]),
    }


def _loads_json(value: str) -> Dict[str, Any]:
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _dumps_json(value) -> str:
    return json.dumps(value, default=_json_default, sort_keys=True)


def _json_default(value):
    if hasattr(value, "item"):
        return value.item()

    return str(value)


def _optional_float(value):
    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None
