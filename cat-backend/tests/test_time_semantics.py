import os
from datetime import datetime, timedelta, timezone

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-key-for-pytest")
os.environ.setdefault("ADMIN_PASSWORD", "testadmin123")
os.environ.setdefault("DATABASE_URL", "sqlite://")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import models, time_utils
from app.database import Base
from app.api.user import get_daily_quest


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    engine.dispose()


def test_insert_and_update_times_are_evaluated_per_operation(db, monkeypatch):
    class Clock(datetime):
        current = datetime(2026, 10, 29, 15, 59, tzinfo=timezone.utc)
        @classmethod
        def now(cls, tz=None):
            return cls.current.astimezone(tz)
    monkeypatch.setattr(time_utils, "datetime", Clock)
    user = models.User(username="time-user", password_hash="x", nickname="Time")
    db.add(user)
    db.commit()
    first = models.Post(user_id=user.id, content="first")
    db.add(first)
    db.commit()
    initial = first.created_at
    Clock.current += timedelta(minutes=2)
    second = models.Post(user_id=user.id, content="second")
    first.content = "edited"
    db.add(second)
    db.commit()
    assert first.created_at == initial
    assert second.created_at == initial + timedelta(minutes=2)
    assert first.updated_at == second.created_at
    assert first.created_at.utcoffset() == timedelta(0)
    assert time_utils.campus_date(first.created_at).isoformat() == "2026-10-29"
    assert time_utils.campus_date(second.created_at).isoformat() == "2026-10-30"


def test_explicit_offset_is_normalized_without_losing_instant(db):
    instant = datetime(2026, 10, 30, 8, tzinfo=timezone(timedelta(hours=8)))
    user = models.User(username="offset-user", password_hash="x", nickname="Time", created_at=instant)
    db.add(user)
    db.commit()
    db.refresh(user)
    assert user.created_at == datetime(2026, 10, 30, tzinfo=timezone.utc)
    assert user.created_at.utcoffset() == timedelta(0)


def test_daily_quest_respects_campus_midnight_and_excludes_tomorrow(db, monkeypatch):
    now = datetime(2026, 10, 29, 16, tzinfo=timezone.utc)
    monkeypatch.setattr(time_utils, "utc_now", lambda: now)
    user = models.User(username="quest-time", password_hash="x", nickname="Time")
    cat = models.Cat(name="Clock")
    db.add_all([user, cat])
    db.commit()
    db.add(models.Sighting(user_id=user.id, cat_id=cat.id, created_at=now-timedelta(seconds=1)))
    db.add(models.Sighting(user_id=user.id, cat_id=cat.id, created_at=now+timedelta(days=1)))
    db.commit()
    assert get_daily_quest(db, user)["quests"][0]["done"] is False
    db.add(models.Sighting(user_id=user.id, cat_id=cat.id, created_at=now))
    db.commit()
    assert get_daily_quest(db, user)["quests"][0]["done"] is True


def test_all_timestamp_defaults_are_callable():
    defaults = [column.default for table in Base.metadata.tables.values() for column in table.columns
                if isinstance(column.type, time_utils.UTCDateTime) and column.default is not None]
    assert len(defaults) >= 24
    assert all(default.is_callable for default in defaults)
    assert models.Post.__table__.c.updated_at.onupdate.is_callable
