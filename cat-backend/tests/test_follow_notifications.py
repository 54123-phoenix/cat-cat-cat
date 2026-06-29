import os

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-key-for-pytest")
os.environ.setdefault("ADMIN_PASSWORD", "testadmin123")
os.environ.setdefault("DEMO_PASSWORD", "testdemo123")
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("INIT_DEMO_USER", "0")

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import crud, models
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


def _user(db, username: str) -> models.User:
    user = models.User(
        username=username,
        password_hash="test-hash",
        nickname=username,
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _cat(db, name: str = "NoticeCat") -> models.Cat:
    cat = models.Cat(name=name, location="测试草坪", personality="亲人")
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


def _follow(db, user_id: int, cat_id: int) -> None:
    db.add(models.UserCatFollow(user_id=user_id, cat_id=cat_id))
    db.commit()


def test_notify_cat_followers_creates_cat_update_notifications(db):
    follower = _user(db, "follow_notice_user")
    actor = _user(db, "follow_notice_actor")
    cat = _cat(db)
    _follow(db, follower.id, cat.id)
    _follow(db, actor.id, cat.id)

    crud.notify_cat_followers(
        db,
        cat_id=cat.id,
        title="NoticeCat 有新偶遇",
        content="测试草坪出现了新偶遇",
        related_id=123,
        related_type="sighting",
        exclude_user_id=actor.id,
    )

    notifications = db.query(models.Notification).all()
    assert len(notifications) == 1
    assert notifications[0].user_id == follower.id
    assert notifications[0].type == "cat_update"
    assert notifications[0].title == "NoticeCat 有新偶遇"
    assert notifications[0].related_id == 123
    assert notifications[0].related_type == "sighting"
    assert notifications[0].is_read is False


def test_notify_cat_followers_skips_actor_when_only_actor_follows(db):
    actor = _user(db, "self_notice_actor")
    cat = _cat(db, "SelfNoticeCat")
    _follow(db, actor.id, cat.id)

    crud.notify_cat_followers(
        db,
        cat_id=cat.id,
        title="SelfNoticeCat 有新照片",
        content="管理员更新了照片",
        related_id=cat.id,
        related_type="cat",
        exclude_user_id=actor.id,
    )

    assert db.query(models.Notification).count() == 0
