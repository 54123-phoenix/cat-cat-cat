from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas, models
from app.api.auth import require_auth
from app.models import User, Cat, UserCatFollow

router = APIRouter(prefix="/api/user", tags=["user"])


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


@router.get("/badges", response_model=List[schemas.BadgeDetail])
def get_badges(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    badge_details, _, _ = crud.compute_user_badges(db, user.id)
    return [schemas.BadgeDetail(**b) for b in badge_details]


@router.get("/weekly-report")
def get_weekly_report(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    return crud.get_weekly_report(db, user_id=user.id)


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
    result = []
    for f in follows:
        cat = db.query(models.Cat).filter(models.Cat.id == f.cat_id).first()
        result.append(schemas.FollowResponse(id=f.id, cat_id=f.cat_id, cat_name=cat.name if cat else None, cat_avatar=cat.avatar if cat else None, created_at=f.created_at))
    return result


@router.get("/follows/{cat_id}")
def check_follow(cat_id: int, db: Session = Depends(get_db), user: User = Depends(require_auth)):
    follow = db.query(models.UserCatFollow).filter(
        models.UserCatFollow.user_id == user.id,
        models.UserCatFollow.cat_id == cat_id
    ).first()
    return {"following": follow is not None}
