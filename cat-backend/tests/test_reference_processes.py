"""Real HTTP servers + a killable worker; synthetic embeddings, no Redis service."""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time

import httpx
from PIL import Image
from sqlalchemy import create_engine, text

BACKEND = Path(__file__).resolve().parents[1]


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def stop(process):
    if process.poll() is None:
        if os.name == 'nt':
            subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            process.kill()
        process.wait(timeout=15)


def until(check, timeout=25):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = check()
        if value:
            return value
        time.sleep(.1)
    raise AssertionError('Timed out waiting for a test process/state')


def test_two_http_workers_publish_recover_invalidate_and_rollback(tmp_path):
    uploads = tmp_path / 'uploads'
    (uploads / 'cats').mkdir(parents=True)
    image = uploads / 'cats' / 'reference.png'
    Image.new('RGB', (16, 16), 'orange').save(image)
    (tmp_path / 'weights.pt').write_bytes(b'synthetic-model')
    (tmp_path / 'detector.pt').write_bytes(b'synthetic-detector')
    store = tmp_path / 'store'
    database = tmp_path / 'fixture.db'
    env = {**os.environ, 'DATABASE_URL': f'sqlite:///{database.as_posix()}',
           'JWT_SECRET': 'reference-process-test-only', 'ADMIN_PASSWORD': 'reference-test-admin',
           'INIT_DEMO_USER': '0', 'REDIS_URL': '', 'AGENT_ENABLED': '0',
           'UPLOAD_DIR': str(uploads), 'REFERENCE_STORE': str(store), 'REFERENCE_DIR': '',
           'REFERENCE_TEST_ROOT': str(tmp_path), 'RATE_RECOGNIZE_PER_MIN': '1000'}
    migration = subprocess.run([sys.executable, '-m', 'alembic', 'upgrade', 'head'], cwd=BACKEND,
                               env=env, capture_output=True, text=True, timeout=45)
    assert migration.returncode == 0, migration.stderr
    engine = create_engine(env['DATABASE_URL'])
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO cats (id,name) VALUES (1,'first-cat')"))
        connection.execute(text("INSERT INTO cat_images (cat_id,image_path) VALUES (1,'/uploads/cats/reference.png')"))
    processes, logs, steps, pids = [], [], [], set()
    count = 0

    def launch(*args):
        nonlocal count
        count += 1
        log = (tmp_path / f'process-{count}.log').open('w', encoding='utf-8')
        logs.append(log)
        process = subprocess.Popen([sys.executable, str(BACKEND / 'tests/reference_process_app.py'), *args],
                                   cwd=BACKEND, env=env, stdout=log, stderr=log,
                                   creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        processes.append(process)
        return process

    def server():
        port = free_port()
        process = launch('serve', str(port))
        base = f'http://127.0.0.1:{port}'
        def ready():
            assert process.poll() is None, f'Server exited; see {tmp_path}'
            try:
                return httpx.get(base + '/', timeout=1).status_code == 200
            except httpx.HTTPError:
                return False
        until(ready)
        return process, base

    def run_worker(expected=0):
        process = launch('worker')
        assert process.wait(timeout=40) == expected, f'Worker failed; see {tmp_path}'

    try:
        first_process, first = server()
        second_process, second = server()
        auth = httpx.post(first + '/api/admin/login', json={'password': 'reference-test-admin'}).json()['token']
        headers = {'Authorization': f'Bearer {auth}'}

        def request(base, method, route, expected=200, **kwargs):
            response = httpx.request(method, base + route, headers=headers, timeout=20, **kwargs)
            assert response.status_code == expected, response.text
            if 'X-Test-Process' in response.headers:
                pids.add(response.headers['X-Test-Process'])
            return response.json()

        def enqueue(**data):
            return request(first, 'POST', '/api/admin/reference/jobs', expected=202, json=data)

        def job(job_id):
            return request(second, 'GET', '/api/admin/reference/jobs/' + job_id)

        def both(status, cat_id=None):
            snapshots = []
            for base in (first, second):
                value = request(base, 'POST', '/api/recognize', files={'file': ('query.png', image.read_bytes(), 'image/png')})
                assert value['status'] == status, value
                if cat_id is not None:
                    assert value['cat_id'] == cat_id, value
                snapshots.append(request(base, 'GET', '/api/admin/reference/status').get('snapshot_id'))
            assert snapshots[0] == snapshots[1], snapshots
            return snapshots[0]

        queued = enqueue()
        assert queued['status'] == 'queued' and not (store / 'current.json').exists()
        run_worker()
        a = job(queued['job_id'])['snapshot_id']
        assert both('confirmed', 1) == a
        assert len(pids) == 2
        steps.append('two real HTTP processes load the same first publication without Redis')

        (tmp_path / 'fail').touch()
        failed = enqueue()
        run_worker(1)
        assert job(failed['job_id'])['code'] == 'invalid_vector'
        (tmp_path / 'fail').unlink()
        assert both('confirmed', 1) == a
        steps.append('failed extraction preserves a compatible published version')

        blocked = enqueue()
        (tmp_path / 'block').touch()
        running = launch('worker')
        until(lambda: job(blocked['job_id'])['input_revision'])
        request(first, 'POST', '/api/admin/reference/jobs', expected=409, json={})
        run_worker(2)
        stop(running)
        (tmp_path / 'block').unlink()
        retry = enqueue()
        assert job(blocked['job_id'])['status'] == 'interrupted'
        run_worker()
        assert job(retry['job_id'])['status'] == 'succeeded'
        both('confirmed', 1)
        steps.append('OS lock excludes concurrent writers and is released after process kill')

        changed = enqueue()
        (tmp_path / 'block').touch()
        running = launch('worker')
        until(lambda: job(changed['job_id'])['input_revision'])
        with engine.begin() as connection:
            connection.execute(text('DELETE FROM cat_images'))
            connection.execute(text('DELETE FROM cats WHERE id=1'))
            connection.execute(text("INSERT INTO cats (id,name) VALUES (2,'second-cat')"))
            connection.execute(text("INSERT INTO cat_images (cat_id,image_path) VALUES (2,'/uploads/cats/reference.png')"))
        (tmp_path / 'block').unlink()
        assert running.wait(timeout=30) == 1
        assert job(changed['job_id'])['status'] == 'failed'
        both('unavailable')
        steps.append('SQL generation changes during construction prevent stale publication and invalidate both readers')

        new = enqueue()
        run_worker()
        b = job(new['job_id'])['snapshot_id']
        assert both('confirmed', 2) == b
        rollback = enqueue(kind='rollback', snapshot_id=a)
        run_worker(1)
        assert job(rollback['job_id'])['code'] == 'generation_mismatch'
        assert both('confirmed', 2) == b
        steps.append('both cached workers switch to new cat identity; incompatible rollback is refused')

        candidate = enqueue(publish=False)
        run_worker()
        c = job(candidate['job_id'])['snapshot_id']
        bad_vectors = store / 'versions' / c / 'vectors.json'
        original_vectors = bad_vectors.read_bytes()
        bad_vectors.write_text('[]')
        corrupt = enqueue(kind='publish', snapshot_id=c)
        run_worker(1)
        assert job(corrupt['job_id'])['code'] == 'artifact_mismatch'
        assert both('confirmed', 2) == b
        bad_vectors.write_bytes(original_vectors)
        enqueue(kind='publish', snapshot_id=c)
        run_worker()
        assert both('confirmed', 2) == c
        enqueue(kind='rollback', snapshot_id=b)
        run_worker()
        assert both('confirmed', 2) == b
        steps.append('corrupt candidates do not replace current pointer; compatible rollback updates both processes')

        pending = enqueue()
        (tmp_path / 'crash-after-pointer').touch()
        run_worker(77)
        assert job(pending['job_id'])['status'] == 'running'
        (tmp_path / 'crash-after-pointer').unlink()
        run_worker()  # No queued work: reconcile journal using authoritative pointer.
        recovered = job(pending['job_id'])
        assert recovered['status'] == 'succeeded' and recovered['recovered']
        current = both('confirmed', 2)
        assert current == recovered['snapshot_id']
        steps.append('process death after atomic publication is reconciled as completed publication')

        pointer = store / 'current.json'
        original_pointer = pointer.read_bytes()
        pointer.write_text('{broken')
        both('unavailable')
        pointer.write_bytes(original_pointer)
        stop(second_process)
        second_process, second = server()
        assert both('confirmed', 2) == current
        steps.append('corrupt pointer fails closed despite cache; server restart reloads valid publication')
    finally:
        for process in reversed(processes):
            stop(process)
        for log in logs:
            log.close()
        engine.dispose()
        report = {'completed_steps': steps, 'http_process_ids': sorted(pids),
                  'model': 'synthetic test adapters, no accuracy claim', 'redis': 'disabled',
                  'all_scenarios_passed': len(steps) == 8}
        (tmp_path / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        evidence = os.getenv('REFERENCE_TEST_EVIDENCE_DIR')
        if evidence:
            target = Path(evidence).resolve()
            target.mkdir(parents=True, exist_ok=True)
            for path in [tmp_path / 'report.json', *tmp_path.glob('process-*.log')]:
                shutil.copy2(path, target / path.name)
