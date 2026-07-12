import math
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models


def _location_expr():
    return func.coalesce(models.Sighting.location_name, models.Sighting.location)


def _approved_since(days: int):
    return (
        models.Sighting.status == "approved",
        models.Sighting.created_at >= datetime.now() - timedelta(days=days),
    )


def data_quality(count: int) -> str:
    if count >= 8:
        return "high"
    if count >= 3:
        return "medium"
    if count > 0:
        return "low"
    return "none"


def find_cat(db: Session, query: str) -> Optional[models.Cat]:
    needle = query.strip().lower()
    if not needle:
        return None
    cats = db.query(models.Cat).order_by(models.Cat.id).all()
    exact = []
    partial = []
    for cat in cats:
        names = [cat.name, cat.nickname]
        names.extend((cat.aliases or "").replace("，", ",").split(","))
        normalized = [name.strip().lower() for name in names if name and name.strip()]
        if needle in normalized:
            exact.append(cat)
        elif any(name in needle or needle in name for name in normalized):
            partial.append(cat)
    return (exact or partial or [None])[0]


def cat_activity(db: Session, cat: models.Cat, days: int = 14) -> dict:
    rows = (
        db.query(models.Sighting)
        .filter(models.Sighting.cat_id == cat.id, *_approved_since(days))
        .order_by(models.Sighting.created_at.desc())
        .all()
    )
    locations: dict[str, int] = {}
    periods = {"清晨": 0, "午间": 0, "午后": 0, "傍晚": 0}
    for row in rows:
        location = row.location_name or row.location or cat.location or "校园某处"
        locations[location] = locations.get(location, 0) + 1
        hour = row.created_at.hour
        period = "清晨" if hour < 11 else "午间" if hour < 14 else "午后" if hour < 18 else "傍晚"
        periods[period] += 1
    return {
        "cat": cat,
        "count": len(rows),
        "locations": sorted(locations.items(), key=lambda item: item[1], reverse=True),
        "periods": sorted(periods.items(), key=lambda item: item[1], reverse=True),
        "latest": rows[0].created_at if rows else None,
        "quality": data_quality(len(rows)),
    }


def location_activity(db: Session, location: str, days: int = 14) -> dict:
    expr = _location_expr()
    rows = (
        db.query(models.Sighting, models.Cat)
        .join(models.Cat, models.Cat.id == models.Sighting.cat_id)
        .filter(*_approved_since(days), expr.ilike(f"%{location.strip()}%"))
        .order_by(models.Sighting.created_at.desc())
        .all()
    )
    cats: dict[int, dict] = {}
    for sighting, cat in rows:
        item = cats.setdefault(cat.id, {"id": cat.id, "name": cat.name, "count": 0})
        item["count"] += 1
    return {
        "location": location.strip(),
        "count": len(rows),
        "cats": sorted(cats.values(), key=lambda item: item["count"], reverse=True),
        "latest": rows[0][0].created_at if rows else None,
        "quality": data_quality(len(rows)),
    }


def hotspots(db: Session, days: int = 14, limit: int = 4) -> list[dict]:
    expr = _location_expr()
    rows = (
        db.query(
            expr.label("name"),
            func.count(models.Sighting.id).label("count"),
            func.max(models.Sighting.created_at).label("latest"),
            func.avg(models.Sighting.latitude).label("latitude"),
            func.avg(models.Sighting.longitude).label("longitude"),
        )
        .filter(*_approved_since(days), expr.isnot(None))
        .group_by(expr)
        .order_by(func.count(models.Sighting.id).desc(), func.max(models.Sighting.created_at).desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "name": row.name,
            "count": int(row.count),
            "latest": row.latest,
            "latitude": float(row.latitude) if row.latitude is not None else None,
            "longitude": float(row.longitude) if row.longitude is not None else None,
            "quality": data_quality(int(row.count)),
        }
        for row in rows
    ]


def nearby_activity(db: Session, latitude: float, longitude: float, radius_km: float = 1.0, days: int = 14) -> list[dict]:
    lat_delta = radius_km / 111.0
    lng_delta = radius_km / (111.0 * max(math.cos(math.radians(latitude)), 0.01))
    rows = (
        db.query(models.Sighting, models.Cat)
        .join(models.Cat, models.Cat.id == models.Sighting.cat_id)
        .filter(
            *_approved_since(days),
            models.Sighting.latitude.between(latitude - lat_delta, latitude + lat_delta),
            models.Sighting.longitude.between(longitude - lng_delta, longitude + lng_delta),
        )
        .order_by(models.Sighting.created_at.desc())
        .all()
    )
    result = []
    for sighting, cat in rows:
        distance = _haversine(latitude, longitude, sighting.latitude, sighting.longitude)
        if distance <= radius_km:
            result.append({"cat": cat, "sighting": sighting, "distance_km": round(distance, 2)})
    return result


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    value = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))
