import random
import hashlib
from datetime import datetime, date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, models
from app.api.auth import require_auth
from app.models import User

router = APIRouter(prefix="/api", tags=["gamification"])

CAPSULE_STICKERS = ["🌅", "🐱", "🐾", "✨", "🌿", "📷", "🗺️", "⭐", "🌙", "🍂"]
CAPSULE_TITLES = [
    "清晨观察员",
    "午后漫步者",
    "黄昏追踪手",
    "校园探索家",
    "猫猫日记员",
    "偶遇收藏者",
]


def build_daily_capsule_for_user(db: Session, user_id: int, target_date: date) -> dict:
    """Deterministically build the daily capsule for a user on a target date.

    The seed is user_id + iso date so the same user on the same day always
    gets the same featured cat / sticker / title. Different users may get
    different capsules.
    """
    date_iso = target_date.isoformat()
    today_start = datetime.combine(target_date, datetime.min.time())
    recent = datetime.now() - timedelta(days=7)

    sightings = (
        db.query(models.Sighting)
        .filter(models.Sighting.created_at >= recent)
        .order_by(models.Sighting.created_at.desc())
        .limit(200)
        .all()
    )

    seed_str = f"{user_id}-{date_iso}"
    rng = random.Random(int(hashlib.md5(seed_str.encode()).hexdigest()[:8], 16))

    featured_cat = None
    latest_sighting = None

    if not sightings:
        cats = db.query(models.Cat).limit(10).all()
        if not cats:
            return {
                "available": False,
                "message": "暂无校园猫数据，快来第一次偶遇吧！",
            }
        featured_cat = rng.choice(cats)
    else:
        cat_ids = [s.cat_id for s in sightings]
        cats_map = {
            c.id: c
            for c in db.query(models.Cat).filter(models.Cat.id.in_(cat_ids)).all()
        }
        weighted = [s for s in sightings if s.cat_id in cats_map]
        if not weighted:
            return {
                "available": False,
                "message": "暂无校园猫数据",
            }
        today_sightings = [s for s in weighted if s.created_at >= today_start]
        pool = today_sightings if today_sightings else weighted
        chosen_sighting = rng.choice(pool)
        featured_cat = cats_map[chosen_sighting.cat_id]
        latest_sighting = chosen_sighting

    personality_tags = []
    if featured_cat.personality:
        import re

        personality_tags = [
            t.strip()
            for t in re.split(r"[，,、]", featured_cat.personality)
            if t.strip()
        ][:5]

    sighting_count = (
        db.query(models.Sighting)
        .filter(models.Sighting.cat_id == featured_cat.id)
        .count()
    )

    sticker = rng.choice(CAPSULE_STICKERS)
    title = rng.choice(CAPSULE_TITLES)

    route_hint = None
    if latest_sighting and latest_sighting.location_name:
        route_hint = f"最近在「{latest_sighting.location_name}」出没"
    elif featured_cat.location:
        route_hint = f"常出没于「{featured_cat.location}」"

    return {
        "available": True,
        "date": date_iso,
        "cat": {
            "id": featured_cat.id,
            "name": featured_cat.name,
            "nickname": featured_cat.nickname,
            "avatar": featured_cat.avatar,
            "color": featured_cat.color,
            "location": featured_cat.location,
            "quote": featured_cat.quote,
            "personality_tags": personality_tags,
            "sighting_count": sighting_count,
        },
        "reward": {
            "sticker": sticker,
            "title": title,
            "route_hint": route_hint,
        },
        "latest_sighting_at": latest_sighting.created_at if latest_sighting else None,
    }


@router.get("/daily-capsule")
def daily_capsule(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    return build_daily_capsule_for_user(db, user.id, date.today())


@router.get("/users/me/titles")
def get_titles(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    sightings = (
        db.query(models.Sighting).filter(models.Sighting.user_id == user.id).all()
    )
    posts = db.query(models.Post).filter(models.Post.user_id == user.id).count()
    follows = (
        db.query(models.UserCatFollow)
        .filter(models.UserCatFollow.user_id == user.id)
        .count()
    )

    sighting_count = len(sightings)
    photo_count = sum(1 for s in sightings if s.image_path)
    distinct_cats = len(set(s.cat_id for s in sightings))
    geo_count = sum(1 for s in sightings if s.latitude and s.longitude)
    night_count = sum(
        1 for s in sightings if s.created_at.hour >= 20 or s.created_at.hour < 5
    )

    cat_ids = set(s.cat_id for s in sightings)
    first_spotter_count = 0
    if cat_ids:
        for cat_id in cat_ids:
            first = (
                db.query(models.Sighting)
                .filter(models.Sighting.cat_id == cat_id)
                .order_by(models.Sighting.created_at.asc())
                .first()
            )
            if first and first.user_id == user.id:
                first_spotter_count += 1

    titles = []

    if first_spotter_count > 0:
        titles.append(
            {
                "key": "first_spotter",
                "label": "初次发现者",
                "label_en": "First Spotter",
                "count": first_spotter_count,
                "description": f"首次发现了 {first_spotter_count} 只校园猫",
            }
        )
    if geo_count >= 3:
        titles.append(
            {
                "key": "route_walker",
                "label": "路线行走者",
                "label_en": "Route Walker",
                "count": geo_count,
                "description": f"在 {geo_count} 个地点记录了偶遇",
            }
        )
    if photo_count >= 5:
        titles.append(
            {
                "key": "photo_archivist",
                "label": "照片档案员",
                "label_en": "Photo Archivist",
                "count": photo_count,
                "description": f"拍摄了 {photo_count} 张猫猫照片",
            }
        )
    if night_count >= 3:
        titles.append(
            {
                "key": "night_watcher",
                "label": "夜间观察者",
                "label_en": "Night Watcher",
                "count": night_count,
                "description": f"记录了 {night_count} 次夜间偶遇",
            }
        )
    if posts >= 1:
        titles.append(
            {
                "key": "community_voice",
                "label": "社区发声者",
                "label_en": "Community Voice",
                "count": posts,
                "description": f"发布了 {posts} 篇猫猫社区帖子",
            }
        )
    if distinct_cats >= 10:
        titles.append(
            {
                "key": "new_cat_finder",
                "label": "新猫发现家",
                "label_en": "New Cat Finder",
                "count": distinct_cats,
                "description": f"认识了 {distinct_cats} 只不同的猫",
            }
        )
    if follows >= 5:
        titles.append(
            {
                "key": "cat_guardian",
                "label": "猫猫守护者",
                "label_en": "Cat Guardian",
                "count": follows,
                "description": f"关注着 {follows} 只猫的动态",
            }
        )

    primary_title = titles[0] if titles else None

    return {
        "titles": titles,
        "primary_title": primary_title,
        "total": len(titles),
    }


@router.get("/routes/story")
def route_story(
    time_slot: str = Query("anytime"),
    limit: int = Query(4, ge=2, le=6),
    days: int = Query(14, ge=1, le=90),
    db: Session = Depends(get_db),
):
    from app.api.routes import TIME_SLOTS, SLOT_TITLE, SLOT_HOURS, _slot_reason

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

        clue = "在这里经常出没"
        if cat and cat.personality:
            import re

            tags = [
                t.strip() for t in re.split(r"[，,、]", cat.personality) if t.strip()
            ]
            if tags:
                clue = f"性格{tags[0]}，常在此处活动"

        time_window = "全天可观察"
        if start_h is not None:
            time_window = f"{start_h:02d}:00 - {end_h:02d}:00"

        stops.append(
            {
                "name": g["name"],
                "reason": _slot_reason(time_slot),
                "cat_id": latest.cat_id,
                "cat_name": cat.name if cat else "校园猫猫",
                "cat_avatar": cat.avatar if cat else None,
                "cat_color": cat.color if cat else None,
                "latitude": g["latitude"],
                "longitude": g["longitude"],
                "sightings_count": len(g["sightings"]),
                "latest_sighting_at": latest.created_at,
                "clue": clue,
                "confidence": latest.confidence or 0.0,
                "time_window": time_window,
                "checked_in": False,
            }
        )

    stops.sort(key=lambda x: x["sightings_count"], reverse=True)
    stops = stops[:limit]

    route_stamp = {
        "name": SLOT_TITLE.get(time_slot, SLOT_TITLE["anytime"]),
        "time_slot": time_slot,
        "stop_count": len(stops),
        "emoji": "🗺️",
    }

    return {
        "title": SLOT_TITLE.get(time_slot, SLOT_TITLE["anytime"]),
        "time_slot": time_slot,
        "generated_at": datetime.now(),
        "share_path": f"/routes?time_slot={time_slot}",
        "stops": stops,
        "route_stamp": route_stamp,
        "story_intro": f"今天为你推荐 {len(stops)} 个偶遇点，跟随线索找到校园猫猫吧！",
    }


class CheckInRequest(BaseModel):
    time_slot: str
    stop_name: str
    cat_id: Optional[int] = None
    route_limit: Optional[int] = Field(None, ge=1, le=6)


def ensure_capsule_collectible(
    db: Session, user_id: int, date_iso: str, title: str, sticker: str
) -> None:
    """Ensure a capsule_reward UserCollectible exists for the given user+date.

    Idempotent: if it already exists, does nothing. Handles IntegrityError
    from concurrent inserts.
    """
    existing = (
        db.query(models.UserCollectible)
        .filter(
            models.UserCollectible.user_id == user_id,
            models.UserCollectible.collectible_type == "capsule_reward",
            models.UserCollectible.key == date_iso,
        )
        .first()
    )
    if existing:
        return
    try:
        db.add(
            models.UserCollectible(
                user_id=user_id,
                collectible_type="capsule_reward",
                key=date_iso,
                display_name=title,
                emoji=sticker,
            )
        )
        db.commit()
    except IntegrityError:
        db.rollback()


@router.post("/daily-capsule/claim")
def claim_daily_capsule(
    db: Session = Depends(get_db), user: User = Depends(require_auth)
):
    today = date.today()
    today_iso = today.isoformat()
    existing = (
        db.query(models.DailyCapsuleClaim)
        .filter(
            models.DailyCapsuleClaim.user_id == user.id,
            models.DailyCapsuleClaim.claim_date == today_iso,
        )
        .first()
    )
    if existing:
        ensure_capsule_collectible(
            db, user.id, today_iso, existing.title, existing.sticker
        )
        return {
            "claimed": False,
            "message": "今日胶囊已领取",
            "claim": {
                "cat_id": existing.cat_id,
                "sticker": existing.sticker,
                "title": existing.title,
                "claim_date": existing.claim_date,
            },
        }

    capsule = build_daily_capsule_for_user(db, user.id, today)
    if not capsule.get("available"):
        raise HTTPException(status_code=400, detail="暂无可领取的胶囊")

    sticker = capsule["reward"]["sticker"]
    title = capsule["reward"]["title"]
    cat_id = capsule["cat"]["id"]
    cat_name = capsule["cat"]["name"]

    try:
        claim = models.DailyCapsuleClaim(
            user_id=user.id,
            claim_date=today_iso,
            cat_id=cat_id,
            sticker=sticker,
            title=title,
        )
        db.add(claim)
        db.flush()
        db.add(
            models.UserCollectible(
                user_id=user.id,
                collectible_type="capsule_reward",
                key=today_iso,
                display_name=title,
                emoji=sticker,
            )
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = (
            db.query(models.DailyCapsuleClaim)
            .filter(
                models.DailyCapsuleClaim.user_id == user.id,
                models.DailyCapsuleClaim.claim_date == today_iso,
            )
            .first()
        )
        if existing:
            ensure_capsule_collectible(
                db, user.id, today_iso, existing.title, existing.sticker
            )
            return {
                "claimed": False,
                "message": "今日胶囊已领取",
                "claim": {
                    "cat_id": existing.cat_id,
                    "sticker": existing.sticker,
                    "title": existing.title,
                    "claim_date": existing.claim_date,
                },
            }
        raise

    return {
        "claimed": True,
        "claim": {
            "cat_id": cat_id,
            "cat_name": cat_name,
            "sticker": sticker,
            "title": title,
            "claim_date": today_iso,
        },
    }


@router.get("/users/me/collectibles")
def get_collectibles(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    items = (
        db.query(models.UserCollectible)
        .filter(models.UserCollectible.user_id == user.id)
        .order_by(models.UserCollectible.created_at.desc())
        .all()
    )
    return {
        "collectibles": [
            {
                "id": c.id,
                "type": c.collectible_type,
                "key": c.key,
                "display_name": c.display_name,
                "emoji": c.emoji,
                "created_at": c.created_at,
            }
            for c in items
        ],
        "total": len(items),
    }


def _route_stop_names(db: Session, time_slot: str, limit: int = 4) -> list[str]:
    """Return valid stop names for a route story with the given limit."""
    limit = min(max(limit or 4, 1), 6)
    story = route_story(time_slot=time_slot, limit=limit, days=14, db=db)
    return [s["name"] for s in story.get("stops", [])]


@router.post("/routes/story/check-in")
def route_checkin(
    body: CheckInRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    from app.api.routes import TIME_SLOTS

    if body.time_slot not in TIME_SLOTS:
        raise HTTPException(status_code=400, detail="无效的时段")

    route_limit = body.route_limit or 4
    valid_stops = _route_stop_names(db, body.time_slot, limit=route_limit)
    if not valid_stops or body.stop_name not in valid_stops:
        raise HTTPException(status_code=400, detail="无效的路线站点")

    already = (
        db.query(models.RouteCheckin)
        .filter(
            models.RouteCheckin.user_id == user.id,
            models.RouteCheckin.time_slot == body.time_slot,
            models.RouteCheckin.stop_name == body.stop_name,
        )
        .first()
    )

    newly_checked = False
    if not already:
        try:
            db.add(
                models.RouteCheckin(
                    user_id=user.id,
                    time_slot=body.time_slot,
                    stop_name=body.stop_name,
                    cat_id=body.cat_id,
                )
            )
            db.commit()
            newly_checked = True
        except IntegrityError:
            db.rollback()

    checked_names = {
        c.stop_name
        for c in db.query(models.RouteCheckin)
        .filter(
            models.RouteCheckin.user_id == user.id,
            models.RouteCheckin.time_slot == body.time_slot,
        )
        .all()
    }
    valid_set = set(valid_stops)
    completed = valid_set != set() and valid_set.issubset(checked_names)

    has_stamp = (
        db.query(models.UserCollectible)
        .filter(
            models.UserCollectible.user_id == user.id,
            models.UserCollectible.collectible_type == "route_stamp",
            models.UserCollectible.key == body.time_slot,
        )
        .first()
        is not None
    )

    stamp_issued = False
    if completed and not has_stamp:
        try:
            db.add(
                models.UserCollectible(
                    user_id=user.id,
                    collectible_type="route_stamp",
                    key=body.time_slot,
                    display_name=f"路线印章 · {body.time_slot}",
                    emoji="🗺️",
                )
            )
            db.commit()
            stamp_issued = True
            has_stamp = True
        except IntegrityError:
            db.rollback()

    return {
        "checked_in": newly_checked,
        "message": None if newly_checked else "该站点已打卡",
        "stop_name": body.stop_name,
        "total_checkins": len(checked_names),
        "total_stops": len(valid_stops),
        "completed": completed,
        "has_stamp": has_stamp,
        "stamp_issued": stamp_issued,
    }


@router.get("/routes/story/progress")
def route_progress(
    time_slot: str = Query("anytime"),
    route_limit: int = Query(4, ge=1, le=6),
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    from app.api.routes import TIME_SLOTS

    if time_slot not in TIME_SLOTS:
        time_slot = "anytime"

    valid_stops = _route_stop_names(db, time_slot, limit=route_limit)
    checkins = (
        db.query(models.RouteCheckin)
        .filter(
            models.RouteCheckin.user_id == user.id,
            models.RouteCheckin.time_slot == time_slot,
        )
        .all()
    )
    checked_names = {c.stop_name for c in checkins}
    valid_set = set(valid_stops)
    total = len(valid_stops)
    completed = total > 0 and valid_set.issubset(checked_names)
    stamp = (
        db.query(models.UserCollectible)
        .filter(
            models.UserCollectible.user_id == user.id,
            models.UserCollectible.collectible_type == "route_stamp",
            models.UserCollectible.key == time_slot,
        )
        .first()
    )
    return {
        "time_slot": time_slot,
        "checked_stops": [c.stop_name for c in checkins],
        "checkin_count": len(checkins),
        "total_stops": total,
        "remaining_stops": max(0, total - len(checked_names & valid_set)),
        "completed": completed,
        "has_stamp": stamp is not None,
    }
