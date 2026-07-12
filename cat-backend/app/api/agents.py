from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.agents.runtime import run_cat_intel
from app.agents.schemas import CatIntelRequest, CatIntelResponse
from app.api.auth import require_auth
from app.database import get_db
from app.models import User
from app.ratelimit import limit
from app.config import settings

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.post("/cat-intel/messages", response_model=CatIntelResponse)
@limit(f"{settings.RATE_AGENT_PER_MIN}/minute")
def cat_intel_message(
    request: Request,
    body: CatIntelRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(require_auth),
):
    return run_cat_intel(db, body)
