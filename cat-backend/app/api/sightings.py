import os
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app import crud, schemas, models
from app.api.auth import require_auth
from app.models import User
from app.ratelimit import limit
from app.config import settings
from app import events

router = APIRouter(prefix="/api/sightings", tags=["sightings"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
MAX_UPLOAD_SIZE = 10 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _validate_upload(file: UploadFile):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}. Allowed: {', '.join(sorted(ALLOWED_IMAGE_TYPES))}")


@router.get("", response_model=schemas.PaginatedSightingsResponse)
def list_sightings(cat_id: Optional[int] = None, status: Optional[str] = "approved", skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    total = crud.count_sightings(db, cat_id=cat_id, status=status)
    items = crud.get_sightings(db, cat_id=cat_id, status=status, skip=skip, limit=limit)
    has_more = (skip + limit) < total
    return schemas.PaginatedSightingsResponse(items=items, total=total, has_more=has_more)


@router.get("/{sighting_id}", response_model=schemas.SightingResponse)
def get_sighting(sighting_id: int, db: Session = Depends(get_db)):
    sighting = crud.get_sighting(db, sighting_id)
    if not sighting:
        raise HTTPException(status_code=404, detail="Sighting not found")
    return sighting


@router.post("", response_model=schemas.SightingResponse)
@limit(f"{settings.RATE_SIGHTING_PER_MIN}/minute")
async def create_sighting(
    request: Request,
    cat_id: int = Form(...),
    location: Optional[str] = Form(None),
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
        _validate_upload(file)
        ext = os.path.splitext(file.filename)[1]
        filename = f"{uuid.uuid4()}{ext}"
        filepath = os.path.join(UPLOAD_DIR, "sightings", filename)

        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        content = await file.read()
        if len(content) > MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=400, detail=f"File too large. Max size: {MAX_UPLOAD_SIZE // (1024 * 1024)}MB")
        with open(filepath, "wb") as f:
            f.write(content)

        image_path = f"/uploads/sightings/{filename}"

    sighting_status = "pending"
    sighting = schemas.SightingCreate(cat_id=cat_id, location=location, confidence=confidence, activity_type=activity_type, note=note, weather=weather, mood=mood)
    db_sighting = crud.create_sighting(db, sighting, image_path=image_path, spotted_by=current_user.nickname, user_id=current_user.id, status=sighting_status)

    cat = db.query(models.Cat).filter(models.Cat.id == cat_id).first()
    if cat:
        follows = db.query(models.UserCatFollow).filter(models.UserCatFollow.cat_id == cat_id).all()
        for f in follows:
            crud.create_notification(
                db,
                user_id=f.user_id,
                notification_type="cat_update",
                title=f"{cat.name} 有新动态",
                content=f"{cat.name} 被观察到{activity_type or '出现了'}，去看看吧",
                related_id=cat_id,
                related_type="cat",
            )

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
    sighting = db.query(models.Sighting).filter(models.Sighting.id == sighting_id).first()
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
    sighting = db.query(models.Sighting).filter(models.Sighting.id == sighting_id).first()
    if not sighting:
        raise HTTPException(status_code=404, detail="Sighting not found")
    cat = db.query(models.Cat).filter(models.Cat.id == body.cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Cat not found")
    existing = db.query(models.SightingVote).filter(
        models.SightingVote.sighting_id == sighting_id,
        models.SightingVote.user_id == current_user.id,
    ).first()
    if existing:
        existing.cat_id = body.cat_id
    else:
        db.add(models.SightingVote(sighting_id=sighting_id, user_id=current_user.id, cat_id=body.cat_id))
    db.commit()

    rows = db.query(
        models.SightingVote.cat_id,
        func.count(models.SightingVote.id),
    ).filter(models.SightingVote.sighting_id == sighting_id).group_by(models.SightingVote.cat_id).all()
    votes = {cid: cnt for cid, cnt in rows}

    auto_confirmed = False
    grade = sighting.grade or "casual"
    top_cat = None
    top_count = 0
    for cid, cnt in votes.items():
        if cnt > top_count:
            top_count = cnt
            top_cat = cid
    if top_cat is not None and top_count >= 3:
        if sighting.cat_id != top_cat:
            sighting.cat_id = top_cat
        sighting.grade = "research_grade"
        grade = "research_grade"
        auto_confirmed = True
        db.commit()
        correct_voters = db.query(models.SightingVote).filter(
            models.SightingVote.sighting_id == sighting_id,
            models.SightingVote.cat_id == top_cat,
        ).all()
        for v in correct_voters:
            voter = db.query(models.User).filter(models.User.id == v.user_id).first()
            if voter is not None:
                crud.add_xp(db, voter, 3)
        events.publish("sighting_confirmed", {
            "sighting_id": sighting_id,
            "cat_id": top_cat,
            "grade": grade,
            "auto": True,
        })

    return schemas.SightingVoteResponse(
        sighting_id=sighting_id,
        votes=votes,
        auto_confirmed=auto_confirmed,
        grade=grade,
    )
