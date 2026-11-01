import logging
import os
import sqlite3
import time
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger("cat_community.database")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./cat_community.db")

_is_sqlite = "sqlite" in DATABASE_URL

if _is_sqlite:
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 30})

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record, *, wal_timeout=5.0):
        cursor = dbapi_connection.cursor()
        try:
            # Concurrent first connections can fail a journal-mode lock upgrade
            # immediately, even with SQLite's busy handler. Retry only this setup
            # operation with a deadline, without replaying application writes.
            cursor.execute("PRAGMA busy_timeout=0")
            deadline = time.monotonic() + wal_timeout
            while True:
                try:
                    mode = cursor.execute("PRAGMA journal_mode").fetchone()[0]
                    if mode not in ("wal", "memory"):
                        mode = cursor.execute("PRAGMA journal_mode=WAL").fetchone()[0]
                        if mode != "wal":
                            raise RuntimeError(f"SQLite WAL could not be enabled: {mode}")
                    break
                except sqlite3.OperationalError as exc:
                    code = getattr(exc, "sqlite_errorcode", 0) & 0xFF
                    remaining = deadline - time.monotonic()
                    if code not in (sqlite3.SQLITE_BUSY, sqlite3.SQLITE_LOCKED) or remaining <= 0:
                        raise
                    time.sleep(min(.05, remaining))
            cursor.execute("PRAGMA busy_timeout=5000")
            cursor.execute("PRAGMA foreign_keys=ON")
        finally:
            cursor.close()
else:
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=3600,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
