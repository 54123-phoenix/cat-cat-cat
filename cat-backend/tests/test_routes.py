import os
from datetime import datetime, timedelta

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-key-for-pytest")
os.environ.setdefault("ADMIN_PASSWORD", "testadmin123")
os.environ.setdefault("DEMO_PASSWORD", "testdemo123")
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("INIT_DEMO_USER", "0")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models
from app.api.routes import recommendations
from app.database import Base

_test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_test_engine)


@pytest.fixture()
def db():
    Base.metadata.drop_all(bind=_test_engine)
    Base.metadata.create_all(bind=_test_engine)
    session = _TestSessionLocal()
    try:
        yield session
    finally:
        session.close()


def _seed(db):
    user = models.User(
        username="route_user", password_hash="x", nickname="R", role="user", xp=10
    )
    cat = models.Cat(name="橘宝", location="图书馆", avatar="cat.png")
    cat2 = models.Cat(name="小黑", location="食堂", avatar=None)
    db.add_all([user, cat, cat2])
    db.commit()
    db.refresh(user)
    db.refresh(cat)
    db.refresh(cat2)
    now = datetime.now()
    db.add(
        models.Sighting(
            cat_id=cat.id,
            user_id=user.id,
            status="approved",
            location_name="图书馆草坪",
            latitude=31.3,
            longitude=121.5,
            created_at=now,
        )
    )
    db.add(
        models.Sighting(
            cat_id=cat.id,
            user_id=user.id,
            status="approved",
            location_name="图书馆草坪",
            latitude=31.3,
            longitude=121.5,
            created_at=now - timedelta(days=1),
        )
    )
    db.add(
        models.Sighting(
            cat_id=cat2.id,
            user_id=user.id,
            status="approved",
            location_name="二食堂",
            latitude=31.31,
            longitude=121.51,
            created_at=now - timedelta(days=2),
        )
    )
    db.commit()
    return user, cat, cat2


def test_recommendations_returns_stops(db):
    _seed(db)
    result = recommendations(time_slot="anytime", limit=4, days=14, db=db)
    assert result["title"]
    assert result["share_path"].startswith("/routes?time_slot=")
    assert len(result["stops"]) == 2
    top = result["stops"][0]
    assert top["name"] == "图书馆草坪"
    assert top["sightings_count"] == 2
    assert top["cat_name"] == "橘宝"
    assert top["cat_avatar"] == "cat.png"
    assert top["latitude"] == 31.3


def test_recommendations_empty_when_no_data(db):
    result = recommendations(time_slot="anytime", limit=4, days=14, db=db)
    assert result["stops"] == []
    assert result["title"]


def test_recommendations_limit_caps_stops(db):
    _seed(db)
    result = recommendations(time_slot="anytime", limit=2, days=14, db=db)
    assert len(result["stops"]) <= 2


def test_recommendations_time_slot_filters(db):
    user = models.User(
        username="route_user2", password_hash="x", nickname="R", role="user", xp=10
    )
    cat = models.Cat(name="夜猫", location="宿舍")
    db.add_all([user, cat])
    db.commit()
    db.refresh(user)
    db.refresh(cat)
    night = datetime.now().replace(hour=20, minute=0, second=0, microsecond=0)
    db.add(
        models.Sighting(
            cat_id=cat.id,
            user_id=user.id,
            status="approved",
            location_name="宿舍区",
            latitude=31.4,
            longitude=121.6,
            created_at=night,
        )
    )
    db.commit()
    morning = recommendations(time_slot="morning", limit=4, days=14, db=db)
    assert morning["stops"] == []
    evening = recommendations(time_slot="evening", limit=4, days=14, db=db)
    assert len(evening["stops"]) == 1
    assert evening["stops"][0]["name"] == "宿舍区"
