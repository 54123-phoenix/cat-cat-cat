from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas

router = APIRouter(prefix="/api/user", tags=["user"])


@router.get("/profile", response_model=schemas.UserProfile)
def get_profile(db: Session = Depends(get_db)):
    user = crud.get_user(db)
    if not user:
        from app.models import User
        user = User(id=1, nickname="猫猫爱好者", avatar="/uploads/avatar/default.jpg")
    return schemas.UserProfile(
        id=user.id,
        nickname=user.nickname,
        avatar=user.avatar,
        created_at=user.created_at,
        badges=crud.get_user_badges(db, user.id),
        stats=crud.get_user_stats(db, user.id),
    )
