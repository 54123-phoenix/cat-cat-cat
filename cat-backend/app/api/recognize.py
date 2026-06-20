import asyncio

from fastapi import APIRouter, UploadFile, File, Request
from app.schemas import RecognizeResponse
from app.services.ai import recognize_cat_image
from app.ratelimit import limit
from app.config import settings

router = APIRouter(prefix="/api", tags=["recognize"])


@router.post("/recognize", response_model=RecognizeResponse)
@limit(f"{settings.RATE_RECOGNIZE_PER_MIN}/minute")
async def recognize(request: Request, file: UploadFile = File(...)):
    image_bytes = await file.read()
    return await asyncio.to_thread(recognize_cat_image, image_bytes=image_bytes, filename=file.filename or "")
