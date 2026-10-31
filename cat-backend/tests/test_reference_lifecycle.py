import json
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app import models
from app.services import reference_lifecycle as lifecycle, reference_snapshot as ref, model_loader, ai
from app.services.reference_store import StoreBusy, writer_lock
from test_reference_snapshot import bundle


@pytest.fixture
def store(bundle, monkeypatch):
    db, output, _, _, _, _, _, vector = bundle
    root = output.parent / 'store'
    monkeypatch.setattr(ref.settings, 'REFERENCE_STORE', str(root))
    monkeypatch.setattr(model_loader, 'extract_embedding', lambda image, **kw: vector)
    factory = sessionmaker(bind=db.get_bind())
    return db, root, factory, bundle


def submit(store, **kwargs):
    return lifecycle.enqueue(store[0], crop=False, **kwargs)


def execute(store):
    return lifecycle.run_once(factory=store[2])


def test_rebuild_publish_and_compatible_rollback(store):
    first = submit(store)
    assert lifecycle.read_job(store[1], first.job_id).status == 'queued'
    assert not (store[1] / 'current.json').exists()
    done = execute(store)
    assert done.status == 'succeeded' and done.completed_photos == done.total_photos == 1
    assert done.input_revision and done.input_generation == 0
    a = ref.load_active_snapshot(False)
    submit(store, publish=False)
    candidate = execute(store)
    assert candidate.code == 'candidate_ready'
    assert ref.load_active_snapshot(False).manifest.snapshot_id == a.manifest.snapshot_id
    submit(store, kind='publish', snapshot_id=candidate.snapshot_id)
    assert execute(store).status == 'succeeded'
    b = ref.load_active_snapshot(False)
    assert b.publication_id != a.publication_id
    submit(store, kind='rollback', snapshot_id=a.manifest.snapshot_id)
    assert execute(store).status == 'succeeded'
    restored = ref.load_active_snapshot(False)
    assert restored.manifest.snapshot_id == a.manifest.snapshot_id
    assert restored.publication_id != a.publication_id


def test_concurrent_or_duplicate_submit_does_not_create_two_jobs(store):
    submit(store)
    with pytest.raises(StoreBusy):
        submit(store)
    with writer_lock(store[1]):
        with pytest.raises(StoreBusy):
            execute(store)
    assert len(lifecycle.list_jobs(store[1])) == 1


def test_failed_build_or_corrupt_candidate_preserves_published_version(store, monkeypatch):
    submit(store)
    original = execute(store)
    pointer = (store[1] / 'current.json').read_bytes()
    monkeypatch.setattr(model_loader, 'extract_embedding', lambda image, **kw: [])
    failed = submit(store)
    assert execute(store).status == 'failed'
    assert lifecycle.read_job(store[1], failed.job_id).code == 'invalid_vector'
    assert '/uploads/cats/one.png' in lifecycle.read_job(store[1], failed.job_id).detail
    assert (store[1] / 'current.json').read_bytes() == pointer
    monkeypatch.setattr(model_loader, 'extract_embedding', lambda image, **kw: store[3][7])
    submit(store, publish=False)
    candidate = execute(store)
    (store[1] / 'versions' / candidate.snapshot_id / 'vectors.json').write_text('[]')
    submit(store, kind='publish', snapshot_id=candidate.snapshot_id)
    assert execute(store).code == 'artifact_mismatch'
    assert ref.load_active_snapshot(False).manifest.snapshot_id == original.snapshot_id


def test_interrupted_writer_is_reconciled_and_new_request_can_retry(store):
    job = submit(store)
    with writer_lock(store[1]):
        lifecycle.save_job(store[1], job, status='running')
    retry = submit(store)
    previous = lifecycle.read_job(store[1], job.job_id)
    assert previous.status == 'interrupted' and previous.recovered
    assert execute(store).job_id == retry.job_id


def test_catalog_change_invalidates_cached_snapshot_and_rejects_old_rollback(store):
    submit(store)
    original = execute(store)
    assert ref.load_active_snapshot(False).catalog.generation == 0
    catalog = store[0].get(models.ReferenceCatalog, 1)
    catalog.generation = 1
    store[0].commit()
    with pytest.raises(ref.ReferenceUnavailable, match='generation'):
        ref.load_active_snapshot(False)
    submit(store, kind='rollback', snapshot_id=original.snapshot_id)
    assert execute(store).code == 'generation_mismatch'
    assert lifecycle.read_pointer(store[1]).snapshot_id == original.snapshot_id


def test_pointer_corruption_does_not_fall_back_to_cached_snapshot(store):
    submit(store)
    execute(store)
    ref.load_active_snapshot(False)
    (store[1] / 'current.json').write_text('{broken')
    with pytest.raises(ref.ReferenceUnavailable, match='pointer'):
        ref.load_active_snapshot(False)


def test_index_cache_is_reused_but_changed_publication_invalidates_inflight_result(store, monkeypatch):
    submit(store)
    execute(store)
    photo = store[3][6]
    assert ai.recognize_cat_image(photo.read_bytes(), crop=False).status == 'confirmed'
    previous = ai._search_cache
    assert ai.recognize_cat_image(photo.read_bytes(), crop=False).status == 'confirmed'
    assert ai._search_cache is previous
    def extract(*args, **kwargs):
        submit(store)
        execute(store)
        return store[3][7]
    monkeypatch.setattr(ai, 'extract_embedding', extract)
    assert ai.recognize_cat_image(photo.read_bytes(), crop=False).status == 'unavailable'


def test_manifest_replacement_between_pointer_check_and_load_is_rejected(store, monkeypatch):
    submit(store)
    done = execute(store)
    original = lifecycle.load_snapshot

    def mutate_then_load(directory, *args, **kwargs):
        path = directory / 'manifest.json'
        data = json.loads(path.read_bytes())
        data['created_at'] = '2026-10-31T01:00:00+00:00'
        path.write_bytes(ref.canonical(data))
        return original(directory, *args, **kwargs)

    monkeypatch.setattr(lifecycle, 'load_snapshot', mutate_then_load)
    with pytest.raises(ref.ReferenceUnavailable) as error:
        ref.load_active_snapshot(False)
    assert error.value.code == 'pointer_manifest_mismatch'
    assert lifecycle.read_pointer(store[1]).snapshot_id == done.snapshot_id


def test_managed_health_uses_current_publication_and_refuses_corruption(store, monkeypatch):
    from app.services import model_health
    monkeypatch.setattr(lifecycle, 'runtime_identity', store[3][4])
    monkeypatch.setattr(model_health, 'EMBEDDINGS_PATH', store[1] / 'missing-legacy.json')
    submit(store)
    done = execute(store)
    health = model_health.get_model_health()
    check = next(c for c in health['checks'] if c['name'] == 'reference_embeddings')
    assert check['status'] == 'pass'
    assert check['metadata']['publication_id'] == done.publication_id
    assert health['reference_cat_count'] == 1
    assert Path(health['embeddings_file']['path']).is_file()
    (store[1] / 'current.json').write_text('{}')
    health = model_health.get_model_health()
    check = next(c for c in health['checks'] if c['name'] == 'reference_embeddings')
    assert check['status'] == 'fail' and check['detail'] == 'pointer_unavailable'
    assert health['reference_cat_count'] == 0


@pytest.fixture
def api(store):
    from app_fixture import isolated_client
    from app.api.auth import create_token
    with isolated_client(store[0].get_bind(), store[2]) as client:
        headers = {}
        with store[2]() as db:
            for role in ('admin', 'reviewer', 'user'):
                user = models.User(username=f'jobs-{role}', nickname=role, password_hash='unused', role=role)
                db.add(user)
                db.flush()
                headers[role] = {'Authorization': f'Bearer {create_token(user)}'}
            db.commit()
        yield client, headers


def test_job_api_authorization_and_enqueue_do_not_run_inference(store, api, monkeypatch):
    client, headers = api
    endpoint = '/api/admin/reference/jobs'

    def unexpected_inference(*args, **kwargs):
        pytest.fail('Enqueue API must never run inference')

    monkeypatch.setattr(model_loader, 'extract_embedding', unexpected_inference)
    for role, expected in [(None, 401), ('user', 403), ('reviewer', 403)]:
        assert client.post(endpoint, headers=headers.get(role, {}), json={}).status_code == expected
    response = client.post(endpoint, headers=headers['admin'], json={})
    assert response.status_code == 202
    job = response.json()
    assert job['status'] == 'queued' and job['snapshot_id'] is None
    assert not (store[1] / 'current.json').exists()
    assert client.post(endpoint, headers=headers['admin'], json={}).status_code == 409
    for path in [endpoint, endpoint + '/' + job['job_id']]:
        for role, expected in [(None, 401), ('user', 403), ('reviewer', 200), ('admin', 200)]:
            assert client.get(path, headers=headers.get(role, {})).status_code == expected
    assert client.get(endpoint + '/' + job['job_id'], headers=headers['reviewer']).json() == job


@pytest.mark.parametrize('payload', [
    {'kind': 'delete'}, {'kind': 'rollback'}, {'kind': 'publish', 'snapshot_id': '../escape'},
    {'kind': 'rebuild', 'snapshot_id': 'a' * 32},
    {'kind': 'rollback', 'snapshot_id': 'a' * 32, 'publish': False},
    {'crop': 'false'}, {'requested_by': 1},
])
def test_job_api_rejects_invalid_contracts(api, payload):
    client, headers = api
    assert client.post('/api/admin/reference/jobs', headers=headers['admin'], json=payload).status_code == 422


def test_job_api_diagnoses_missing_and_corrupt_journals(store, api, monkeypatch):
    client, headers = api
    endpoint = '/api/admin/reference/jobs'
    assert client.get(endpoint + '/invalid', headers=headers['admin']).status_code == 400
    assert client.get(endpoint + '/' + 'a' * 32, headers=headers['admin']).status_code == 404
    assert client.post(endpoint, headers=headers['admin'], json={'kind': 'publish', 'snapshot_id': 'a' * 32}).status_code == 404
    job = submit(store)
    (store[1] / 'jobs' / f'{job.job_id}.json').write_text('{broken')
    response = client.get(endpoint, headers=headers['admin'])
    assert response.status_code == 503 and response.json()['detail']['code'] == 'job_unreadable'
    status = client.get('/api/admin/reference/status', headers=headers['reviewer'])
    assert status.status_code == 200 and status.json()['job_error']['code'] == 'job_unreadable'
    assert client.post(endpoint, headers=headers['admin'], json={}).status_code == 503
    monkeypatch.setattr(ref.settings, 'REFERENCE_STORE', '')
    assert client.post(endpoint, headers=headers['admin'], json={}).status_code == 503


def test_management_status_distinguishes_catalog_publication_and_model_failure(store, api):
    client, headers = api
    path = '/api/admin/reference/status?crop=false'
    def status():
        response = client.get(path, headers=headers['reviewer'])
        assert response.status_code == 200
        return response.json()

    before = status()
    assert before['pending_changes'] is True and before['published'] is None
    assert before['current_catalog']['cat_count'] == before['current_catalog']['photo_count'] == 1
    assert before['jobs'] == [] and before['current_catalog']['cats_without_photos'] == 0
    submit(store)
    done = execute(store)
    published = status()
    assert published['status'] == 'compatible' and published['pending_changes'] is False
    assert published['published']['snapshot_id'] == done.snapshot_id
    assert published['jobs'][0]['status'] == 'succeeded'

    store[0].get(models.Cat, 1).name = 'renamed'
    store[0].commit()
    assert status()['pending_changes'] is False
    store[3][3].unlink()  # Model failure must not hide database/publication/history information.
    missing = status()
    assert missing['status'] == 'unavailable' and missing['code'] == 'model_unavailable'
    assert missing['pending_changes'] is False and missing['published'] == published['published']
    assert missing['jobs'][0]['status'] == 'succeeded'


def test_management_status_detects_photo_bytes_and_reports_missing_source(store, api):
    from PIL import Image
    client, headers = api
    submit(store)
    execute(store)
    photo = store[3][6]
    Image.new('RGB', (16, 16), 'blue').save(photo)
    data = client.get('/api/admin/reference/status?crop=false', headers=headers['admin']).json()
    assert data['pending_changes'] is True and data['status'] == 'unavailable'
    assert data['current_catalog']['generation'] == data['published']['catalog_generation']
    photo.unlink()
    data = client.get('/api/admin/reference/status?crop=false', headers=headers['admin']).json()
    assert data['pending_changes'] is None and data['catalog_error']['code'] == 'invalid_source'
    assert '/uploads/cats/one.png' in data['catalog_error']['message']
    assert data['current_catalog']['photo_count'] == 1  # Registered count, not readable count.


def test_management_status_does_not_claim_corrupt_publication_or_new_cat_is_ready(store, api):
    client, headers = api
    submit(store)
    execute(store)
    store[0].add(models.Cat(name='without-photo'))
    store[0].commit()
    data = client.get('/api/admin/reference/status?crop=false', headers=headers['admin']).json()
    assert data['pending_changes'] is True and data['status'] == 'unavailable'
    assert data['current_catalog']['cats_without_photos'] == 1
    assert data['jobs'][0]['status'] == 'succeeded'
    (store[1] / 'current.json').write_text('{broken')
    data = client.get('/api/admin/reference/status?crop=false', headers=headers['admin']).json()
    assert data['published'] is None and data['pending_changes'] is None
    assert data['publication_error']['code'] == 'pointer_unavailable'


def test_management_status_returns_actual_job_progress_and_disallows_public_access(store, api):
    client, headers = api
    job = submit(store)
    lifecycle.save_job(store[1], job, status='running', completed_photos=1, total_photos=2)
    path = '/api/admin/reference/status?crop=false'
    assert client.get(path).status_code == 401
    assert client.get(path, headers=headers['user']).status_code == 403
    data = client.get(path, headers=headers['reviewer']).json()
    assert data['jobs'][0]['status'] == 'running'
    assert data['jobs'][0]['completed_photos'] == 1 and data['jobs'][0]['total_photos'] == 2
    assert data['latest_job'] == data['jobs'][0]
