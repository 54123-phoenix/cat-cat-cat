"""Exercise API restart and PowerShell SQLite/upload recovery in a disposable project.

Stops every fixture API before backup/restore; never accesses the working database.
No model/reference-store recovery or Docker volume acceptance is implied.
"""
import argparse
from contextlib import closing
from datetime import datetime, timezone
import hashlib
from io import BytesIO
import json
import os
from pathlib import Path
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import traceback

import httpx
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / 'cat-backend'


def state(database):
    with closing(sqlite3.connect(database)) as db:
        assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        assert db.execute('PRAGMA foreign_key_check').fetchall() == []
        return {
            'revision': db.execute('SELECT version_num FROM alembic_version').fetchone()[0],
            'counts': {table: db.execute(f'SELECT count(*) FROM {table}').fetchone()[0]
                       for table in ('users', 'cats', 'cat_images', 'sightings', 'posts', 'audit_logs')},
            'identity': db.execute('SELECT database_id,generation FROM reference_catalog').fetchone(),
        }


def scenario(output, report):
    shell = shutil.which('pwsh') or shutil.which('powershell')
    assert shell, 'PowerShell is required to exercise the project backup/restore wrappers'
    with tempfile.TemporaryDirectory(prefix='cat-sqlite-acceptance-') as tmp:
        project = Path(tmp)
        scripts = project / 'scripts'
        scripts.mkdir()
        for name in ('backup.ps1', 'restore.ps1', 'database_path.ps1', 'sqlite_backup.py'):
            shutil.copyfile(ROOT / 'scripts' / name, scripts / name)
        data = project / 'cat-backend' / 'data'
        data.mkdir(parents=True)
        database = data / 'cat_community.db'
        uploads = project / 'cat-backend' / 'uploads'
        env = {**os.environ, 'DATABASE_URL': f'sqlite:///{database.as_posix()}',
               'JWT_SECRET': 'recovery-only-secret', 'ADMIN_PASSWORD': 'recovery-only-admin',
               'INIT_DEMO_USER': '0', 'UPLOAD_DIR': str(uploads), 'REDIS_URL': '',
               'REFERENCE_STORE': '', 'REFERENCE_DIR': str(project / 'empty-references'),
               'AGENT_ENABLED': '0', 'RATE_LOGIN_PER_MIN': '100', 'PYTHON_DOTENV_DISABLED': '1'}
        def run(label, command, cwd=BACKEND):
            result = subprocess.run(command, cwd=cwd, env=env, capture_output=True, text=True, timeout=60)
            (output / f'{label}.log').write_text(result.stdout + result.stderr, encoding='utf-8')
            assert result.returncode == 0, f'{label}: {result.stderr[-1000:]}'
        def wrapper(label, name, *args):
            run(label, [shell, '-NoProfile', '-File', str(scripts / name), '-Python', sys.executable,
                        '-DatabasePath', 'data/cat_community.db', *args], cwd=project)

        # Upgrade a real historical migration with a preserved record.
        run('legacy-migration', [sys.executable, '-m', 'alembic', 'upgrade', 'e20261030'])
        with closing(sqlite3.connect(database)) as db, db:
            db.execute("INSERT INTO cats (id,name,created_at) VALUES (100,'legacy-cat','2026-10-01 00:00:00')")
        run('current-migration', [sys.executable, '-m', 'alembic', 'upgrade', 'head'])
        process = None
        logs = []
        def stop():
            nonlocal process
            if process is not None and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
            process = None
        def start(client):
            nonlocal process
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                port = sock.getsockname()[1]
            log = (output / f'api-{len(logs)}.log').open('w', encoding='utf-8')
            logs.append(log)
            process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1',
                                        '--port', str(port), '--no-access-log'], cwd=BACKEND, env=env,
                                       stdout=log, stderr=log,
                                       creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            base = f'http://127.0.0.1:{port}'
            deadline = time.monotonic() + 40
            while time.monotonic() < deadline:
                assert process.poll() is None, 'API startup failed; see api logs'
                try:
                    if client.get(base + '/').status_code == 200:
                        return base
                except httpx.HTTPError:
                    pass
                time.sleep(.1)
            raise AssertionError('API did not become ready')
        try:
            with httpx.Client(timeout=5) as client:
                base = start(client)
                def request(method, path, **kwargs):
                    response = client.request(method, base + path, **kwargs)
                    assert response.status_code == 200, f'{path}: {response.status_code}: {response.text[:300]}'
                    return response.json()
                assert request('GET', '/api/cats/100')['name'] == 'legacy-cat'
                admin = request('POST', '/api/admin/login', json={'password': env['ADMIN_PASSWORD']})
                admin_headers = {'Authorization': 'Bearer ' + admin['token']}
                user = request('POST', '/api/auth/register', json={'username': 'recovery-user', 'password': 'recovery-user-pass', 'nickname': 'recovery'})
                headers = {'Authorization': 'Bearer ' + user['token']}
                cat = request('POST', '/api/cats', headers=admin_headers, json={'name': 'recovery-cat'})
                image = BytesIO()
                Image.new('RGB', (32, 24), color=(60, 100, 140)).save(image, format='JPEG')
                attachment = request('POST', f"/api/cats/{cat['id']}/images", headers=admin_headers,
                                     files={'file': ('fixture.jpg', image.getvalue(), 'image/jpeg')})
                sighting = request('POST', '/api/sightings', headers=headers,
                                   data={'cat_id': cat['id'], 'latitude': 31.3, 'longitude': 121.5})
                request('POST', f"/api/admin/sightings/{sighting['id']}/review", headers=admin_headers, json={'action': 'approve'})
                request('POST', '/api/posts', headers=headers, data={'content': 'before backup'})
                original = state(database)
                image_url = attachment['image_path']
                image_file = uploads / image_url.removeprefix('/uploads/')
                digest = hashlib.sha256(image_file.read_bytes()).hexdigest()
                report['source'] = original
                report['attachment_sha256'] = digest
                stop()
                base = start(client)
                assert state(database) == original
                assert hashlib.sha256(client.get(base + image_url).content).hexdigest() == digest
                report['checks']['migration_and_process_restart_persist_records_and_attachment'] = 'passed'

                # No application writer is running throughout each snapshot/restore window.
                stop()
                wrapper('backup', 'backup.ps1')
                saved = next((project / 'backups').glob('*/cat_community.db')).parent
                assert state(saved / 'cat_community.db') == original
                assert hashlib.sha256((saved / 'uploads' / image_url.removeprefix('/uploads/')).read_bytes()).hexdigest() == digest
                base = start(client)
                request('PUT', f"/api/cats/{cat['id']}", headers=admin_headers, json={'name': 'after-backup'})
                request('POST', '/api/posts', headers=headers, data={'content': 'after backup'})
                stop()
                image_file.write_bytes(b'damaged fixture attachment')
                extra = uploads / 'extra.txt'
                extra.write_text('preserved extra file', encoding='utf-8')
                changed = state(database)
                wrapper('restore-preview', 'restore.ps1', '-BackupPath', str(saved))
                assert state(database) == changed
                assert image_file.read_bytes() == b'damaged fixture attachment'
                report['checks']['restore_preview_does_not_mutate_data'] = 'passed'

                wrapper('restore', 'restore.ps1', '-BackupPath', str(saved), '-ConfirmRestore')
                assert state(database) == original
                assert hashlib.sha256(image_file.read_bytes()).hexdigest() == digest
                assert extra.read_text(encoding='utf-8') == 'preserved extra file'
                prior = next((project / 'backups').glob('pre-restore-*/cat_community.db')).parent
                assert state(prior / 'cat_community.db') == changed
                assert (prior / 'uploads' / image_url.removeprefix('/uploads/')).read_bytes() == b'damaged fixture attachment'
                report['checks']['restore_recovers_snapshot_and_keeps_pre_restore_copy'] = 'passed'
                run('restored-migration', [sys.executable, '-m', 'alembic', 'upgrade', 'head'])
                base = start(client)
                assert request('GET', f"/api/cats/{cat['id']}")['name'] == 'recovery-cat'
                assert request('GET', '/api/map/heatmap')['total'] == 1
                assert state(database) == original
                downloaded = client.get(base + image_url)
                assert downloaded.status_code == 200
                assert hashlib.sha256(downloaded.content).hexdigest() == digest
                with Image.open(BytesIO(downloaded.content)) as restored_image:
                    restored_image.verify()
                report['checks']['restored_api_serves_verified_records_and_decodable_attachment'] = 'passed'
                report['restored'] = state(database)
        finally:
            stop()
            for log in logs:
                log.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'artifacts/optimization-c-sqlite')
    args = parser.parse_args()
    output = args.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    report = {'status': 'running', 'checks': {}, 'started_at': datetime.now(timezone.utc).isoformat()}
    try:
        scenario(output, report)
        report['status'] = 'passed'
    except Exception:
        report['status'] = 'failed'
        (output / 'failure.txt').write_text(traceback.format_exc(), encoding='utf-8')
        raise
    finally:
        (output / 'result.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(json.dumps(report))


if __name__ == '__main__':
    main()
