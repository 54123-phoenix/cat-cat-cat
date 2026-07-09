import asyncio
import re

from fastapi import APIRouter, UploadFile, File, Request, Depends
from sqlalchemy.orm import Session
from app.schemas import RecognizeResponse
from app.services.ai import recognize_cat_image
from app.ratelimit import limit
from app.config import settings
from app.database import get_db
from app.models import AuditLog, Cat, CatImage, Sighting
from app.api.upload import validate_upload

router = APIRouter(prefix="/api", tags=["recognize"])


def _cat_photo_summary(cat: Cat, db: Session):
    images = (
        db.query(CatImage)
        .filter(CatImage.cat_id == cat.id)
        .order_by(CatImage.created_at.desc())
        .all()
    )
    avatar = cat.avatar or (images[0].image_path if images else None)
    return avatar, len(images)


def _apply_cat_media(target, cat: Cat, db: Session):
    avatar, photo_count = _cat_photo_summary(cat, db)
    target.cat_avatar = avatar
    target.photo_count = photo_count


def _enrich_result(result, db: Session):
    for candidate in result.candidates or []:
        cat = db.query(Cat).filter(Cat.id == candidate.cat_id).first()
        if cat:
            _apply_cat_media(candidate, cat, db)

    if not result.cat_id:
        return result
    cat = db.query(Cat).filter(Cat.id == result.cat_id).first()
    if not cat:
        return result
    _apply_cat_media(result, cat, db)
    if cat.personality:
        tags = [t.strip() for t in re.split(r"[，,、]", cat.personality) if t.strip()]
        result.personality_tags = tags[:5]
    if cat.location:
        result.campus_zone = cat.location
    sighting_count = db.query(Sighting).filter(Sighting.cat_id == cat.id).count()
    if sighting_count >= 50:
        result.collector_status = "资深观察员"
    elif sighting_count >= 20:
        result.collector_status = "常驻记录者"
    elif sighting_count >= 5:
        result.collector_status = "校园观察员"
    else:
        result.collector_status = "新朋友"
    return result


@router.post("/recognize", response_model=RecognizeResponse)
@limit(f"{settings.RATE_RECOGNIZE_PER_MIN}/minute")
async def recognize(
    request: Request, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    image_bytes = await validate_upload(file)
    result = await asyncio.to_thread(
        recognize_cat_image, image_bytes=image_bytes, filename=file.filename or ""
    )
    try:
        db.add(
            AuditLog(
                action="recognize",
                entity_type="cat",
                entity_id=result.cat_id,
                performed_by=request.client.host if request.client else "system",
            )
        )
        db.commit()
    except Exception:
        db.rollback()
    result = _enrich_result(result, db)
    return result
