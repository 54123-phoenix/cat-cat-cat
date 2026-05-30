from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas

router = APIRouter(prefix="/api/map", tags=["map"])


@router.get("/heatmap", response_model=List[schemas.HeatmapPoint])
def heatmap(days: int = 7, limit: int = 100, db: Session = Depends(get_db)):
    if days < 0 or days > 365:
        raise HTTPException(status_code=400, detail="days must be between 0 and 365")
    if limit < 1 or limit > 500:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 500")
    return crud.get_heatmap_points(db, days=days, limit=limit)
