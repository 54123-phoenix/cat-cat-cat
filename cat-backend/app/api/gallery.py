from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.models import Cat, CatImage, Sighting

router = APIRouter(prefix="/api/gallery", tags=["gallery"])


class GalleryItem:
    def __init__(self, id, image_path, cat_id, cat_name, type, created_at):
        self.id = id
        self.image_path = image_path
        self.cat_id = cat_id
        self.cat_name = cat_name
        self.type = type
        self.created_at = created_at


class GalleryItemResponse:
    id: int
    image_path: Optional[str]
    cat_id: int
    cat_name: Optional[str]
    type: str
    created_at: datetime


@router.get("")
def get_gallery(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    color: Optional[str] = None,
    location: Optional[str] = None,
    db: Session = Depends(get_db),
):
    cat_query = db.query(CatImage).join(Cat, CatImage.cat_id == Cat.id)
    if color:
        cat_query = cat_query.filter(Cat.color.ilike(f"%{color}%"))
    if location:
        cat_query = cat_query.filter(Cat.location.ilike(f"%{location}%"))
    cat_rows = cat_query.order_by(CatImage.created_at.desc()).all()

    sighting_query = db.query(Sighting).join(Cat, Sighting.cat_id == Cat.id)
    if color:
        sighting_query = sighting_query.filter(Cat.color.ilike(f"%{color}%"))
    if location:
        sighting_query = sighting_query.filter(Cat.location.ilike(f"%{location}%"))
    sighting_rows = sighting_query.filter(Sighting.image_path.isnot(None)).order_by(Sighting.created_at.desc()).all()

    items = []
    for img in cat_rows:
        items.append({
            "id": img.id,
            "image_path": img.image_path,
            "cat_id": img.cat_id,
            "cat_name": img.cat.name if img.cat else None,
            "type": "cat",
            "created_at": img.created_at,
        })
    for s in sighting_rows:
        items.append({
            "id": s.id,
            "image_path": s.image_path,
            "cat_id": s.cat_id,
            "cat_name": s.cat.name if s.cat else None,
            "type": "sighting",
            "created_at": s.created_at,
        })

    items.sort(key=lambda x: x["created_at"] or datetime.min, reverse=True)
    total = len(items)
    page = items[skip : skip + limit]
    return {"items": page, "total": total, "has_more": (skip + limit) < total}
