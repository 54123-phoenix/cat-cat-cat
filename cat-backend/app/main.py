from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.database import engine, SessionLocal, Base
from app.api import cats, sightings, recognize, user, auth, admin, posts, health, feeding, notifications
from app.crud import init_mock_data
from app.models import User
from passlib.context import CryptContext

app = FastAPI(title="猫猫社区 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
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
app.include_router(posts.router)
app.include_router(health.router)
app.include_router(feeding.router)
app.include_router(notifications.router)


@app.on_event("startup")
def startup():
    db = SessionLocal()
    try:
        pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        if not db.query(User).filter(User.username == "admin").first():
            db.add(User(
                username="admin",
                password_hash=pwd_ctx.hash(os.getenv("ADMIN_PASSWORD", "cat-admin")),
                nickname="猫协管理员",
                role="admin",
            ))
        if not db.query(User).filter(User.username == "demo").first():
            db.add(User(
                username="demo",
                password_hash=pwd_ctx.hash("demo123"),
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
