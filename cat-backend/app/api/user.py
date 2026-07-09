from typing import List, Literal
from datetime import datetime, date

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas, models
from app.api.auth import require_auth
from app.api.upload import save_upload
from app.models import User
from app.cache import cached

router = APIRouter(prefix="/api/user", tags=["user"])
me_router = APIRouter(prefix="/api/users", tags=["user"])
lb_router = APIRouter(prefix="/api", tags=["user"])

TIER_NAMES_CN = [
    "青铜", "白银", "黄金", "蓝宝石", "红宝石",
    "翡翠", "紫水晶", "珍珠", "黑曜石", "钻石",
]
TIER_NAMES_EN = [
    "Bronze", "Silver", "Gold", "Sapphire", "Ruby",
    "Emerald", "Amethyst", "Pearl", "Obsidian", "Diamond",
]


def _tier_index(level: int) -> int:
    if level <= 0:
        return 0
    return min(9, (level - 1) // 2)


def _tier_boundary_xp(tier_index: int) -> int:
    if tier_index >= 9:
        return None
    next_level = (tier_index + 1) * 2 + 1
    return 50 * next_level * (next_level - 1)


@router.get("/profile")
def get_profile(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    badge_details, stats_dict, badge_count = crud.compute_user_badges(db, user.id)
    stats = schemas.UserStats(
        sightings=stats_dict["sightings"],
        posts=stats_dict["posts"],
        cats_known=stats_dict["cats_known"],
        badges_count=badge_count,
        total_badges=12,
        locations_count=stats_dict["locations_count"],
        photos_count=stats_dict["photos_count"],
        contribution_score=stats_dict["contribution_score"],
        primary_contribution=stats_dict["primary_contribution"],
        contribution_breakdown=stats_dict["contribution_breakdown"],
    )
    badges = [
        schemas.UserBadgeItem(badge_key=b["badge_key"], earned=b["earned"], earned_at=b["earned_at"])
        for b in badge_details
    ]
    return schemas.UserProfile(
        id=user.id,
        username=user.username,
        nickname=user.nickname,
        role=user.role,
        avatar=user.avatar,
        created_at=user.created_at,
        stats=stats,
        badges=badges,
    )


@router.patch("/profile", response_model=schemas.UserProfile)
def update_profile(
    payload: schemas.UserProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    if "nickname" in payload.model_fields_set:
        nickname = (payload.nickname or "").strip()
        if not nickname:
            raise HTTPException(status_code=400, detail="昵称不能为空")
        user.nickname = nickname
    if "avatar" in payload.model_fields_set:
        avatar = (payload.avatar or "").strip()
        user.avatar = avatar or None
    db.commit()
    db.refresh(user)
    return get_profile(db=db, user=user)


@router.post("/profile/avatar", response_model=schemas.UserProfile)
async def upload_profile_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    image_path = await save_upload(file, "avatars")
    user.avatar = image_path
    db.commit()
    db.refresh(user)
    return get_profile(db=db, user=user)


@router.get("/badges", response_model=List[schemas.BadgeDetail])
def get_badges(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    badge_details, _, _ = crud.compute_user_badges(db, user.id)
    return [schemas.BadgeDetail(**b) for b in badge_details]


@router.get("/weekly-report")
def get_weekly_report(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    return crud.get_weekly_report(db, user_id=user.id)


@me_router.get("/me/wrapped")
def get_wrapped(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    return crud.get_wrapped_report(db, user_id=user.id)


@me_router.get("/me/visited-locations")
def get_visited_locations(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    rows = db.query(models.Sighting.location_name, models.Sighting.location).filter(
        models.Sighting.user_id == user.id,
    ).all()
    names = set()
    for loc_name, loc in rows:
        if loc_name:
            names.add(loc_name)
        if loc:
            names.add(loc)
    return {"locations": sorted(n for n in names if n)}


@router.post("/follows/{cat_id}", response_model=schemas.FollowResponse)
def follow_cat(cat_id: int, db: Session = Depends(get_db), user: User = Depends(require_auth)):
    cat = db.query(models.Cat).filter(models.Cat.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Cat not found")
    existing = db.query(models.UserCatFollow).filter(
        models.UserCatFollow.user_id == user.id,
        models.UserCatFollow.cat_id == cat_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already following")
    follow = models.UserCatFollow(user_id=user.id, cat_id=cat_id)
    db.add(follow); db.commit(); db.refresh(follow)
    return schemas.FollowResponse(id=follow.id, cat_id=cat_id, cat_name=cat.name, cat_avatar=cat.avatar, created_at=follow.created_at)


@router.delete("/follows/{cat_id}")
def unfollow_cat(cat_id: int, db: Session = Depends(get_db), user: User = Depends(require_auth)):
    follow = db.query(models.UserCatFollow).filter(
        models.UserCatFollow.user_id == user.id,
        models.UserCatFollow.cat_id == cat_id
    ).first()
    if not follow:
        raise HTTPException(status_code=404, detail="Not following")
    db.delete(follow); db.commit()
    return {"ok": True}


@router.get("/follows", response_model=List[schemas.FollowResponse])
def list_follows(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    follows = db.query(models.UserCatFollow).filter(models.UserCatFollow.user_id == user.id).all()
    cat_ids = [f.cat_id for f in follows]
    cats_map = {}
    if cat_ids:
        for cat in db.query(models.Cat).filter(models.Cat.id.in_(cat_ids)).all():
            cats_map[cat.id] = cat
    result = []
    for f in follows:
        cat = cats_map.get(f.cat_id)
        result.append(schemas.FollowResponse(id=f.id, cat_id=f.cat_id, cat_name=cat.name if cat else None, cat_avatar=cat.avatar if cat else None, created_at=f.created_at))
    return result


@router.get("/follows/{cat_id}")
def check_follow(cat_id: int, db: Session = Depends(get_db), user: User = Depends(require_auth)):
    follow = db.query(models.UserCatFollow).filter(
        models.UserCatFollow.user_id == user.id,
        models.UserCatFollow.cat_id == cat_id
    ).first()
    return {"following": follow is not None}


@me_router.get("/me")
def get_me(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    stats = crud.get_user_stats_full(db, user.id)
    return {
        "id": user.id,
        "username": user.username,
        "nickname": user.nickname,
        "role": user.role,
        "avatar": user.avatar,
        "created_at": user.created_at,
        "xp": stats["xp"],
        "level": stats["level"],
        "level_progress": stats["level_progress"],
        "streak": stats["streak"],
        "longest_streak": stats["longest_streak"],
        "sightings": stats["sightings"],
        "posts": stats["posts"],
        "contribution_score": stats["contribution_score"],
        "primary_contribution": stats["primary_contribution"],
        "contribution_breakdown": stats["contribution_breakdown"],
    }


@me_router.get("/me/daily-quest")
def get_daily_quest(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    today_start = datetime.combine(date.today(), datetime.min.time())
    sighting_count = db.query(models.Sighting).filter(
        models.Sighting.user_id == user.id,
        models.Sighting.created_at >= today_start,
    ).count()
    photo_count = db.query(models.Sighting).filter(
        models.Sighting.user_id == user.id,
        models.Sighting.created_at >= today_start,
        models.Sighting.image_path.isnot(None),
    ).count()
    post_count = db.query(models.Post).filter(
        models.Post.user_id == user.id,
        models.Post.created_at >= today_start,
    ).count()
    recognize_count = db.query(models.AuditLog).filter(
        models.AuditLog.action == "recognize",
        models.AuditLog.created_at >= today_start,
    ).count()

    quests = [
        {"key": "sighting", "label": "偶遇1只猫", "target": 1, "progress": min(sighting_count, 1), "done": sighting_count >= 1},
        {"key": "photo", "label": "拍1张猫猫照片", "target": 1, "progress": min(photo_count, 1), "done": photo_count >= 1},
        {"key": "post", "label": "发1条动态", "target": 1, "progress": min(post_count, 1), "done": post_count >= 1},
        {"key": "recognize", "label": "识别1次猫猫", "target": 1, "progress": min(recognize_count, 1), "done": recognize_count >= 1},
    ]
    all_done = all(q["done"] for q in quests)
    return {"quests": quests, "all_done": all_done, "reward_xp": 20}


@lb_router.get("/leaderboard")
@cached(
    ttl=60,
    key_fn=lambda *args, **kwargs: f"leaderboard:v2:{getattr(kwargs.get('user'), 'id', 'anon')}:{kwargs.get('category', 'overall')}",
)
def get_leaderboard(
    category: Literal["overall", "photography", "discovery", "map", "confirmation", "guardian"] = Query("overall"),
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    users = db.query(User).all()
    user_rows = []
    for u in users:
        contribution = crud.get_user_contribution_stats(db, u.id)
        category_scores = {item["key"]: item["score"] for item in contribution["contribution_breakdown"]}
        category_score = (u.xp or 0) if category == "overall" else category_scores.get(category, 0)
        user_rows.append((u, contribution, category_score))

    user_rows.sort(key=lambda row: row[2], reverse=True)
    total_players = len(users)
    top = []
    my_rank = 1
    my_xp = user.xp or 0
    my_level = crud.compute_level(my_xp)
    for idx, (u, contribution, category_score) in enumerate(user_rows):
        rank = idx + 1
        if u.id == user.id:
            my_rank = rank
        if len(top) < 50:
            u_xp = u.xp or 0
            top.append({
                "id": u.id,
                "nickname": u.nickname,
                "avatar": u.avatar,
                "xp": u_xp,
                "level": crud.compute_level(u_xp),
                "contribution_score": contribution["contribution_score"],
                "primary_contribution": contribution["primary_contribution"],
                "category_score": category_score,
            })
    ti = _tier_index(my_level)
    boundary = _tier_boundary_xp(ti)
    my_contribution = crud.get_user_contribution_stats(db, user.id)
    return {
        "category": category,
        "tier_name": TIER_NAMES_CN[ti],
        "tier_name_en": TIER_NAMES_EN[ti],
        "tier_index": ti,
        "my_rank": my_rank,
        "my_xp": my_xp,
        "my_level": my_level,
        "my_contribution_score": my_contribution["contribution_score"],
        "my_primary_contribution": my_contribution["primary_contribution"],
        "contribution_breakdown": my_contribution["contribution_breakdown"],
        "total_players": total_players,
        "next_tier_xp": boundary,
        "next_tier_name": TIER_NAMES_CN[ti + 1] if ti < 9 else None,
        "top": top,
    }
