import asyncio

from fastapi import APIRouter, Depends, Query, Header, HTTPException
from fastapi.responses import StreamingResponse

from app.api.auth import verify_token
from app.database import SessionLocal
from app.models import User
from app import events

router = APIRouter(prefix="/api/events", tags=["events"])


def _resolve_user(authorization: str, token: str) -> User:
    raw = None
    if authorization and authorization.startswith("Bearer "):
        raw = authorization[len("Bearer "):]
    elif token:
        raw = token
    if not raw:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(raw)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == int(payload["sub"])).first()
    finally:
        db.close()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.get("/stream")
async def event_stream(
    token: str = Query(default=None),
    authorization: str = Header(default=""),
):
    _resolve_user(authorization, token)
    queue = await events.subscribe()

    async def generator():
        try:
            while True:
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {message}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            events.unsubscribe(queue)

    return StreamingResponse(generator(), media_type="text/event-stream")

