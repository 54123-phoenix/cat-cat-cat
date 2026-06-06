from fastapi import APIRouter, UploadFile, File
from app.schemas import RecognizeResponse
from app.services.ai import recognize_cat_image

router = APIRouter(prefix="/api", tags=["recognize"])


@router.post("/recognize", response_model=RecognizeResponse)
async def recognize(file: UploadFile = File(...)):
    image_bytes = await file.read()
    return recognize_cat_image(image_bytes=image_bytes, filename=file.filename or "")
