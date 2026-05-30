import os
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import crud, schemas
from app.api.admin import require_admin
from app.database import get_db

router = APIRouter(prefix="/api/discoveries", tags=["discoveries"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")


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
        ext = os.path.splitext(file.filename)[1]
        filename = f"{uuid.uuid4()}{ext}"
        filepath = os.path.join(UPLOAD_DIR, "discoveries", filename)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "wb") as f:
            f.write(await file.read())
        image_path = f"/uploads/discoveries/{filename}"

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
