"""Real Redis + independent API processes, isolated SQLite, bounded fault injection.

Pass a local redis-server executable (optionally inside WSL). No existing Redis
instance is flushed or stopped. Each invocation owns all its ports and data.
"""
import argparse
import asyncio
from contextlib import AsyncExitStack
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shlex
import socket
import subprocess
import sys
import tempfile
import time
import traceback

import httpx
import redis.asyncio as redis
from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / 'cat-backend'


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


class FaultProxy:
    """Interrupt only the acceptance clients; Redis data survives the outage."""
    def __init__(self, target):
        self.target = target
        self.port = free_port()
        self.server = None
        self.writers = set()

    async def start(self):
        self.server = await asyncio.start_server(self.handle, '127.0.0.1', self.port)

    async def handle(self, reader, writer):
        remote = None
        self.writers.add(writer)
        try:
            upstream, remote = await asyncio.open_connection('127.0.0.1', self.target)
            self.writers.add(remote)
            async def pipe(source, target):
                try:
                    while data := await source.read(65536):
                        target.write(data)
                        await target.drain()
                finally:
                    target.close()
            await asyncio.gather(pipe(reader, remote), pipe(upstream, writer))
        except (OSError, asyncio.CancelledError):
            pass
        finally:
            for stream in (writer, remote):
                if stream:
                    stream.close()
                    self.writers.discard(stream)

    async def stop(self):
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            self.server = None
        for writer in list(self.writers):
            writer.close()
        await asyncio.sleep(.05)


async def wait_until(check, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if await check():
            return
        await asyncio.sleep(.1)
    raise AssertionError('Timed out waiting for acceptance state')


async def scenario(args, output, report):
    processes, logs = [], []
    proxy = None
    control = None
    engine = None
    redis_run_id = None
    with tempfile.TemporaryDirectory(prefix='cat-redis-acceptance-') as tmp:
        fixture = Path(tmp)
        def launch(command, env=None, cwd=BACKEND):
            log = (output / f'process-{len(processes)}.log').open('w', encoding='utf-8')
            logs.append(log)
            process = subprocess.Popen(command, cwd=cwd, env=env, stdout=log, stderr=log,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            processes.append(process)
            return process

        redis_port = free_port()
        command = [args.redis_server, '--bind', '127.0.0.1', '--port', str(redis_port),
                            '--save', '', '--appendonly', 'no', '--protected-mode', 'yes']
        if args.wsl:
            # Preserve empty arguments through Windows -> WSL shell forwarding.
            command = ['wsl', '-d', args.wsl, '--exec', 'sh', '-c', shlex.join(command)]
        redis_process = launch(command, cwd=fixture)
        try:
            control = redis.Redis(host='127.0.0.1', port=redis_port, socket_connect_timeout=1, socket_timeout=1)
            async def redis_ready():
                assert redis_process.poll() is None, 'Acceptance Redis exited'
                try:
                    return await control.ping()
                except (redis.ConnectionError, redis.TimeoutError):
                    return False
            await wait_until(redis_ready)
            info = await control.info('server')
            redis_run_id = info['run_id']
            report['redis_version'] = info['redis_version']
            proxy = FaultProxy(redis_port)
            await proxy.start()
            env = {**os.environ, 'DATABASE_URL': f'sqlite:///{(fixture / "fixture.db").as_posix()}',
                   'JWT_SECRET': 'redis-acceptance-only-secret', 'ADMIN_PASSWORD': 'runtime-admin-test',
                   'INIT_DEMO_USER': '0', 'REDIS_URL': f'redis://127.0.0.1:{proxy.port}/0',
                   'AGENT_ENABLED': '0', 'UPLOAD_DIR': str(fixture / 'uploads'), 'REFERENCE_STORE': '',
                   'REFERENCE_DIR': str(fixture / 'references'), 'PYTHON_DOTENV_DISABLED': '1',
                   'RATE_LOGIN_PER_MIN': '100', 'RATE_POST_PER_MIN': '100'}
            migration = await asyncio.to_thread(subprocess.run, [sys.executable, '-m', 'alembic', 'upgrade', 'head'],
                cwd=BACKEND, env=env, capture_output=True, text=True, timeout=60)
            assert migration.returncode == 0, migration.stderr
            engine = create_engine(env['DATABASE_URL'])

            # Launch together: catches duplicate bootstrap inserts across independent workers.
            endpoints = []
            for _ in range(4):
                port = free_port()
                process = launch([sys.executable, 'tests/runtime_process_app.py', str(port)], env)
                endpoints.append((process, f'http://127.0.0.1:{port}'))
            async with httpx.AsyncClient(timeout=5) as client:
                async def ready():
                    for process, base in endpoints:
                        assert process.poll() is None, 'An API worker failed to start; see process logs'
                        try:
                            if (await client.get(base + '/')).status_code != 200:
                                return False
                        except httpx.HTTPError:
                            return False
                    return True
                await wait_until(ready, timeout=45)
                first, second = endpoints[0][1], endpoints[1][1]
                report['api_pids'] = sorted({(await client.get(base + '/')).headers['X-Test-Process'] for _, base in endpoints})
                assert len(report['api_pids']) == 4
                with engine.connect() as db:
                    report['bootstrap_counts'] = {
                        'admin': db.execute(text("SELECT count(*) FROM users WHERE username='admin'")).scalar_one(),
                        'fudan': db.execute(text("SELECT count(*) FROM campuses WHERE slug='fudan'")).scalar_one(),
                    }
                    report['username_indexes'] = [dict(row._mapping) for row in db.execute(text("PRAGMA index_list(users)"))]
                    assert report['bootstrap_counts'] == {'admin': 1, 'fudan': 1}, report['bootstrap_counts']
                report['checks']['four_process_bootstrap'] = 'passed'

                async def request(base, method, path, expected=200, **kwargs):
                    response = await client.request(method, base + path, **kwargs)
                    assert response.status_code == expected, f'{path}: {response.status_code}: {response.text[:300]}'
                    return response.json()
                admin = await request(first, 'POST', '/api/admin/login', json={'password': 'runtime-admin-test'})
                admin_headers = {'Authorization': 'Bearer ' + admin['token']}
                user = await request(first, 'POST', '/api/auth/register', json={'username': 'runtime-user', 'password': 'runtime-user-pass', 'nickname': 'runtime-user'})
                headers = {'Authorization': 'Bearer ' + user['token']}
                user_id = user['user']['id']
                await request(first, 'PUT', '/__acceptance/cache/shared', params={'value': 'value'})
                assert (await request(second, 'GET', '/__acceptance/cache/shared'))['value'] == 'value'
                await request(second, 'DELETE', '/__acceptance/cache/shared')
                assert (await request(first, 'GET', '/__acceptance/cache/shared'))['value'] is None
                report['checks']['redis_cache_shared_and_invalidated'] = 'passed'

                async def subscribers(expected):
                    async def check():
                        counts = await control.pubsub_numsub('cat_community:events')
                        return counts[0][1] == expected
                    await wait_until(check, timeout=20)

                async def event(lines, event_type):
                    async for line in lines:
                        if line.startswith('data: '):
                            value = json.loads(line[6:])
                            if value['type'] == event_type:
                                return value
                    raise AssertionError('SSE stream ended before expected event')

                async with AsyncExitStack() as stack:
                    streams = []
                    for base in (first, second):
                        stream = await stack.enter_async_context(client.stream('GET', base + '/api/events/stream', headers=headers, timeout=25))
                        assert stream.status_code == 200
                        streams.append(stream.aiter_lines())
                    await subscribers(2)
                    post = await request(first, 'POST', '/api/posts', headers=headers, data={'content': 'cross-process evidence', 'topic': 'daily'})
                    messages = await asyncio.wait_for(asyncio.gather(*(event(lines, 'post_new') for lines in streams)), 15)
                    assert all(message['data']['post_id'] == post['id'] for message in messages)
                    report['checks']['async_route_broadcast_to_two_processes'] = 'passed'
                    await request(first, 'POST', f"/api/posts/{post['id']}/like", headers=headers)
                    messages = await asyncio.wait_for(asyncio.gather(*(event(lines, 'like_new') for lines in streams)), 15)
                    assert all(message['data']['post_id'] == post['id'] for message in messages)
                    report['checks']['sync_route_broadcast_to_two_processes'] = 'passed'
                await subscribers(0)
                report['checks']['disconnect_releases_subscriptions'] = 'passed'

                cat = await request(first, 'POST', '/api/cats', headers=admin_headers, json={'name': 'acceptance-cat'})
                sighting = await request(first, 'POST', '/api/sightings', headers=headers,
                    data={'cat_id': cat['id'], 'location_name': 'test', 'latitude': 31.3, 'longitude': 121.5})
                review_path = f"/api/admin/sightings/{sighting['id']}/review"
                await request(first, 'POST', review_path, headers=admin_headers, json={'action': 'approve'})
                assert (await request(second, 'GET', '/api/map/heatmap'))['total'] == 1
                # Redis retains cached approval while clients lose access during rejection.
                await proxy.stop()
                await request(first, 'POST', review_path, headers=admin_headers, json={'action': 'reject'})
                assert (await request(second, 'GET', '/api/map/heatmap'))['total'] == 0
                await proxy.start()
                assert (await request(second, 'GET', '/api/map/heatmap'))['total'] == 0
                report['checks']['rejected_location_never_returns_after_redis_outage'] = 'passed'

                async with client.stream('GET', second + '/api/events/stream', headers=headers, timeout=25) as stream:
                    assert stream.status_code == 200
                    await subscribers(1)
                    await request(first, 'POST', f'/api/admin/users/{user_id}/revoke', headers=admin_headers)
                    async def drained():
                        async for line in stream.aiter_lines():
                            assert not line.startswith('data: '), 'Revoked session received a new event'
                    await asyncio.wait_for(drained(), 20)
                await subscribers(0)
                await request(second, 'GET', '/api/events/stream', expected=401, headers=headers)
                report['checks']['revocation_closes_existing_stream_and_denies_reconnect'] = 'passed'

                login = await request(first, 'POST', '/api/auth/login', json={'username': 'runtime-user', 'password': 'runtime-user-pass'})
                headers = {'Authorization': 'Bearer ' + login['token']}
                async with client.stream('GET', second + '/api/events/stream', headers=headers, timeout=25) as stream:
                    await subscribers(1)
                    await proxy.stop()
                    async def ended():
                        async for _ in stream.aiter_lines():
                            pass
                    await asyncio.wait_for(ended(), 20)
                await subscribers(0)
                await request(second, 'GET', '/api/events/stream', expected=503, headers=headers)
                report['checks']['offline_sse_returns_503'] = 'passed'
                offline_post = await request(first, 'POST', '/api/posts', headers=headers,
                                             data={'content': 'saved while pubsub was offline', 'topic': 'daily'})
                # Pub/Sub offers no replay: let this failed publish finish before recovery.
                await asyncio.sleep(3)
                await proxy.start()
                saved_posts = await request(second, 'GET', '/api/posts', headers=headers)
                assert offline_post['id'] in {post['id'] for post in saved_posts['items']}
                report['checks']['missed_event_state_recovered_by_authoritative_query'] = 'passed'
                async with client.stream('GET', second + '/api/events/stream', headers=headers, timeout=25) as stream:
                    await subscribers(1)
                    post = await request(first, 'POST', '/api/posts', headers=headers, data={'content': 'after redis recovery', 'topic': 'daily'})
                    received = await asyncio.wait_for(event(stream.aiter_lines(), 'post_new'), 15)
                    assert received['data']['post_id'] == post['id']
                await subscribers(0)
                report['checks']['sse_disconnect_and_reconnect_after_network_outage'] = 'passed'
        finally:
            if proxy:
                await proxy.stop()
            for process in reversed(processes[1:]):
                if process.poll() is None:
                    process.terminate()
                    try:
                        await asyncio.to_thread(process.wait, timeout=10)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        await asyncio.to_thread(process.wait, timeout=5)
            if control:
                try:
                    if redis_run_id and redis_process.poll() is None:
                        current = await control.info('server')
                        if current['run_id'] == redis_run_id:
                            await control.shutdown(nosave=True)
                except (redis.ConnectionError, redis.TimeoutError):
                    pass
                await control.aclose()
            if redis_process.poll() is None:
                try:
                    await asyncio.to_thread(redis_process.wait, timeout=10)
                except subprocess.TimeoutExpired:
                    redis_process.terminate()
                    await asyncio.to_thread(redis_process.wait, timeout=5)
            if engine:
                engine.dispose()
            for log in logs:
                log.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--redis-server', required=True)
    parser.add_argument('--wsl', help='WSL distribution containing redis-server; optional')
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'artifacts/optimization-c-redis')
    args = parser.parse_args()
    output = args.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    report = {'status': 'running', 'checks': {}, 'started_at': datetime.now(timezone.utc).isoformat(),
              'environment': 'WSL Redis + Windows API' if args.wsl else 'native Redis + API'}
    try:
        asyncio.run(scenario(args, output, report))
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
