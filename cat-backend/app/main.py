from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.config import settings
from app.database import engine, SessionLocal, Base
from app.api import cats, sightings, recognize, user, auth, admin, posts, health, feeding, notifications, discoveries, map, audit, events
from app.crud import init_mock_data
from app.models import User
from passlib.context import CryptContext
from app.ratelimit import limiter, _SLOWAPI_AVAILABLE

app = FastAPI(title="猫猫社区 API", version="1.0.0")

if _SLOWAPI_AVAILABLE:
    from slowapi.middleware import SlowAPIMiddleware
    from slowapi.errors import RateLimitExceeded
    from slowapi import _rate_limit_exceeded_handler
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

from app.migrate import ensure_users_columns, ensure_sightings_columns, ensure_cats_columns, ensure_posts_columns
ensure_users_columns()
ensure_sightings_columns()
ensure_cats_columns()
ensure_posts_columns()

UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(os.path.join(UPLOAD_DIR, "cats"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "sightings"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "posts"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

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
app.include_router(events.router)


@app.on_event("startup")
def startup():
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
            print("WARNING: ADMIN_PASSWORD not set. Admin account will not be created.")
        if settings.INIT_DEMO_USER:
            if not settings.DEMO_PASSWORD:
                print("WARNING: INIT_DEMO_USER=1 but DEMO_PASSWORD is empty. Skipping demo user creation.")
            elif not db.query(User).filter(User.username == "demo").first():
                db.add(User(
                    username="demo",
                    password_hash=pwd_ctx.hash(settings.DEMO_PASSWORD),
                    nickname="猫猫爱好者",
                    role="user",
                ))
            db.commit()
            init_mock_data(db)
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "猫猫社区 API", "docs": "/docs"}
