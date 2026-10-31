import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas, models
from app.api.auth import require_auth, optional_auth
from app.api.upload import save_upload
from app.models import User
from app.ratelimit import limit
from app.config import settings
from app import events

router = APIRouter(prefix="/api/sightings", tags=["sightings"])


@router.get("", response_model=schemas.PaginatedSightingsResponse)
def list_sightings(cat_id: Optional[int] = None, status: str = "approved", skip: int = 0, limit: int = 20, mine: bool = False, db: Session = Depends(get_db), user=Depends(optional_auth)):
    if status not in {"approved", "pending", "rejected", "all"}:
        raise HTTPException(status_code=400, detail="Invalid sighting status")
    if mine and user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if status != "approved" and not mine and (user is None or user.role not in {"admin", "reviewer"}):
        raise HTTPException(status_code=403, detail="Review access required")
    owner_id = user.id if mine else None
    query_status = None if status == "all" else status
    total = crud.count_sightings(db, cat_id=cat_id, status=query_status, user_id=owner_id)
    items = crud.get_sightings(db, cat_id=cat_id, status=query_status, skip=skip, limit=limit, user_id=owner_id)
    has_more = (skip + limit) < total
    return schemas.PaginatedSightingsResponse(items=items, total=total, has_more=has_more)


@router.get("/{sighting_id}", response_model=schemas.SightingResponse)
def get_sighting(sighting_id: int, db: Session = Depends(get_db), user=Depends(optional_auth)):
    sighting = crud.get_sighting(db, sighting_id)
    if not sighting:
        raise HTTPException(status_code=404, detail="Sighting not found")
    if sighting.status != "approved" and (user is None or (user.id != sighting.user_id and user.role not in {"admin", "reviewer"})):
        raise HTTPException(status_code=404, detail="Sighting not found")
    return sighting


@router.post("", response_model=schemas.SightingResponse)
@limit(f"{settings.RATE_SIGHTING_PER_MIN}/minute")
async def create_sighting(
    request: Request,
    cat_id: int = Form(...),
    location: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    location_name: Optional[str] = Form(None),
    confidence: Optional[float] = Form(None),
    activity_type: Optional[str] = Form(None),
    note: Optional[str] = Form(None),
    weather: Optional[str] = Form(None),
    mood: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth),
):
    image_path = None
    if file:
        image_path = await save_upload(file, "sightings")

    sighting_status = "pending"
    sighting = schemas.SightingCreate(cat_id=cat_id, location=location, latitude=latitude, longitude=longitude, location_name=location_name, confidence=confidence, activity_type=activity_type, note=note, weather=weather, mood=mood)
    db_sighting = crud.create_sighting(db, sighting, image_path=image_path, spotted_by=current_user.nickname, user_id=current_user.id, status=sighting_status)

    return db_sighting


def _recompute_grade(sighting) -> str:
    c = sighting.confirmations or 0
    if c >= 2:
        sighting.grade = "research_grade"
    elif c == 1:
        sighting.grade = "needs_id"
    else:
        sighting.grade = "casual"
    return sighting.grade


@router.post("/{sighting_id}/confirm", response_model=schemas.SightingConfirmResponse)
def confirm_sighting(sighting_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_auth)):
    sighting = get_sighting(sighting_id, db, current_user)
    if not sighting:
        raise HTTPException(status_code=404, detail="Sighting not found")
    existing = db.query(models.SightingConfirmation).filter(
        models.SightingConfirmation.sighting_id == sighting_id,
        models.SightingConfirmation.user_id == current_user.id,
    ).first()
    if existing:
        return schemas.SightingConfirmResponse(
            sighting_id=sighting_id,
            confirmations=sighting.confirmations or 0,
            grade=sighting.grade or "casual",
        )
    db.add(models.SightingConfirmation(sighting_id=sighting_id, user_id=current_user.id))
    sighting.confirmations = (sighting.confirmations or 0) + 1
    grade = _recompute_grade(sighting)
    db.commit()
    crud.add_xp(db, current_user, 2)
    events.publish("sighting_confirmed", {
        "sighting_id": sighting_id,
        "confirmations": sighting.confirmations,
        "grade": grade,
        "user_id": current_user.id,
        "user_nickname": current_user.nickname,
    })
    return schemas.SightingConfirmResponse(
        sighting_id=sighting_id,
        confirmations=sighting.confirmations,
        grade=grade,
    )


@router.post("/{sighting_id}/vote", response_model=schemas.SightingVoteResponse)
def vote_sighting(sighting_id: int, body: schemas.SightingVoteRequest, db: Session = Depends(get_db), current_user: User = Depends(require_auth)):
    sighting = get_sighting(sighting_id, db, current_user)
    if not sighting:
        raise HTTPException(status_code=404, detail="Sighting not found")
    cat = db.query(models.Cat).filter(models.Cat.id == body.cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Cat not found")
    from app.services.voting import settle_vote
    votes, auto_confirmed, grade, changed = settle_vote(db, sighting_id, current_user.id, body.cat_id)
    if changed:
        events.publish("sighting_confirmed", {
            "sighting_id": sighting_id,
            "cat_id": sighting.cat_id,
            "grade": grade,
            "auto": True,
        })

    return schemas.SightingVoteResponse(
        sighting_id=sighting_id,
        votes=votes,
        auto_confirmed=auto_confirmed,
        grade=grade,
    )
