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
    return user
