import asyncio

from fastapi import APIRouter, UploadFile, File, Request, Depends
from sqlalchemy.orm import Session
from app.schemas import RecognizeResponse
from app.services.ai import recognize_cat_image
from app.ratelimit import limit
from app.config import settings
from app.database import get_db
from app.models import AuditLog
from app.api.upload import validate_upload

router = APIRouter(prefix="/api", tags=["recognize"])


@router.post("/recognize", response_model=RecognizeResponse)
@limit(f"{settings.RATE_RECOGNIZE_PER_MIN}/minute")
async def recognize(request: Request, file: UploadFile = File(...), db: Session = Depends(get_db)):
    image_bytes = await validate_upload(file)
    result = await asyncio.to_thread(recognize_cat_image, image_bytes=image_bytes, filename=file.filename or "")
    try:
        db.add(AuditLog(
            action="recognize",
            entity_type="cat",
            entity_id=result.cat_id,
            performed_by=request.client.host if request.client else "system",
        ))
        db.commit()
    except Exception:
        db.rollback()
    return result
