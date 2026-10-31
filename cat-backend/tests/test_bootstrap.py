from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.bootstrap import ensure_row
from app.database import Base
from app.models import User


def test_concurrent_bootstrap_and_restart_preserve_one_original_account(tmp_path):
    engine = create_engine(f'sqlite:///{(tmp_path / "bootstrap.db").as_posix()}')
    Base.metadata.create_all(engine)
    barrier = Barrier(4)
    def start():
        def factory():
            # All four requests have already observed that the account is absent.
            barrier.wait(timeout=10)
            return User(username='admin', nickname='original', password_hash='original')
        with Session(engine) as db:
            ensure_row(db, User, {'username': 'admin'}, factory)
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(lambda _: start(), range(4)))
    with Session(engine) as db:
        ensure_row(db, User, {'username': 'admin'}, lambda: User(username='admin', password_hash='changed'))
        assert db.query(User).count() == 1
        assert db.query(User).one().password_hash == 'original'
        with pytest.raises(IntegrityError):
            ensure_row(db, User, {'username': 'broken'}, lambda: User(username='broken', nickname=None))
        assert db.query(User).count() == 1
    engine.dispose()
