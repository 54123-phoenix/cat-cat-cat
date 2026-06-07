import os
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas, models

router = APIRouter(prefix="/api/sightings", tags=["sightings"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")


@router.get("", response_model=List[schemas.SightingResponse])
def list_sightings(cat_id: Optional[int] = None, status: Optional[str] = "approved", skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    return crud.get_sightings(db, cat_id=cat_id, status=status, skip=skip, limit=limit)


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
    activity_type: Optional[str] = Form(None),
    note: Optional[str] = Form(None),
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

    sighting_status = "pending" if file else "approved"
    sighting = schemas.SightingCreate(cat_id=cat_id, location=location, confidence=confidence, activity_type=activity_type, note=note)
    db_sighting = crud.create_sighting(db, sighting, image_path=image_path, spotted_by="铲屎官", status=sighting_status)

    cat = db.query(models.Cat).filter(models.Cat.id == cat_id).first()
    if cat:
        follows = db.query(models.UserCatFollow).filter(models.UserCatFollow.cat_id == cat_id).all()
        for f in follows:
            crud.create_notification(
                db,
                user_id=f.user_id,
                notification_type="cat_update",
                title=f"{cat.name} 有新动态",
                content=f"{cat.name} 被观察到{activity_type or '出现了'}，去看看吧",
                related_id=cat_id,
                related_type="cat",
            )

    return db_sighting
