import os
import sys
import pathlib
import tempfile

_db_path = pathlib.Path(tempfile.gettempdir()) / "cat_w4_test.db"
if _db_path.exists():
    _db_path.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{_db_path}"
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ADMIN_PASSWORD", "test-admin")

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from passlib.context import CryptContext

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _setup():
    from app.database import SessionLocal, Base, engine
    from app import models
    from app.migrate import ensure_users_columns, ensure_sightings_columns
    Base.metadata.create_all(bind=engine)
    ensure_users_columns()
    ensure_sightings_columns()
    return SessionLocal()


def _make_user(db, username):
    from app import models
    u = db.query(models.User).filter(models.User.username == username).first()
    if not u:
        u = models.User(username=username, password_hash=_pwd.hash("x"), nickname=username, role="user")
        db.add(u); db.commit(); db.refresh(u)
    return u


def _make_cat(db, name="橘宝"):
    from app import models
    cat = db.query(models.Cat).filter(models.Cat.name == name).first()
    if not cat:
        cat = models.Cat(name=name, color="橘", location="校园")
        db.add(cat); db.commit(); db.refresh(cat)
    return cat


def _make_sighting(db, cat, user):
    from app import models
    s = models.Sighting(cat_id=cat.id, user_id=user.id, status="approved", spotted_by=user.nickname)
    db.add(s); db.commit(); db.refresh(s)
    return s


def test_confirm_grade_flow():
    db = _setup()
    try:
        from app import models
        from app.api.sightings import confirm_sighting, _recompute_grade

        u1 = _make_user(db, "w4_conf1")
        u2 = _make_user(db, "w4_conf2")
        u3 = _make_user(db, "w4_conf3")
        cat = _make_cat(db)
        s = _make_sighting(db, cat, u1)

        assert (s.grade or "casual") == "casual"

        class FakeUser:
            def __init__(self, real):
                self.id = real.id
                self.nickname = real.nickname

        r0 = confirm_sighting(s.id, db=db, current_user=FakeUser(u2))
        assert r0.confirmations == 1
        assert r0.grade == "needs_id"

        r1 = confirm_sighting(s.id, db=db, current_user=FakeUser(u3))
        assert r1.confirmations == 2
        assert r1.grade == "research_grade"

        r_idem = confirm_sighting(s.id, db=db, current_user=FakeUser(u3))
        assert r_idem.confirmations == 2
        assert r_idem.grade == "research_grade"
    finally:
        db.close()


def test_vote_auto_confirm():
    db = _setup()
    try:
        from app import models
        from app.api.sightings import vote_sighting
        from app import schemas

        u1 = _make_user(db, "w4_vote1")
        u2 = _make_user(db, "w4_vote2")
        u3 = _make_user(db, "w4_vote3")
        cat_a = _make_cat(db, "投票橘宝")
        cat_b = _make_cat(db, "投票黑宝")
        s = _make_sighting(db, cat_b, u1)

        class FakeUser:
            def __init__(self, real):
                self.id = real.id
                self.nickname = real.nickname

        body = schemas.SightingVoteRequest(cat_id=cat_a.id)
        vote_sighting(s.id, body=body, db=db, current_user=FakeUser(u1))
        vote_sighting(s.id, body=body, db=db, current_user=FakeUser(u2))
        r = vote_sighting(s.id, body=body, db=db, current_user=FakeUser(u3))

        assert r.auto_confirmed is True
        assert r.grade == "research_grade"
        assert r.votes.get(cat_a.id) == 3

        db.refresh(s)
        assert s.cat_id == cat_a.id
        assert s.grade == "research_grade"
    finally:
        db.close()
