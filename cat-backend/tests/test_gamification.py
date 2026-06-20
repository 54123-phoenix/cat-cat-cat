import os
import sys
import pathlib
import tempfile

_db_path = pathlib.Path(tempfile.gettempdir()) / "cat_gamification_test.db"
if _db_path.exists():
    _db_path.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{_db_path}"
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_PASSWORD", "test-admin")

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))


def test_compute_level():
    from app.crud import compute_level
    assert compute_level(0) == 1
    assert compute_level(99) == 1
    assert compute_level(100) == 2
    assert compute_level(299) == 2
    assert compute_level(300) == 3
    assert compute_level(600) == 4
    assert compute_level(-5) == 1


def test_level_progress():
    from app.crud import level_progress
    assert 0.0 <= level_progress(0) <= 1.0
    assert 0.0 <= level_progress(100) <= 1.0
    assert 0.0 <= level_progress(300) <= 1.0


def test_add_xp_and_daily_quest_structure():
    from app.database import SessionLocal, Base, engine
    from app import models, crud

    Base.metadata.create_all(bind=engine)
    from app.migrate import ensure_users_columns
    ensure_users_columns()
    db = SessionLocal()
    try:
        from passlib.context import CryptContext
        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        u = db.query(models.User).filter(models.User.username == "xp_test_user").first()
        if not u:
            u = models.User(username="xp_test_user", password_hash=pwd.hash("x"), nickname="xp", role="user")
            db.add(u); db.commit(); db.refresh(u)
        before = u.xp or 0
        crud.add_xp(db, u, 10)
        db.refresh(u)
        assert u.xp == before + 10
        assert u.level == crud.compute_level(u.xp)

        stats = crud.get_user_stats_full(db, u.id)
        for key in ("streak", "longest_streak", "xp", "level", "level_progress"):
            assert key in stats

        from app.api.user import get_daily_quest
        class FakeUser:
            id = u.id
        resp = get_daily_quest(db=db, user=u)
        assert "quests" in resp and "all_done" in resp and "reward_xp" in resp
        assert len(resp["quests"]) == 4
        assert resp["reward_xp"] == 20
        keys = {q["key"] for q in resp["quests"]}
        assert keys == {"sighting", "photo", "post", "recognize"}
    finally:
        db.close()
