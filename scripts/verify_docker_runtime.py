"""Accept the Compose stack using unique, disposable volumes and ports.

Builds the repository Dockerfiles and derives commands/networking from Compose.
Default: API stage with empty model volumes. --models-dir enables real CPU
inference and recovery with pinned weights. Neither mode tests model accuracy
on held-out data or accesses real business volumes.
"""
import argparse
from contextlib import closing
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import threading
import time
import traceback
from uuid import uuid4

import httpx
from PIL import Image

from inference_assets import ASSETS, digest, verify_assets

ROOT = Path(__file__).resolve().parents[1]


def database_state(path):
    with closing(sqlite3.connect(f'{path.as_uri()}?mode=ro', uri=True)) as db:
        assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        assert db.execute('PRAGMA foreign_key_check').fetchall() == []
        return {
            'revision': db.execute('SELECT version_num FROM alembic_version').fetchone()[0],
            'identity': list(db.execute('SELECT database_id,generation FROM reference_catalog').fetchone()),
            'counts': {table: db.execute(f'SELECT count(*) FROM {table}').fetchone()[0]
                       for table in ('users', 'cats', 'cat_images', 'posts')},
        }


def scenario(output, report, prepare_only, models_dir=None):
    inference = models_dir is not None
    if inference:
        report['assets'] = verify_assets(models_dir)
    project = 'cat-acceptance-' + uuid4().hex[:12]
    restored_project = project + '-restore'
    report['projects'] = [project, restored_project]
    env = {**os.environ, 'JWT_SECRET': 'docker-acceptance-only-secret',
           'ADMIN_PASSWORD': 'docker-acceptance-only-admin', 'INIT_DEMO_USER': '0',
           'AGENT_ENABLED': '0', 'AGENT_API_KEY': '', 'DEMO_PASSWORD': '',
           'WECHAT_APPID': '', 'WECHAT_SECRET': '', 'REFERENCE_STORE': '/app/reference-store',
           'REFERENCE_DIR': '', 'COMPOSE_PROFILES': '', 'COMPOSE_FILE': ''}
    env_file = output / 'fixture.env'
    env_file.write_text('', encoding='utf-8')
    compose_file = output / 'compose.json'
    sequence = 0

    def run(*command, timeout=120, check=True):
        nonlocal sequence
        sequence += 1
        result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True,
                                encoding='utf-8', errors='replace', timeout=timeout)
        (output / f'command-{sequence:03d}.log').write_text(
            result.stdout + result.stderr, encoding='utf-8')
        if check:
            assert result.returncode == 0, f'{command[:4]} failed; command-{sequence:03d}.log: {result.stderr[-1500:]}'
        return result.stdout.strip()

    def compose(name, *args, **kwargs):
        assert name in (project, restored_project)
        return run('docker', 'compose', '--env-file', str(env_file), '-p', name,
                   '-f', str(compose_file), *args, **kwargs)

    config = json.loads(run('docker', 'compose', '--env-file', str(env_file),
                            '-f', str(ROOT / 'docker-compose.yml'), 'config', '--format', 'json'))
    config.pop('name', None)
    config['services'].pop('postgres', None)
    config['volumes'] = {name: {} for name in ('data', 'uploads', 'models', 'embeddings', 'reference-store')}
    config['networks'] = {'default': {}}
    mounts = [{'type': 'volume', 'source': name, 'target': '/app/' + name} for name in config['volumes']]
    for service in config['services'].values():
        service['restart'] = 'no'
        service.pop('ports', None)
    backend = config['services']['backend']
    backend['build']['target'] = 'inference' if inference else 'api'
    backend['build']['args'] = {'PIP_INDEX': 'https://pypi.org/simple'}
    backend['image'] = project + '-api:local'
    backend['ports'] = ['127.0.0.1::8000']
    for name in ('backend', 'reference-worker'):
        service = config['services'][name]
        service['volumes'] = mounts
        service['environment'] = {
            'DATABASE_URL': 'sqlite:////app/data/cat_community.db',
            'UPLOAD_DIR': '/app/uploads', 'REFERENCE_STORE': '/app/reference-store', 'REFERENCE_DIR': '',
            'JWT_SECRET': env['JWT_SECRET'], 'ADMIN_PASSWORD': env['ADMIN_PASSWORD'],
            'INIT_DEMO_USER': '0', 'AGENT_ENABLED': '0', 'AGENT_API_KEY': '',
            'WECHAT_APPID': '', 'WECHAT_SECRET': '', 'WECHAT_DEV_MODE': '0',
            'RATE_LOGIN_PER_MIN': '100', 'RATE_POST_PER_MIN': '100', 'RATE_REGISTER_PER_MIN': '100',
            'RATE_RECOGNIZE_PER_MIN': '100', 'OMP_NUM_THREADS': '2', 'MKL_NUM_THREADS': '2',
            'OPENBLAS_NUM_THREADS': '2',
            'REDIS_URL': 'redis://redis:6379/0',
        }
    worker = config['services']['reference-worker']
    worker.pop('build')
    worker['image'] = backend['image']
    config['services']['frontend']['image'] = project + '-web:local'
    config['services']['frontend']['ports'] = ['127.0.0.1::80']
    compose_file.write_text(json.dumps(config, indent=2), encoding='utf-8')
    compose(project, 'config', '--quiet')
    if prepare_only:
        report['status'] = 'prepared'
        return

    def base_url(name):
        address = compose(name, 'port', 'frontend', '80').splitlines()[0]
        return 'http://' + address

    def ready(name):
        base = base_url(name)
        deadline = time.monotonic() + 120
        while time.monotonic() < deadline:
            try:
                if httpx.get(base + '/api/cats', timeout=3).status_code == 200:
                    return base
            except httpx.HTTPError:
                pass
            time.sleep(.5)
        raise AssertionError(f'{name}: API did not become ready through nginx')

    def snapshot(name, folder):
        folder.mkdir()
        for volume in snapshot_volumes:
            target = folder / volume
            target.mkdir()
            compose(name, 'cp', f'backend:/app/{volume}/.', str(target))
        state = database_state(folder / 'data/cat_community.db')
        if inference:
            state['assets'] = {path.relative_to(folder).as_posix(): digest(path)
                               for volume in ('models', 'uploads', 'reference-store')
                               for path in sorted((folder / volume).rglob('*'))
                               if path.is_file() and path.name != '.writer.lock'}
        return state

    snapshot_volumes = ('data', 'uploads', 'reference-store', 'models') if inference else ('data', 'uploads', 'reference-store')

    try:
        report['engine'] = json.loads(run('docker', 'version', '--format', '{{json .Server}}'))
        assert report['engine']['Os'] == 'linux'
        compose(project, 'build', '--pull', 'backend', 'frontend', timeout=1200)
        report['checks']['inference_and_frontend_images_build' if inference else 'api_and_frontend_images_build'] = 'passed'
        if inference:
            compose(project, 'create', timeout=120)
            for name in ASSETS:
                compose(project, 'cp', str(models_dir / name), f'backend:/app/models/{name}')
            compose(project, 'run', '--rm', '--no-deps', 'backend', 'python', '-m', 'pip', 'check')
            probe = compose(project, 'run', '--rm', '--no-deps', 'backend', 'python', '-c', '''
import json, cv2, torch, torchvision, timm, ultralytics, faiss, httpx, numpy, tempfile, uvicorn, gunicorn
from pathlib import Path
from app.services import model_loader
model = model_loader.load_model()
assert model is not None, 'Checkpoint did not strictly load'
original = model_loader.MODEL_PATH
state = model.state_dict()
with tempfile.TemporaryDirectory(prefix='checkpoint-probe-') as directory:
    candidate = Path(directory) / 'weights.pt'
    model_loader.MODEL_PATH = candidate
    assert model_loader.load_model() is None, 'Missing checkpoint was accepted'
    candidate.write_bytes(b'invalid-checkpoint')
    assert model_loader.load_model() is None, 'Corrupt checkpoint was accepted'
    key = 'emb_head.proj.weight'
    torch.save({k: v for k, v in state.items() if k != key}, candidate)
    assert model_loader.load_model() is None, 'Incomplete checkpoint was accepted'
    torch.save({**state, key: state[key][:-1]}, candidate)
    assert model_loader.load_model() is None, 'Wrong projection dimensions were accepted'
model_loader.MODEL_PATH = original
print(json.dumps({'torch': torch.__version__, 'torchvision': torchvision.__version__,
    'timm': timm.__version__, 'ultralytics': ultralytics.__version__, 'opencv': cv2.__version__,
    'faiss': faiss.__version__, 'httpx': httpx.__version__, 'numpy': numpy.__version__,
    'uvicorn': uvicorn.__version__, 'gunicorn': gunicorn.__version__,
    'cuda_runtime': torch.version.cuda, 'model_loaded': True,
    'missing_corrupt_incomplete_and_wrong_dimensions_rejected': True}))
''', timeout=120)
            report['runtime'] = json.loads(probe.splitlines()[-1])
            assert report['runtime']['cuda_runtime'] is None
            report['checks']['runtime_dependencies_and_real_checkpoint_load'] = 'passed'
        compose(project, 'up', '-d', timeout=180)
        base = ready(project)
        processes = compose(project, 'exec', '-T', 'backend', 'python', '-c', '''
import json
from pathlib import Path
workers=[]
for entry in Path('/proc').iterdir():
    if not entry.name.isdigit(): continue
    try:
        status=(entry/'status').read_text()
        command=(entry/'cmdline').read_bytes().replace(b'\\0',b' ').decode()
        if 'PPid:\\t1\\n' in status and 'gunicorn' in command: workers.append(int(entry.name))
    except (FileNotFoundError, ProcessLookupError): pass
assert len(workers)==4, workers
print(json.dumps(workers))
''')
        report['gunicorn_worker_pids'] = json.loads(processes)
        assert compose(project, 'exec', '-T', 'redis', 'redis-cli', 'ping') == 'PONG'
        report['checks']['empty_database_migration_four_workers_and_redis'] = 'passed'
        with httpx.Client(timeout=90 if inference else 15) as client:
            def request(method, path, expected=200, **kwargs):
                response = client.request(method, base + path, **kwargs)
                assert response.status_code == expected, f'{path}: {response.status_code}: {response.text[:300]}'
                return response.json()

            response = client.get(base + '/')
            assert response.status_code == 200 and '<html' in response.text
            admin = request('POST', '/api/admin/login', json={'password': env['ADMIN_PASSWORD']})
            headers = {'Authorization': 'Bearer ' + admin['token']}
            cat = request('POST', '/api/cats', headers=headers, json={'name': 'docker-acceptance-cat'})
            photo = BytesIO((ROOT / 'showcase/img/cat1.jpg').read_bytes()) if inference else BytesIO()
            if not inference:
                Image.new('RGB', (32, 24), 'orange').save(photo, format='JPEG')
            uploaded = request('POST', f"/api/cats/{cat['id']}/images", headers=headers,
                               files={'file': ('fixture.jpg', photo.getvalue(), 'image/jpeg')})
            image_url = uploaded['image_path']
            image_bytes = client.get(base + image_url).content
            image_hash = hashlib.sha256(image_bytes).hexdigest()
            with Image.open(BytesIO(image_bytes)) as decoded:
                decoded.verify()
            report['attachment_sha256'] = image_hash
            report['checks']['nginx_auth_archive_upload_and_image_serving'] = 'passed'
            reference_photos = [(cat['id'], image_bytes)]
            if inference:
                second = request('POST', '/api/cats', headers=headers, json={'name': 'inference-second-cat'})
                second_photo = (ROOT / 'showcase/img/cat2.jpg').read_bytes()
                uploaded_second = request('POST', f"/api/cats/{second['id']}/images", headers=headers,
                                          files={'file': ('second.jpg', second_photo, 'image/jpeg')})
                reference_photos.append((second['id'], client.get(base + uploaded_second['image_path']).content))

            # Headers arrive only after Redis subscription succeeds. A real HTTP
            # write must reach the subscribed client through nginx's SSE location.
            subscribed = threading.Event()
            events, errors = [], []
            def listen():
                try:
                    with httpx.stream('GET', base + '/api/events/stream', headers=headers, timeout=25) as stream:
                        assert stream.status_code == 200
                        subscribed.set()
                        for line in stream.iter_lines():
                            if line.startswith('data:') and 'post_new' in line:
                                events.append(json.loads(line[5:]))
                                return
                except Exception as exc:
                    errors.append(str(exc))
                    subscribed.set()
            listener = threading.Thread(target=listen, daemon=True)
            listener.start()
            assert subscribed.wait(15) and not errors, errors
            post = request('POST', '/api/posts', headers=headers, data={'content': 'docker event acceptance'})
            listener.join(30)
            assert not listener.is_alive() and not errors and events, (errors, events)
            assert events[0]['data']['post_id'] == post['id'], events
            report['checks']['http_write_redis_event_through_nginx_sse'] = 'passed'

            job = request('POST', '/api/admin/reference/jobs', expected=202, headers=headers, json={})
            deadline = time.monotonic() + (180 if inference else 30)
            while True:
                status = request('GET', '/api/admin/reference/status', headers=headers)
                latest = status['latest_job']
                if latest['status'] in ('succeeded', 'failed', 'interrupted'):
                    break
                assert time.monotonic() < deadline, status
                time.sleep(.5)
            assert latest['job_id'] == job['job_id'], latest
            report['reference_job'] = latest

            def recognize_references():
                predictions = []
                for expected_id, raw in reference_photos:
                    started = time.monotonic()
                    result = request('POST', '/api/recognize', headers=headers,
                                     files={'file': ('same-reference.jpg', raw, 'image/jpeg')})
                    assert result['status'] == 'confirmed' and result['cat_id'] == expected_id, result
                    assert result['confidence'] > .999, result
                    predictions.append({'cat_id': expected_id, 'confidence': result['confidence'],
                                        'seconds': round(time.monotonic() - started, 3)})
                return predictions

            if inference:
                assert latest['status'] == 'succeeded' and latest['code'] == 'published', status
                assert status['status'] == 'compatible' and status['dimension'] == 256 and status['photo_count'] == 2, status
                health = request('GET', '/api/system/health?warm_model=true')
                assert health['status'] == 'healthy' and health['model']['warm_model_loaded'], health
                report['reference_status'] = status
                report['recognition_before'] = recognize_references()
                report['checks']['real_yolo_dinov3_faiss_reference_build_and_http_self_match'] = 'passed'
            else:
                assert latest['code'] == 'model_unavailable', latest
                assert status['published'] is None
                report['checks']['real_worker_records_missing_model_failure_without_publication'] = 'passed'

            compose(project, 'restart', 'backend', 'reference-worker', timeout=90)
            compose(project, 'restart', 'frontend')
            base = ready(project)
            assert request('GET', f"/api/cats/{cat['id']}")['name'] == 'docker-acceptance-cat'
            assert hashlib.sha256(client.get(base + image_url).content).hexdigest() == image_hash
            assert request('GET', '/api/admin/reference/status', headers=headers)['latest_job'] == latest
            if inference:
                report['recognition_after_restart'] = recognize_references()
            report['checks']['restart_preserves_database_attachment_and_job_journal'] = 'passed'

            compose(project, 'stop', 'backend', 'reference-worker', timeout=90)
            saved = output / 'backup'
            report['source'] = snapshot(project, saved)
            assert report['source']['counts']['users'] == 1, report['source']
            compose(restored_project, 'create', timeout=120)
            for volume in snapshot_volumes:
                compose(restored_project, 'cp', str(saved / volume) + '/.', f'backend:/app/{volume}/')
            compose(restored_project, 'up', '-d', timeout=120)
            base = ready(restored_project)
            assert request('GET', f"/api/cats/{cat['id']}")['name'] == 'docker-acceptance-cat'
            assert hashlib.sha256(client.get(base + image_url).content).hexdigest() == image_hash
            assert request('GET', '/api/admin/reference/status', headers=headers)['latest_job'] == latest
            if inference:
                restored_status = request('GET', '/api/admin/reference/status', headers=headers)
                assert restored_status['status'] == 'compatible'
                assert restored_status['publication_id'] == status['publication_id']
                report['recognition_after_restore'] = recognize_references()
            compose(restored_project, 'stop', 'backend', 'reference-worker', timeout=90)
            report['restored'] = snapshot(restored_project, output / 'restored')
            assert report['source'] == report['restored']
            report['checks']['stopped_snapshot_restores_into_fresh_volumes_with_same_identity'] = 'passed'
            if inference:
                # Only the newly restored acceptance volumes are faulted. Start
                # and warm them first to verify rejection also invalidates caches.
                compose(restored_project, 'up', '-d', timeout=120)
                base = ready(restored_project)
                recognize_references()
                version = status['published']['snapshot_id']
                faults = {
                    'wrong_checkpoint': '/app/models/finetuned_best.pt',
                    'corrupt_vectors': f'/app/reference-store/versions/{version}/vectors.json',
                    'corrupt_reference_photo': '/app' + image_url,
                }
                for label, path in faults.items():
                    compose(restored_project, 'exec', '-T', 'backend', 'python', '-c',
                            'from pathlib import Path; import sys; p=Path(sys.argv[1]); p.rename(str(p)+".saved"); p.write_bytes(b"invalid-acceptance-fixture")', path)
                    try:
                        result = request('POST', '/api/recognize', headers=headers,
                                         files={'file': ('query.jpg', image_bytes, 'image/jpeg')})
                        assert result['status'] == 'unavailable' and result['cat_id'] is None, result
                        report['checks'][label + '_fails_closed'] = 'passed'
                    finally:
                        compose(restored_project, 'exec', '-T', 'backend', 'python', '-c',
                                'from pathlib import Path; import sys; p=Path(sys.argv[1]); Path(str(p)+".saved").replace(p)', path)
                    recognize_references()
                report['checks']['valid_assets_restore_recognition_after_each_fault'] = 'passed'
        report['status'] = 'passed'
    finally:
        for name in (restored_project, project):
            compose(name, 'logs', '--no-color', check=False)
            # Both names and every volume are generated exclusively by this run.
            compose(name, 'down', '--volumes', '--remove-orphans', timeout=120)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'artifacts/docker-runtime')
    parser.add_argument('--prepare-only', action='store_true', help='Validate isolated Compose configuration without an engine')
    parser.add_argument('--models-dir', type=Path, help='Enable inference acceptance using pinned local model files')
    args = parser.parse_args()
    output = args.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    report = {'status': 'running', 'checks': {}, 'started_at': datetime.now(timezone.utc).isoformat(),
              'scope': ('CPU inference; two reference photos; self-match and complete isolated volume recovery, not held-out accuracy'
                        if args.models_dir else 'API stage; empty model volumes; production worker handles model_unavailable')}
    try:
        scenario(output, report, args.prepare_only, args.models_dir.resolve() if args.models_dir else None)
    except Exception:
        report['status'] = 'failed'
        (output / 'failure.txt').write_text(traceback.format_exc(), encoding='utf-8')
        raise
    finally:
        (output / 'result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
