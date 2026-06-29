import json
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Sighting, AuditLog
from app.api.auth import require_admin, require_reviewer_or_admin, create_token
from app import schemas, models, crud
from app.config import settings
from app.ratelimit import limit
from passlib.context import CryptContext

router = APIRouter(prefix="/api/admin", tags=["admin"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AdminLoginRequest(BaseModel):
    password: str


class AdminLoginResponse(BaseModel):
    token: str
    token_type: str = "bearer"


@router.post("/login", response_model=AdminLoginResponse)
@limit(f"{settings.RATE_LOGIN_PER_MIN}/minute")
def login(request: Request, payload: AdminLoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.role == "admin").first()
    if not user:
        raise HTTPException(status_code=401, detail="No admin account configured. Set ADMIN_PASSWORD and restart.")
    if not pwd_context.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid admin password")
    return AdminLoginResponse(token=create_token(user))


@router.get("/me")
def me(user: User = Depends(require_reviewer_or_admin)):
    return {"role": user.role, "nickname": user.nickname}


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), _: User = Depends(require_reviewer_or_admin)):
    week_start = datetime.now() - timedelta(days=7)
    pending_discoveries = db.query(models.Discovery).filter(models.Discovery.status == "pending").count()
    pending_reports = db.query(models.Report).filter(models.Report.status == "pending").count()
    pending_sightings = db.query(models.Sighting).filter(models.Sighting.status == "pending").count()
    recent_sightings = db.query(models.Sighting).filter(models.Sighting.created_at >= week_start).count()
    total_cats = db.query(models.Cat).count()
    total_users = db.query(models.User).count()

    hot_locations = db.query(
        models.Sighting.location_name,
        models.Sighting.location,
        func.count(models.Sighting.id).label("count"),
    ).filter(
        models.Sighting.created_at >= week_start,
    ).group_by(
        models.Sighting.location_name,
        models.Sighting.location,
    ).order_by(func.count(models.Sighting.id).desc()).limit(5).all()

    active_users = db.query(models.User).order_by(models.User.xp.desc()).limit(5).all()
    recent_audit_logs = crud.get_audit_logs(db, limit=5)

    return {
        "summary": {
            "pending_discoveries": pending_discoveries,
            "pending_reports": pending_reports,
            "pending_sightings": pending_sightings,
            "recent_sightings": recent_sightings,
            "total_cats": total_cats,
            "total_users": total_users,
        },
        "hot_locations": [
            {
                "name": row.location_name or row.location or "校园某处",
                "count": int(row.count),
            }
            for row in hot_locations
        ],
        "active_contributors": [
            {
                "id": user.id,
                "nickname": user.nickname,
                "avatar": user.avatar,
                "xp": user.xp or 0,
                "level": crud.compute_level(user.xp or 0),
                "contribution_score": crud.get_user_contribution_stats(db, user.id)["contribution_score"],
            }
            for user in active_users
        ],
        "recent_audit_logs": [
            {
                "id": log.id,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "performed_by": log.performed_by,
                "created_at": log.created_at,
            }
            for log in recent_audit_logs
        ],
    }


@router.get("/sightings", response_model=List[schemas.SightingListItem])
def list_pending_sightings(
    status: Optional[str] = "pending",
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(require_reviewer_or_admin),
):
    q = db.query(Sighting)
    if status:
        q = q.filter(Sighting.status == status)
    return q.order_by(Sighting.created_at.desc()).offset(skip).limit(limit).all()


@router.post("/sightings/{sighting_id}/review")
def review_sighting(
    sighting_id: int,
    payload: schemas.SightingReviewRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_reviewer_or_admin),
):
    sighting = db.query(Sighting).filter(Sighting.id == sighting_id).first()
    if not sighting:
        raise HTTPException(status_code=404, detail="Sighting not found")
    if payload.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Action must be approve or reject")

    old_status = sighting.status
    sighting.status = payload.action + "d"
    sighting_id_val = sighting.id

    log = AuditLog(
        action=f"review_{payload.action}",
        entity_type="sighting",
        entity_id=sighting_id_val,
        old_value=json.dumps({"status": old_status}),
        new_value=json.dumps({"status": sighting.status, "reason": payload.reject_reason}),
        performed_by=admin.nickname,
        created_at=datetime.now(),
    )
    db.add(log)
    db.commit()

    return {"ok": True, "status": sighting.status}


@router.post("/users/{user_id}/revoke")
def revoke_user_tokens(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.token_version = (user.token_version or 0) + 1
    db.commit()
    return {"ok": True, "token_version": user.token_version}
