from fastapi import APIRouter, UploadFile, File
from app.schemas import RecognizeCandidate, RecognizeResponse

router = APIRouter(prefix="/api", tags=["recognize"])


@router.post("/recognize", response_model=RecognizeResponse)
async def recognize(file: UploadFile = File(...)):
    filename = (file.filename or "").lower()

    # Keep the recognition implementation swappable for the AI teammate.
    # Demo filenames can include "uncertain" or "unknown" to test fallback UI.
    if "unknown" in filename:
        return RecognizeResponse(status="unknown", confidence=0.32)

    if "uncertain" in filename:
        return RecognizeResponse(
            status="uncertain",
            confidence=0.68,
            candidates=[
                RecognizeCandidate(cat_id=1, cat_name="小白", confidence=0.68),
                RecognizeCandidate(cat_id=2, cat_name="橘子", confidence=0.61),
                RecognizeCandidate(cat_id=3, cat_name="黑咪", confidence=0.55),
            ],
        )

    return RecognizeResponse(status="confirmed", cat_id=1, cat_name="小白", confidence=0.92)
