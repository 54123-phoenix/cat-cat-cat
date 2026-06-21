from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import crud, schemas
from app.api.auth import require_auth
from app.models import User

router = APIRouter(prefix="/api/invite", tags=["invite"])


@router.post("", response_model=schemas.InviteCodeResponse)
def generate_invite(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    return crud.create_invite_code(db, user.id)


@router.get("", response_model=List[schemas.InviteCodeResponse])
def list_my_invites(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    return crud.get_user_invite_codes(db, user.id)


@router.post("/{code}/use")
def use_invite(code: str, db: Session = Depends(get_db), user: User = Depends(require_auth)):
    invite = crud.use_invite_code(db, code, user.id)
    if not invite:
        raise HTTPException(status_code=400, detail="Invalid or already used invite code")
    return {"ok": True, "code": code}
