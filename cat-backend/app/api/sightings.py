import os
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas

router = APIRouter(prefix="/api/sightings", tags=["sightings"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")


@router.get("", response_model=List[schemas.SightingResponse])
def list_sightings(cat_id: Optional[int] = None, skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    return crud.get_sightings(db, cat_id=cat_id, skip=skip, limit=limit)


@router.get("/{sighting_id}", response_model=schemas.SightingResponse)
def get_sighting(sighting_id: int, db: Session = Depends(get_db)):
    sighting = crud.get_sighting(db, sighting_id)
    if not sighting:
        raise HTTPException(status_code=404, detail="Sighting not found")
    return sighting


@router.post("", response_model=schemas.SightingResponse)
async def create_sighting(
    cat_id: int = Form(...),
    location: Optional[str] = Form(None),
    confidence: Optional[float] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    image_path = None
    if file:
        ext = os.path.splitext(file.filename)[1]
        filename = f"{uuid.uuid4()}{ext}"
        filepath = os.path.join(UPLOAD_DIR, "sightings", filename)

        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, "wb") as f:
            content = await file.read()
            f.write(content)

        image_path = f"/uploads/sightings/{filename}"

    sighting = schemas.SightingCreate(cat_id=cat_id, location=location, confidence=confidence)
    return crud.create_sighting(db, sighting, image_path=image_path)
