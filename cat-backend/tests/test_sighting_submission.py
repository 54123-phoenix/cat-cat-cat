"""Real requests and concurrent SQLite writers; no production data is used."""
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import threading
import uuid

from PIL import Image
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import Base
from app.services.sighting_submission import submit_sighting
from test_repair_contracts import api  # reusable isolated API fixture


def picture(color='orange'):
    stream = BytesIO()
    Image.new('RGB', (12, 12), color).save(stream, format='PNG')
    return stream.getvalue()


def test_retry_preserves_one_record_one_photo_and_one_reward(api, tmp_path, monkeypatch):
    from app.api import upload
    client, db, users, headers = api
    monkeypatch.setattr(upload, 'UPLOAD_DIR', str(tmp_path))
    cat = models.Cat(name='reviewed cat')
    db.add(cat); db.commit()
    key = str(uuid.uuid4())
    data = {'cat_id': cat.id, 'client_request_id': key, 'location': '现场定位',
            'latitude': 31.3, 'longitude': 121.5, 'note': '一条记录'}
    before = users['user'].xp or 0
    def send(body=data, image=picture(), role='user'):
        return client.post('/api/sightings', data=body, headers=headers[role],
                           files={'file': ('cat.png', image, 'image/png')})
    first, retry = send(), send()
    assert first.status_code == retry.status_code == 200
    assert first.json()['id'] == retry.json()['id']
    assert retry.json()['status'] == 'pending'
    assert retry.json()['latitude'] == 31.3
    assert retry.json()['image_path']
    assert db.query(models.Sighting).count() == 1
    assert len(list(tmp_path.rglob('*.png'))) == 1
    db.refresh(users['user'])
    assert users['user'].xp == before + 10
    # Content drift may not silently replay an earlier request.
    assert send({**data, 'note': 'different'}).status_code == 409
    assert send(image=picture('blue')).status_code == 409
    assert len(list(tmp_path.rglob('*.png'))) == 1
    # Keys belong to authenticated accounts, never to a global public namespace.
    other = send(role='reviewer')
    assert other.status_code == 200 and other.json()['id'] != first.json()['id']


@pytest.mark.parametrize('change', [
    {'client_request_id': 'not-a-uuid'}, {'latitude': 'NaN'}, {'longitude': 181},
    {'confidence': 'Infinity'}, {'note': 'x' * 501},
])
def test_invalid_submission_is_rejected_without_writing(api, change):
    client, db, _, headers = api
    cat = models.Cat(name='valid cat'); db.add(cat); db.commit()
    response = client.post('/api/sightings', headers=headers['user'],
                           data={'cat_id': cat.id, **change})
    assert response.status_code == 422
    assert db.query(models.Sighting).count() == 0


def test_unknown_cat_does_not_write_an_attachment(api, tmp_path, monkeypatch):
    from app.api import upload
    client, db, _, headers = api
    monkeypatch.setattr(upload, 'UPLOAD_DIR', str(tmp_path))
    result = client.post('/api/sightings', headers=headers['user'], data={'cat_id': 999999},
                         files={'file': ('cat.png', picture(), 'image/png')})
    assert result.status_code == 404 and not list(tmp_path.iterdir())
    assert db.query(models.Sighting).count() == 0


def test_concurrent_retries_commit_one_sighting_and_reward(tmp_path):
    engine = create_engine(f'sqlite:///{(tmp_path / "race.db").as_posix()}',
                           connect_args={'check_same_thread': False, 'timeout': 20})
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add_all([models.User(id=1, username='race', nickname='race', password_hash='x', xp=0),
                    models.Cat(id=1, name='race cat')]); db.commit()
    barrier = threading.Barrier(4)
    key = str(uuid.uuid4())
    def send(_):
        with Session(engine) as db:
            user = db.get(models.User, 1)
            barrier.wait(timeout=10)
            return submit_sighting(db, user, schemas.SightingCreate(cat_id=1), key).id
    try:
        with ThreadPoolExecutor(max_workers=4) as pool:
            ids = list(pool.map(send, range(4)))
        assert len(set(ids)) == 1
        with Session(engine) as db:
            assert db.query(models.Sighting).count() == 1
            assert db.get(models.User, 1).xp == 10
    finally:
        engine.dispose()


def test_legacy_clients_can_still_create_distinct_records(api):
    client, db, _, headers = api
    cat = models.Cat(name='legacy'); db.add(cat); db.commit()
    first = client.post('/api/sightings', headers=headers['user'], data={'cat_id': cat.id})
    second = client.post('/api/sightings', headers=headers['user'], data={'cat_id': cat.id})
    assert first.status_code == second.status_code == 200
    assert first.json()['id'] != second.json()['id']


def test_commit_failure_removes_only_the_new_photo_and_retry_awards_once(api, tmp_path, monkeypatch):
    from app.api import upload
    _, db, users, _ = api
    monkeypatch.setattr(upload, 'UPLOAD_DIR', str(tmp_path))
    cat = models.Cat(name='retry after commit failure'); db.add(cat); db.commit()
    payload = schemas.SightingCreate(cat_id=cat.id)
    user = users['user']
    before = user.xp or 0
    key = str(uuid.uuid4())
    unrelated_path = upload.save_validated_upload(picture('blue'), 'image/png', 'sightings')
    unrelated = tmp_path / unrelated_path.removeprefix('/uploads/')
    original_commit = db.commit

    def failed_commit():
        raise RuntimeError('commit did not succeed')

    monkeypatch.setattr(db, 'commit', failed_commit)
    with pytest.raises(RuntimeError, match='commit did not succeed'):
        submit_sighting(db, user, payload, key, picture(), 'image/png')
    assert db.query(models.Sighting).count() == 0
    assert list(tmp_path.rglob('*.png')) == [unrelated]
    assert unrelated.read_bytes() == picture('blue')
    db.refresh(user)
    assert (user.xp or 0) == before

    monkeypatch.setattr(db, 'commit', original_commit)
    created = submit_sighting(db, user, payload, key, picture(), 'image/png')
    retry = submit_sighting(db, user, payload, key, picture(), 'image/png')
    assert created.id == retry.id
    assert db.query(models.Sighting).count() == 1
    assert len(list(tmp_path.rglob('*.png'))) == 2  # Existing unrelated image plus the committed image.
    assert (tmp_path / created.image_path.removeprefix('/uploads/')).read_bytes() == picture()
    db.refresh(user)
    assert user.xp == before + 10


@pytest.mark.parametrize('failure_stage', ['commit_response', 'refresh'])
def test_durable_submission_keeps_its_photo_when_commit_response_or_refresh_fails(api, tmp_path, monkeypatch, failure_stage):
    from app.api import upload
    _, db, users, _ = api
    monkeypatch.setattr(upload, 'UPLOAD_DIR', str(tmp_path))
    cat = models.Cat(name='durable before failure'); db.add(cat); db.commit()
    payload = schemas.SightingCreate(cat_id=cat.id)
    user = users['user']
    before = user.xp or 0
    key = str(uuid.uuid4())
    original_commit, original_refresh = db.commit, db.refresh

    def commit_then_raise():
        original_commit()
        raise RuntimeError('commit response lost')

    def failed_refresh(*args, **kwargs):
        raise RuntimeError('refresh failed')

    if failure_stage == 'commit_response':
        monkeypatch.setattr(db, 'commit', commit_then_raise)
    else:
        monkeypatch.setattr(db, 'refresh', failed_refresh)
    with pytest.raises(RuntimeError, match='commit response lost|refresh failed'):
        submit_sighting(db, user, payload, key, picture(), 'image/png')
    monkeypatch.setattr(db, 'commit', original_commit)
    monkeypatch.setattr(db, 'refresh', original_refresh)

    existing = db.query(models.Sighting).one()
    image_path = tmp_path / existing.image_path.removeprefix('/uploads/')
    assert image_path.read_bytes() == picture()
    retry = submit_sighting(db, user, payload, key, picture(), 'image/png')
    assert retry.id == existing.id
    assert list(tmp_path.rglob('*.png')) == [image_path]
    db.refresh(user)
    assert user.xp == before + 10


@pytest.mark.parametrize('cleanup_failure', ['database_query', 'file_remove', 'rollback'])
def test_uncertain_cleanup_preserves_photo_and_original_failure(api, tmp_path, monkeypatch, cleanup_failure):
    from app.api import upload
    _, db, users, _ = api
    monkeypatch.setattr(upload, 'UPLOAD_DIR', str(tmp_path))
    cat = models.Cat(name='preserve uncertain asset'); db.add(cat); db.commit()
    payload = schemas.SightingCreate(cat_id=cat.id)
    original_rollback = db.rollback

    def broken_cleanup(*args, **kwargs):
        raise OSError('cleanup unavailable')

    def failed_commit():
        if cleanup_failure == 'database_query':
            monkeypatch.setattr(db, 'query', broken_cleanup)
        elif cleanup_failure == 'file_remove':
            monkeypatch.setattr(upload, 'discard_created_upload', broken_cleanup)
        else:
            monkeypatch.setattr(db, 'rollback', broken_cleanup)
        raise RuntimeError('original commit failure')

    monkeypatch.setattr(db, 'commit', failed_commit)
    with pytest.raises(RuntimeError, match='original commit failure'):
        submit_sighting(db, users['user'], payload, str(uuid.uuid4()), picture(), 'image/png')
    files = list(tmp_path.rglob('*.png'))
    assert len(files) == 1 and files[0].read_bytes() == picture()
    # End the deliberately failed transaction for fixture teardown.
    monkeypatch.setattr(db, 'rollback', original_rollback)
    original_rollback()


def test_exclusive_upload_does_not_overwrite_or_delete_a_colliding_file(api, tmp_path, monkeypatch):
    from app.api import upload
    _, db, users, _ = api
    monkeypatch.setattr(upload, 'UPLOAD_DIR', str(tmp_path))
    cat = models.Cat(name='collision'); db.add(cat); db.commit()
    payload = schemas.SightingCreate(cat_id=cat.id)
    identity = uuid.uuid4()
    monkeypatch.setattr(upload.uuid, 'uuid4', lambda: identity)
    existing_path = upload.save_validated_upload(picture('blue'), 'image/png', 'sightings')
    existing = tmp_path / existing_path.removeprefix('/uploads/')
    with pytest.raises(FileExistsError):
        submit_sighting(db, users['user'], payload, str(identity), picture(), 'image/png')
    assert existing.read_bytes() == picture('blue')
    assert db.query(models.Sighting).count() == 0
    assert list(tmp_path.rglob('*.png')) == [existing]


def test_cleanup_keeps_a_new_upload_if_its_bytes_changed_before_failure(api, tmp_path, monkeypatch):
    from app.api import upload
    _, db, users, _ = api
    monkeypatch.setattr(upload, 'UPLOAD_DIR', str(tmp_path))
    cat = models.Cat(name='changed asset'); db.add(cat); db.commit()
    payload = schemas.SightingCreate(cat_id=cat.id)

    def replace_image_then_fail():
        files = list(tmp_path.rglob('*.png'))
        assert len(files) == 1
        files[0].write_bytes(picture('blue'))
        raise RuntimeError('commit failure with changed asset')

    monkeypatch.setattr(db, 'commit', replace_image_then_fail)
    with pytest.raises(RuntimeError, match='commit failure with changed asset'):
        submit_sighting(db, users['user'], payload, str(uuid.uuid4()), picture(), 'image/png')
    files = list(tmp_path.rglob('*.png'))
    assert len(files) == 1 and files[0].read_bytes() == picture('blue')


@pytest.mark.parametrize('cleanup_fails', [False, True])
def test_partial_upload_cleanup_never_masks_the_write_failure(tmp_path, monkeypatch, cleanup_fails):
    from app.api import upload
    monkeypatch.setattr(upload, 'UPLOAD_DIR', str(tmp_path))

    class PartialWrite:
        def __init__(self, path, mode):
            self.handle = open(path, mode)

        def __enter__(self):
            return self

        def __exit__(self, *args):
            self.handle.close()

        def write(self, content):
            self.handle.write(content[:7])
            raise OSError('disk full during upload')

    def cannot_remove(*args, **kwargs):
        raise PermissionError('file cleanup unavailable')

    monkeypatch.setattr(upload, 'open', PartialWrite, raising=False)
    if cleanup_fails:
        monkeypatch.setattr(upload.os, 'unlink', cannot_remove)
    with pytest.raises(OSError, match='disk full during upload'):
        upload.save_validated_upload(picture(), 'image/png', 'sightings')
    files = list(tmp_path.rglob('*.png'))
    if cleanup_fails:
        assert len(files) == 1 and files[0].read_bytes() == picture()[:7]
    else:
        assert not files
