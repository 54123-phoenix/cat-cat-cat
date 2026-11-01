"""Real Chromium/API/Redis outage acceptance; only Redis transport is interrupted."""
import argparse
import asyncio
from datetime import datetime, timezone
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import traceback
from uuid import uuid4

import redis.asyncio as redis
from playwright.async_api import async_playwright, expect

from verify_browser import stop_process
from verify_redis_runtime import FaultProxy, free_port, wait_until

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / 'cat-backend'


async def scenario(output, report):
    processes = []
    proxy = control = None
    container = 'cat-reconnect-' + uuid4().hex[:12]

    async def command(*args, **kwargs):
        result = await asyncio.to_thread(subprocess.run, list(args), capture_output=True, text=True,
                                         encoding='utf-8', errors='replace', timeout=120, **kwargs)
        assert result.returncode == 0, result.stderr[-1500:]
        return result.stdout.strip()

    try:
        await command('docker', 'run', '-d', '--rm', '--name', container,
                      '-p', '127.0.0.1::6379', 'redis:7-alpine', '--save', '', '--appendonly', 'no')
        redis_port = int((await command('docker', 'port', container, '6379')).rsplit(':', 1)[1])
        control = redis.Redis(host='127.0.0.1', port=redis_port, socket_connect_timeout=1, socket_timeout=1)
        async def redis_ready():
            try:
                return await control.ping()
            except (redis.ConnectionError, redis.TimeoutError):
                return False
        await wait_until(redis_ready)
        info = await control.info('server')
        report['redis_version'] = info['redis_version']
        redis_id = info['run_id']
        proxy = FaultProxy(redis_port)
        await proxy.start()
        with tempfile.TemporaryDirectory(prefix='cat-reconnect-') as tmp, (output / 'servers.log').open('w', encoding='utf-8') as log:
            fixture = Path(tmp)
            api_port, web_port = free_port(), free_port()
            while web_port == api_port:
                web_port = free_port()
            base = f'http://127.0.0.1:{web_port}'
            env = {**os.environ, 'DATABASE_URL': f'sqlite:///{(fixture / "fixture.db").as_posix()}',
                   'JWT_SECRET': 'reconnect-only-secret', 'ADMIN_PASSWORD': 'reconnect-only-admin',
                   'INIT_DEMO_USER': '0', 'REDIS_URL': f'redis://127.0.0.1:{proxy.port}/0',
                   'UPLOAD_DIR': str(fixture / 'uploads'), 'REFERENCE_DIR': '', 'REFERENCE_STORE': '',
                   'AGENT_ENABLED': '0', 'AGENT_API_KEY': '', 'PYTHON_DOTENV_DISABLED': '1',
                   'RATE_LOGIN_PER_MIN': '100', 'RATE_POST_PER_MIN': '100',
                   'VITE_API_TARGET': f'http://127.0.0.1:{api_port}', 'VITE_AMAP_KEY': ''}
            await command(sys.executable, '-m', 'alembic', 'upgrade', 'head', cwd=BACKEND, env=env)
            def launch(args, cwd):
                process = subprocess.Popen(args, cwd=cwd, env=env, stdout=log, stderr=log,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
                processes.append(process)
                return process
            launch([sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1',
                    '--port', str(api_port), '--no-access-log'], BACKEND)
            launch([shutil.which('node'), 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1',
                    '--port', str(web_port), '--strictPort'], ROOT / 'cat-frontend')
            try:
                async with async_playwright() as p:
                    browser = await p.chromium.launch(headless=True)
                    context = await browser.new_context(viewport={'width': 1280, 'height': 900})
                    report['browser'] = browser.version
                    await context.tracing.start(screenshots=True, snapshots=True, sources=True)
                    await context.add_init_script('''
window.__streams = {created: 0, opened: 0, errors: 0, closed: 0};
window.__postReads = {pending: 0, completedAfterOpen: 0};
const nativeFetch = window.fetch.bind(window);
window.fetch = (...args) => {
  const [input, init] = args;
  const url = new URL(typeof input === 'string' ? input : input.url, window.location.href);
  const method = (init?.method || input?.method || 'GET').toUpperCase();
  const tracked = url.pathname === '/api/posts' && method === 'GET';
  const openedAtStart = window.__streams.opened;
  if (tracked) window.__postReads.pending++;
  const result = nativeFetch(...args);
  if (tracked) result.then(response => response.clone().arrayBuffer()).then(() => {
    if (openedAtStart > 0) window.__postReads.completedAfterOpen++;
    window.__postReads.pending--;
  }, () => { window.__postReads.pending--; });
  return result;
};
const NativeEventSource = window.EventSource;
window.EventSource = class extends NativeEventSource {
  constructor(...args) {
    super(...args); window.__streams.created++;
    this.addEventListener('open', () => window.__streams.opened++);
    this.addEventListener('error', () => window.__streams.errors++);
  }
  close() { window.__streams.closed++; return super.close(); }
};
localStorage.setItem('cat-capsule-seen', new Date().toISOString().slice(0, 10));
''')
                    page = await context.new_page()
                    page.on('pageerror', lambda error: report['page_errors'].append(str(error)))
                    expect.set_options(timeout=15000)

                    async def request(method, path, expected=200, **kwargs):
                        response = await getattr(context.request, method)(base + path, **kwargs)
                        assert response.status == expected, f'{path}: {response.status}: {(await response.text())[:300]}'
                        return await response.json()

                    async def ready():
                        assert all(process.poll() is None for process in processes), 'API/Vite exited'
                        try:
                            response = await context.request.get(base + '/api/cats', timeout=1000)
                            return response.status == 200
                        except Exception:
                            return False
                    await wait_until(ready, 60)

                    async def subscribers(count):
                        async def check():
                            return (await control.pubsub_numsub('cat_community:events'))[0][1] == count
                        await wait_until(check, 15)

                    async def outage():
                        opens = await page.evaluate('window.__streams.opened')
                        await proxy.stop()
                        await subscribers(0)
                        return opens

                    async def recover(opens, timeout=60000):
                        await proxy.start()
                        await page.wait_for_function('(opens) => window.__streams.opened > opens', arg=opens, timeout=timeout)

                    def passed(name):
                        report['checks'][name] = 'passed'
                        print(name + ': passed', flush=True)

                    try:
                        user = await request('post', '/api/auth/register', data={
                            'username': 'reconnect-user', 'password': 'reconnect-user-password', 'nickname': '重连验收用户'})
                        other = await request('post', '/api/auth/register', data={
                            'username': 'reconnect-other', 'password': 'reconnect-other-password', 'nickname': '另一位用户'})
                        author = {'Authorization': 'Bearer ' + other['token']}
                        viewer = {'Authorization': 'Bearer ' + user['token']}
                        admin = await request('post', '/api/admin/login', data={'password': env['ADMIN_PASSWORD']})
                        admin_headers = {'Authorization': 'Bearer ' + admin['token']}
                        await page.goto(base + '/login')
                        await page.evaluate('(user) => { localStorage.setItem("token", user.token); localStorage.setItem("user", JSON.stringify(user.user)); }', user)
                        await page.goto(base + '/community')
                        await page.wait_for_function('window.__streams.opened > 0')
                        # First SSE open triggers a real posts refetch. Let that
                        # baseline read finish before creating the missed event;
                        # otherwise it can legitimately include the new post.
                        await page.wait_for_function('window.__postReads.completedAfterOpen > 0 && window.__postReads.pending === 0')
                        report['initial_post_reads'] = await page.evaluate('window.__postReads')
                        await expect(page.get_by_text('还没有帖子', exact=True)).to_be_visible()
                        opens = await outage()
                        first_post = await request('post', '/api/posts', headers=author, form={'content': '断线期间的新帖子'})
                        assert any(row['content'] == '断线期间的新帖子' for row in (await request('get', '/api/posts', headers=author))['items'])
                        await expect(page.get_by_text('断线期间的新帖子', exact=True)).to_have_count(0)
                        await recover(opens)
                        await expect(page.get_by_text('断线期间的新帖子', exact=True)).to_be_visible()
                        passed('missed_post_refetched_after_redis_reconnect')

                        await page.get_by_role('button', name='发帖', exact=True).click()
                        draft = page.locator('textarea').first
                        await draft.fill('这是一份尚未发送的草稿')
                        opens = await outage()
                        await request('post', '/api/posts', headers=author, form={'content': '草稿编辑期间的新帖子'})
                        await recover(opens)
                        await expect(draft).to_have_value('这是一份尚未发送的草稿')
                        await expect(page.get_by_text('草稿编辑期间的新帖子', exact=True)).to_be_visible()
                        passed('revalidation_preserves_unsent_compose_draft')

                        await page.goto(base + f"/posts/{first_post['id']}")
                        await page.wait_for_function('window.__streams.opened > 0')
                        await page.get_by_role('button', name=re.compile('条回复')).click()
                        reply = page.get_by_placeholder('写评论…')
                        await reply.fill('这份评论也还没有发送')
                        opens = await outage()
                        await request('post', f"/api/posts/{first_post['id']}/comments", headers=author,
                                      data={'content': '断线时收到的新评论'})
                        await recover(opens)
                        await expect(page.get_by_text('断线时收到的新评论', exact=True)).to_be_visible()
                        await expect(reply).to_have_value('这份评论也还没有发送')
                        passed('post_detail_refreshes_comments_without_losing_reply')

                        own_post = await request('post', '/api/posts', headers=viewer, form={'content': '通知验收的帖子'})
                        await page.goto(base + '/notifications')
                        await page.wait_for_function('window.__streams.opened > 0')
                        opens = await outage()
                        await request('post', f"/api/posts/{own_post['id']}/like", headers=author)
                        await recover(opens)
                        await expect(page.get_by_text('有人赞了你的帖子', exact=True)).to_be_visible()
                        passed('notifications_refetch_missed_like')

                        await request('post', '/api/cats', headers=admin_headers, data={'name': '已有档案猫'})
                        await page.goto(base + '/collection')
                        await page.wait_for_function('window.__streams.opened > 0')
                        search = page.get_by_role('textbox')
                        await search.fill('重连验收猫')
                        opens = await outage()
                        await request('post', '/api/cats', headers=admin_headers, data={'name': '重连验收猫'})
                        await recover(opens)
                        await expect(page.get_by_text('重连验收猫', exact=True)).to_be_visible()
                        await expect(search).to_have_value('重连验收猫')
                        passed('catalog_refetch_preserves_search_filter')

                        await page.goto(base + '/')
                        await page.wait_for_function('window.__streams.opened > 0')
                        await subscribers(1)
                        opens = await outage()
                        await request('post', '/api/posts', headers=author, form={'content': '首页断线后应出现的帖子'})
                        await recover(opens)
                        await expect(page.get_by_text('首页断线后应出现的帖子', exact=True)).to_be_visible()
                        await subscribers(1)
                        passed('home_refreshes_with_one_shared_subscription')

                        await page.goto(base + '/community')
                        await page.wait_for_function('window.__streams.opened > 0')
                        opens = await page.evaluate('window.__streams.opened')
                        await context.set_offline(True)
                        await subscribers(0)
                        await request('post', '/api/posts', headers=author, form={'content': '浏览器离线期间的新帖子'})
                        await context.set_offline(False)
                        await page.wait_for_function('(opens) => window.__streams.opened > opens', arg=opens)
                        await expect(page.get_by_text('浏览器离线期间的新帖子', exact=True)).to_be_visible()
                        passed('browser_offline_online_reconnects_and_refetches')

                        opens = await outage()
                        # Includes the old retry budget plus real failed-request latency.
                        outage_started = time.monotonic()
                        await page.wait_for_timeout(60000)
                        await request('post', '/api/posts', headers=author, form={'content': '长时间断线后仍能恢复'})
                        await recover(opens)
                        await expect(page.get_by_text('长时间断线后仍能恢复', exact=True)).to_be_visible()
                        report['long_outage_seconds'] = round(time.monotonic() - outage_started, 2)
                        passed('recovers_after_old_retry_budget_is_exhausted')

                        opens = await outage()
                        await page.get_by_role('button', name='打开菜单').click()
                        await page.get_by_role('button', name='退出登录', exact=True).click()
                        await expect(page).to_have_url(base + '/login')
                        attempts = await page.evaluate('window.__streams.created')
                        await proxy.start()
                        await page.wait_for_timeout(4000)
                        assert await page.evaluate('window.__streams.created') == attempts
                        await subscribers(0)
                        passed('logout_cancels_pending_reconnect_and_subscription')

                        await page.get_by_label('用户名', exact=True).fill('reconnect-user')
                        await page.get_by_label('密码', exact=True).fill('reconnect-user-password')
                        await page.get_by_role('button', name='登录', exact=True).click()
                        await expect(page).to_have_url(base + '/')
                        await subscribers(1)
                        await request('post', f"/api/admin/users/{user['user']['id']}/revoke", headers=admin_headers)
                        await expect(page).to_have_url(base + '/login', timeout=25000)
                        assert await page.evaluate("localStorage.getItem('token')") is None
                        await subscribers(0)
                        passed('revoked_session_stops_reconnecting_and_returns_to_login')
                        assert (await control.info('server'))['run_id'] == redis_id
                        assert not report['page_errors'], report['page_errors']
                        report['streams'] = await page.evaluate('window.__streams')
                    except Exception:
                        await page.screenshot(path=str(output / 'failure.png'), full_page=True)
                        await context.tracing.stop(path=str(output / 'trace.zip'))
                        raise
                    else:
                        await context.tracing.stop()
                    finally:
                        await context.close()
                        await browser.close()
            finally:
                for process in reversed(processes):
                    await asyncio.to_thread(stop_process, process)
    finally:
        if proxy:
            await proxy.stop()
        if control:
            await control.aclose()
        await command('docker', 'rm', '-f', container)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'artifacts/reconnect-browser')
    args = parser.parse_args()
    output = args.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    report = {'status': 'running', 'checks': {}, 'page_errors': [],
              'started_at': datetime.now(timezone.utc).isoformat()}
    try:
        asyncio.run(scenario(output, report))
        report['status'] = 'passed'
    except Exception:
        report['status'] = 'failed'
        (output / 'failure.txt').write_text(traceback.format_exc(), encoding='utf-8')
        raise
    finally:
        (output / 'result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
