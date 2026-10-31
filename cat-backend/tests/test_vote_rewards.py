from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import models, schemas
from app.api.auth import create_token
from app.api.sightings import vote_sighting
from app.database import Base, get_db
from app.main import app
from app.services.voting import settle_vote


@pytest.fixture
def voting_db(tmp_path):
    engine = create_engine(f'sqlite:///{(tmp_path / "votes.db").as_posix()}',
                           connect_args={'check_same_thread': False, 'timeout': 20})
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add_all([models.Cat(id=i, name=f'cat {i}') for i in (1, 2)])
        db.add_all([models.User(id=i, username=f'voter{i}', nickname='Voter', password_hash='x')
                    for i in range(1, 5)])
        db.add(models.Sighting(id=1, cat_id=1, status='approved'))
        db.commit()
    yield engine
    engine.dispose()


def test_retries_changed_votes_and_new_voters_only_reward_once(voting_db):
    with Session(voting_db) as db:
        for uid in (1, 2, 3):
            vote_sighting(1, schemas.SightingVoteRequest(cat_id=1), db, db.get(models.User, uid))
        for uid in (1, 2, 3, 1, 2, 3):
            vote_sighting(1, schemas.SightingVoteRequest(cat_id=1), db, db.get(models.User, uid))
        assert [db.get(models.User, i).xp for i in range(1, 5)] == [3, 3, 3, 0]
        # A different winning identity must not reset the receipt.
        for uid in (1, 2, 3, 4):
            vote_sighting(1, schemas.SightingVoteRequest(cat_id=2), db, db.get(models.User, uid))
        assert [db.get(models.User, i).xp for i in range(1, 5)] == [3, 3, 3, 3]
        assert db.query(models.SightingVoteReward).count() == 4
        assert db.get(models.Sighting, 1).cat_id == 2


def test_concurrent_http_votes_have_one_receipt_and_one_increment(voting_db, monkeypatch):
    def get_test_db():
        with Session(voting_db) as db:
            yield db
    monkeypatch.setitem(app.dependency_overrides, get_db, get_test_db)
    with Session(voting_db) as db:
        tokens = {i: create_token(db.get(models.User, i)) for i in range(1, 5)}
    # Avoid shared TestClient lifespan state; use plain clients without startup.
    def request_vote(uid):
        client = TestClient(app)
        try:
            return client.post('/api/sightings/1/vote', json={'cat_id': 1},
                               headers={'Authorization': f'Bearer {tokens[uid]}'}).status_code
        finally:
            client.close()
    with ThreadPoolExecutor(max_workers=4) as pool:
        assert list(pool.map(request_vote, [1, 2, 3, 4] * 3)) == [200] * 12
    with Session(voting_db) as db:
        assert db.query(models.SightingVote).count() == 4
        assert db.query(models.SightingVoteReward).count() == 4
        assert [db.get(models.User, i).xp for i in range(1, 5)] == [3] * 4


def test_vote_and_reward_rollback_together(voting_db, monkeypatch):
    with Session(voting_db) as db:
        settle_vote(db, 1, 1, 1)
        settle_vote(db, 1, 2, 1)
        def fail_commit():
            raise RuntimeError('simulated transaction failure')
        monkeypatch.setattr(db, 'commit', fail_commit)
        with pytest.raises(RuntimeError):
            settle_vote(db, 1, 3, 1)
    with Session(voting_db) as db:
        assert db.query(models.SightingVote).count() == 2
        assert db.query(models.SightingVoteReward).count() == 0
        assert [db.get(models.User, i).xp for i in range(1, 5)] == [0] * 4
