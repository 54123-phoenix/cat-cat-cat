from fastapi import APIRouter, UploadFile, File
from app.schemas import RecognizeResponse
from app.services.ai import recognize_cat_image

router = APIRouter(prefix="/api", tags=["recognize"])


@router.post("/recognize", response_model=RecognizeResponse)
async def recognize(file: UploadFile = File(...)):
    return recognize_cat_image(filename=file.filename or "")
