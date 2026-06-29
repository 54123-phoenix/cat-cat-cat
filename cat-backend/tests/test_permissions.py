import os
from types import SimpleNamespace

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-key-for-pytest")
os.environ.setdefault("ADMIN_PASSWORD", "testadmin123")
os.environ.setdefault("DEMO_PASSWORD", "testdemo123")
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("INIT_DEMO_USER", "0")

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import crud, models, schemas
from app.api.auth import require_admin, require_reviewer_or_admin
from app.api.discoveries import review_discovery as review_discovery_route
from app.api.posts import HandleAction, handle_report as handle_report_route
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


def test_reviewer_or_admin_helper_allows_reviewer_and_admin():
    reviewer = SimpleNamespace(role="reviewer", nickname="Reviewer")
    admin = SimpleNamespace(role="admin", nickname="Admin")

    assert require_reviewer_or_admin(reviewer) is reviewer
    assert require_reviewer_or_admin(admin) is admin


def test_role_helpers_reject_lower_privilege_users():
    user = SimpleNamespace(role="user", nickname="User")
    reviewer = SimpleNamespace(role="reviewer", nickname="Reviewer")

    with pytest.raises(HTTPException) as user_error:
        require_reviewer_or_admin(user)
    assert user_error.value.status_code == 403

    with pytest.raises(HTTPException) as reviewer_error:
        require_admin(reviewer)
    assert reviewer_error.value.status_code == 403


def test_reviewer_can_review_discovery_and_writes_audit_log(db):
    reviewer = SimpleNamespace(id=10, role="reviewer", nickname="ReviewLead")
    discovery = crud.create_discovery(
        db,
        location_name="Library Lawn",
        note="Maybe a new cat",
    )

    reviewed = review_discovery_route(
        discovery_id=discovery.id,
        review=schemas.DiscoveryReview(action="reject"),
        db=db,
        admin=reviewer,
    )

    log = db.query(models.AuditLog).filter(models.AuditLog.entity_type == "discovery").one()
    assert reviewed.status == "rejected"
    assert log.action == "reject"
    assert log.performed_by == "ReviewLead"
    assert '"status":"pending"' in log.old_value
    assert '"status":"rejected"' in log.new_value


def test_reviewer_can_handle_report_and_writes_audit_log(db):
    reviewer = models.User(username="reviewer", password_hash="x", nickname="ReportLead", role="reviewer")
    reporter = models.User(username="reporter", password_hash="x", nickname="Reporter", role="user")
    post = models.Post(user_id=1, topic="daily", content="needs moderation", status="reported")
    db.add_all([reviewer, reporter, post])
    db.commit()
    db.refresh(reviewer)
    db.refresh(reporter)
    post.user_id = reporter.id
    db.commit()
    db.refresh(post)
    report = models.Report(
        post_id=post.id,
        reported_by=reporter.id,
        reason="spam",
        status="pending",
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    result = handle_report_route(
        report_id=report.id,
        body=HandleAction(action="hide"),
        db=db,
        user=reviewer,
    )

    updated_report = db.query(models.Report).filter(models.Report.id == report.id).one()
    updated_post = db.query(models.Post).filter(models.Post.id == post.id).one()
    log = db.query(models.AuditLog).filter(models.AuditLog.entity_type == "report").one()
    assert result == {"ok": True}
    assert updated_report.status == "resolved"
    assert updated_post.status == "hidden"
    assert log.action == "report_hide"
    assert log.performed_by == "ReportLead"
    assert '"status":"pending"' in log.old_value
    assert '"status":"resolved"' in log.new_value
