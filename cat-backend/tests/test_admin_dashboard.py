import os
from datetime import datetime
from types import SimpleNamespace

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
from app.api.admin import dashboard
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


def test_admin_dashboard_summarizes_workflow_and_activity(db):
    admin = models.User(username="admin_dash", password_hash="x", nickname="Admin", role="admin", xp=100)
    contributor = models.User(username="active_dash", password_hash="x", nickname="Active", role="user", xp=300)
    cat = models.Cat(name="DashCat", location="图书馆")
    post = models.Post(user_id=contributor.id, topic="daily", content="需要处理", status="reported")
    db.add_all([admin, contributor, cat])
    db.commit()
    db.refresh(contributor)
    db.refresh(cat)
    post.user_id = contributor.id
    db.add(post)
    db.commit()
    db.refresh(post)

    db.add(models.Discovery(location_name="图书馆", status="pending"))
    db.add(models.Report(post_id=post.id, reported_by=contributor.id, reason="测试", status="pending"))
    db.add(models.Sighting(cat_id=cat.id, user_id=contributor.id, status="pending", location_name="图书馆", created_at=datetime.now()))
    db.commit()
    crud.create_audit_log(db, action="update", entity_type="cat", entity_id=cat.id, performed_by="Admin")

    result = dashboard(db=db, _=SimpleNamespace(role="admin"))

    assert result["summary"]["pending_discoveries"] == 1
    assert result["summary"]["pending_reports"] == 1
    assert result["summary"]["pending_sightings"] == 1
    assert result["hot_locations"][0]["name"] == "图书馆"
    assert result["active_contributors"][0]["nickname"] == "Active"
    assert result["recent_audit_logs"][0]["entity_type"] == "cat"
