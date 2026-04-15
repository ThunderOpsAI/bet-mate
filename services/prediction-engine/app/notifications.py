"""
Notification senders for blackbook auto-bet triggers.

Supported channels:
  - SMS via Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)
  - Email via Resend (RESEND_API_KEY, NOTIFY_EMAIL_FROM)
  - Push via Pushover app (PUSHOVER_APP_TOKEN + per-user pushover_key)

All senders are best-effort and fire-and-forget — failures are logged but never
raise so they never block a prediction response.
"""

import os
import threading
import urllib.request
import urllib.parse
import json
from typing import Optional


def _env(key: str) -> str:
    return os.getenv(key, "").strip()


# ── Twilio SMS ────────────────────────────────────────────────────────────────

def _send_sms(to: str, body: str) -> bool:
    sid = _env("TWILIO_ACCOUNT_SID")
    token = _env("TWILIO_AUTH_TOKEN")
    from_number = _env("TWILIO_FROM_NUMBER")
    if not (sid and token and from_number and to):
        print(f"[notify] SMS skipped (Twilio not configured): {body[:60]}")
        return False
    try:
        import base64
        url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
        data = urllib.parse.urlencode({
            "From": from_number,
            "To": to,
            "Body": body,
        }).encode()
        credentials = base64.b64encode(f"{sid}:{token}".encode()).decode()
        req = urllib.request.Request(url, data=data, headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/x-www-form-urlencoded",
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 201
    except Exception as exc:
        print(f"[notify] SMS error: {exc}")
        return False


# ── Resend Email ──────────────────────────────────────────────────────────────

def _send_email(to: str, subject: str, html: str) -> bool:
    api_key = _env("RESEND_API_KEY")
    from_addr = _env("NOTIFY_EMAIL_FROM") or "alerts@bet-mate.app"
    if not (api_key and to):
        print(f"[notify] Email skipped (Resend not configured): {subject}")
        return False
    try:
        payload = json.dumps({
            "from": from_addr,
            "to": [to],
            "subject": subject,
            "html": html,
        }).encode()
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception as exc:
        print(f"[notify] Email error: {exc}")
        return False


# ── Pushover push notification ────────────────────────────────────────────────

def _send_push(user_key: str, title: str, message: str) -> bool:
    app_token = _env("PUSHOVER_APP_TOKEN")
    if not (app_token and user_key):
        print(f"[notify] Push skipped (Pushover not configured): {title}")
        return False
    try:
        data = urllib.parse.urlencode({
            "token": app_token,
            "user": user_key,
            "title": title,
            "message": message,
            "sound": "cashregister",
        }).encode()
        req = urllib.request.Request(
            "https://api.pushover.net/1/messages.json",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception as exc:
        print(f"[notify] Push error: {exc}")
        return False


# ── Public entry point ────────────────────────────────────────────────────────

def notify_blackbook_trigger(
    runner: str,
    probability: float,
    stake: float,
    bet_type: str,
    user_config: dict,
) -> None:
    """
    Fire all configured notifications for a blackbook auto-bet trigger.
    Runs in a background thread — never blocks the caller.
    """
    title = f"BetMate: {runner}"
    body = (
        f"{runner} picked at {probability:.1f}% \u2014 "
        f"auto paper bet ${stake:.0f} {bet_type.upper()} placed."
    )
    html = f"<p><strong>{runner}</strong> predicted at <strong>{probability:.1f}%</strong>.<br>Auto paper bet <strong>${stake:.0f} {bet_type.upper()}</strong> placed.</p>"

    def _fire():
        if phone := user_config.get("notify_phone"):
            _send_sms(phone, f"[BetMate] {body}")
        if email := user_config.get("notify_email"):
            _send_email(email, title, html)
        if push_key := user_config.get("notify_pushover_key"):
            _send_push(push_key, title, body)

    threading.Thread(target=_fire, daemon=True).start()
