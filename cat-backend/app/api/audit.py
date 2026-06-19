from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas
from app.api.admin import require_admin

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("/logs", response_model=List[schemas.AuditLogResponse])
def list_audit_logs(
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin)
):
    return crud.get_audit_logs(db, action=action, entity_type=entity_type, limit=limit)
