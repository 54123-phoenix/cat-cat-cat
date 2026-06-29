import os
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

from app import crud, models, schemas
from app.api.cats import create_cat as create_cat_route
from app.api.cats import delete_cat as delete_cat_route
from app.api.cats import update_cat as update_cat_route
from app.api.discoveries import review_discovery as review_discovery_route
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


def test_cat_profile_changes_write_audit_logs(db):
    admin = SimpleNamespace(nickname="AuditAdmin")

    created = create_cat_route(
        cat=schemas.CatCreate(name="AuditCat", location="测试草坪"),
        db=db,
        user=admin,
    )
    update_cat_route(
        cat_id=created.id,
        cat=schemas.CatUpdate(name="AuditCatRenamed", location="图书馆"),
        db=db,
        user=admin,
    )
    delete_cat_route(cat_id=created.id, db=db, user=admin)

    logs = db.query(models.AuditLog).filter(models.AuditLog.entity_type == "cat").order_by(models.AuditLog.id).all()
    assert [log.action for log in logs] == ["create", "update", "delete"]
    assert logs[0].performed_by == "AuditAdmin"
    assert "AuditCat" in logs[1].old_value
    assert "AuditCatRenamed" in logs[1].new_value


def test_discovery_review_writes_status_audit_log(db):
    admin = SimpleNamespace(nickname="ReviewAdmin")
    discovery = crud.create_discovery(
        db,
        location_name="测试草坪",
        note="疑似新猫",
    )

    reviewed = review_discovery_route(
        discovery_id=discovery.id,
        review=schemas.DiscoveryReview(action="reject"),
        db=db,
        admin=admin,
    )

    log = db.query(models.AuditLog).filter(models.AuditLog.entity_type == "discovery").one()
    assert reviewed.status == "rejected"
    assert log.action == "reject"
    assert log.performed_by == "ReviewAdmin"
    assert '"status":"pending"' in log.old_value
    assert '"status":"rejected"' in log.new_value
