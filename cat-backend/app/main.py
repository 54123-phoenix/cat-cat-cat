from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from sqlalchemy import inspect, text

from app.database import engine, SessionLocal, Base
from app.api import cats, sightings, recognize, user, posts, admin, map, discoveries
from app.crud import init_mock_data

app = FastAPI(title="猫猫社区 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)


def ensure_sighting_columns():
    columns = {column["name"] for column in inspect(engine).get_columns("sightings")}
    missing_columns = {
        "location_name": "VARCHAR(100)",
        "latitude": "FLOAT",
        "longitude": "FLOAT",
        "note": "TEXT",
        "spotted_by": "VARCHAR(50)",
    }

    with engine.begin() as connection:
        for name, column_type in missing_columns.items():
            if name not in columns:
                connection.execute(text(f"ALTER TABLE sightings ADD COLUMN {name} {column_type}"))


ensure_sighting_columns()


def ensure_cat_columns():
    columns = {column["name"] for column in inspect(engine).get_columns("cats")}
    missing_columns = {
        "nickname": "VARCHAR(100)",
        "gender": "VARCHAR(10)",
        "neutered": "VARCHAR(10)",
        "age_estimate": "VARCHAR(20)",
    }

    with engine.begin() as connection:
        for name, column_type in missing_columns.items():
            if name not in columns:
                connection.execute(text(f"ALTER TABLE cats ADD COLUMN {name} {column_type}"))


ensure_cat_columns()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(os.path.join(UPLOAD_DIR, "cats"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "sightings"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "discoveries"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(cats.router)
app.include_router(sightings.router)
app.include_router(recognize.router)
app.include_router(user.router)
app.include_router(posts.router)
app.include_router(admin.router)
app.include_router(map.router)
app.include_router(discoveries.router)


@app.on_event("startup")
def startup():
    db = SessionLocal()
    try:
        init_mock_data(db)
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "猫猫社区 API", "docs": "/docs"}
