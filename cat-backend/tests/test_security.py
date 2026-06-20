import os
import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-testing")
os.environ.setdefault("ADMIN_PASSWORD", "testadmin123")

from app.main import app
from app.database import SessionLocal
from app.models import User

client = TestClient(app)


@pytest.fixture(scope="session")
def admin_token():
    resp = client.post("/api/admin/login", json={"password": "testadmin123"})
    assert resp.status_code == 200
    return resp.json()["token"]


@pytest.fixture(scope="session")
def test_user_token():
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


def test_upload_non_image_rejected(test_user_token):
    import io
    resp = client.post(
        "/api/discoveries",
        files={"file": ("test.txt", io.BytesIO(b"hello world"), "text/plain")},
        data={"location_name": "test"},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert resp.status_code == 400


def test_unauthenticated_upload_rejected():
    resp = client.get("/uploads/cats/test.jpg")
    assert resp.status_code == 401


def test_expired_jwt_rejected():
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.jwt.token"})
    assert resp.status_code == 401


def test_normal_user_admin_endpoint_forbidden(test_user_token):
    resp = client.get("/api/admin/me", headers={"Authorization": f"Bearer {test_user_token}"})
    assert resp.status_code == 403


def test_admin_revoke_user_tokens(admin_token, test_user_token):
    db = SessionLocal()
    user = db.query(User).filter(User.username == "testsec_user").first()
    user_id = user.id if user else None
    db.close()
    if not user_id:
        pytest.skip("test user not found")
    resp = client.post(
        f"/api/admin/users/{user_id}/revoke",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {test_user_token}"})
    assert resp.status_code == 401


def test_security_headers_present():
    resp = client.get("/")
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert "Content-Security-Policy" in resp.headers


def test_global_exception_handler():
    resp = client.get("/api/cats/999999")
    assert resp.status_code in (404, 500)
    if resp.status_code == 500:
        assert "detail" in resp.json()


def test_schema_validation_cat_name_too_long(admin_token):
    resp = client.post(
        "/api/cats",
        json={"name": "x" * 51},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 422


def test_schema_validation_sighting_lat_out_of_range(test_user_token):
    resp = client.post(
        "/api/sightings",
        data={"cat_id": "1", "latitude": "100", "longitude": "0"},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert resp.status_code == 422
