import os
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas
from app.api.admin import require_admin

router = APIRouter(prefix="/api/cats", tags=["cats"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")


@router.get("", response_model=List[schemas.CatListResponse])
def list_cats(location: Optional[str] = None, skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    return crud.get_cats(db, location=location, skip=skip, limit=limit)


@router.get("/images", response_model=List[schemas.GalleryImageResponse])
def list_gallery_images(skip: int = 0, limit: int = 60, db: Session = Depends(get_db)):
    return crud.get_gallery_images(db, skip=skip, limit=limit)


@router.get("/{cat_id}", response_model=schemas.CatResponse)
def get_cat(cat_id: int, db: Session = Depends(get_db)):
    cat = crud.get_cat(db, cat_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Cat not found")
    return cat


@router.post("", response_model=schemas.CatResponse)
def create_cat(cat: schemas.CatCreate, db: Session = Depends(get_db), _: None = Depends(require_admin)):
    return crud.create_cat(db, cat)


@router.put("/{cat_id}", response_model=schemas.CatResponse)
def update_cat(cat_id: int, cat: schemas.CatUpdate, db: Session = Depends(get_db), _: None = Depends(require_admin)):
    updated = crud.update_cat(db, cat_id, cat)
    if not updated:
        raise HTTPException(status_code=404, detail="Cat not found")
    return updated


@router.delete("/{cat_id}")
def delete_cat(cat_id: int, db: Session = Depends(get_db), _: None = Depends(require_admin)):
    success = crud.delete_cat(db, cat_id)
    if not success:
        raise HTTPException(status_code=404, detail="Cat not found")
    return {"message": "Deleted"}


@router.get("/{cat_id}/images", response_model=List[schemas.CatImageResponse])
def list_cat_images(cat_id: int, db: Session = Depends(get_db)):
    return crud.get_cat_images(db, cat_id)


@router.post("/{cat_id}/images", response_model=schemas.CatImageResponse)
async def upload_cat_image(cat_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), _: None = Depends(require_admin)):
    cat = crud.get_cat(db, cat_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Cat not found")

    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOAD_DIR, "cats", filename)

    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)

    image_path = f"/uploads/cats/{filename}"
    return crud.create_cat_image(db, cat_id, image_path)
