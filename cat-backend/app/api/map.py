from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas

router = APIRouter(prefix="/api/map", tags=["map"])


@router.get("/heatmap", response_model=schemas.PaginatedHeatmapResponse)
def heatmap(days: int = 7, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    if days < 0 or days > 365:
        raise HTTPException(status_code=400, detail="days must be between 0 and 365")
    if limit < 1 or limit > 500:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 500")
    total = crud.count_heatmap_points(db, days=days)
    items = crud.get_heatmap_points(db, days=days, limit=limit)
    has_more = (skip + limit) < total
    return schemas.PaginatedHeatmapResponse(items=items, total=total, has_more=has_more)
