import os
import io
from datetime import timedelta
from PIL import Image

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-key-for-pytest")
os.environ.setdefault("ADMIN_PASSWORD", "testadmin123")
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("INIT_DEMO_USER", "0")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app import models, cache
from app.main import app
from app.database import Base, get_db
from app.api.auth import create_token
from app.ratelimit import limiter


def test_personal_collection_recognition_and_discoveries_are_isolated(api, monkeypatch):
    from app import crud, schemas, time_utils
    from app.api import recognize as recognition_api
    client, db, users, headers = api
    other = models.User(username='second-user', nickname='Second', password_hash='x')
    cat = models.Cat(name='Personal cat')
    db.add_all([cat, other])
    db.commit()
    other_header = {'Authorization': f'Bearer {create_token(other)}'}
    db.add(models.Sighting(cat_id=cat.id, user_id=users['user'].id, status='approved'))
    db.add(models.Discovery(status='approved'))  # legacy ownership unknown
    db.add(models.AuditLog(action='recognize', entity_type='cat', performed_by='legacy'))
    db.commit()
    assert client.get('/api/users/me/encountered-cats').status_code == 401
    assert client.get('/api/users/me/encountered-cats', headers=headers['user']).json() == [cat.id]
    assert client.get('/api/users/me/encountered-cats', headers=other_header).json() == []
    def recognition_done(auth):
        quests = client.get('/api/users/me/daily-quest', headers=auth).json()['quests']
        return next(q['done'] for q in quests if q['key'] == 'recognize')
    assert not recognition_done(headers['user'])
    assert not recognition_done(other_header)
    data = io.BytesIO()
    Image.new('RGB', (12, 12)).save(data, format='JPEG')
    monkeypatch.setattr(recognition_api, 'recognize_cat_image', lambda **kw: schemas.RecognizeResponse(status='unknown', confidence=0))
    assert client.post('/api/recognize', files={'file': ('cat.jpg', data.getvalue(), 'image/jpeg')}, headers=headers['user']).status_code == 200
    assert recognition_done(headers['user'])
    assert not recognition_done(other_header)
    monkeypatch.setattr(recognition_api, 'recognize_cat_image', lambda **kw: schemas.RecognizeResponse(status='unavailable', confidence=0))
    client.post('/api/recognize', files={'file': ('cat.jpg', data.getvalue(), 'image/jpeg')}, headers=other_header)
    assert not recognition_done(other_header)
    # A different day's audit never completes today's task.
    start, end = time_utils.campus_day_bounds(time_utils.campus_date())
    db.add_all([models.AuditLog(action='recognize', entity_type='cat', performed_by='test', user_id=other.id, created_at=t)
                for t in (start-timedelta(seconds=1), end)])
    db.commit()
    assert not recognition_done(other_header)
    assert client.post('/api/discoveries', data={'note': 'anonymous'}).status_code == 401
    for auth in (headers['user'], other_header):
        # Forged form user_id is ignored; server derives ownership from auth.
        response = client.post('/api/discoveries', data={'note': 'own', 'user_id': 999}, headers=auth)
        assert response.status_code == 200
    a, b = db.query(models.Discovery).filter(models.Discovery.note == 'own').order_by(models.Discovery.id).all()
    assert a.user_id == users['user'].id and b.user_id == other.id
    a.status = 'approved'
    db.commit()
    stats_a = crud.get_user_stats_full(db, users['user'].id)
    stats_b = crud.get_user_stats_full(db, other.id)
    assert (stats_a['discoveries'], stats_a['approved_discoveries']) == (0, 1)
    assert (stats_b['discoveries'], stats_b['approved_discoveries']) == (1, 0)


@pytest.fixture
def api(monkeypatch):
    monkeypatch.setattr(cache, '_redis_client', None)
    monkeypatch.setattr(cache, '_memory_cache', cache.TTLCache())
    if limiter is not None:
        monkeypatch.setattr(limiter, "enabled", False)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    db = Session(engine)
    users = {role: models.User(username=role, nickname=role, password_hash="x", role=role) for role in ("user", "reviewer", "admin")}
    db.add_all(users.values())
    db.commit()
    headers = {role: {"Authorization": f"Bearer {create_token(user)}"} for role, user in users.items()}
    monkeypatch.setitem(app.dependency_overrides, get_db, lambda: db)
    client = TestClient(app)
    yield client, db, users, headers
    client.close()
    db.close()
    engine.dispose()


def test_report_list_route_and_role_boundaries(api):
    client, db, users, headers = api
    post = models.Post(user_id=users["user"].id, content="reported post")
    db.add(post)
    db.commit()
    db.add(models.Report(post_id=post.id, reported_by=users["user"].id, reason="review"))
    db.commit()
    assert client.get('/api/posts/reports').status_code == 401
    assert client.get('/api/posts/reports', headers=headers['user']).status_code == 403
    for role in ('reviewer', 'admin'):
        response = client.get('/api/posts/reports', headers=headers[role])
        assert response.status_code == 200
        assert len(response.json()) == 1
    assert client.get(f'/api/posts/{post.id}', headers=headers['user']).status_code == 200


def test_reference_diagnostics_require_a_review_role(api, monkeypatch, tmp_path):
    from app.config import settings
    client, _, _, headers = api
    monkeypatch.setattr(settings, 'REFERENCE_DIR', str(tmp_path / 'missing-bundle'))
    assert client.get('/api/admin/reference/status').status_code == 401
    assert client.get('/api/admin/reference/status', headers=headers['user']).status_code == 403
    for role in ('reviewer', 'admin'):
        response = client.get('/api/admin/reference/status', headers=headers[role])
        assert response.status_code == 200
        assert response.json()['status'] == 'unavailable'
        assert response.json()['code'] == 'manifest_missing'


def test_miniprogram_urlencoded_forms_create_readable_records(api):
    client, db, _, headers = api
    cat = models.Cat(name='form cat')
    db.add(cat)
    db.commit()
    response = client.post('/api/posts', data={'topic': 'daily', 'content': '猫 & 草坪'}, headers=headers['user'])
    assert response.status_code == 200
    assert response.json()['content'] == '猫 & 草坪'
    response = client.post('/api/sightings', data={'cat_id': cat.id, 'latitude': '0', 'longitude': '12', 'location_name': '测试地点', 'note': '表单偶遇'}, headers=headers['user'])
    assert response.status_code == 200
    sighting = db.get(models.Sighting, response.json()['id'])
    assert sighting.latitude == 0 and sighting.note == '表单偶遇'
    assert sighting.location_name == '测试地点'
    assert response.json()['location_name'] == '测试地点'


def test_review_rejects_with_valid_state_and_is_repeatable(api):
    client, db, users, headers = api
    cat = models.Cat(name='review cat')
    db.add(cat)
    db.commit()
    sighting = models.Sighting(cat_id=cat.id, user_id=users['user'].id, status='pending')
    db.add(sighting)
    db.commit()
    url = f'/api/admin/sightings/{sighting.id}/review'
    assert client.post(url, json={'action': 'reject'}, headers=headers['user']).status_code == 403
    for _ in range(2):
        response = client.post(url, json={'action': 'reject'}, headers=headers['reviewer'])
        assert response.json() == {'ok': True, 'status': 'rejected'}
    assert db.get(models.Sighting, sighting.id).status == 'rejected'
    assert db.query(models.AuditLog).count() == 1
    assert client.post(url, json={'action': 'approve'}, headers=headers['admin']).json()['status'] == 'approved'
    assert client.post(url, json={'action': 'invalid'}, headers=headers['admin']).status_code in (400, 422)


def test_pending_sightings_are_private_until_approved_and_caches_follow_review(api, monkeypatch):
    import json
    client, db, users, headers = api
    cat = models.Cat(name='private cat')
    other = models.User(username='other', nickname='Other', password_hash='x', role='user')
    db.add_all([cat, other])
    db.commit()
    pending = models.Sighting(cat_id=cat.id, user_id=users['user'].id, status='pending',
                              latitude=31.3, longitude=121.5, location_name='pending place', image_path='/test.png')
    db.add(pending)
    db.commit()
    url = f'/api/sightings/{pending.id}'
    assert client.get(url).status_code == 404
    assert client.get(url, headers={'Authorization': f'Bearer {create_token(other)}'}).status_code == 404
    assert client.get(url, headers=headers['user']).status_code == 200
    assert client.get('/api/sightings?status=pending').status_code == 403
    assert client.get('/api/sightings?status=pending', headers=headers['reviewer']).json()['total'] == 1
    assert client.get('/api/sightings?mine=true&status=all', headers=headers['user']).json()['total'] == 1
    assert client.get('/api/sightings').json()['total'] == 0
    assert client.get('/api/gallery').json()['total'] == 0
    assert client.get('/api/map/heatmap').json()['items'] == []

    assert client.get('/api/routes/recommendations').json()['stops'] == []
    review = f'/api/admin/sightings/{pending.id}/review'
    assert client.post(review, json={'action': 'approve'}, headers=headers['admin']).status_code == 200
    assert client.get(url).status_code == 200
    assert client.get('/api/gallery').json()['total'] == 1
    assert len(client.get('/api/map/heatmap').json()['items']) == 1
    cache.cache_set('heatmap:7:0:100', json.dumps(client.get('/api/map/heatmap').json()))
    monkeypatch.setattr(cache, 'cache_invalidate', lambda *_: None)  # missed invalidation during an outage
    assert client.post(review, json={'action': 'reject'}, headers=headers['admin']).status_code == 200
    assert client.get(url).status_code == 404
    assert client.get('/api/map/heatmap').json()['items'] == []


def test_sse_revocation_closes_active_stream_and_releases_subscription(api, monkeypatch):
    import asyncio
    from fastapi import HTTPException
    from sqlalchemy.orm import sessionmaker
    from app import events
    from app.api import events as endpoint
    client, db, users, headers = api
    monkeypatch.setattr(endpoint, 'SessionLocal', sessionmaker(bind=db.bind))
    monkeypatch.setattr(events, '_redis_client', None)
    monkeypatch.setattr(events, '_in_memory_subscribers', {})
    authorization = headers['user']['Authorization']
    async def scenario():
        response = await endpoint.event_stream(token=None, authorization=authorization)
        assert len(events._in_memory_subscribers) == 1  # subscription succeeds before HTTP 200
        receiving = asyncio.create_task(anext(response.body_iterator))
        await asyncio.sleep(0)
        queue = next(iter(events._in_memory_subscribers))
        await queue.put('before')
        assert 'before' in await receiving
        users['user'].token_version += 1
        db.commit()
        await queue.put('after')
        with pytest.raises(StopAsyncIteration):
            await anext(response.body_iterator)
        assert not events._in_memory_subscribers
    asyncio.run(scenario())
    assert client.get('/api/auth/me', headers=headers['user']).status_code == 401
    with pytest.raises(HTTPException) as error:
        endpoint._resolve_user(authorization, None)
    assert error.value.status_code == 401


def test_heatmap_offset_returns_distinct_stable_pages(api):
    client, db, users, _ = api
    cat = models.Cat(name='heat cat')
    db.add(cat)
    db.commit()
    for index in range(5):
        db.add(models.Sighting(cat_id=cat.id, user_id=users['user'].id, status='approved', latitude=31+index/100, longitude=121, location_name=f'point {index}'))
    db.commit()
    pages = [client.get(f'/api/map/heatmap?skip={skip}&limit=2').json() for skip in [0,2,4]]
    assert [page['total'] for page in pages] == [5,5,5]
    assert [page['has_more'] for page in pages] == [True,True,False]
    assert len({item['name'] for page in pages for item in page['items']}) == 5
