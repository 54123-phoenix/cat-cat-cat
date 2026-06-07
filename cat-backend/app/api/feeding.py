from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas, models
from app.api.auth import require_admin, require_auth

router = APIRouter(prefix="/api/feeding", tags=["feeding"])


@router.get("/points", response_model=List[schemas.FeedingPointResponse])
def list_points(active_only: bool = True, db: Session = Depends(get_db)):
    return crud.get_feeding_points(db, active_only=active_only)


@router.post("/points", response_model=schemas.FeedingPointResponse)
def create_point(
    point: schemas.FeedingPointCreate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return crud.create_feeding_point(db, point)


@router.delete("/points/{point_id}")
def delete_point(
    point_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    success = crud.delete_feeding_point(db, point_id)
    if not success:
        raise HTTPException(status_code=404, detail="Feeding point not found")
    return {"message": "Deleted"}


@router.get("/check-ins", response_model=List[schemas.FeedingCheckInResponse])
def list_check_ins(point_id: Optional[int] = None, limit: int = 50, db: Session = Depends(get_db)):
    return crud.get_feeding_check_ins(db, point_id=point_id, limit=limit)


@router.post("/points/{point_id}/check-in", response_model=schemas.FeedingCheckInResponse)
def create_check_in(
    point_id: int,
    check_in: schemas.FeedingCheckInCreate,
    db: Session = Depends(get_db),
    user=Depends(require_auth),
):
    point = db.query(models.FeedingPoint).filter(models.FeedingPoint.id == point_id).first()
    if not point:
        raise HTTPException(status_code=404, detail="Feeding point not found")
    db_check_in = crud.create_feeding_check_in(db, point_id, check_in, user_id=user.id)
    return schemas.FeedingCheckInResponse(
        id=db_check_in.id,
        point_id=db_check_in.point_id,
        user_id=db_check_in.user_id,
        food_remaining=db_check_in.food_remaining,
        cats_seen=db_check_in.cats_seen,
        note=db_check_in.note,
        created_at=db_check_in.created_at,
        user_nickname=user.nickname,
    )
