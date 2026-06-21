import math
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas
from app.api.auth import require_admin
from app.api.upload import validate_upload, save_upload, UPLOAD_DIR, MAX_UPLOAD_SIZE, ALLOWED_IMAGE_TYPES
from app.models import User

router = APIRouter(prefix="/api/cats", tags=["cats"])


@router.get("", response_model=schemas.PaginatedCatsResponse)
def list_cats(location: Optional[str] = None, skip: int = 0, limit: int = 200, db: Session = Depends(get_db)):
    total = crud.count_cats(db, location=location)
    items = crud.get_cats(db, location=location, skip=skip, limit=limit)
    has_more = (skip + limit) < total
    return schemas.PaginatedCatsResponse(items=items, total=total, has_more=has_more)


@router.get("/nearby", tags=["cats"])
def nearby_cats(
    lat: float = Query(..., description="Latitude of the search center"),
    lng: float = Query(..., description="Longitude of the search center"),
    radius_km: float = Query(1.0, gt=0, description="Search radius in kilometers"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    if not -90 <= lat <= 90:
        raise HTTPException(status_code=422, detail="Latitude must be between -90 and 90")
    if not -180 <= lng <= 180:
        raise HTTPException(status_code=422, detail="Longitude must be between -180 and 180")

    rows = crud.get_nearby_sightings(db, lat, lng, radius_km)

    cat_distances = {}
    for cat_id, s_lat, s_lng, created_at, cat_name, cat_avatar in rows:
        dist = _haversine(lat, lng, s_lat, s_lng)
        if dist > radius_km:
            continue
        if cat_id not in cat_distances or created_at > cat_distances[cat_id]["latest_sighting_at"]:
            cat_distances[cat_id] = {
                "distance_km": dist,
                "latest_sighting_at": created_at,
                "cat_name": cat_name,
                "cat_avatar": cat_avatar,
            }

    results = [
        {
            "cat_id": cat_id,
            "cat_name": info["cat_name"],
            "cat_avatar": info["cat_avatar"],
            "distance_km": round(info["distance_km"], 3),
            "latest_sighting_at": info["latest_sighting_at"],
        }
        for cat_id, info in cat_distances.items()
    ]
    results.sort(key=lambda x: x["distance_km"])
    return results[:limit]


@router.get("/{cat_id}", response_model=schemas.CatResponse)
def get_cat(cat_id: int, db: Session = Depends(get_db)):
    cat = crud.get_cat(db, cat_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Cat not found")
    return cat


@router.post("", response_model=schemas.CatResponse)
def create_cat(cat: schemas.CatCreate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    return crud.create_cat(db, cat)


@router.put("/{cat_id}", response_model=schemas.CatResponse)
def update_cat(cat_id: int, cat: schemas.CatUpdate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    updated = crud.update_cat(db, cat_id, cat)
    if not updated:
        raise HTTPException(status_code=404, detail="Cat not found")
    return updated


@router.delete("/{cat_id}")
def delete_cat(cat_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    success = crud.delete_cat(db, cat_id)
    if not success:
        raise HTTPException(status_code=404, detail="Cat not found")
    return {"message": "Deleted"}


@router.get("/{cat_id}/images", response_model=List[schemas.CatImageResponse])
def list_cat_images(cat_id: int, db: Session = Depends(get_db)):
    return crud.get_cat_images(db, cat_id)


@router.post("/{cat_id}/images", response_model=schemas.CatImageResponse)
async def upload_cat_image(cat_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(require_admin)):
    cat = crud.get_cat(db, cat_id)
    if not cat:
        raise HTTPException(status_code=404, detail="Cat not found")

    image_path = await save_upload(file, "cats")
    return crud.create_cat_image(db, cat_id, image_path)


def _haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c
