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

from app.models import User

_test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_test_engine)

from app_fixture import isolated_client


@pytest.fixture(scope="module")
def client():
    with isolated_client(_test_engine, _TestSessionLocal) as c:
        yield c


@pytest.fixture(scope="module")
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


@pytest.fixture(scope="module")
def test_user_token(client):
    resp = client.post("/api/auth/register", json={
        "username": "testext_user",
        "password": "testpass123",
        "nickname": "扩展测试用户",
    })
    if resp.status_code == 200:
        return resp.json()["token"]
    resp = client.post("/api/auth/login", json={
        "username": "testext_user",
        "password": "testpass123",
    })
    assert resp.status_code == 200
    return resp.json()["token"]


class TestNotifications:
    def test_list_requires_auth(self, client):
        resp = client.get("/api/notifications")
        assert resp.status_code == 401

    def test_list_with_auth(self, client, test_user_token):
        resp = client.get("/api/notifications", headers={"Authorization": f"Bearer {test_user_token}"})
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)


class TestFeedingPoints:
    def test_list_points(self, client, admin_token):
        resp = client.get("/api/feeding/points", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200

    def test_create_point(self, client, admin_token):
        resp = client.post("/api/feeding/points", json={
            "name": "测试喂猫点",
            "latitude": 31.3,
            "longitude": 121.5,
        }, headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code in (200, 201, 422)


class TestFollows:
    def test_get_follows(self, client, test_user_token):
        resp = client.get("/api/user/follows", headers={"Authorization": f"Bearer {test_user_token}"})
        assert resp.status_code == 200

    def test_follow_cat(self, client, test_user_token):
        resp = client.post("/api/user/follows/1", headers={"Authorization": f"Bearer {test_user_token}"})
        assert resp.status_code in (200, 404)

    def test_unfollow_cat(self, client, test_user_token):
        resp = client.delete("/api/user/follows/1", headers={"Authorization": f"Bearer {test_user_token}"})
        assert resp.status_code in (200, 404)


class TestPostsExtended:
    def test_create_comment(self, client, test_user_token, admin_token):
        post_resp = client.post("/api/posts", data={"topic": "daily", "content": "测试帖子评论", "tags": "[]", "pollOptions": "[]"}, headers={"Authorization": f"Bearer {test_user_token}"})
        if post_resp.status_code != 200:
            pytest.skip("post creation failed")
        post_id = post_resp.json()["id"]
        resp = client.post(f"/api/posts/{post_id}/comments", json={"content": "测试评论"}, headers={"Authorization": f"Bearer {test_user_token}"})
        assert resp.status_code == 200

    def test_like_post(self, client, test_user_token, admin_token):
        posts = client.get("/api/posts?limit=1", headers={"Authorization": f"Bearer {test_user_token}"})
        if not posts.json().get("items"):
            pytest.skip("no posts")
        post_id = posts.json()["items"][0]["id"]
        resp = client.post(f"/api/posts/{post_id}/like", headers={"Authorization": f"Bearer {test_user_token}"})
        assert resp.status_code == 200

    def test_report_post(self, client, test_user_token, admin_token):
        posts = client.get("/api/posts?limit=1", headers={"Authorization": f"Bearer {test_user_token}"})
        if not posts.json().get("items"):
            pytest.skip("no posts")
        post_id = posts.json()["items"][0]["id"]
        resp = client.post(f"/api/posts/{post_id}/report", json={"reason": "测试举报"}, headers={"Authorization": f"Bearer {test_user_token}"})
        assert resp.status_code in (200, 400)


class TestEdgeCases:
    def test_empty_body_returns_error(self, client, test_user_token):
        resp = client.post("/api/posts", headers={"Authorization": f"Bearer {test_user_token}", "Content-Type": "application/json"})
        assert resp.status_code in (400, 422)

    def test_invalid_topic(self, client, test_user_token):
        resp = client.get("/api/posts?topic=hack", headers={"Authorization": f"Bearer {test_user_token}"})
        assert resp.status_code == 400

    def test_negative_skip(self, client, test_user_token):
        resp = client.get("/api/cats?skip=-1", headers={"Authorization": f"Bearer {test_user_token}"})
        assert resp.status_code in (200, 400, 422)
