import json
import math
import os
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Union

from app.database import get_connection, init_database
from app.time_utils import is_melbourne_premium_day, today_melbourne


CONFIDENCE_ORDER = {"low": 0, "medium": 1, "high": 2}
ALLOWED_MARKETS = {"win", "place", "quinella", "head_to_head"}
DEFAULT_STANDARD_BANKROLL = 250.0
DEFAULT_PREMIUM_BANKROLL = 500.0
DEFAULT_STRATEGY_PROFILES = [
    {
        "profile_key": "bob",
        "display_name": "Betmate Bob",
        "is_editable": False,
        "rule_set": {
            "profile_key": "bob",
            "display_name": "Betmate Bob",
            "min_edge": 0.05,
            "min_confidence": "medium",
            "max_bets_per_day": 5,
            "max_stake_per_bet": 60.0,
            "kelly_fraction": 0.25,
            "allowed_markets": ["win", "place", "quinella", "head_to_head"],
            "allow_multis": True,
            "max_multi_legs": 2,
            "sport_weights": {"racing": 0.45, "afl": 0.275, "nba": 0.275},
            "notes": "Balanced. Flagship profile.",
        },
    },
    {
        "profile_key": "james",
        "display_name": "James",
        "is_editable": True,
        "rule_set": {
            "profile_key": "james",
            "display_name": "James",
            "min_edge": 0.08,
            "min_confidence": "medium",
            "max_bets_per_day": 8,
            "max_stake_per_bet": 80.0,
            "kelly_fraction": 0.35,
            "allowed_markets": ["win", "place", "quinella", "head_to_head"],
            "allow_multis": True,
            "max_multi_legs": 3,
            "sport_weights": {"racing": 0.4, "afl": 0.3, "nba": 0.3},
            "notes": "High action. Editable by admin.",
        },
    },
    {
        "profile_key": "conservative",
        "display_name": "Conservative",
        "is_editable": False,
        "rule_set": {
            "profile_key": "conservative",
            "display_name": "Conservative",
            "min_edge": 0.10,
            "min_confidence": "high",
            "max_bets_per_day": 3,
            "max_stake_per_bet": 35.0,
            "kelly_fraction": 0.15,
            "allowed_markets": ["win", "head_to_head"],
            "allow_multis": False,
            "max_multi_legs": 1,
            "sport_weights": {"racing": 0.5, "afl": 0.25, "nba": 0.25},
            "notes": "Low variance. Top confidence only.",
        },
    },
    {
        "profile_key": "neutral",
        "display_name": "Neutral",
        "is_editable": False,
        "rule_set": {
            "profile_key": "neutral",
            "display_name": "Neutral",
            "min_edge": 0.06,
            "min_confidence": "medium",
            "max_bets_per_day": 4,
            "max_stake_per_bet": 50.0,
            "kelly_fraction": 0.20,
            "allowed_markets": ["win", "place", "head_to_head"],
            "allow_multis": False,
            "max_multi_legs": 1,
            "sport_weights": {"racing": 0.45, "afl": 0.275, "nba": 0.275},
            "notes": "Disciplined. No multis.",
        },
    },
    {
        "profile_key": "aggressive",
        "display_name": "Aggressive",
        "is_editable": False,
        "rule_set": {
            "profile_key": "aggressive",
            "display_name": "Aggressive",
            "min_edge": 0.04,
            "min_confidence": "low",
            "max_bets_per_day": 10,
            "max_stake_per_bet": 90.0,
            "kelly_fraction": 0.50,
            "allowed_markets": ["win", "place", "quinella", "head_to_head"],
            "allow_multis": True,
            "max_multi_legs": 4,
            "sport_weights": {"racing": 0.4, "afl": 0.3, "nba": 0.3},
            "notes": "High action, wider net.",
        },
    },
]


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
        _settle_system_bets_for_event(conn, sport, event_id, completed_at)

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
    origin: str = "user",
    system_bet_id: Optional[int] = None,
    user_id: str = "legacy",
) -> Dict[str, Any]:
    user_id = (user_id or "").strip()
    sport = sport.strip().lower()
    event_id = event_id.strip()
    event_name = event_name.strip()
    selection = selection.strip()
    bet_type = bet_type.strip().lower() or "win"
    origin = (origin or "user").strip().lower()
    stake = float(stake)
    odds = _optional_float(odds)

    if not user_id:
        raise ValueError("user_id is required")
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
                user_id,
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
                origin,
                system_bet_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                created_at,
                created_at,
                settled_at,
                prediction["id"] if prediction else prediction_log_id,
                user_id,
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
                origin,
                system_bet_id,
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
    user_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    limit = max(1, min(int(limit), 200))
    status = status.strip().upper() if status else None
    sport = sport.strip().lower() if sport else None
    conditions = []
    params = []
    if user_id:
        conditions.append("user_id = ?")
        params.append(user_id)

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


def get_paper_bet_summary(sport: Optional[str] = None, user_id: Optional[str] = None) -> Dict[str, Any]:
    sport = sport.strip().lower() if sport else None
    conditions = []
    params: list = []
    if user_id:
        conditions.append("user_id = ?")
        params.append(user_id)
    if sport and sport != "all":
        conditions.append("sport = ?")
        params.append(sport)

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    with _connect() as conn:
        row = conn.execute(
            f"""
            SELECT
                COUNT(*) AS total_bets,
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending_bets,
                SUM(CASE WHEN status = 'WON' THEN 1 ELSE 0 END) AS won_bets,
                SUM(CASE WHEN status = 'LOST' THEN 1 ELSE 0 END) AS lost_bets,
                SUM(CASE WHEN status = 'VOID' THEN 1 ELSE 0 END) AS void_bets,
                COALESCE(SUM(stake), 0.0) AS total_staked,
                COALESCE(SUM(CASE WHEN status = 'PENDING' THEN stake ELSE 0 END), 0.0) AS pending_exposure,
                COALESCE(SUM(CASE WHEN status IN ('WON', 'LOST') THEN stake ELSE 0 END), 0.0) AS settled_staked,
                COALESCE(SUM(CASE WHEN status IN ('WON', 'LOST') THEN COALESCE(payout, 0) ELSE 0 END), 0.0) AS total_returned,
                COALESCE(SUM(CASE WHEN status != 'PENDING' THEN COALESCE(profit, 0) ELSE 0 END), 0.0) AS net_profit
            FROM paper_bet_log
            {where_clause}
            """,
            tuple(params),
        ).fetchone()

    total_bets = int(row["total_bets"] or 0)
    pending_bets = int(row["pending_bets"] or 0)
    won_bets = int(row["won_bets"] or 0)
    lost_bets = int(row["lost_bets"] or 0)
    void_bets = int(row["void_bets"] or 0)
    settled_bets = total_bets - pending_bets
    decision_bets = won_bets + lost_bets
    total_staked = float(row["total_staked"])
    pending_exposure = float(row["pending_exposure"])
    settled_staked = float(row["settled_staked"])
    total_returned = float(row["total_returned"])
    net_profit = float(row["net_profit"])

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


def get_paper_bet_trend(sport: Optional[str] = None, days: int = 30, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    sport = sport.strip().lower() if sport else None
    days = max(1, min(int(days), 365))
    conditions = ["status != 'PENDING'", "settled_at IS NOT NULL"]
    params = []
    if user_id:
        conditions.append("user_id = ?")
        params.append(user_id)

    if sport and sport != "all":
        conditions.append("sport = ?")
        params.append(sport)

    with _connect() as conn:
        rows = conn.execute(
            f"""
            SELECT *
            FROM paper_bet_log
            WHERE {' AND '.join(conditions)}
            ORDER BY settled_at ASC, id ASC
            """,
            tuple(params),
        ).fetchall()

    buckets = {}
    for bet in [_row_to_paper_bet(row) for row in rows]:
        settled_at = bet["settled_at"] or ""
        day = settled_at[:10]
        if len(day) != 10:
            continue

        bucket = buckets.setdefault(day, {
            "date": day,
            "settled_bets": 0,
            "decision_bets": 0,
            "settled_staked": 0.0,
            "total_returned": 0.0,
            "net_profit": 0.0,
        })
        bucket["settled_bets"] += 1
        bucket["net_profit"] += bet["profit"] or 0.0

        if bet["status"] in {"WON", "LOST"}:
            bucket["decision_bets"] += 1
            bucket["settled_staked"] += bet["stake"]
            bucket["total_returned"] += bet["payout"] or 0.0

    trend = []
    cumulative_staked = 0.0
    cumulative_profit = 0.0
    for day, bucket in sorted(buckets.items()):
        settled_staked = bucket["settled_staked"]
        net_profit = bucket["net_profit"]
        cumulative_staked += settled_staked
        cumulative_profit += net_profit
        trend.append({
            "date": day,
            "sport": sport or "all",
            "settled_bets": bucket["settled_bets"],
            "decision_bets": bucket["decision_bets"],
            "settled_staked": round(settled_staked, 2),
            "total_returned": round(bucket["total_returned"], 2),
            "net_profit": round(net_profit, 2),
            "roi": round(net_profit / settled_staked, 4) if settled_staked > 0 else 0.0,
            "cumulative_staked": round(cumulative_staked, 2),
            "cumulative_profit": round(cumulative_profit, 2),
            "cumulative_roi": round(cumulative_profit / cumulative_staked, 4) if cumulative_staked > 0 else 0.0,
        })

    return trend[-days:]


def settle_paper_bet(
    bet_id: int,
    status: str,
    payout: Optional[float] = None,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    status = status.strip().upper()
    if status not in {"WON", "LOST", "VOID"}:
        raise ValueError("status must be WON, LOST, or VOID")

    updated_at = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        if user_id:
            row = conn.execute("SELECT * FROM paper_bet_log WHERE id = ? AND user_id = ?", (bet_id, user_id)).fetchone()
        else:
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
            WHERE id = ? AND (? IS NULL OR user_id = ?)
            """,
            (updated_at, updated_at, status, settled_payout, profit, bet_id, user_id, user_id),
        )
        conn.commit()
        if user_id:
            updated_row = conn.execute("SELECT * FROM paper_bet_log WHERE id = ? AND user_id = ?", (bet_id, user_id)).fetchone()
        else:
            updated_row = conn.execute("SELECT * FROM paper_bet_log WHERE id = ?", (bet_id,)).fetchone()

    return _row_to_paper_bet(updated_row)


def delete_paper_bet(bet_id: int, user_id: Optional[str] = None) -> bool:
    with _connect() as conn:
        if user_id:
            cursor = conn.execute("DELETE FROM paper_bet_log WHERE id = ? AND user_id = ?", (bet_id, user_id))
        else:
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


def ensure_default_strategy_profiles() -> None:
    with _connect() as conn:
        rows = conn.execute("SELECT profile_key FROM strategy_profiles").fetchall()
        existing = {row["profile_key"] for row in rows}
        created_at = datetime.now(timezone.utc).isoformat()
        for profile in DEFAULT_STRATEGY_PROFILES:
            if profile["profile_key"] in existing:
                continue
            conn.execute(
                """
                INSERT INTO strategy_profiles (
                    profile_key,
                    display_name,
                    rule_set_json,
                    is_editable,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    profile["profile_key"],
                    profile["display_name"],
                    _dumps_json(profile["rule_set"]),
                    bool(profile["is_editable"]),
                    created_at,
                    created_at,
                ),
            )
        conn.commit()


def list_strategy_profiles() -> List[Dict[str, Any]]:
    ensure_default_strategy_profiles()
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM strategy_profiles
            ORDER BY id ASC
            """
        ).fetchall()
    return [_row_to_strategy_profile(row) for row in rows]


def get_strategy_profile(profile_key: str) -> Optional[Dict[str, Any]]:
    ensure_default_strategy_profiles()
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT *
            FROM strategy_profiles
            WHERE profile_key = ?
            """,
            (profile_key,),
        ).fetchone()
    return _row_to_strategy_profile(row) if row else None


def update_strategy_profile(profile_key: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    existing = get_strategy_profile(profile_key)
    if not existing:
        raise ValueError("strategy profile not found")
    if not existing["is_editable"] or profile_key != "james":
        raise ValueError("only the james profile is editable")

    rule_set = {**existing["rule_set"], **updates}
    _validate_rule_set(rule_set)

    updated_at = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        conn.execute(
            """
            UPDATE strategy_profiles
            SET display_name = ?, rule_set_json = ?, updated_at = ?
            WHERE profile_key = ?
            """,
            (
                str(rule_set["display_name"]),
                _dumps_json(rule_set),
                updated_at,
                profile_key,
            ),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM strategy_profiles WHERE profile_key = ?",
            (profile_key,),
        ).fetchone()
    return _row_to_strategy_profile(row)


def get_strategy_card(profile_key: str, run_date: str) -> Optional[Dict[str, Any]]:
    with _connect() as conn:
        row = conn.execute(
            """
            SELECT *
            FROM daily_strategy_runs
            WHERE profile_key = ? AND run_date = ?
            """,
            (profile_key, run_date),
        ).fetchone()
        if not row:
            return None
        return _hydrate_strategy_card(conn, row)


def get_strategy_cards(run_date: str) -> List[Dict[str, Any]]:
    ensure_default_strategy_profiles()
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM daily_strategy_runs
            WHERE run_date = ?
            ORDER BY id ASC
            """,
            (run_date,),
        ).fetchall()
        return [_hydrate_strategy_card(conn, row) for row in rows]


def save_strategy_card(card: Dict[str, Any], replace: bool = False) -> Dict[str, Any]:
    ensure_default_strategy_profiles()
    profile_key = str(card["profile_key"])
    run_date = str(card["card_date"])
    existing = get_strategy_card(profile_key, run_date)
    if existing and not replace:
        return existing

    run_payload = {
        "bankroll_available": card["bankroll_available"],
        "skipped_opportunities": card.get("skipped_opportunities", []),
        "sport_mix": card.get("sport_mix", {}),
        "expected_edge": card.get("expected_edge", 0.0),
        "selected_bets": card.get("selected_bets", []),
    }
    created_at = datetime.now(timezone.utc).isoformat()
    bankroll_standard = float(card.get("bankroll_standard", DEFAULT_STANDARD_BANKROLL))
    bankroll_premium = float(card.get("bankroll_premium", DEFAULT_PREMIUM_BANKROLL))

    with _connect() as conn:
        existing_run_row = conn.execute(
            """
            SELECT *
            FROM daily_strategy_runs
            WHERE profile_key = ? AND run_date = ?
            """,
            (profile_key, run_date),
        ).fetchone()
        if existing_run_row and replace:
            conn.execute(
                """
                UPDATE paper_bet_log
                SET system_bet_id = NULL
                WHERE system_bet_id IN (
                    SELECT id
                    FROM system_bets
                    WHERE run_id = ?
                )
                """,
                (existing_run_row["id"],),
            )
            conn.execute(
                """
                DELETE FROM system_bets
                WHERE run_id = ?
                """,
                (existing_run_row["id"],),
            )
            conn.execute(
                """
                UPDATE daily_strategy_runs
                SET bankroll_standard = ?,
                    bankroll_premium = ?,
                    total_allocated = ?,
                    candidate_count = ?,
                    selected_count = ?,
                    skipped_count = ?,
                    run_payload_json = ?,
                    created_at = ?
                WHERE id = ?
                """,
                (
                    bankroll_standard,
                    bankroll_premium,
                    float(card.get("total_allocated", 0.0)),
                    int(card.get("candidate_count", 0)),
                    len(card.get("selected_bets", [])),
                    len(card.get("skipped_opportunities", [])),
                    _dumps_json(run_payload),
                    created_at,
                    existing_run_row["id"],
                ),
            )
        else:
            conn.execute(
                """
                INSERT INTO daily_strategy_runs (
                    profile_key,
                    run_date,
                    bankroll_standard,
                    bankroll_premium,
                    total_allocated,
                    candidate_count,
                    selected_count,
                    skipped_count,
                    run_payload_json,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    profile_key,
                    run_date,
                    bankroll_standard,
                    bankroll_premium,
                    float(card.get("total_allocated", 0.0)),
                    int(card.get("candidate_count", 0)),
                    len(card.get("selected_bets", [])),
                    len(card.get("skipped_opportunities", [])),
                    _dumps_json(run_payload),
                    created_at,
                ),
            )

        run_row = conn.execute(
            """
            SELECT *
            FROM daily_strategy_runs
            WHERE profile_key = ? AND run_date = ?
            """,
            (profile_key, run_date),
        ).fetchone()
        run_id = run_row["id"]

        for bet in card.get("selected_bets", []):
            conn.execute(
                """
                INSERT INTO system_bets (
                    run_id,
                    profile_key,
                    sport,
                    event_id,
                    event_name,
                    market_type,
                    selection,
                    model_probability,
                    odds_used,
                    odds_source,
                    edge,
                    stake,
                    legs_json,
                    status,
                    payout,
                    profit,
                    settled_at,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run_id,
                    profile_key,
                    bet["sport"],
                    bet["event_id"],
                    bet["event_name"],
                    bet["market_type"],
                    bet["selection"],
                    float(bet["model_probability"]),
                    float(bet["odds_used"]),
                    bet["odds_source"],
                    float(bet["edge"]),
                    float(bet["stake"]),
                    _dumps_json(bet.get("legs") or []),
                    bet.get("status", "pending"),
                    _optional_float(bet.get("payout")),
                    _optional_float(bet.get("profit")),
                    bet.get("settled_at"),
                    created_at,
                ),
            )

        conn.commit()
        return _hydrate_strategy_card(conn, run_row)


def list_system_bets(profile_key: Optional[str] = None, limit: int = 200) -> List[Dict[str, Any]]:
    limit = max(1, min(int(limit), 500))
    params: list[Any] = []
    where_clause = ""
    if profile_key:
        where_clause = "WHERE profile_key = ?"
        params.append(profile_key)

    with _connect() as conn:
        rows = conn.execute(
            f"""
            SELECT *
            FROM system_bets
            {where_clause}
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            (*params, limit),
        ).fetchall()
    return [_row_to_system_bet(row) for row in rows]


def get_profile_performance(profile_key: str) -> Dict[str, Any]:
    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM system_bets
            WHERE profile_key = ?
            ORDER BY created_at ASC, id ASC
            """,
            (profile_key,),
        ).fetchall()

    bets = [_row_to_system_bet(row) for row in rows]
    settled = [bet for bet in bets if bet["status"] != "pending"]
    decision_bets = [bet for bet in bets if bet["status"] in {"won", "lost"}]
    total_staked = sum(bet["stake"] for bet in decision_bets)
    net_profit = sum((bet["profit"] or 0.0) for bet in settled)
    return {
        "profile_key": profile_key,
        "total_bets": len(bets),
        "settled_bets": len(settled),
        "won_bets": sum(1 for bet in bets if bet["status"] == "won"),
        "lost_bets": sum(1 for bet in bets if bet["status"] == "lost"),
        "void_bets": sum(1 for bet in bets if bet["status"] == "void"),
        "total_staked": round(total_staked, 2),
        "net_profit": round(net_profit, 2),
        "roi": round(net_profit / total_staked, 4) if total_staked > 0 else 0.0,
    }


def auto_tune_strategy_profile(profile_key: str, reference_date: Optional[str] = None) -> Dict[str, Any]:
    profile = get_strategy_profile(profile_key)
    if not profile:
        raise ValueError("strategy profile not found")

    effective_reference_date = reference_date or today_melbourne().isoformat()

    with _connect() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM system_bets
            WHERE profile_key = ? AND settled_at IS NOT NULL
            ORDER BY settled_at ASC, id ASC
            """,
            (profile_key,),
        ).fetchall()

    bets = [
        bet
        for bet in [_row_to_system_bet(row) for row in rows]
        if (bet["settled_at"] or "")[:10] <= effective_reference_date
    ]
    settled_days = sorted({(bet["settled_at"] or "")[:10] for bet in bets if bet.get("settled_at")})
    if len(settled_days) < 30:
        return {
            "ran": False,
            "reason": "minimum 30 settled calendar days not met",
            "settled_days": len(settled_days),
            "reference_date": effective_reference_date,
        }

    window_end = effective_reference_date
    window_start = settled_days[-30]
    window_bets = [bet for bet in bets if window_start <= (bet["settled_at"] or "")[:10] <= window_end]
    if not window_bets:
        return {
            "ran": False,
            "reason": "no settled bets in tuning window",
            "settled_days": len(settled_days),
            "reference_date": effective_reference_date,
        }

    before = dict(profile["rule_set"])
    after = dict(before)
    roi = sum((bet["profit"] or 0.0) for bet in window_bets if bet["status"] != "pending")
    staked = sum(bet["stake"] for bet in window_bets if bet["status"] in {"won", "lost"})
    window_roi = roi / staked if staked > 0 else 0.0

    after["kelly_fraction"] = round(min(0.75, max(0.05, before["kelly_fraction"] + (0.05 if window_roi > 0 else -0.05))), 2)
    after["min_edge"] = round(min(0.2, max(0.01, before["min_edge"] + (-0.01 if window_roi > 0 else 0.01))), 2)
    after["sport_weights"] = _retune_sport_weights(window_bets, before["sport_weights"])
    _validate_rule_set(after)

    updated_profile = update_strategy_profile(profile_key, after) if profile["is_editable"] else _write_noneditable_profile(profile_key, after)
    improvement_metric = round(window_roi, 4)

    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO auto_tune_log (
                profile_key,
                tuned_at,
                window_start,
                window_end,
                settled_bets_in_window,
                params_before,
                params_after,
                improvement_metric
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                profile_key,
                datetime.now(timezone.utc).isoformat(),
                window_start,
                window_end,
                len(window_bets),
                _dumps_json(before),
                _dumps_json(after),
                improvement_metric,
            ),
        )
        conn.commit()

    return {
        "ran": True,
        "window_start": window_start,
        "window_end": window_end,
        "settled_bets_in_window": len(window_bets),
        "settled_days": len(settled_days),
        "profile": updated_profile,
        "improvement_metric": improvement_metric,
    }


def init_db() -> None:
    """Initialize the database schema once. Delegates to database module."""
    init_database()
    ensure_default_strategy_profiles()


def _connect():
    """Get a database connection. Returns a context manager."""
    return get_connection()


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
        """
    )
    _ensure_column(conn, "paper_bet_log", "user_id", "TEXT DEFAULT 'legacy'")
    # dedupe is now called once from init_db(), not on every connection
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_sport ON prediction_log (sport)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_event ON prediction_log (sport, event_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_created_at ON prediction_log (created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_prediction_log_settled_at ON prediction_log (settled_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_paper_bet_log_status ON paper_bet_log (status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_paper_bet_log_user_created_at ON paper_bet_log (user_id, created_at)")
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


def _row_to_strategy_profile(row) -> Dict[str, Any]:
    rule_set = _loads_json(row["rule_set_json"])
    if not isinstance(rule_set, dict):
        rule_set = {}
    return {
        "id": row["id"],
        "profile_key": row["profile_key"],
        "display_name": row["display_name"],
        "rule_set": rule_set,
        "is_editable": bool(row["is_editable"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _row_has_key(row, key: str) -> bool:
    if isinstance(row, dict):
        return key in row
    if hasattr(row, "keys"):
        try:
            return key in row.keys()
        except TypeError:
            pass
    try:
        row[key]
        return True
    except (IndexError, KeyError, TypeError):
        return False


def _system_bet_legs_from_row(row) -> List[Dict[str, Any]]:
    if not _row_has_key(row, "legs_json"):
        return []
    legs = _loads_json(row["legs_json"])
    return legs if isinstance(legs, list) else []


def _sport_allocation_from_legs(legs: List[Dict[str, Any]]) -> Dict[str, float]:
    sport_counts: Dict[str, int] = {}
    for leg in legs:
        sport = str(leg.get("sport", "")).strip().lower()
        if sport in {"racing", "afl", "nba"}:
            sport_counts[sport] = sport_counts.get(sport, 0) + 1
    leg_count = len(legs)
    if leg_count <= 0:
        return {}
    return {
        sport: round(count / leg_count, 4)
        for sport, count in sport_counts.items()
    }


def _row_to_system_bet(row) -> Dict[str, Any]:
    bet = {
        "id": row["id"],
        "run_id": row["run_id"] if _row_has_key(row, "run_id") else None,
        "profile_key": row["profile_key"],
        "sport": row["sport"],
        "event_id": row["event_id"],
        "event_name": row["event_name"],
        "market_type": row["market_type"],
        "selection": row["selection"],
        "model_probability": float(_optional_float(row["model_probability"]) or 0.0),
        "odds_used": float(_optional_float(row["odds_used"]) or 0.0),
        "odds_source": row["odds_source"],
        "edge": float(_optional_float(row["edge"]) or 0.0),
        "stake": float(_optional_float(row["stake"]) or 0.0),
        "status": row["status"],
        "payout": _optional_float(row["payout"]),
        "profit": _optional_float(row["profit"]),
        "settled_at": row["settled_at"],
        "created_at": row["created_at"] if _row_has_key(row, "created_at") else None,
    }
    legs = _system_bet_legs_from_row(row)
    if legs:
        bet["legs"] = legs
        bet["odds_sources"] = [str(leg.get("odds_source", "")) for leg in legs if str(leg.get("odds_source", "")).strip()]
        sport_allocation = _sport_allocation_from_legs(legs)
        if sport_allocation:
            bet["sport_allocation"] = sport_allocation
    return bet


def _hydrate_strategy_card(conn, run_row) -> Dict[str, Any]:
    run_payload = _loads_json(run_row["run_payload_json"] or {})
    if not isinstance(run_payload, dict):
        run_payload = {}
    profile_row = conn.execute(
        "SELECT * FROM strategy_profiles WHERE profile_key = ?",
        (run_row["profile_key"],),
    ).fetchone()
    bets = conn.execute(
        """
        SELECT *
        FROM system_bets
        WHERE run_id = ?
        ORDER BY id ASC
        """,
        (run_row["id"],),
    ).fetchall()
    selected_bets = [_row_to_system_bet(row) for row in bets]
    performance = get_profile_performance(run_row["profile_key"])
    return {
        "profile_key": run_row["profile_key"],
        "display_name": profile_row["display_name"] if profile_row else run_row["profile_key"],
        "card_date": run_row["run_date"],
        "bankroll_available": float(run_payload.get("bankroll_available") or (run_row["bankroll_premium"] if is_melbourne_premium_day(run_row["run_date"]) else run_row["bankroll_standard"])),
        "bankroll_standard": float(run_row["bankroll_standard"]),
        "bankroll_premium": float(run_row["bankroll_premium"]),
        "total_allocated": round(float(run_row["total_allocated"] or 0.0), 2),
        "candidate_count": int(run_row["candidate_count"] or 0),
        "selected_count": int(run_row["selected_count"] or 0),
        "skipped_count": int(run_row["skipped_count"] or 0),
        "selected_bets": selected_bets,
        "skipped_opportunities": run_payload.get("skipped_opportunities", []),
        "sport_mix": run_payload.get("sport_mix", {}),
        "expected_edge": float(run_payload.get("expected_edge", 0.0)),
        "performance": performance if performance["settled_bets"] > 0 else None,
        "created_at": run_row["created_at"],
    }


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
        "user_id": row["user_id"] if _row_has_key(row, "user_id") else "legacy",
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
        "origin": row["origin"] if _row_has_key(row, "origin") else "user",
        "system_bet_id": row["system_bet_id"] if _row_has_key(row, "system_bet_id") else None,
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


def _settle_system_bets_for_event(conn, sport: str, event_id: str, settled_at: str) -> None:
    rows = conn.execute(
        """
        SELECT *
        FROM system_bets
        WHERE sport = ? AND event_id = ? AND status = 'pending'
        """,
        (sport, event_id),
    ).fetchall()

    for bet in rows:
        prediction = _find_prediction_for_bet(conn, sport, event_id, bet["selection"])
        if not prediction or prediction["actual_outcome"] is None:
            continue

        status, payout, profit = _bet_settlement(
            float(bet["stake"]),
            float(bet["odds_used"]),
            float(prediction["actual_outcome"]),
        )
        conn.execute(
            """
            UPDATE system_bets
            SET status = ?, payout = ?, profit = ?, settled_at = ?
            WHERE id = ?
            """,
            (status.lower(), payout, profit, settled_at, bet["id"]),
        )

    _settle_pending_multi_system_bets(conn, sport, event_id, settled_at)


def _settle_pending_multi_system_bets(conn, sport: str, event_id: str, settled_at: str) -> None:
    rows = conn.execute(
        """
        SELECT *
        FROM system_bets
        WHERE market_type = 'multi' AND status = 'pending'
        ORDER BY id ASC
        """
    ).fetchall()

    for bet in rows:
        legs = _system_bet_legs_from_row(bet)
        if not legs or not _multi_bet_contains_event(legs, sport, event_id):
            continue

        settlement = _resolve_multi_bet_settlement(conn, bet, legs)
        if settlement is None:
            continue

        status, payout, profit = settlement
        conn.execute(
            """
            UPDATE system_bets
            SET status = ?, payout = ?, profit = ?, settled_at = ?
            WHERE id = ?
            """,
            (status.lower(), payout, profit, settled_at, bet["id"]),
        )


def _multi_bet_contains_event(legs: List[Dict[str, Any]], sport: str, event_id: str) -> bool:
    return any(
        str(leg.get("sport", "")).strip().lower() == sport
        and str(leg.get("event_id", "")).strip() == event_id
        for leg in legs
    )


def _resolve_multi_bet_settlement(conn, bet, legs: List[Dict[str, Any]]) -> Optional[tuple[str, float, float]]:
    if not legs:
        return None

    outcomes: List[Optional[float]] = []
    for leg in legs:
        prediction = _find_prediction_for_bet(
            conn,
            str(leg.get("sport", "")).strip().lower(),
            str(leg.get("event_id", "")).strip(),
            str(leg.get("selection", "")),
        )
        if not prediction:
            outcomes.append(None)
            continue

        actual_outcome = prediction["actual_outcome"]
        if actual_outcome is None:
            outcomes.append(None)
            continue
        outcomes.append(float(actual_outcome))

    if any(outcome is not None and outcome <= 0.0 for outcome in outcomes):
        return "LOST", 0.0, -float(bet["stake"])

    if any(outcome is None for outcome in outcomes):
        return None

    if all(outcome >= 1.0 for outcome in outcomes):
        payout = float(bet["stake"]) * float(bet["odds_used"])
        return "WON", payout, payout - float(bet["stake"])

    # Any non-losing, fully-resolved leg with a partial outcome voids the multi.
    return "VOID", float(bet["stake"]), 0.0


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


def _write_noneditable_profile(profile_key: str, rule_set: Dict[str, Any]) -> Dict[str, Any]:
    updated_at = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        conn.execute(
            """
            UPDATE strategy_profiles
            SET display_name = ?, rule_set_json = ?, updated_at = ?
            WHERE profile_key = ?
            """,
            (rule_set["display_name"], _dumps_json(rule_set), updated_at, profile_key),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM strategy_profiles WHERE profile_key = ?", (profile_key,)).fetchone()
    return _row_to_strategy_profile(row)


def _validate_rule_set(rule_set: Dict[str, Any]) -> None:
    required_keys = {
        "profile_key",
        "display_name",
        "min_edge",
        "min_confidence",
        "max_bets_per_day",
        "max_stake_per_bet",
        "kelly_fraction",
        "allowed_markets",
        "allow_multis",
        "max_multi_legs",
        "sport_weights",
        "notes",
    }
    missing = required_keys - set(rule_set.keys())
    if missing:
        raise ValueError(f"rule set missing keys: {', '.join(sorted(missing))}")
    if rule_set["min_confidence"] not in CONFIDENCE_ORDER:
        raise ValueError("min_confidence must be one of: low, medium, high")
    markets = set(rule_set["allowed_markets"])
    if not markets or not markets.issubset(ALLOWED_MARKETS):
        raise ValueError("allowed_markets contains unsupported market types")
    sport_weights = rule_set["sport_weights"]
    weight_sum = sum(float(sport_weights.get(sport, 0.0)) for sport in ("racing", "afl", "nba"))
    if abs(weight_sum - 1.0) > 0.001:
        raise ValueError("sport_weights must sum to 1.0")


def _retune_sport_weights(window_bets: List[Dict[str, Any]], current_weights: Dict[str, float]) -> Dict[str, float]:
    profits = {"racing": 0.0, "afl": 0.0, "nba": 0.0}
    stakes = {"racing": 0.0, "afl": 0.0, "nba": 0.0}
    for bet in window_bets:
        if bet["status"] not in {"won", "lost"}:
            continue
        profits[bet["sport"]] += bet["profit"] or 0.0
        stakes[bet["sport"]] += bet["stake"]

    raw = {}
    for sport in ("racing", "afl", "nba"):
        roi = profits[sport] / stakes[sport] if stakes[sport] > 0 else 0.0
        raw[sport] = max(0.1, float(current_weights.get(sport, 0.0)) + roi * 0.2)

    total = sum(raw.values()) or 1.0
    return {sport: round(raw[sport] / total, 3) for sport in ("racing", "afl", "nba")}


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


def _loads_json(value: Optional[Union[str, Dict[str, Any], List[Any]]]) -> Any:
    if value is None:
        return {}

    if isinstance(value, (dict, list)):
        return value

    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, (dict, list)) else {}
    except (TypeError, json.JSONDecodeError):
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
