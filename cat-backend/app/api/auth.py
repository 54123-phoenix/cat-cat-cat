import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import UserLogin, UserProfile, UserRegister, TokenResponse
from app import schemas
from app.services.wechat import code2session
from app.ratelimit import limit

router = APIRouter(prefix="/api/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = settings.JWT_SECRET
ALGORITHM = settings.ALGORITHM
TOKEN_TTL_MINUTES = settings.TOKEN_TTL_MINUTES

RESERVED_USERNAMES = {"admin", "demo", "root", "system"}


def create_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=TOKEN_TTL_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_user_from_header(authorization: str = Header(default=""), db: Session = Depends(get_db)) -> User:
    prefix = "Bearer "
    if not authorization.startswith(prefix):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[len(prefix):]
    payload = verify_token(token)
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_admin(user: User = Depends(get_current_user_from_header)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def require_auth(user: User = Depends(get_current_user_from_header)) -> User:
    return user


@router.post("/register", response_model=TokenResponse)
@limit(f"{settings.RATE_REGISTER_PER_MIN}/minute")
def register(request: Request, payload: UserRegister, db: Session = Depends(get_db)):
    if payload.username.lower() in RESERVED_USERNAMES:
        raise HTTPException(status_code=400, detail="This username is reserved")
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    user = User(
        username=payload.username,
        password_hash=pwd_context.hash(payload.password),
        nickname=payload.nickname,
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenResponse(token=create_token(user), user=user)


@router.post("/login", response_model=TokenResponse)
@limit(f"{settings.RATE_LOGIN_PER_MIN}/minute")
def login(request: Request, payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not user.password_hash or not pwd_context.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return TokenResponse(token=create_token(user), user=user)


@router.get("/me", response_model=UserProfile)
def me(user: User = Depends(require_auth)):
    return user


@router.post("/wechat-login", response_model=schemas.WechatLoginResponse)
@limit(f"{settings.RATE_REGISTER_PER_MIN}/minute")
async def wechat_login(request: Request, payload: schemas.WechatLoginRequest, db: Session = Depends(get_db)):
    try:
        wx_data = await code2session(payload.code)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    openid = wx_data.get("openid")
    if not openid:
        raise HTTPException(status_code=400, detail="WeChat login failed")

    user = db.query(User).filter(User.openid == openid).first()
    is_new = False

    if not user:
        is_new = True
        username = f"wx_{openid[:12]}"
        nickname = payload.nickname or f"猫友{openid[-4:]}"
        user = User(
            username=username,
            password_hash="",
            nickname=nickname,
            role="user",
            avatar=payload.avatar_url,
            openid=openid,
            session_key=wx_data.get("session_key"),
        )
        db.add(user)
    else:
        user.session_key = wx_data.get("session_key")
        if payload.nickname:
            user.nickname = payload.nickname
        if payload.avatar_url:
            user.avatar = payload.avatar_url

    db.commit()
    db.refresh(user)
    return schemas.WechatLoginResponse(
        token=create_token(user),
        user=user,
        is_new=is_new,
    )
