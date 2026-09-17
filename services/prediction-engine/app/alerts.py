"""
Automated Multi-Channel Alert Engine for BetMate Prediction Engine.

Features:
  - 24-Hour Daily Summary Digest: Morning email/push summary of all saved BlackBook entities racing today.
  - Proximity Race Alerts: Pre-race notifications triggered at customizable intervals (15m, 5m, 2m before jump).
  - Dispatch helpers wrapping Twilio SMS, Resend Email, and Pushover Push notifications.
"""

import os
import json
import logging
import threading
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

from app.notifications import _send_email, _send_push, _send_sms
from app.time_utils import today_melbourne

LOGGER = logging.getLogger("betmate.alerts")


@dataclass
class AlertPreference:
    user_id: str
    daily_digest_enabled: bool = True
    daily_digest_time: str = "08:00"  # Local Melbourne time HH:MM
    proximity_alerts_enabled: bool = True
    proximity_intervals_minutes: List[int] = field(default_factory=lambda: [15, 5, 2])
    channel_email: bool = True
    channel_push: bool = True
    channel_sms: bool = False
    channel_in_app: bool = True
    email_address: Optional[str] = None
    phone_number: Optional[str] = None
    pushover_key: Optional[str] = None
    card_bell_toggles: Dict[str, bool] = field(default_factory=dict)


# In-memory alert preferences store fallback
_PREFERENCES_STORE: Dict[str, AlertPreference] = {}
_DISPATCHED_ALERTS_CACHE: Dict[str, datetime] = {}


def get_user_alert_preference(user_id: str) -> AlertPreference:
    """Retrieve or initialize alert preferences for a given user."""
    if user_id not in _PREFERENCES_STORE:
        _PREFERENCES_STORE[user_id] = AlertPreference(user_id=user_id)
    return _PREFERENCES_STORE[user_id]


def update_user_alert_preference(user_id: str, updates: Dict[str, Any]) -> AlertPreference:
    """Update alert preferences for a given user."""
    pref = get_user_alert_preference(user_id)
    for key, value in updates.items():
        if hasattr(pref, key):
            setattr(pref, key, value)
    _PREFERENCES_STORE[user_id] = pref
    return pref


# ──────────────────────────────────────────────────────────────────────────────
# 24-HOUR DAILY SUMMARY DIGEST
# ──────────────────────────────────────────────────────────────────────────────

def generate_daily_summary_digest(
    user_id: str,
    blackbook_items: List[Dict[str, Any]],
    today_races: List[Dict[str, Any]],
    run_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate morning 24-hour summary digest of all saved BlackBook entities racing today.
    """
    target_date = run_date or today_melbourne().isoformat()
    racing_matches = []

    # Index races by runner name and venue/race details
    for race in today_races:
        venue = race.get("venue", "Unknown Venue")
        race_number = race.get("race_number", 1)
        start_time = race.get("start_time", "")
        horses = race.get("horses", [])

        for horse in horses:
            horse_name = horse.get("name", "")
            jockey_name = horse.get("jockey_name", "")
            trainer_name = horse.get("trainer_name", "")

            for item in blackbook_items:
                target_name = item.get("targetName", "").strip().lower()
                target_type = item.get("targetType", "runner").lower()
                entity_type = item.get("entityType", "RUNNER").upper()
                notes = item.get("notes", "")

                matched = False
                match_reason = ""

                if entity_type == "RUNNER" and target_name and target_name in horse_name.lower():
                    matched = True
                    match_reason = f"Runner '{horse_name}' is in your BlackBook"
                elif entity_type == "JOCKEY" and target_name and target_name in (jockey_name or "").lower():
                    matched = True
                    match_reason = f"Jockey '{jockey_name}' riding {horse_name}"
                elif entity_type == "TRAINER" and target_name and target_name in (trainer_name or "").lower():
                    matched = True
                    match_reason = f"Trainer '{trainer_name}' training {horse_name}"
                elif target_name in horse_name.lower():
                    matched = True
                    match_reason = f"BlackBook entity '{target_name}' racing"

                if matched:
                    racing_matches.append({
                        "blackbook_item_id": item.get("id"),
                        "entity_name": item.get("targetName"),
                        "entity_type": entity_type,
                        "runner_name": horse_name,
                        "jockey_name": jockey_name,
                        "trainer_name": trainer_name,
                        "venue": venue,
                        "race_number": race_number,
                        "start_time": start_time,
                        "win_probability": horse.get("win_probability", horse.get("past_win_rate", 0) * 100),
                        "fair_odds": horse.get("fair_odds", 0),
                        "match_reason": match_reason,
                        "notes": notes,
                    })

    total_count = len(racing_matches)
    subject = f"🏇 BetMate Daily Digest: {total_count} BlackBook Entr{'y' if total_count == 1 else 'ies'} Racing Today ({target_date})"
    
    if total_count == 0:
        headline = f"No saved BlackBook entities are scheduled to race today ({target_date})."
        body_text = f"BetMate Morning Digest - {target_date}\n\nNo saved BlackBook horses or runners are active today. We will keep monitoring live markets for you."
        html_content = f"""
        <div style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px;">
            <h2 style="color: #38bdf8;">🏇 BetMate 24-Hour Daily Digest</h2>
            <p style="color: #94a3b8;">Date: <strong>{target_date}</strong></p>
            <div style="background: #1e293b; padding: 16px; border-radius: 8px; border-left: 4px solid #0284c7;">
                <p style="margin: 0; color: #cbd5e1;">No saved BlackBook entities are racing today. Check back tomorrow!</p>
            </div>
        </div>
        """
    else:
        headline = f"You have {total_count} saved BlackBook entr{'y' if total_count == 1 else 'ies'} racing today across live venues."
        
        matches_text = "\n".join([
            f"• {m['runner_name']} — {m['venue']} Race {m['race_number']} (Jump: {m['start_time'] or 'TBD'}) [{m['match_reason']}]"
            for m in racing_matches
        ])
        body_text = f"BetMate Morning Digest - {target_date}\n\n{headline}\n\nScheduled Races:\n{matches_text}\n\nLog in to BetMate for AI predictions and automated betting rules."

        items_html = "".join([
            f"""
            <tr style="border-bottom: 1px solid #334155;">
                <td style="padding: 10px; font-weight: bold; color: #f1f5f9;">{m['runner_name']}</td>
                <td style="padding: 10px; color: #cbd5e1;">{m['venue']} R{m['race_number']}</td>
                <td style="padding: 10px; color: #fbbf24; font-family: monospace;">{m['start_time'] or 'TBD'}</td>
                <td style="padding: 10px; color: #34d399;">{m['match_reason']}</td>
            </tr>
            """
            for m in racing_matches
        ])

        html_content = f"""
        <div style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px;">
            <h2 style="color: #38bdf8; margin-bottom: 4px;">🏇 BetMate 24-Hour Daily Summary Digest</h2>
            <p style="color: #94a3b8; margin-top: 0;">Date: <strong>{target_date}</strong></p>
            <p style="font-size: 16px; color: #e2e8f0;">{headline}</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 16px; background: #1e293b; border-radius: 8px; overflow: hidden;">
                <thead>
                    <tr style="background: #334155; color: #94a3b8; text-align: left; font-size: 12px; text-transform: uppercase;">
                        <th style="padding: 10px;">Runner</th>
                        <th style="padding: 10px;">Venue & Race</th>
                        <th style="padding: 10px;">Jump Time</th>
                        <th style="padding: 10px;">BlackBook Match</th>
                    </tr>
                </thead>
                <tbody>
                    {items_html}
                </tbody>
            </table>
            
            <div style="margin-top: 24px; padding: 12px; background: #1e293b; border-radius: 6px; text-align: center;">
                <a href="http://localhost:3000/blackbook" style="color: #38bdf8; font-weight: bold; text-decoration: none;">View Live BlackBook & AI Ratings &rarr;</a>
            </div>
        </div>
        """

    return {
        "user_id": user_id,
        "date": target_date,
        "total_racing_entities": total_count,
        "subject": subject,
        "headline": headline,
        "body_text": body_text,
        "html_content": html_content,
        "matches": racing_matches,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def dispatch_daily_summary_digest(
    user_config: Dict[str, Any],
    digest_data: Dict[str, Any],
) -> Dict[str, bool]:
    """
    Dispatch daily digest across configured communication channels (Email, Push, SMS).
    """
    results = {"email": False, "push": False, "sms": False}

    email_addr = user_config.get("email_address") or user_config.get("notify_email")
    push_key = user_config.get("pushover_key") or user_config.get("notify_pushover_key")
    phone_num = user_config.get("phone_number") or user_config.get("notify_phone")

    def _fire():
        if email_addr and user_config.get("channel_email", True):
            results["email"] = _send_email(
                to=email_addr,
                subject=digest_data["subject"],
                html=digest_data["html_content"],
            )

        if push_key and user_config.get("channel_push", True):
            results["push"] = _send_push(
                user_key=push_key,
                title="BetMate Daily Digest",
                message=digest_data["headline"],
            )

        if phone_num and user_config.get("channel_sms", False) and digest_data["total_racing_entities"] > 0:
            results["sms"] = _send_sms(
                to=phone_num,
                body=f"[BetMate Daily Digest] {digest_data['headline']}",
            )

    t = threading.Thread(target=_fire, daemon=True)
    t.start()
    t.join(timeout=3.0)  # Short wait for response verification

    return results


# ──────────────────────────────────────────────────────────────────────────────
# PROXIMITY RACE ALERTS (15m, 5m, 2m pre-jump)
# ──────────────────────────────────────────────────────────────────────────────

def calculate_minutes_until_jump(start_time_str: str) -> Optional[float]:
    """Calculate minutes until race jump from ISO or HH:MM string."""
    if not start_time_str:
        return None
    try:
        if "T" in start_time_str:
            jump_dt = datetime.fromisoformat(start_time_str.replace("Z", "+00:00"))
        else:
            # Parse time string relative to today
            now_local = datetime.now()
            hours, minutes = map(int, start_time_str.split(":")[:2])
            jump_dt = now_local.replace(hour=hours, minute=minutes, second=0, microsecond=0)
            if jump_dt.tzinfo is None:
                jump_dt = jump_dt.astimezone()

        now_utc = datetime.now(timezone.utc)
        if jump_dt.tzinfo is None:
            jump_dt = jump_dt.replace(tzinfo=timezone.utc)
        
        diff = (jump_dt - now_utc).total_seconds() / 60.0
        return diff
    except Exception as exc:
        LOGGER.debug("Could not parse start time '%s': %s", start_time_str, exc)
        return None


def check_proximity_race_alerts(
    user_id: str,
    blackbook_items: List[Dict[str, Any]],
    upcoming_races: List[Dict[str, Any]],
    alert_intervals_minutes: Optional[List[int]] = None,
    user_preferences: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Check live & upcoming races against user BlackBook entities for proximity race alerts (15m, 5m, 2m).
    """
    intervals = alert_intervals_minutes or [15, 5, 2]
    triggered_alerts = []

    for race in upcoming_races:
        race_id = race.get("race_id", "unknown")
        venue = race.get("venue", "Unknown Venue")
        race_number = race.get("race_number", 1)
        start_time = race.get("start_time", "")
        horses = race.get("horses", [])

        mins_to_jump = calculate_minutes_until_jump(start_time)
        if mins_to_jump is None or mins_to_jump < 0:
            continue

        for target_interval in intervals:
            # Check if mins_to_jump is within target interval window (±2.5 minutes)
            if abs(mins_to_jump - target_interval) <= 2.5:
                for horse in horses:
                    horse_name = horse.get("name", "")
                    jockey_name = horse.get("jockey_name", "")
                    trainer_name = horse.get("trainer_name", "")

                    for item in blackbook_items:
                        target_name = item.get("targetName", "").strip().lower()
                        entity_type = item.get("entityType", "RUNNER").upper()
                        
                        # Check card bell toggle if specified
                        card_bell = user_preferences.get("card_bell_toggles", {}).get(item.get("id"), True) if user_preferences else True
                        if not card_bell:
                            continue

                        matched = False
                        if entity_type == "RUNNER" and target_name and target_name in horse_name.lower():
                            matched = True
                        elif entity_type == "JOCKEY" and target_name and target_name in (jockey_name or "").lower():
                            matched = True
                        elif entity_type == "TRAINER" and target_name and target_name in (trainer_name or "").lower():
                            matched = True
                        elif target_name in horse_name.lower():
                            matched = True

                        if matched:
                            cache_key = f"{user_id}:{race_id}:{horse_name}:{target_interval}m"
                            if cache_key in _DISPATCHED_ALERTS_CACHE:
                                continue  # Already notified for this interval

                            alert = {
                                "alert_id": cache_key,
                                "user_id": user_id,
                                "race_id": race_id,
                                "venue": venue,
                                "race_number": race_number,
                                "runner_name": horse_name,
                                "target_name": item.get("targetName"),
                                "interval_minutes": target_interval,
                                "minutes_remaining": round(mins_to_jump, 1),
                                "start_time": start_time,
                                "title": f"🚨 Proximity Alert: {horse_name} in {target_interval}m!",
                                "message": f"{horse_name} is running at {venue} Race {race_number} in ~{target_interval} minutes (Jump: {start_time}).",
                                "triggered_at": datetime.now(timezone.utc).isoformat(),
                            }

                            triggered_alerts.append(alert)
                            _DISPATCHED_ALERTS_CACHE[cache_key] = datetime.now(timezone.utc)

    return triggered_alerts


def dispatch_proximity_alert(
    user_config: Dict[str, Any],
    alert: Dict[str, Any],
) -> Dict[str, bool]:
    """
    Dispatch a single pre-race proximity alert via push/email/SMS.
    """
    results = {"email": False, "push": False, "sms": False}

    title = alert.get("title", "BetMate Proximity Alert")
    message = alert.get("message", "")
    html = f"""
    <div style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; border-radius: 12px;">
        <h3 style="color: #f59e0b; margin-top: 0;">{title}</h3>
        <p style="font-size: 15px; color: #e2e8f0;">{message}</p>
        <p style="color: #94a3b8; font-size: 13px;">Venue: <strong>{alert.get('venue')} R{alert.get('race_number')}</strong></p>
        <div style="margin-top: 16px;">
            <a href="http://localhost:3000/races" style="background: #f59e0b; color: #0f172a; padding: 8px 16px; font-weight: bold; text-decoration: none; border-radius: 6px;">Open Race Card &rarr;</a>
        </div>
    </div>
    """

    email_addr = user_config.get("email_address") or user_config.get("notify_email")
    push_key = user_config.get("pushover_key") or user_config.get("notify_pushover_key")
    phone_num = user_config.get("phone_number") or user_config.get("notify_phone")

    def _fire():
        if push_key and user_config.get("channel_push", True):
            results["push"] = _send_push(push_key, title, message)

        if email_addr and user_config.get("channel_email", True):
            results["email"] = _send_email(email_addr, title, html)

        if phone_num and user_config.get("channel_sms", False):
            results["sms"] = _send_sms(phone_num, f"[BetMate Alert] {message}")

    t = threading.Thread(target=_fire, daemon=True)
    t.start()
    t.join(timeout=3.0)

    return results
