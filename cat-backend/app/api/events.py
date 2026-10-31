import asyncio
import logging
import anyio

from fastapi import APIRouter, Depends, Query, Header, HTTPException
from fastapi.responses import StreamingResponse

from app.api.auth import get_current_user_from_header
from app.database import SessionLocal
from app.models import User
from app import events

router = APIRouter(prefix="/api/events", tags=["events"])
logger = logging.getLogger("cat_community.events")


def _resolve_user(authorization: str, token: str) -> User:
    raw = None
    if authorization and authorization.startswith("Bearer "):
        raw = authorization[len("Bearer "):]
    elif token:
        raw = token
    if not raw:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db = SessionLocal()
    try:
        return get_current_user_from_header(f"Bearer {raw}", db)
    finally:
        db.close()


@router.get("/stream")
async def event_stream(
    token: str = Query(default=None),
    authorization: str = Header(default=""),
):
    _resolve_user(authorization, token)
    try:
        sub = await events.subscribe()
    except events.STREAM_ERRORS:
        raise HTTPException(status_code=503, detail="Event stream temporarily unavailable", headers={"Retry-After": "3"})

    closed = False
    async def cleanup():
        nonlocal closed
        if closed:
            return
        closed = True
        # HTTP disconnect cancellation must not interrupt subscription cleanup.
        with anyio.CancelScope(shield=True):
            try:
                await events.unsubscribe(sub)
            except events.STREAM_ERRORS:
                logger.warning("Redis unavailable during subscription cleanup")

    class EventStreamResponse(StreamingResponse):
        async def __call__(self, scope, receive, send):
            try:
                await super().__call__(scope, receive, send)
            finally:
                # Also covers a failed response start, before generator entry.
                await cleanup()

    async def generator():
        try:
            while True:
                if hasattr(sub, "get_message"):
                    msg = await sub.get_message(ignore_subscribe_messages=True, timeout=15.0)
                    message = msg["data"] if msg and msg.get("type") == "message" else None
                else:
                    try:
                        message = await asyncio.wait_for(sub.get(), timeout=15.0)
                    except asyncio.TimeoutError:
                        message = None
                # Revalidate before delivery and on every heartbeat, including revocation.
                try:
                    _resolve_user(authorization, token)
                except HTTPException:
                    return
                yield f"data: {message}\n\n" if message is not None else ": ping\n\n"
        except events.STREAM_ERRORS:
            logger.warning("Redis subscription lost; client must reconnect and refresh current state")
        finally:
            await cleanup()

    return EventStreamResponse(generator(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})
