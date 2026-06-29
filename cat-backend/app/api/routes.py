from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app import models

router = APIRouter(prefix="/api/routes", tags=["routes"])

TIME_SLOTS = ("morning", "noon", "afternoon", "evening", "anytime")

SLOT_TITLE = {
    "morning": "清晨校园猫路线",
    "noon": "午间校园猫路线",
    "afternoon": "午后校园猫路线",
    "evening": "傍晚校园猫路线",
    "anytime": "校园猫路线推荐",
}

SLOT_HOURS = {
    "morning": (5, 11),
    "noon": (11, 14),
    "afternoon": (14, 18),
    "evening": (18, 24),
}


def _slot_reason(time_slot: str) -> str:
    return {
        "morning": "清晨偶遇活跃",
        "noon": "午间偶遇活跃",
        "afternoon": "午后偶遇活跃",
        "evening": "傍晚偶遇活跃",
        "anytime": "近段时间偶遇活跃",
    }.get(time_slot, "偶遇活跃")


@router.get("/recommendations")
def recommendations(
    time_slot: str = Query("anytime"),
    limit: int = Query(4, ge=2, le=6),
    days: int = Query(14, ge=1, le=90),
    db: Session = Depends(get_db),
):
    if time_slot not in TIME_SLOTS:
        time_slot = "anytime"

    since = datetime.now() - timedelta(days=days)
    sightings = (
        db.query(models.Sighting)
        .filter(models.Sighting.created_at >= since)
        .order_by(models.Sighting.created_at.desc())
        .all()
    )

    start_h, end_h = SLOT_HOURS.get(time_slot, (None, None))
    if start_h is not None:
        sightings = [s for s in sightings if start_h <= s.created_at.hour < end_h]

    groups: dict[str, dict] = {}
    for s in sightings:
        key = s.location_name or s.location or "校园某处"
        if key not in groups:
            groups[key] = {
                "name": key,
                "sightings": [],
                "latitude": s.latitude,
                "longitude": s.longitude,
            }
        g = groups[key]
        g["sightings"].append(s)
        if g["latitude"] is None and s.latitude is not None:
            g["latitude"] = s.latitude
        if g["longitude"] is None and s.longitude is not None:
            g["longitude"] = s.longitude

    cat_cache: dict[int, Optional[models.Cat]] = {}
    stops = []
    for g in groups.values():
        latest = g["sightings"][0]
        if latest.cat_id not in cat_cache:
            cat_cache[latest.cat_id] = (
                db.query(models.Cat).filter(models.Cat.id == latest.cat_id).first()
            )
        cat = cat_cache[latest.cat_id]
        stops.append(
            {
                "name": g["name"],
                "reason": _slot_reason(time_slot),
                "cat_id": latest.cat_id,
                "cat_name": cat.name if cat else "校园猫猫",
                "cat_avatar": cat.avatar if cat else None,
                "latitude": g["latitude"],
                "longitude": g["longitude"],
                "sightings_count": len(g["sightings"]),
                "latest_sighting_at": latest.created_at,
            }
        )

    stops.sort(key=lambda x: x["sightings_count"], reverse=True)
    stops = stops[:limit]

    return {
        "title": SLOT_TITLE.get(time_slot, SLOT_TITLE["anytime"]),
        "time_slot": time_slot,
        "generated_at": datetime.now(),
        "share_path": f"/routes?time_slot={time_slot}",
        "stops": stops,
    }
