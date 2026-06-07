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
    user = db.query(User).filter(User.role == "admin").first()
    if not user:
        raise HTTPException(status_code=401, detail="No admin account configured. Set ADMIN_PASSWORD and restart.")
    if not pwd_context.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid admin password")
    return AdminLoginResponse(token=create_token(user))


@router.get("/me")
def me(user: User = Depends(require_admin)):
    return {"role": user.role, "nickname": user.nickname}
