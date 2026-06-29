from datetime import datetime

from fastapi import APIRouter

from app import schemas
from app.services.model_health import get_model_health

router = APIRouter(prefix="/api/system", tags=["system"])


@router.get("/health", response_model=schemas.SystemHealthResponse)
def system_health(warm_model: bool = False):
    model = get_model_health(warm_model=warm_model)
    return {
        "service": "cat-community",
        "status": model["status"],
        "model": model,
        "checked_at": datetime.utcnow(),
    }
