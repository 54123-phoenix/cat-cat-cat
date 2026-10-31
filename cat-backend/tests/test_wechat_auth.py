import asyncio
import os
from types import SimpleNamespace

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-key-for-pytest")
os.environ.setdefault("ADMIN_PASSWORD", "testadmin123")
os.environ.setdefault("DATABASE_URL", "sqlite://")

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api import auth
from app.config import Settings
from app.database import Base, get_db
from app.models import User
from app.ratelimit import limiter
from app.services import wechat


@pytest.fixture
def setup(monkeypatch):
    config = SimpleNamespace(WECHAT_DEV_MODE=False, WECHAT_APPID="", WECHAT_SECRET="")
    monkeypatch.setattr(wechat, "settings", config)
    if limiter is not None:
        monkeypatch.setattr(limiter, "enabled", False)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    app = FastAPI()
    app.include_router(auth.router)
    app.dependency_overrides[get_db] = lambda: session
    with TestClient(app) as client:
        yield config, client, session
    session.close()
    engine.dispose()


def test_dev_mode_defaults_off(monkeypatch):
    monkeypatch.delenv("WECHAT_DEV_MODE", raising=False)
    assert Settings(_env_file=None).WECHAT_DEV_MODE is False


@pytest.mark.parametrize("value,expected", [("0", False), ("1", True)])
def test_dev_mode_environment_is_respected(monkeypatch, value, expected):
    monkeypatch.setenv("WECHAT_DEV_MODE", value)
    assert Settings(_env_file=None).WECHAT_DEV_MODE is expected


@pytest.mark.parametrize("appid,secret", [("", ""), ("appid", ""), ("", "secret")])
def test_missing_credentials_never_create_identity(setup, appid, secret):
    config, client, db = setup
    config.WECHAT_APPID, config.WECHAT_SECRET = appid, secret
    response = client.post("/api/auth/wechat-login", json={"code": "samepref-code"})
    assert response.status_code == 400
    assert "token" not in response.json()
    assert db.query(User).count() == 0


def test_explicit_dev_mode_uses_full_code_and_stable_identity(setup):
    config, client, db = setup
    config.WECHAT_DEV_MODE = True
    first = client.post("/api/auth/wechat-login", json={"code": "samepref-first"})
    second = client.post("/api/auth/wechat-login", json={"code": "samepref-second"})
    repeated = client.post("/api/auth/wechat-login", json={"code": "samepref-first"})
    assert [first.status_code, second.status_code, repeated.status_code] == [200, 200, 200]
    assert first.json()["user"]["id"] != second.json()["user"]["id"]
    assert first.json()["user"]["id"] == repeated.json()["user"]["id"]
    assert repeated.json()["is_new"] is False
    assert db.query(User).count() == 2


def test_empty_code_is_rejected_even_in_dev_mode(setup):
    config, client, db = setup
    config.WECHAT_DEV_MODE = True
    assert client.post("/api/auth/wechat-login", json={"code": " "}).status_code == 400
    assert db.query(User).count() == 0


@pytest.mark.parametrize("status,body", [(200, {"errcode": 40029}), (502, {"openid": "bad"}), (200, {})])
def test_provider_failures_do_not_fall_back_to_dev(setup, monkeypatch, status, body):
    config, client, db = setup
    config.WECHAT_APPID, config.WECHAT_SECRET = "appid", "secret"
    async_client = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(status, json=body))
    monkeypatch.setattr(wechat.httpx, "AsyncClient", lambda: async_client(transport=transport))
    response = client.post("/api/auth/wechat-login", json={"code": "bad-code"})
    assert response.status_code == 400
    assert "token" not in response.json()
    assert db.query(User).count() == 0


def test_provider_identity_is_reused_and_usernames_do_not_collide(setup, monkeypatch):
    config, client, db = setup
    config.WECHAT_APPID, config.WECHAT_SECRET = "appid", "secret"
    async_client = httpx.AsyncClient
    def provider(request):
        assert request.url.params["appid"] == "appid"
        assert request.url.params["secret"] == "secret"
        identity = "same-prefix-" + request.url.params["js_code"]
        return httpx.Response(200, json={"openid": identity, "session_key": "test-key"})
    monkeypatch.setattr(wechat.httpx, "AsyncClient", lambda: async_client(transport=httpx.MockTransport(provider)))
    first = client.post("/api/auth/wechat-login", json={"code": "first"})
    second = client.post("/api/auth/wechat-login", json={"code": "second"})
    repeated = client.post("/api/auth/wechat-login", json={"code": "first"})
    assert [r.status_code for r in (first, second, repeated)] == [200, 200, 200]
    assert first.json()["user"]["id"] == repeated.json()["user"]["id"]
    assert db.query(User).count() == 2


def test_access_token_requires_credentials_unless_dev_enabled(setup):
    config, _, _ = setup
    with pytest.raises(ValueError):
        asyncio.run(wechat.get_access_token())
    config.WECHAT_DEV_MODE = True
    assert asyncio.run(wechat.get_access_token()) == "dev_access_token"
