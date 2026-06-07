from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas
from app.api.auth import require_auth
from app.models import User

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
