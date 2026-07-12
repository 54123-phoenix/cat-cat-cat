import os
from datetime import datetime, timedelta

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-key-for-pytest")
os.environ.setdefault("ADMIN_PASSWORD", "testadmin123")
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("INIT_DEMO_USER", "0")

import pytest
from fastapi.testclient import TestClient
from passlib.context import CryptContext
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models
from app.agents.cat_intel import answer_cat_intel
from app.agents.schemas import CatIntelContext, CatIntelRequest
from app.api.auth import create_token
from app.database import Base, get_db


engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


def seed(db):
    user = models.User(username="intel", password_hash=CryptContext(schemes=["bcrypt"]).hash("password123"), nickname="情报员")
    orange = models.Cat(name="橙子", aliases="小橙", location="光草")
    black = models.Cat(name="小黑", location="北区")
    db.add_all([user, orange, black])
    db.commit()
    now = datetime.now()
    sightings = [
        models.Sighting(cat_id=orange.id, user_id=user.id, status="approved", location_name="光草", latitude=31.3000, longitude=121.5000, created_at=now),
        models.Sighting(cat_id=orange.id, user_id=user.id, status="approved", location_name="光草", latitude=31.3001, longitude=121.5001, created_at=now - timedelta(days=1)),
        models.Sighting(cat_id=black.id, user_id=user.id, status="approved", location_name="北区", latitude=31.3100, longitude=121.5100, created_at=now - timedelta(days=2)),
        models.Sighting(cat_id=black.id, user_id=user.id, status="pending", location_name="光草", latitude=31.3000, longitude=121.5000, created_at=now),
    ]
    db.add_all(sightings)
    db.commit()
    return user, orange, black


def test_cat_question_uses_approved_activity(db):
    _, orange, _ = seed(db)
    result = answer_cat_intel(db, CatIntelRequest(message="橙子最近在哪里出现？"))
    assert result.intent == "cat_activity"
    assert "2 条" in result.answer
    assert "光草" in result.answer
    assert result.actions[0].params["cat_id"] == orange.id


def test_location_question_excludes_pending_sightings(db):
    seed(db)
    result = answer_cat_intel(db, CatIntelRequest(message="光草最近有哪些猫？"))
    assert result.intent == "location_activity"
    assert "橙子（2 次）" in result.answer
    assert "小黑" not in result.answer


def test_nearby_question_uses_runtime_location(db):
    seed(db)
    request = CatIntelRequest(
        message="我附近有什么猫？",
        context=CatIntelContext(latitude=31.3000, longitude=121.5000),
    )
    result = answer_cat_intel(db, request)
    assert result.intent == "nearby_activity"
    assert "橙子" in result.answer
    assert "小黑" not in result.answer


def test_route_question_returns_action(db):
    seed(db)
    result = answer_cat_intel(db, CatIntelRequest(message="帮我规划一条半小时路线"))
    assert result.intent == "route_recommendation"
    assert result.actions[0].type == "start_route"
    assert "光草" in result.answer


def test_api_requires_auth_and_returns_structured_answer(db):
    user, _, _ = seed(db)
    from app.main import app

    def override_db():
        yield db

    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_db
    try:
        client = TestClient(app)
        assert client.post("/api/agents/cat-intel/messages", json={"message": "哪里有猫？"}).status_code == 401
        response = client.post(
            "/api/agents/cat-intel/messages",
            json={"message": "哪里有猫？"},
            headers={"Authorization": f"Bearer {create_token(user)}"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["mode"] == "fallback"
        assert payload["evidence"]
        assert payload["actions"]
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override
