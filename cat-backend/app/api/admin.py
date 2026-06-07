import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.api.auth import require_admin, create_token
from passlib.context import CryptContext

router = APIRouter(prefix="/api/admin", tags=["admin"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AdminLoginRequest(BaseModel):
    password: str


class AdminLoginResponse(BaseModel):
    token: str
    token_type: str = "bearer"


@router.post("/login", response_model=AdminLoginResponse)
def login(payload: AdminLoginRequest, db: Session = Depends(get_db)):
    expected = os.getenv("ADMIN_PASSWORD", "cat-admin")
    if payload.password != expected:
        raise HTTPException(status_code=401, detail="Invalid admin password")
    user = db.query(User).filter(User.role == "admin").first()
    if not user:
        user = User(
            username="admin",
            password_hash=pwd_context.hash(payload.password),
            nickname="猫协管理员",
            role="admin",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return AdminLoginResponse(token=create_token(user))


@router.get("/me")
def me(user: User = Depends(require_admin)):
    return {"role": user.role, "nickname": user.nickname}
