"""UTC persistence and UTC+08:00 calendar days for the Fudan campus."""

from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import DateTime
from sqlalchemy.types import TypeDecorator

CAMPUS_TIMEZONE = timezone(timedelta(hours=8))


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime) -> datetime:
    # Existing SQLite timestamps have no offset. The storage contract is UTC.
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def campus_date(value: datetime | None = None) -> date:
    return as_utc(value if value is not None else utc_now()).astimezone(CAMPUS_TIMEZONE).date()


def campus_day_bounds(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min, tzinfo=CAMPUS_TIMEZONE)
    return as_utc(start), as_utc(start + timedelta(days=1))


class UTCDateTime(TypeDecorator):
    """Store UTC without an offset; always expose aware UTC values to callers."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return as_utc(value).replace(tzinfo=None) if value is not None else None

    def process_result_value(self, value, dialect):
        return as_utc(value) if value is not None else None
