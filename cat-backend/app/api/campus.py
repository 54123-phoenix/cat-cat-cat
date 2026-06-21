from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas
from app.api.auth import require_admin
from app.models import User

router = APIRouter(prefix="/api/campuses", tags=["campuses"])


@router.get("", response_model=List[schemas.CampusResponse])
def list_campuses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_campuses(db, skip=skip, limit=limit)


@router.get("/{campus_id}", response_model=schemas.CampusResponse)
def get_campus(campus_id: int, db: Session = Depends(get_db)):
    campus = crud.get_campus(db, campus_id)
    if not campus:
        raise HTTPException(status_code=404, detail="Campus not found")
    return campus


@router.post("", response_model=schemas.CampusResponse)
def create_campus(campus: schemas.CampusCreate, db: Session = Depends(get_db), _user: User = Depends(require_admin)):
    existing = crud.get_campus_by_slug(db, campus.slug)
    if existing:
        raise HTTPException(status_code=400, detail="Campus slug already exists")
    return crud.create_campus(db, campus)
