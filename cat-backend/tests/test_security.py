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

Base.metadata.create_all(bind=_test_engine)

app = _main_mod.app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin_token(client):
    pwd_ctx = __import__("passlib.context", fromlist=["CryptContext"]).CryptContext(schemes=["bcrypt"], deprecated="auto")
    db = _TestSessionLocal()
    if not db.query(User).filter(User.username == "admin").first():
        db.add(User(username="admin", password_hash=pwd_ctx.hash("testadmin123"), nickname="管理员", role="admin"))
        db.commit()
    db.close()
    resp = client.post("/api/admin/login", json={"password": "testadmin123"})
    assert resp.status_code == 200
    return resp.json()["token"]


@pytest.fixture(scope="session")
def test_user_token(client):
    resp = client.post("/api/auth/register", json={
        "username": "testsec_user",
        "password": "testpass123",
        "nickname": "安全测试用户",
    })
    if resp.status_code == 200:
        return resp.json()["token"]
    resp = client.post("/api/auth/login", json={
        "username": "testsec_user",
        "password": "testpass123",
    })
    assert resp.status_code == 200
    return resp.json()["token"]


def test_upload_non_image_rejected(client, test_user_token):
    import io
    resp = client.post(
        "/api/discoveries",
        files={"file": ("test.txt", io.BytesIO(b"hello world"), "text/plain")},
        data={"location_name": "test"},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert resp.status_code == 400


def test_unauthenticated_upload_rejected(client):
    resp = client.get("/uploads/cats/test.jpg")
    assert resp.status_code == 401


def test_expired_jwt_rejected(client):
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.jwt.token"})
    assert resp.status_code == 401


def test_normal_user_admin_endpoint_forbidden(client, test_user_token):
    resp = client.get("/api/admin/me", headers={"Authorization": f"Bearer {test_user_token}"})
    assert resp.status_code == 403


def test_security_headers_present(client):
    resp = client.get("/")
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert "Content-Security-Policy" in resp.headers


def test_schema_validation_cat_name_too_long(client, admin_token):
    resp = client.post(
        "/api/cats",
        json={"name": "x" * 51},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 422


def test_schema_validation_discovery_review_action(client, admin_token):
    resp = client.post(
        "/api/discoveries/999/review",
        json={"action": "hack"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code in (400, 404, 422)
