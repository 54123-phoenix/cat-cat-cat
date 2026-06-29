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


def test_contribution_stats_and_category_leaderboard():
    import uuid
    from app.database import SessionLocal, Base, engine
    from app import models, crud

    Base.metadata.create_all(bind=engine)
    from app.migrate import ensure_users_columns
    ensure_users_columns()
    db = SessionLocal()
    try:
        from passlib.context import CryptContext
        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        suffix = uuid.uuid4().hex[:8]
        photographer = models.User(
            username=f"photo_rank_user_{suffix}",
            password_hash=pwd.hash("x"),
            nickname="photo",
            role="user",
            xp=5,
        )
        observer = models.User(
            username=f"observe_rank_user_{suffix}",
            password_hash=pwd.hash("x"),
            nickname="observer",
            role="user",
            xp=500,
        )
        cat = models.Cat(name="RankCat", location="测试草坪")
        db.add_all([photographer, observer, cat])
        db.commit()
        db.refresh(photographer)
        db.refresh(observer)
        db.refresh(cat)

        photo_sighting = models.Sighting(
            cat_id=cat.id,
            user_id=photographer.id,
            image_path="/uploads/sightings/rank.png",
            location="测试草坪",
            latitude=31.1,
            longitude=121.1,
        )
        plain_sighting = models.Sighting(cat_id=cat.id, user_id=observer.id, location="测试草坪")
        db.add_all([photo_sighting, plain_sighting])
        db.commit()
        db.refresh(photo_sighting)
        db.add(models.SightingConfirmation(sighting_id=photo_sighting.id, user_id=observer.id))
        db.add(models.SightingVote(sighting_id=photo_sighting.id, user_id=observer.id, cat_id=cat.id))
        db.add(models.UserCatFollow(user_id=photographer.id, cat_id=cat.id))
        db.commit()

        stats = crud.get_user_stats_full(db, photographer.id)
        assert stats["contribution_score"] > 0
        assert len(stats["contribution_breakdown"]) == 5
        assert {item["key"] for item in stats["contribution_breakdown"]} == {
            "photography", "discovery", "map", "confirmation", "guardian",
        }

        from app.api.user import get_leaderboard
        board = get_leaderboard(category="photography", db=db, user=photographer)
        assert board["category"] == "photography"
        assert board["top"][0]["id"] == photographer.id
        assert board["top"][0]["category_score"] > 0
    finally:
        db.close()
