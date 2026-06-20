from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import crud, schemas
from app.api.admin import require_admin
from app.api.upload import save_upload
from app.database import get_db

router = APIRouter(prefix="/api/discoveries", tags=["discoveries"])


@router.post("", response_model=schemas.DiscoveryResponse)
async def create_discovery(
    location_name: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    note: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    image_path = None
    if file:
        image_path = await save_upload(file, "discoveries")

    return crud.create_discovery(db, image_path=image_path, location_name=location_name, latitude=latitude, longitude=longitude, note=note)


@router.get("", response_model=List[schemas.DiscoveryResponse])
def list_discoveries(status: Optional[str] = None, skip: int = 0, limit: int = 50, db: Session = Depends(get_db), _: None = Depends(require_admin)):
    return crud.get_discoveries(db, status=status, skip=skip, limit=limit)


@router.post("/{discovery_id}/review", response_model=schemas.DiscoveryResponse)
def review_discovery(discovery_id: int, review: schemas.DiscoveryReview, db: Session = Depends(get_db), _: None = Depends(require_admin)):
    try:
        discovery = crud.review_discovery(db, discovery_id, review)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not discovery:
        raise HTTPException(status_code=404, detail="Discovery not found")
    return discovery
