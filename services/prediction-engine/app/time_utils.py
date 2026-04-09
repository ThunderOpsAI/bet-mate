from __future__ import annotations

from datetime import date, datetime, timezone

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    from backports.zoneinfo import ZoneInfo  # type: ignore


MELBOURNE_TZ = ZoneInfo("Australia/Melbourne")


def now_melbourne() -> datetime:
    return datetime.now(MELBOURNE_TZ)


def today_melbourne() -> date:
    return now_melbourne().date()


def melbourne_date_string(value: datetime | str | None = None) -> str:
    if value is None:
        return today_melbourne().isoformat()
    return to_melbourne_datetime(value).date().isoformat()


def to_melbourne_datetime(value: datetime | str) -> datetime:
    if isinstance(value, datetime):
        dt = value
    else:
        raw = value.strip()
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        dt = datetime.fromisoformat(raw)

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(MELBOURNE_TZ)


def melbourne_weekday(value: datetime | str | None = None) -> str:
    dt = now_melbourne() if value is None else to_melbourne_datetime(value)
    return dt.strftime("%a").lower()


def is_melbourne_premium_day(run_date: date | str) -> bool:
    if isinstance(run_date, str):
        target_date = date.fromisoformat(run_date)
    else:
        target_date = run_date

    return target_date.weekday() in {4, 5}
