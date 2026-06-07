from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas
from app.api.auth import require_admin

router = APIRouter(prefix="/api/cats", tags=["health"])


@router.get("/{cat_id}/health", response_model=List[schemas.HealthRecordResponse])
def list_health_records(
    cat_id: int,
    record_type: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    return crud.get_health_records(db, cat_id=cat_id, record_type=record_type, limit=limit)


@router.post("/{cat_id}/health", response_model=schemas.HealthRecordResponse)
def create_health_record(
    cat_id: int,
    record: schemas.HealthRecordCreate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    return crud.create_health_record(db, cat_id=cat_id, record=record, created_by=admin.id)


@router.delete("/{cat_id}/health/{record_id}")
def delete_health_record(
    cat_id: int,
    record_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    success = crud.delete_health_record(db, record_id)
    if not success:
        raise HTTPException(status_code=404, detail="Health record not found")
    return {"message": "Deleted"}
