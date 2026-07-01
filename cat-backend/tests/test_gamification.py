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
            u = models.User(
                username="xp_test_user",
                password_hash=pwd.hash("x"),
                nickname="xp",
                role="user",
            )
            db.add(u)
            db.commit()
            db.refresh(u)
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
        plain_sighting = models.Sighting(
            cat_id=cat.id, user_id=observer.id, location="测试草坪"
        )
        db.add_all([photo_sighting, plain_sighting])
        db.commit()
        db.refresh(photo_sighting)
        db.add(
            models.SightingConfirmation(
                sighting_id=photo_sighting.id, user_id=observer.id
            )
        )
        db.add(
            models.SightingVote(
                sighting_id=photo_sighting.id, user_id=observer.id, cat_id=cat.id
            )
        )
        db.add(models.UserCatFollow(user_id=photographer.id, cat_id=cat.id))
        db.commit()

        stats = crud.get_user_stats_full(db, photographer.id)
        assert stats["contribution_score"] > 0
        assert len(stats["contribution_breakdown"]) == 5
        assert {item["key"] for item in stats["contribution_breakdown"]} == {
            "photography",
            "discovery",
            "map",
            "confirmation",
            "guardian",
        }

        from app.api.user import get_leaderboard

        board = get_leaderboard(category="photography", db=db, user=photographer)
        assert board["category"] == "photography"
        assert board["top"][0]["id"] == photographer.id
        assert board["top"][0]["category_score"] > 0
    finally:
        db.close()


def test_gamification_titles_include_post_contribution():
    import uuid
    from app.database import SessionLocal, Base, engine
    from app import models

    Base.metadata.create_all(bind=engine)
    from app.migrate import ensure_users_columns

    ensure_users_columns()
    db = SessionLocal()
    try:
        from passlib.context import CryptContext

        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        suffix = uuid.uuid4().hex[:8]
        user = models.User(
            username=f"title_post_user_{suffix}",
            password_hash=pwd.hash("x"),
            nickname="poster",
            role="user",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        db.add(models.Post(user_id=user.id, topic="daily", content="今天也遇到猫猫了"))
        db.commit()

        from app.api.gamification import get_titles

        result = get_titles(db=db, user=user)
        keys = {item["key"] for item in result["titles"]}
        assert "community_voice" in keys
    finally:
        db.close()


def test_daily_capsule_claim_idempotency():
    import uuid
    from app.database import SessionLocal, Base, engine
    from app import models

    Base.metadata.create_all(bind=engine)
    from app.migrate import ensure_users_columns

    ensure_users_columns()
    db = SessionLocal()
    try:
        from passlib.context import CryptContext

        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        suffix = uuid.uuid4().hex[:8]
        user = models.User(
            username=f"capsule_claim_{suffix}",
            password_hash=pwd.hash("x"),
            nickname="claimer",
            role="user",
        )
        db.add(user)
        cat = models.Cat(name="CapsuleCat", location="本部")
        db.add(cat)
        db.commit()
        db.refresh(user)
        db.refresh(cat)
        db.add(models.Sighting(cat_id=cat.id, user_id=user.id, location="本部"))
        db.commit()

        from app.api.gamification import claim_daily_capsule

        result1 = claim_daily_capsule(db=db, user=user)
        assert result1["claimed"] is True
        assert result1["claim"]["cat_id"] is not None

        result2 = claim_daily_capsule(db=db, user=user)
        assert result2["claimed"] is False
        assert "已领取" in result2["message"]

        claims = (
            db.query(models.DailyCapsuleClaim)
            .filter(models.DailyCapsuleClaim.user_id == user.id)
            .all()
        )
        assert len(claims) == 1

        collectibles = (
            db.query(models.UserCollectible)
            .filter(
                models.UserCollectible.user_id == user.id,
                models.UserCollectible.collectible_type == "capsule_reward",
            )
            .all()
        )
        assert len(collectibles) == 1
    finally:
        db.close()


def test_daily_capsule_get_equals_claim():
    """同一用户同一天 GET daily capsule 和 claim 结果一致。"""
    import uuid
    from datetime import date
    from app.database import SessionLocal, Base, engine
    from app import models

    Base.metadata.create_all(bind=engine)
    from app.migrate import ensure_users_columns

    ensure_users_columns()
    db = SessionLocal()
    try:
        from passlib.context import CryptContext

        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        suffix = uuid.uuid4().hex[:8]
        user = models.User(
            username=f"capsule_get_{suffix}",
            password_hash=pwd.hash("x"),
            nickname="getter",
            role="user",
        )
        db.add(user)
        cat = models.Cat(name="GetCat", location="本部")
        db.add(cat)
        db.commit()
        db.refresh(user)
        db.refresh(cat)
        db.add(models.Sighting(cat_id=cat.id, user_id=user.id, location="本部"))
        db.commit()

        from app.api.gamification import daily_capsule, claim_daily_capsule

        get_result = daily_capsule(db=db, user=user)
        assert get_result["available"] is True

        claim_result = claim_daily_capsule(db=db, user=user)
        assert claim_result["claimed"] is True

        assert get_result["cat"]["id"] == claim_result["claim"]["cat_id"]
        assert get_result["reward"]["sticker"] == claim_result["claim"]["sticker"]
        assert get_result["reward"]["title"] == claim_result["claim"]["title"]
    finally:
        db.close()


def test_daily_capsule_different_users_different_seed():
    """不同用户同一天胶囊 seed 不互相污染（至少不报错且各自稳定）。"""
    import uuid
    from app.database import SessionLocal, Base, engine
    from app import models

    Base.metadata.create_all(bind=engine)
    from app.migrate import ensure_users_columns

    ensure_users_columns()
    db = SessionLocal()
    try:
        from passlib.context import CryptContext

        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        suffix = uuid.uuid4().hex[:8]
        user_a = models.User(
            username=f"capsule_a_{suffix}",
            password_hash=pwd.hash("x"),
            nickname="a",
            role="user",
        )
        user_b = models.User(
            username=f"capsule_b_{suffix}",
            password_hash=pwd.hash("x"),
            nickname="b",
            role="user",
        )
        db.add_all([user_a, user_b])
        cat = models.Cat(name="SharedCat", location="本部")
        db.add(cat)
        db.commit()
        db.refresh(user_a)
        db.refresh(user_b)
        db.refresh(cat)
        db.add(models.Sighting(cat_id=cat.id, user_id=user_a.id, location="本部"))
        db.add(models.Sighting(cat_id=cat.id, user_id=user_b.id, location="本部"))
        db.commit()

        from app.api.gamification import build_daily_capsule_for_user
        from datetime import date

        today = date.today()
        result_a1 = build_daily_capsule_for_user(db, user_a.id, today)
        result_a2 = build_daily_capsule_for_user(db, user_a.id, today)
        result_b1 = build_daily_capsule_for_user(db, user_b.id, today)

        assert result_a1["reward"]["sticker"] == result_a2["reward"]["sticker"]
        assert result_a1["reward"]["title"] == result_a2["reward"]["title"]
        assert result_a1["cat"]["id"] == result_a2["cat"]["id"]
        assert result_b1["available"] is True
    finally:
        db.close()


def _setup_route_test_data(db, user, cat, stop_names, time_slot="anytime"):
    """Create sightings at given stop_names so route_story produces them.

    Clears prior sightings/checkins to isolate route tests from other tests'
    data in the shared test DB.
    """
    from datetime import datetime, timedelta
    from app import models

    db.query(models.Sighting).delete()
    db.query(models.RouteCheckin).delete()
    db.query(models.UserCollectible).filter(
        models.UserCollectible.collectible_type == "route_stamp"
    ).delete(synchronize_session=False)
    db.commit()

    base_time = datetime.now() - timedelta(hours=2)
    for i, name in enumerate(stop_names):
        for j in range(10):
            db.add(
                models.Sighting(
                    cat_id=cat.id,
                    user_id=user.id,
                    location=name,
                    location_name=name,
                    created_at=base_time + timedelta(minutes=i * 10 + j),
                )
            )
    db.commit()


def test_route_checkin_idempotency():
    import uuid
    from app.database import SessionLocal, Base, engine
    from app import models

    Base.metadata.create_all(bind=engine)
    from app.migrate import ensure_users_columns

    ensure_users_columns()
    db = SessionLocal()
    try:
        from passlib.context import CryptContext

        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        suffix = uuid.uuid4().hex[:8]
        user = models.User(
            username=f"checkin_user_{suffix}",
            password_hash=pwd.hash("x"),
            nickname="walker",
            role="user",
        )
        db.add(user)
        cat = models.Cat(name="RouteCat", location="南区")
        db.add(cat)
        db.commit()
        db.refresh(user)
        db.refresh(cat)

        _setup_route_test_data(db, user, cat, ["南区草坪", "北区草坪", "本部草坪"])

        from app.api.gamification import route_checkin, CheckInRequest

        body = CheckInRequest(time_slot="anytime", stop_name="南区草坪", cat_id=cat.id)
        result1 = route_checkin(body=body, db=db, user=user)
        assert result1["checked_in"] is True

        result2 = route_checkin(body=body, db=db, user=user)
        assert result2["checked_in"] is False

        checkins = (
            db.query(models.RouteCheckin)
            .filter(models.RouteCheckin.user_id == user.id)
            .all()
        )
        assert len(checkins) == 1
    finally:
        db.close()


def test_route_checkin_rejects_invalid_stop():
    """非法 stop_name 不能打卡，返回 400。"""
    import uuid
    from app.database import SessionLocal, Base, engine
    from app import models
    from fastapi import HTTPException
    import pytest

    Base.metadata.create_all(bind=engine)
    from app.migrate import ensure_users_columns

    ensure_users_columns()
    db = SessionLocal()
    try:
        from passlib.context import CryptContext

        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        suffix = uuid.uuid4().hex[:8]
        user = models.User(
            username=f"invalid_stop_{suffix}",
            password_hash=pwd.hash("x"),
            nickname="invalid",
            role="user",
        )
        db.add(user)
        cat = models.Cat(name="InvalidCat", location="本部")
        db.add(cat)
        db.commit()
        db.refresh(user)
        db.refresh(cat)

        _setup_route_test_data(db, user, cat, ["真实站点A", "真实站点B"])

        from app.api.gamification import route_checkin, CheckInRequest

        body = CheckInRequest(
            time_slot="anytime", stop_name="不存在的站点", cat_id=cat.id
        )
        with pytest.raises(HTTPException) as exc_info:
            route_checkin(body=body, db=db, user=user)
        assert exc_info.value.status_code == 400

        body_bad_slot = CheckInRequest(
            time_slot="badslot", stop_name="真实站点A", cat_id=cat.id
        )
        with pytest.raises(HTTPException) as exc_info:
            route_checkin(body=body_bad_slot, db=db, user=user)
        assert exc_info.value.status_code == 400
    finally:
        db.close()


def test_route_stamp_only_on_full_completion():
    """只打一站不发 route_stamp，全部打完才发。"""
    import uuid
    from app.database import SessionLocal, Base, engine
    from app import models

    Base.metadata.create_all(bind=engine)
    from app.migrate import ensure_users_columns

    ensure_users_columns()
    db = SessionLocal()
    try:
        from passlib.context import CryptContext

        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        suffix = uuid.uuid4().hex[:8]
        user = models.User(
            username=f"stamp_user_{suffix}",
            password_hash=pwd.hash("x"),
            nickname="stamper",
            role="user",
        )
        db.add(user)
        cat = models.Cat(name="StampCat", location="本部")
        db.add(cat)
        db.commit()
        db.refresh(user)
        db.refresh(cat)

        stops = ["站点一", "站点二", "站点三"]
        _setup_route_test_data(db, user, cat, stops)

        from app.api.gamification import route_checkin, CheckInRequest

        body1 = CheckInRequest(time_slot="anytime", stop_name="站点一", cat_id=cat.id)
        r1 = route_checkin(body=body1, db=db, user=user)
        assert r1["checked_in"] is True
        assert r1["completed"] is False
        assert r1["has_stamp"] is False

        stamps = (
            db.query(models.UserCollectible)
            .filter(
                models.UserCollectible.user_id == user.id,
                models.UserCollectible.collectible_type == "route_stamp",
            )
            .all()
        )
        assert len(stamps) == 0

        body2 = CheckInRequest(time_slot="anytime", stop_name="站点二", cat_id=cat.id)
        route_checkin(body=body2, db=db, user=user)

        stamps = (
            db.query(models.UserCollectible)
            .filter(
                models.UserCollectible.user_id == user.id,
                models.UserCollectible.collectible_type == "route_stamp",
            )
            .all()
        )
        assert len(stamps) == 0

        body3 = CheckInRequest(time_slot="anytime", stop_name="站点三", cat_id=cat.id)
        r3 = route_checkin(body=body3, db=db, user=user)
        assert r3["completed"] is True
        assert r3["has_stamp"] is True
        assert r3["stamp_issued"] is True

        stamps = (
            db.query(models.UserCollectible)
            .filter(
                models.UserCollectible.user_id == user.id,
                models.UserCollectible.collectible_type == "route_stamp",
            )
            .all()
        )
        assert len(stamps) == 1
    finally:
        db.close()


def test_route_progress_fields():
    """路线进度接口返回 total_stops/remaining_stops/completed/has_stamp。"""
    import uuid
    from app.database import SessionLocal, Base, engine
    from app import models

    Base.metadata.create_all(bind=engine)
    from app.migrate import ensure_users_columns

    ensure_users_columns()
    db = SessionLocal()
    try:
        from passlib.context import CryptContext

        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        suffix = uuid.uuid4().hex[:8]
        user = models.User(
            username=f"progress_user_{suffix}",
            password_hash=pwd.hash("x"),
            nickname="progressor",
            role="user",
        )
        db.add(user)
        cat = models.Cat(name="ProgressCat", location="本部")
        db.add(cat)
        db.commit()
        db.refresh(user)
        db.refresh(cat)

        stops = ["进度站A", "进度站B"]
        _setup_route_test_data(db, user, cat, stops)

        from app.api.gamification import route_checkin, route_progress, CheckInRequest

        prog0 = route_progress(time_slot="anytime", route_limit=4, db=db, user=user)
        assert prog0["total_stops"] >= 2
        assert prog0["checkin_count"] == 0
        assert prog0["completed"] is False
        assert prog0["has_stamp"] is False
        assert prog0["remaining_stops"] == prog0["total_stops"]

        route_checkin(
            body=CheckInRequest(
                time_slot="anytime", stop_name="进度站A", cat_id=cat.id
            ),
            db=db,
            user=user,
        )
        prog1 = route_progress(time_slot="anytime", route_limit=4, db=db, user=user)
        assert prog1["checkin_count"] == 1
        assert prog1["completed"] is False
        assert prog1["remaining_stops"] == prog1["total_stops"] - 1
    finally:
        db.close()


def test_collectibles_listing():
    import uuid
    from app.database import SessionLocal, Base, engine
    from app import models

    Base.metadata.create_all(bind=engine)
    from app.migrate import ensure_users_columns

    ensure_users_columns()
    db = SessionLocal()
    try:
        from passlib.context import CryptContext

        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        suffix = uuid.uuid4().hex[:8]
        user = models.User(
            username=f"coll_user_{suffix}",
            password_hash=pwd.hash("x"),
            nickname="collector",
            role="user",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        db.add(
            models.UserCollectible(
                user_id=user.id,
                collectible_type="route_stamp",
                key="morning",
                display_name="路线印章 · morning",
                emoji="🗺️",
            )
        )
        db.add(
            models.UserCollectible(
                user_id=user.id,
                collectible_type="capsule_reward",
                key="2026-07-01",
                display_name="清晨观察员",
                emoji="🌅",
            )
        )
        db.commit()

        from app.api.gamification import get_collectibles

        result = get_collectibles(db=db, user=user)
        assert result["total"] == 2
        types = {c["type"] for c in result["collectibles"]}
        assert types == {"route_stamp", "capsule_reward"}
    finally:
        db.close()


def test_route_progress_single_stop():
    """单站路线 route_limit=1 时 progress 正常返回，不报错。"""
    import uuid
    from app.database import SessionLocal, Base, engine
    from app import models

    Base.metadata.create_all(bind=engine)
    from app.migrate import ensure_users_columns

    ensure_users_columns()
    db = SessionLocal()
    try:
        from passlib.context import CryptContext

        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        suffix = uuid.uuid4().hex[:8]
        user = models.User(
            username=f"single_stop_{suffix}",
            password_hash=pwd.hash("x"),
            nickname="single",
            role="user",
        )
        db.add(user)
        cat = models.Cat(name="SingleCat", location="本部")
        db.add(cat)
        db.commit()
        db.refresh(user)
        db.refresh(cat)

        _setup_route_test_data(db, user, cat, ["唯一站"])

        from app.api.gamification import route_progress

        prog = route_progress(time_slot="anytime", route_limit=1, db=db, user=user)
        assert prog["total_stops"] == 1
        assert prog["remaining_stops"] == 1
        assert prog["completed"] is False
        assert prog["has_stamp"] is False
    finally:
        db.close()


def test_capsule_claim_compensates_missing_collectible():
    """手动创建 DailyCapsuleClaim 但不创建 UserCollectible，再调用 claim 应补回。"""
    import uuid
    from datetime import date
    from app.database import SessionLocal, Base, engine
    from app import models

    Base.metadata.create_all(bind=engine)
    from app.migrate import ensure_users_columns

    ensure_users_columns()
    db = SessionLocal()
    try:
        from passlib.context import CryptContext

        pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
        suffix = uuid.uuid4().hex[:8]
        user = models.User(
            username=f"compensate_{suffix}",
            password_hash=pwd.hash("x"),
            nickname="compensate",
            role="user",
        )
        db.add(user)
        cat = models.Cat(name="CompensateCat", location="本部")
        db.add(cat)
        db.commit()
        db.refresh(user)
        db.refresh(cat)
        db.add(models.Sighting(cat_id=cat.id, user_id=user.id, location="本部"))
        db.commit()

        today_iso = date.today().isoformat()
        db.add(
            models.DailyCapsuleClaim(
                user_id=user.id,
                claim_date=today_iso,
                cat_id=cat.id,
                sticker="🐱",
                title="清晨观察员",
            )
        )
        db.commit()

        from app.api.gamification import claim_daily_capsule

        result = claim_daily_capsule(db=db, user=user)
        assert result["claimed"] is False
        assert "已领取" in result["message"]

        collectibles = (
            db.query(models.UserCollectible)
            .filter(
                models.UserCollectible.user_id == user.id,
                models.UserCollectible.collectible_type == "capsule_reward",
                models.UserCollectible.key == today_iso,
            )
            .all()
        )
        assert len(collectibles) == 1
        assert collectibles[0].display_name == "清晨观察员"
    finally:
        db.close()
