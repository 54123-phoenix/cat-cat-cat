"""API fixture credentials remain independent of deployment settings."""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app_fixture import TEST_ADMIN_PASSWORD, isolated_client


@pytest.mark.parametrize("ambient_password", ["", "different-ci-admin-password"])
def test_fixture_login_ignores_ambient_password_and_restores_settings(monkeypatch, ambient_password):
    from app.config import settings
    from app.ratelimit import limiter

    # This regression exercises credentials, independent of shared login quotas.
    monkeypatch.setattr(limiter, "enabled", False)
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", ambient_password)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    try:
        with isolated_client(engine, sessionmaker(bind=engine)) as client:
            login = client.post("/api/auth/login", json={"username": "admin", "password": TEST_ADMIN_PASSWORD})
            assert login.status_code == 200
            assert login.json()["user"]["role"] == "admin"
            assert client.post("/api/admin/login", json={"password": TEST_ADMIN_PASSWORD}).status_code == 200
            assert client.post("/api/admin/login", json={"password": ambient_password or "wrong-password"}).status_code == 401
        assert settings.ADMIN_PASSWORD == ambient_password
    finally:
        engine.dispose()
