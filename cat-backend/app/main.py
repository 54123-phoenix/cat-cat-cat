import logging

from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import os

from app.config import settings
from app.database import engine, SessionLocal, Base
from app.api import cats, sightings, recognize, user, auth, admin, posts, health, feeding, notifications, discoveries, map, audit, gallery, campus, invite
from app.api import events as events_api
from app.crud import init_mock_data
from app.models import User
from passlib.context import CryptContext
from app.ratelimit import limiter, _SLOWAPI_AVAILABLE
from app.middleware.security_headers import SecurityHeadersMiddleware
from app import events
from app.cache import init_cache

logger = logging.getLogger("cat_community")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await events.init_redis(os.getenv("REDIS_URL"))
    init_cache(os.getenv("REDIS_URL"))
    db = SessionLocal()
    try:
        pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        admin_password = settings.ADMIN_PASSWORD
        if admin_password:
            if not db.query(User).filter(User.username == "admin").first():
                db.add(User(
                    username="admin",
                    password_hash=pwd_ctx.hash(admin_password),
                    nickname="猫协管理员",
                    role="admin",
                ))
        else:
            logger.warning("ADMIN_PASSWORD not set. Admin account will not be created.")
        if settings.INIT_DEMO_USER:
            if not settings.DEMO_PASSWORD:
                logger.warning("INIT_DEMO_USER=1 but DEMO_PASSWORD is empty. Skipping demo user creation.")
            elif not db.query(User).filter(User.username == "demo").first():
                db.add(User(
                    username="demo",
                    password_hash=pwd_ctx.hash(settings.DEMO_PASSWORD),
                    nickname="猫猫爱好者",
                    role="user",
                ))
            db.commit()
            init_mock_data(db)
        from app.models import Campus
        if not db.query(Campus).first():
            db.add(Campus(name="复旦大学", slug="fudan", center_lat=31.3005, center_lng=121.5068))
            db.commit()
    finally:
        db.close()
    yield
    await events.close_redis()


app = FastAPI(title="猫猫社区 API", version="1.0.0", lifespan=lifespan)

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

Base.metadata.create_all(bind=engine)

UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(os.path.join(UPLOAD_DIR, "cats"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "sightings"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "posts"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "discoveries"), exist_ok=True)


@app.get("/uploads/{filepath:path}")
async def serve_upload(filepath: str):
    full_path = os.path.normpath(os.path.join(UPLOAD_DIR, filepath))
    if not full_path.startswith(os.path.normpath(UPLOAD_DIR)):
        raise HTTPException(status_code=403, detail="Access denied")
    if not os.path.isfile(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(full_path)

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


@app.get("/")
def root():
    return {"message": "猫猫社区 API", "docs": "/docs"}
