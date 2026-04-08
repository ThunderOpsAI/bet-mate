import json
import math
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
                    updated_at,
                    sport,
                    event_id,
                    event_name,
                    selection,
                    probability,
                    fair_odds,
                    payload_json,
                    feature_impact_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(sport, event_id, selection) DO UPDATE SET
                    updated_at = CASE
                        WHEN prediction_log.settled_at IS NULL THEN excluded.updated_at
                        ELSE prediction_log.updated_at
                    END,
                    event_name = CASE
                        WHEN prediction_log.settled_at IS NULL THEN excluded.event_name
                        ELSE prediction_log.event_name
                    END,
                    probability = CASE
                        WHEN prediction_log.settled_at IS NULL THEN excluded.probability
                        ELSE prediction_log.probability
                    END,
                    fair_odds = CASE
                        WHEN prediction_log.settled_at IS NULL THEN excluded.fair_odds
                        ELSE prediction_log.fair_odds
                    END,
                    payload_json = CASE
                        WHEN prediction_log.settled_at IS NULL THEN excluded.payload_json
                        ELSE prediction_log.payload_json
                    END,
                    feature_impact_json = CASE
                        WHEN prediction_log.settled_at IS NULL THEN excluded.feature_impact_json
                        ELSE prediction_log.feature_impact_json
                    END
                """,
                [
                    (
                        created_at,
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
                updated_at,
                sport,
                event_id,
                event_name,
                selection,
                probability,
                fair_odds,
                actual_outcome,
                result_status,
                settled_at,
                payload_json,
                feature_impact_json
            FROM prediction_log
            ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return [_row_to_prediction(row) for row in rows]


def settle_prediction_result(
    sport: str,
    event_id: str,
    winner_selection: Optional[str] = None,
    selection_results: Optional[Dict[str, Any]] = None,
    event_name: Optional[str] = None,
    completed_at: Optional[str] = None,
    result_payload: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    sport = sport.strip().lower()
    event_id = event_id.strip()
    winner_selection = winner_selection.strip() if winner_selection else None
    completed_at = completed_at or datetime.now(timezone.utc).isoformat()
    updated_at = datetime.now(timezone.utc).isoformat()

    if not sport or not event_id:
        raise ValueError("sport and event_id are required")
    if not winner_selection and not selection_results:
        raise ValueError("winner_selection or selection_results is required")

    normalized_results = _normalize_selection_results(selection_results)
    if selection_results and not normalized_results and not winner_selection:
        raise ValueError("selection_results did not contain any numeric outcomes")

    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT id, event_name, selection
            FROM prediction_log
            WHERE sport = ? AND event_id = ?
            ORDER BY id ASC
            """,
            (sport, event_id),
        ).fetchall()

        if not rows:
            raise ValueError("no logged predictions found for sport/event_id")

        inferred_event_name = event_name or (rows[0]["event_name"] if rows else "")
        matched_predictions = 0
        matched_winner = 0

        if normalized_results:
            for row in rows:
                outcome = normalized_results.get(row["selection"].casefold())
                if outcome is None:
                    continue

                matched_predictions += 1
                status = _result_status(outcome)
                conn.execute(
                    """
                    UPDATE prediction_log
                    SET actual_outcome = ?, result_status = ?, settled_at = ?
                    WHERE id = ?
                    """,
                    (outcome, status, completed_at, row["id"]),
                )
                if outcome >= 0.5:
                    matched_winner += 1
        else:
            winner_key = winner_selection.casefold()
            for row in rows:
                outcome = 1.0 if row["selection"].casefold() == winner_key else 0.0
                if outcome == 1.0:
                    matched_winner += 1

                matched_predictions += 1
                conn.execute(
                    """
                    UPDATE prediction_log
                    SET actual_outcome = ?, result_status = ?, settled_at = ?
                    WHERE id = ?
                    """,
                    (outcome, _result_status(outcome), completed_at, row["id"]),
                )

        if rows and matched_predictions == 0:
            raise ValueError("result did not match any logged prediction selections")
        if rows and winner_selection and matched_winner == 0:
            raise ValueError("winner_selection did not match any logged prediction selection")

        _settle_paper_bets_for_event(conn, sport, event_id, completed_at)

        conn.execute(
            """
            INSERT INTO prediction_results (
                created_at,
                updated_at,
                completed_at,
                sport,
                event_id,
                event_name,
                winner_selection,
                result_payload_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(sport, event_id) DO UPDATE SET
                updated_at = excluded.updated_at,
                completed_at = excluded.completed_at,
                event_name = excluded.event_name,
                winner_selection = excluded.winner_selection,
                result_payload_json = excluded.result_payload_json
            """,
            (
                updated_at,
                updated_at,
                completed_at,
                sport,
                event_id,
                inferred_event_name,
                winner_selection,
                _dumps_json(result_payload or {}),
            ),
        )
        conn.commit()

        result_row = conn.execute(
            """
            SELECT
                id,
                created_at,
                updated_at,
                completed_at,
                sport,
                event_id,
                event_name,
                winner_selection,
                result_payload_json
            FROM prediction_results
            WHERE sport = ? AND event_id = ?
            """,
            (sport, event_id),
        ).fetchone()

    result = _row_to_result(result_row)
    result["matched_predictions"] = matched_predictions
    result["matched_winner_predictions"] = matched_winner
    return result


def get_recent_results(limit: int = 50) -> List[Dict[str, Any]]:
    limit = max(1, min(int(limit), 200))
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT
                id,
                created_at,
                updated_at,
                completed_at,
                sport,
                event_id,
                event_name,
                winner_selection,
                result_payload_json
            FROM prediction_results
            ORDER BY completed_at DESC, id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return [_row_to_result(row) for row in rows]


def create_paper_bet(
    sport: str,
    event_id: str,
    event_name: str,
    selection: str,
    stake: float,
    odds: Optional[float] = None,
    bet_type: str = "win",
    notes: Optional[str] = None,
    prediction_log_id: Optional[int] = None,
) -> Dict[str, Any]:
    sport = sport.strip().lower()
    event_id = event_id.strip()
    event_name = event_name.strip()
    selection = selection.strip()
    bet_type = bet_type.strip().lower() or "win"
    stake = float(stake)
    odds = _optional_float(odds)

    if not sport or not event_id or not selection:
        raise ValueError("sport, event_id, and selection are required")
    if stake <= 0:
        raise ValueError("stake must be greater than zero")

    created_at = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        prediction = _find_prediction_for_bet(conn, sport, event_id, selection, prediction_log_id)
        if prediction:
            event_name = event_name or prediction["event_name"]
            odds = odds if odds and odds > 1 else _optional_float(prediction["fair_odds"])

        if odds is None or odds <= 1:
            raise ValueError("odds must be greater than 1")

        status = "PENDING"
        payout = None
        profit = None
        settled_at = None
        if prediction and prediction["actual_outcome"] is not None:
            status, payout, profit = _bet_settlement(stake, odds, float(prediction["actual_outcome"]))
            settled_at = prediction["settled_at"] or created_at

        cursor = conn.execute(
            """
            INSERT INTO paper_bet_log (
                created_at,
                updated_at,
                settled_at,
                prediction_log_id,
                sport,
                event_id,
                event_name,
                selection,
                bet_type,
                odds,
                stake,
                status,
                payout,
                profit,
                notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                created_at,
                created_at,
                settled_at,
                prediction["id"] if prediction else prediction_log_id,
                sport,
                event_id,
                event_name,
                selection,
                bet_type,
                odds,
                stake,
                status,
                payout,
                profit,
                notes,
            ),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT *
            FROM paper_bet_log
            WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()

    return _row_to_paper_bet(row)


def get_paper_bets(
    status: Optional[str] = None,
    sport: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    limit = max(1, min(int(limit), 200))
    status = status.strip().upper() if status else None
    sport = sport.strip().lower() if sport else None
    conditions = []
    params = []

    if status and status != "ALL":
        conditions.append("status = ?")
        params.append(status)
    if sport and sport != "all":
        conditions.append("sport = ?")
        params.append(sport)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    with _connect() as conn:
        rows = conn.execute(
            f"""
            SELECT *
            FROM paper_bet_log
            {where_clause}
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            (*params, limit),
        ).fetchall()

    return [_row_to_paper_bet(row) for row in rows]


def get_paper_bet_summary(sport: Optional[str] = None) -> Dict[str, Any]:
    sport = sport.strip().lower() if sport else None
    with _connect() as conn:
        if sport and sport != "all":
            rows = conn.execute("SELECT * FROM paper_bet_log WHERE sport = ?", (sport,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM paper_bet_log").fetchall()

    bets = [_row_to_paper_bet(row) for row in rows]
    total_bets = len(bets)
    pending_bets = sum(1 for bet in bets if bet["status"] == "PENDING")
    won_bets = sum(1 for bet in bets if bet["status"] == "WON")
    lost_bets = sum(1 for bet in bets if bet["status"] == "LOST")
    void_bets = sum(1 for bet in bets if bet["status"] == "VOID")
    decision_bets = won_bets + lost_bets
    settled_bets = total_bets - pending_bets
    total_staked = sum(bet["stake"] for bet in bets)
    pending_exposure = sum(bet["stake"] for bet in bets if bet["status"] == "PENDING")
    settled_staked = sum(bet["stake"] for bet in bets if bet["status"] in {"WON", "LOST"})
    total_returned = sum(bet["payout"] or 0.0 for bet in bets if bet["status"] in {"WON", "LOST"})
    net_profit = sum(bet["profit"] or 0.0 for bet in bets if bet["status"] != "PENDING")

    return {
        "sport": sport or "all",
        "total_bets": total_bets,
        "pending_bets": pending_bets,
        "settled_bets": settled_bets,
        "won_bets": won_bets,
        "lost_bets": lost_bets,
        "void_bets": void_bets,
        "total_staked": round(total_staked, 2),
        "settled_staked": round(settled_staked, 2),
        "pending_exposure": round(pending_exposure, 2),
        "total_returned": round(total_returned, 2),
        "net_profit": round(net_profit, 2),
        "roi": round(net_profit / settled_staked, 4) if settled_staked > 0 else 0.0,
        "win_rate": round(won_bets / decision_bets, 4) if decision_bets > 0 else 0.0,
    }


def settle_paper_bet(
    bet_id: int,
    status: str,
    payout: Optional[float] = None,
) -> Dict[str, Any]:
    status = status.strip().upper()
    if status not in {"WON", "LOST", "VOID"}:
        raise ValueError("status must be WON, LOST, or VOID")

    updated_at = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        row = conn.execute("SELECT * FROM paper_bet_log WHERE id = ?", (bet_id,)).fetchone()
        if not row:
            raise ValueError("paper bet not found")

        stake = float(row["stake"])
        odds = float(row["odds"])
        if status == "WON":
            settled_payout = _optional_float(payout)
            if settled_payout is None:
                settled_payout = stake * odds
        elif status == "VOID":
            settled_payout = stake
        else:
            settled_payout = 0.0

        profit = settled_payout - stake
        conn.execute(
            """
            UPDATE paper_bet_log
            SET updated_at = ?, settled_at = ?, status = ?, payout = ?, profit = ?
            WHERE id = ?
            """,
            (updated_at, updated_at, status, settled_payout, profit, bet_id),
        )
        conn.commit()
        updated_row = conn.execute("SELECT * FROM paper_bet_log WHERE id = ?", (bet_id,)).fetchone()

    return _row_to_paper_bet(updated_row)


def delete_paper_bet(bet_id: int) -> bool:
    with _connect() as conn:
        cursor = conn.execute("DELETE FROM paper_bet_log WHERE id = ?", (bet_id,))
        conn.commit()
        return cursor.rowcount > 0


def get_prediction_summary() -> List[Dict[str, Any]]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT
                sport,
                COUNT(*) AS prediction_count,
                COUNT(actual_outcome) AS settled_count,
                SUM(CASE WHEN result_status = 'win' THEN 1 ELSE 0 END) AS winning_count,
                COUNT(DISTINCT event_id) AS event_count,
                MAX(COALESCE(updated_at, created_at)) AS latest_at,
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
            "settled_count": int(row["settled_count"]),
            "winning_count": int(row["winning_count"] or 0),
            "event_count": int(row["event_count"]),
            "latest_at": row["latest_at"],
            "avg_probability": round(float(row["avg_probability"] or 0.0), 2),
        }
        for row in rows
    ]


def get_prediction_accuracy(sport: Optional[str] = None) -> Dict[str, Any]:
    sport = sport.strip().lower() if sport else None
    with _connect() as conn:
        if sport:
            rows = conn.execute(
                """
                SELECT
                    id,
                    sport,
                    event_id,
                    event_name,
                    selection,
                    probability,
                    fair_odds,
                    actual_outcome,
                    settled_at,
                    result_status
                FROM prediction_log
                WHERE sport = ? AND actual_outcome IS NOT NULL
                ORDER BY settled_at DESC, id DESC
                """,
                (sport,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT
                    id,
                    sport,
                    event_id,
                    event_name,
                    selection,
                    probability,
                    fair_odds,
                    actual_outcome,
                    settled_at,
                    result_status
                FROM prediction_log
                WHERE actual_outcome IS NOT NULL
                ORDER BY settled_at DESC, id DESC
                """
            ).fetchall()

    summary = _compute_accuracy_metrics(rows, sport or "all")
    if sport:
        summary["by_sport"] = [summary.copy()] if rows else []
    else:
        by_sport = []
        for sport_name in sorted({row["sport"] for row in rows}):
            sport_rows = [row for row in rows if row["sport"] == sport_name]
            by_sport.append(_compute_accuracy_metrics(sport_rows, sport_name))
        summary["by_sport"] = by_sport

    return summary


def get_prediction_accuracy_trend(sport: Optional[str] = None, days: int = 30) -> List[Dict[str, Any]]:
    sport = sport.strip().lower() if sport else None
    days = max(1, min(int(days), 365))
    with _connect() as conn:
        if sport:
            rows = conn.execute(
                """
                SELECT
                    id,
                    sport,
                    event_id,
                    probability,
                    fair_odds,
                    actual_outcome,
                    settled_at
                FROM prediction_log
                WHERE sport = ? AND actual_outcome IS NOT NULL AND settled_at IS NOT NULL
                ORDER BY settled_at ASC, id ASC
                """,
                (sport,),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT
                    id,
                    sport,
                    event_id,
                    probability,
                    fair_odds,
                    actual_outcome,
                    settled_at
                FROM prediction_log
                WHERE actual_outcome IS NOT NULL AND settled_at IS NOT NULL
                ORDER BY settled_at ASC, id ASC
                """
            ).fetchall()

    buckets = {}
    for row in rows:
        settled_at = row["settled_at"] or ""
        day = settled_at[:10]
        if len(day) != 10:
            continue

        probability = _probability_fraction(row["probability"])
        outcome = max(0.0, min(float(row["actual_outcome"]), 1.0))
        bucket = buckets.setdefault(day, {
            "date": day,
            "settled_predictions": 0,
            "brier_sum": 0.0,
            "log_loss_sum": 0.0,
            "events": {},
        })
        bucket["settled_predictions"] += 1
        bucket["brier_sum"] += (probability - outcome) ** 2
        bucket["log_loss_sum"] += _log_loss(probability, outcome)
        bucket["events"].setdefault((row["sport"], row["event_id"]), []).append(row)

    trend = []
    for day, bucket in sorted(buckets.items()):
        top_picks = [
            max(event_rows, key=lambda row: (_probability_fraction(row["probability"]), row["id"]))
            for event_rows in bucket["events"].values()
        ]
        top_pick_wins = sum(1 for row in top_picks if float(row["actual_outcome"]) >= 1.0)
        paper_bet_profits = [
            profit
            for profit in [_paper_bet_profit(row) for row in top_picks]
            if profit is not None
        ]
        settled_events = len(top_picks)
        settled_predictions = bucket["settled_predictions"]

        trend.append({
            "date": day,
            "sport": sport or "all",
            "settled_predictions": settled_predictions,
            "settled_events": settled_events,
            "top_pick_wins": top_pick_wins,
            "hit_rate": round(top_pick_wins / settled_events, 4) if settled_events else 0.0,
            "paper_bets": len(paper_bet_profits),
            "paper_profit": round(sum(paper_bet_profits), 4),
            "paper_roi": round(sum(paper_bet_profits) / len(paper_bet_profits), 4) if paper_bet_profits else 0.0,
            "brier_score": round(bucket["brier_sum"] / settled_predictions, 4) if settled_predictions else 0.0,
            "log_loss": round(bucket["log_loss_sum"] / settled_predictions, 4) if settled_predictions else 0.0,
        })

    return trend[-days:]


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
        """
    )
    _ensure_column(conn, "prediction_log", "updated_at", "TEXT")
    _ensure_column(conn, "prediction_log", "actual_outcome", "REAL")
    _ensure_column(conn, "prediction_log", "result_status", "TEXT")
    _ensure_column(conn, "prediction_log", "settled_at", "TEXT")
    conn.execute(
        """
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
        """
    )
    conn.execute(
        """
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
        """
    )
    _dedupe_prediction_log(conn)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_sport ON prediction_log (sport)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_event ON prediction_log (sport, event_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_created_at ON prediction_log (created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_settled_at ON prediction_log (settled_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_paper_bet_log_status ON paper_bet_log (status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_paper_bet_log_event ON paper_bet_log (sport, event_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_paper_bet_log_created_at ON paper_bet_log (created_at)")
    conn.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_prediction_log_unique_selection
        ON prediction_log (sport, event_id, selection)
        """
    )
    conn.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_prediction_results_unique_event
        ON prediction_results (sport, event_id)
        """
    )
    conn.commit()


def _row_to_prediction(row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "sport": row["sport"],
        "event_id": row["event_id"],
        "event_name": row["event_name"],
        "selection": row["selection"],
        "probability": row["probability"],
        "fair_odds": row["fair_odds"],
        "actual_outcome": row["actual_outcome"],
        "result_status": row["result_status"],
        "settled_at": row["settled_at"],
        "payload": _loads_json(row["payload_json"]),
        "feature_impact": _loads_json(row["feature_impact_json"]),
    }


def _row_to_result(row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "completed_at": row["completed_at"],
        "sport": row["sport"],
        "event_id": row["event_id"],
        "event_name": row["event_name"],
        "winner_selection": row["winner_selection"],
        "payload": _loads_json(row["result_payload_json"]),
    }


def _row_to_paper_bet(row) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "settled_at": row["settled_at"],
        "prediction_log_id": row["prediction_log_id"],
        "sport": row["sport"],
        "event_id": row["event_id"],
        "event_name": row["event_name"],
        "selection": row["selection"],
        "bet_type": row["bet_type"],
        "odds": float(row["odds"]),
        "stake": float(row["stake"]),
        "status": row["status"],
        "payout": _optional_float(row["payout"]),
        "profit": _optional_float(row["profit"]),
        "notes": row["notes"],
    }


def _compute_accuracy_metrics(rows, sport: str) -> Dict[str, Any]:
    rows = list(rows)
    if not rows:
        return {
            "sport": sport,
            "settled_predictions": 0,
            "settled_events": 0,
            "top_pick_wins": 0,
            "hit_rate": 0.0,
            "paper_bets": 0,
            "paper_profit": 0.0,
            "paper_roi": 0.0,
            "brier_score": 0.0,
            "log_loss": 0.0,
            "avg_confidence": 0.0,
            "avg_winner_probability": 0.0,
            "calibration_error": 0.0,
            "latest_settled_at": None,
            "calibration": [],
        }

    probabilities = [_probability_fraction(row["probability"]) for row in rows]
    outcomes = [max(0.0, min(float(row["actual_outcome"]), 1.0)) for row in rows]
    brier_score = _mean([(prob - outcome) ** 2 for prob, outcome in zip(probabilities, outcomes)])
    log_loss = _mean([_log_loss(prob, outcome) for prob, outcome in zip(probabilities, outcomes)])

    events = {}
    for row in rows:
        events.setdefault((row["sport"], row["event_id"]), []).append(row)

    top_picks = [
        max(event_rows, key=lambda row: (_probability_fraction(row["probability"]), row["id"]))
        for event_rows in events.values()
    ]
    top_pick_wins = sum(1 for row in top_picks if float(row["actual_outcome"]) >= 1.0)
    paper_bet_profits = [
        profit
        for profit in [_paper_bet_profit(row) for row in top_picks]
        if profit is not None
    ]
    event_confidences = [_probability_fraction(row["probability"]) for row in top_picks]
    winner_probabilities = [
        _probability_fraction(row["probability"])
        for row in rows
        if float(row["actual_outcome"]) >= 1.0
    ]
    calibration = _calibration_buckets(rows)
    calibration_error = sum(
        bucket["count"] / len(rows) * abs(bucket["avg_predicted"] - bucket["observed_rate"])
        for bucket in calibration
    )
    settled_times = [row["settled_at"] for row in rows if row["settled_at"]]

    return {
        "sport": sport,
        "settled_predictions": len(rows),
        "settled_events": len(events),
        "top_pick_wins": top_pick_wins,
        "hit_rate": round(top_pick_wins / len(events), 4) if events else 0.0,
        "paper_bets": len(paper_bet_profits),
        "paper_profit": round(sum(paper_bet_profits), 4),
        "paper_roi": round(sum(paper_bet_profits) / len(paper_bet_profits), 4) if paper_bet_profits else 0.0,
        "brier_score": round(brier_score, 4),
        "log_loss": round(log_loss, 4),
        "avg_confidence": round(_mean(event_confidences), 4),
        "avg_winner_probability": round(_mean(winner_probabilities), 4),
        "calibration_error": round(calibration_error, 4),
        "latest_settled_at": max(settled_times) if settled_times else None,
        "calibration": calibration,
    }


def _calibration_buckets(rows) -> List[Dict[str, Any]]:
    buckets = {}
    for row in rows:
        probability = _probability_fraction(row["probability"])
        outcome = max(0.0, min(float(row["actual_outcome"]), 1.0))
        bucket_floor = min(int(probability * 5) * 20, 80)
        bucket_key = f"{bucket_floor}-{bucket_floor + 20}%"
        bucket = buckets.setdefault(bucket_floor, {"bucket": bucket_key, "count": 0, "predicted_sum": 0.0, "outcome_sum": 0.0})
        bucket["count"] += 1
        bucket["predicted_sum"] += probability
        bucket["outcome_sum"] += outcome

    return [
        {
            "bucket": bucket["bucket"],
            "count": bucket["count"],
            "avg_predicted": round(bucket["predicted_sum"] / bucket["count"], 4),
            "observed_rate": round(bucket["outcome_sum"] / bucket["count"], 4),
        }
        for _, bucket in sorted(buckets.items())
    ]


def _normalize_selection_results(selection_results: Optional[Dict[str, Any]]) -> Dict[str, float]:
    if not selection_results:
        return {}

    normalized = {}
    for selection, value in selection_results.items():
        try:
            outcome = max(0.0, min(float(value), 1.0))
        except (TypeError, ValueError):
            continue
        normalized[str(selection).casefold()] = outcome

    return normalized


def _result_status(outcome: float) -> str:
    if outcome >= 1.0:
        return "win"
    if outcome <= 0.0:
        return "loss"

    return "push"


def _probability_fraction(value) -> float:
    probability = _optional_float(value) or 0.0
    if probability > 1:
        probability = probability / 100

    return max(0.0, min(probability, 1.0))


def _log_loss(probability: float, outcome: float) -> float:
    probability = max(1e-15, min(probability, 1 - 1e-15))
    return -((outcome * math.log(probability)) + ((1 - outcome) * math.log(1 - probability)))


def _paper_bet_profit(row) -> Optional[float]:
    fair_odds = _optional_float(row["fair_odds"])
    if fair_odds is None or fair_odds <= 1:
        return None

    outcome = max(0.0, min(float(row["actual_outcome"]), 1.0))
    return (outcome * fair_odds) - 1


def _find_prediction_for_bet(conn, sport: str, event_id: str, selection: str, prediction_log_id: Optional[int] = None):
    if prediction_log_id is not None:
        row = conn.execute(
            """
            SELECT *
            FROM prediction_log
            WHERE id = ?
            """,
            (prediction_log_id,),
        ).fetchone()
        if (
            row
            and row["sport"] == sport
            and row["event_id"] == event_id
            and row["selection"].casefold() == selection.casefold()
        ):
            return row

    return conn.execute(
        """
        SELECT *
        FROM prediction_log
        WHERE sport = ? AND event_id = ? AND lower(selection) = lower(?)
        ORDER BY id DESC
        LIMIT 1
        """,
        (sport, event_id, selection),
    ).fetchone()


def _settle_paper_bets_for_event(conn, sport: str, event_id: str, settled_at: str) -> None:
    rows = conn.execute(
        """
        SELECT *
        FROM paper_bet_log
        WHERE sport = ? AND event_id = ? AND status = 'PENDING'
        """,
        (sport, event_id),
    ).fetchall()

    for bet in rows:
        prediction = _find_prediction_for_bet(
            conn,
            sport,
            event_id,
            bet["selection"],
            bet["prediction_log_id"],
        )
        if not prediction or prediction["actual_outcome"] is None:
            continue

        status, payout, profit = _bet_settlement(
            float(bet["stake"]),
            float(bet["odds"]),
            float(prediction["actual_outcome"]),
        )
        conn.execute(
            """
            UPDATE paper_bet_log
            SET updated_at = ?, settled_at = ?, prediction_log_id = ?, status = ?, payout = ?, profit = ?
            WHERE id = ?
            """,
            (settled_at, settled_at, prediction["id"], status, payout, profit, bet["id"]),
        )


def _bet_settlement(stake: float, odds: float, outcome: float):
    if outcome >= 1.0:
        payout = stake * odds
        return "WON", payout, payout - stake
    if outcome <= 0.0:
        return "LOST", 0.0, -stake

    return "VOID", stake, 0.0


def _mean(values: List[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _ensure_column(conn, table_name: str, column_name: str, column_type: str) -> None:
    columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()}
    if column_name not in columns:
        conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")


def _dedupe_prediction_log(conn) -> None:
    conn.execute(
        """
        DELETE FROM prediction_log
        WHERE id NOT IN (
            SELECT MAX(id)
            FROM prediction_log
            GROUP BY sport, event_id, selection
        )
        """
    )


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
