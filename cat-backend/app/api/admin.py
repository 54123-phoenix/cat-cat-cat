import hmac
import os
import secrets
import time
from hashlib import sha256

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/admin", tags=["admin"])

TOKEN_TTL_SECONDS = 60 * 60 * 12


class AdminLoginRequest(BaseModel):
    password: str


class AdminLoginResponse(BaseModel):
    token: str

    token_type: str = "bearer"


def _admin_password() -> str:
    return os.getenv("ADMIN_PASSWORD", "cat-admin")


def _admin_secret() -> str:
    return os.getenv("ADMIN_SECRET", _admin_password())


def _sign(payload: str) -> str:
    return hmac.new(_admin_secret().encode("utf-8"), payload.encode("utf-8"), sha256).hexdigest()


def _create_token() -> str:
    expires_at = int(time.time()) + TOKEN_TTL_SECONDS
    nonce = secrets.token_urlsafe(12)
    payload = f"{expires_at}.{nonce}"
    return f"{payload}.{_sign(payload)}"


def require_admin(authorization: str = Header(default="")) -> None:
    prefix = "Bearer "
    if not authorization.startswith(prefix):
        raise HTTPException(status_code=401, detail="Admin authorization required")

    token = authorization[len(prefix):]
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=401, detail="Invalid admin token")

    expires_at, nonce, signature = parts
    payload = f"{expires_at}.{nonce}"
    if not hmac.compare_digest(signature, _sign(payload)):
        raise HTTPException(status_code=401, detail="Invalid admin token")

    try:
        if int(expires_at) < int(time.time()):
            raise HTTPException(status_code=401, detail="Admin token expired")
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid admin token") from exc


@router.post("/login", response_model=AdminLoginResponse)
def login(payload: AdminLoginRequest):
    if not hmac.compare_digest(payload.password, _admin_password()):
        raise HTTPException(status_code=401, detail="Invalid admin password")
    return AdminLoginResponse(token=_create_token())


@router.get("/me")
def me(_: None = Depends(require_admin)):
    return {"role": "admin"}
