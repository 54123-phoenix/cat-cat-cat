import logging

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException, Depends, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.concurrency import run_in_threadpool
import os

from app.config import settings
from app.database import engine, SessionLocal
from app.schema_readiness import require_current_schema
from app.api import (
    cats,
    sightings,
    recognize,
    user,
    auth,
    admin,
    posts,
    health,
    feeding,
    notifications,
    discoveries,
    map,
    audit,
    gallery,
    campus,
    invite,
    routes,
    system,
    gamification,
    agents,
)
from app.api import events as events_api
from app.bootstrap import ensure_row
from app.models import User
from passlib.context import CryptContext
from app.ratelimit import limiter, _SLOWAPI_AVAILABLE
from app.middleware.request_logging import RequestLoggingMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app import events
from app.cache import init_cache
from app.services.upload_thumbnail import ALLOWED_WIDTHS, ThumbnailError, create_thumbnail

logger = logging.getLogger("cat_community")


@asynccontextmanager
async def lifespan(app: FastAPI):
    require_current_schema(engine)
    await events.init_redis(os.getenv("REDIS_URL"))
    try:
        init_cache(os.getenv("REDIS_URL"))
        _bootstrap_database()
        yield
    finally:
        await events.close_redis()


def _bootstrap_database():
    db = SessionLocal()
    try:
        pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        admin_password = settings.ADMIN_PASSWORD
        if admin_password:
            ensure_row(db, User, {"username": "admin"}, lambda: User(
                username="admin",
                password_hash=pwd_ctx.hash(admin_password),
                nickname="猫协管理员",
                role="admin",
            ))
        else:
            logger.warning("ADMIN_PASSWORD not set. Admin account will not be created.")
        if settings.INIT_DEMO_USER:
            if not settings.DEMO_PASSWORD:
                logger.warning(
                    "INIT_DEMO_USER=1 but DEMO_PASSWORD is empty. Skipping demo user creation."
                )
            else:
                ensure_row(db, User, {"username": "demo"}, lambda: User(
                    username="demo",
                    password_hash=pwd_ctx.hash(settings.DEMO_PASSWORD),
                    nickname="猫猫爱好者",
                    role="user",
                ))
        from app.models import Campus

        if not db.query(Campus).first():
            ensure_row(db, Campus, {"slug": "fudan"}, lambda: Campus(
                name="复旦大学",
                slug="fudan",
                center_lat=31.3005,
                center_lng=121.5068,
            ))
    finally:
        db.close()


app = FastAPI(title="猫猫社区 API", version="1.0.0", lifespan=lifespan)

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

if _SLOWAPI_AVAILABLE:
    from slowapi.middleware import SlowAPIMiddleware
    from slowapi.errors import RateLimitExceeded
    from slowapi import _rate_limit_exceeded_handler

    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "内部服务器错误，请稍后重试"},
    )


UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(os.path.join(UPLOAD_DIR, "cats"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "sightings"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "posts"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "discoveries"), exist_ok=True)


@app.get("/uploads/{filepath:path}")
async def serve_upload(filepath: str, request: Request,
                       w: str | None = Query(None, description="Optional preview width: 160, 320, 640, 960 or 1280")):
    upload_root = Path(UPLOAD_DIR).resolve()
    requested_path = Path(filepath)
    # Accept relative resource paths only, including on Windows (drive/UNC paths).
    if requested_path.anchor:
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        # Resolve links and traversal before checking directory membership.
        full_path = (upload_root / requested_path).resolve()
    except (OSError, RuntimeError, ValueError):
        raise HTTPException(status_code=403, detail="Access denied")
    if not full_path.is_relative_to(upload_root):
        raise HTTPException(status_code=403, detail="Access denied")
    if not full_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    if w is None:
        return FileResponse(full_path)
    if len(request.query_params.getlist("w")) != 1 or w not in {str(value) for value in ALLOWED_WIDTHS}:
        raise HTTPException(status_code=422, detail="Preview width must be one of 160, 320, 640, 960, 1280")
    try:
        preview = await run_in_threadpool(create_thumbnail, full_path, upload_root, int(w))
    except ThumbnailError as error:
        headers = {"Retry-After": "1"} if error.status_code == 503 else None
        raise HTTPException(status_code=error.status_code, detail=str(error), headers=headers) from error
    headers = {"Cache-Control": "public, no-cache", "ETag": preview.etag}
    validators = {value.strip().removeprefix("W/") for value in request.headers.get("if-none-match", "").split(",")}
    if preview.etag in validators or "*" in validators:
        return Response(status_code=304, headers=headers)
    return Response(preview.body, media_type=preview.media_type, headers=headers)


app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(cats.router)
app.include_router(sightings.router)
app.include_router(recognize.router)
app.include_router(user.router)
app.include_router(user.me_router)
app.include_router(user.lb_router)
app.include_router(posts.router)
app.include_router(health.router)
app.include_router(feeding.router)
app.include_router(notifications.router)
app.include_router(discoveries.router)
app.include_router(map.router)
app.include_router(audit.router)
app.include_router(events_api.router)
app.include_router(gallery.router)
app.include_router(campus.router)
app.include_router(invite.router)
app.include_router(routes.router)
app.include_router(system.router)
app.include_router(gamification.router)
app.include_router(agents.router)


@app.get("/")
def root():
    return {"message": "猫猫社区 API", "docs": "/docs"}
