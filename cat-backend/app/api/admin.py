import json
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Sighting, AuditLog
from app.api.auth import require_admin, create_token
from app import schemas
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
def me(user: User = Depends(require_admin)):
    return {"role": user.role, "nickname": user.nickname}


@router.get("/sightings", response_model=List[schemas.SightingListItem])
def list_pending_sightings(
    status: Optional[str] = "pending",
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
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
    admin: User = Depends(require_admin),
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
