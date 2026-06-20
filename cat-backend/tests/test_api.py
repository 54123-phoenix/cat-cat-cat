import os

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-key-for-pytest")
os.environ.setdefault("ADMIN_PASSWORD", "testadmin123")
os.environ.setdefault("DEMO_PASSWORD", "testdemo123")
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("INIT_DEMO_USER", "0")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import User

_test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_test_engine)

import app.database as _db_mod
import app.main as _main_mod
_db_mod.engine = _test_engine
_db_mod.SessionLocal = _TestSessionLocal
_main_mod.engine = _test_engine
_main_mod.SessionLocal = _TestSessionLocal

app = _main_mod.app


def _override_get_db():
    db = _TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_get_db


@pytest.fixture(scope="session")
def client():
    Base.metadata.create_all(bind=_test_engine)
    db = _TestSessionLocal()
    try:
        if not db.query(User).filter(User.username == "admin").first():
            from passlib.context import CryptContext
            pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
            db.add(User(
                username="admin",
                password_hash=pwd_ctx.hash("testadmin123"),
                nickname="TestAdmin",
                role="admin",
            ))
            db.commit()
    finally:
        db.close()
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin_token(client):
    resp = client.post("/api/auth/login", json={
        "username": "admin",
        "password": "testadmin123",
    })
    assert resp.status_code == 200
    return resp.json()["token"]


@pytest.fixture(scope="session")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def test_user_token(client):
    resp = client.post("/api/auth/register", json={
        "username": "testuser1",
        "password": "password123",
        "nickname": "TestUser",
    })
    assert resp.status_code == 200
    return resp.json()["token"]


@pytest.fixture(scope="session")
def test_user_headers(test_user_token):
    return {"Authorization": f"Bearer {test_user_token}"}


# ─── Auth Tests ──────────────────────────────────────────────────────

class TestAuth:
    def test_register_success(self, client):
        resp = client.post("/api/auth/register", json={
            "username": "newuser1",
            "password": "password123",
            "nickname": "NewUser",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["user"]["username"] == "newuser1"

    def test_register_duplicate_username(self, client):
        client.post("/api/auth/register", json={
            "username": "dupuser",
            "password": "password123",
            "nickname": "DupUser",
        })
        resp = client.post("/api/auth/register", json={
            "username": "dupuser",
            "password": "password123",
            "nickname": "DupUser2",
        })
        assert resp.status_code == 400
        assert "already exists" in resp.json()["detail"]

    def test_register_reserved_username(self, client):
        resp = client.post("/api/auth/register", json={
            "username": "admin",
            "password": "password123",
            "nickname": "FakeAdmin",
        })
        assert resp.status_code == 400
        assert "reserved" in resp.json()["detail"].lower()

    def test_login_success(self, client):
        resp = client.post("/api/auth/login", json={
            "username": "admin",
            "password": "testadmin123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["user"]["username"] == "admin"

    def test_login_wrong_password(self, client):
        resp = client.post("/api/auth/login", json={
            "username": "admin",
            "password": "wrongpassword",
        })
        assert resp.status_code == 401

    def test_me_with_token(self, client, auth_headers):
        resp = client.get("/api/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["username"] == "admin"

    def test_me_without_token(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401


# ─── Cats Tests ──────────────────────────────────────────────────────

class TestCats:
    def test_list_cats(self, client):
        resp = client.get("/api/cats")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert "has_more" in data

    def test_get_cat_not_found(self, client):
        resp = client.get("/api/cats/99999")
        assert resp.status_code == 404

    def test_get_cat_exists(self, client, auth_headers):
        create_resp = client.post("/api/cats", json={
            "name": "TestCat",
            "color": "orange",
            "personality": "friendly",
            "location": "campus",
        }, headers=auth_headers)
        assert create_resp.status_code == 200
        cat_id = create_resp.json()["id"]
        resp = client.get(f"/api/cats/{cat_id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "TestCat"


# ─── Posts Tests ─────────────────────────────────────────────────────

class TestPosts:
    def test_list_posts_requires_auth(self, client):
        resp = client.get("/api/posts")
        assert resp.status_code == 401

    def test_list_posts_with_auth(self, client, test_user_headers):
        resp = client.get("/api/posts", headers=test_user_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert "has_more" in data

    def test_create_post(self, client, test_user_headers):
        resp = client.post("/api/posts", headers=test_user_headers, data={
            "content": "Hello from test!",
            "topic": "daily",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["content"] == "Hello from test!"
        assert data["topic"] == "daily"


# ─── Recognize Tests ─────────────────────────────────────────────────

class TestRecognize:
    def test_recognize_returns_valid_status(self, client):
        import io
        from PIL import Image

        img = Image.new("RGB", (100, 100), color="orange")
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)

        resp = client.post("/api/recognize", files={
            "file": ("test_cat.jpg", buf, "image/jpeg"),
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in {"confirmed", "uncertain", "unknown", "unavailable"}


# ─── Map Tests ───────────────────────────────────────────────────────

class TestMap:
    def test_heatmap(self, client):
        resp = client.get("/api/map/heatmap")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert "has_more" in data


# ─── Badges/Quests Tests ─────────────────────────────────────────────

class TestBadgesQuests:
    def test_profile_requires_auth(self, client):
        resp = client.get("/api/user/profile")
        assert resp.status_code == 401

    def test_profile_with_auth(self, client, test_user_headers):
        resp = client.get("/api/user/profile", headers=test_user_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "username" in data
        assert "stats" in data
        assert "badges" in data

    def test_daily_quest_requires_auth(self, client):
        resp = client.get("/api/users/me/daily-quest")
        assert resp.status_code == 401

    def test_daily_quest_returns_4_quests(self, client, test_user_headers):
        resp = client.get("/api/users/me/daily-quest", headers=test_user_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "quests" in data
        assert len(data["quests"]) == 4
