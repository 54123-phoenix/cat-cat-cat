"""Real Vite/API/SQLite smoke; Chromium in CI, optional local Edge.

Uses disposable records and credentials. Only the explicit failure test intercepts
HTTP; saving, reviewing and public visibility use the real backend. Artifacts are
written outside showcase and include a trace/screenshot when a browser test fails.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import traceback
from urllib.parse import urlparse
from urllib.request import urlopen

from jose import jwt
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
SECRET = 'browser-validation-only-key'


def wait_http(url, process):
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f'Test server stopped: {url}')
        try:
            with urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except OSError:
            time.sleep(.2)
    raise RuntimeError(f'Test server did not start: {url}')


def check_ports(*ports):
    if len(set(ports)) != len(ports):
        raise ValueError('API and Web ports must differ')
    for port in ports:
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', port))


def stop_process(process):
    if process.poll() is not None:
        return
    if os.name == 'nt':
        subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def payload(response, status=200):
    assert response.status == status, f'{response.url}: expected {status}, got {response.status}: {response.text()[:300]}'
    return response.json()


def smoke(page, base, checks):
    page.goto(base + '/admin')
    expect(page.get_by_role('heading', name='猫协管理登录')).to_be_visible()
    page.get_by_placeholder('管理员口令').fill('local-review-admin')
    page.get_by_role('button', name='进入管理台').click()
    expect(page.get_by_role('heading', name='管理台', exact=True)).to_be_visible()
    page.get_by_role('button', name='退出', exact=True).click()
    expect(page.get_by_role('heading', name='猫协管理登录')).to_be_visible()
    checks['admin_login_logout_ui'] = 'passed'

    page.goto(base + '/login')
    page.get_by_label('用户名', exact=True).fill('review_demo')
    page.get_by_label('密码', exact=True).fill('local-review-password')
    page.get_by_role('button', name='登录', exact=True).click()
    expect(page).to_have_url(base + '/')
    expect(page.get_by_text('验收演示用户', exact=True).first).to_be_visible()
    user_token = page.evaluate("localStorage.getItem('token')")
    user_headers = {'Authorization': f'Bearer {user_token}'}
    checks['user_login_ui'] = 'passed'

    page.goto(base + '/collection')
    expect(page.get_by_text('演示小橘', exact=True)).to_be_visible()
    page.get_by_role('textbox').fill('演示小白')
    expect(page.get_by_text('演示小橘', exact=True)).to_have_count(0)
    expect(page.get_by_text('演示小白', exact=True)).to_be_visible()
    checks['collection_search_ui'] = 'passed'

    # All calls below go through Vite's real /api proxy to the temporary DB.
    request = page.request
    cats = payload(request.get(base + '/api/cats'))['items']
    cat_id = next(cat['id'] for cat in cats if cat['name'] == '演示小白')
    note = '浏览器跨角色验收记录'
    created = payload(request.post(base + '/api/sightings', headers=user_headers, form={
        'cat_id': str(cat_id), 'location_name': '验收测试点',
        'latitude': '31.3012', 'longitude': '121.5071', 'note': note,
    }))
    sighting_id = created['id']
    assert created['status'] == 'pending'
    public_url = base + '/api/sightings?limit=100'
    heatmap_url = base + '/api/map/heatmap?days=7&limit=100'
    assert sighting_id not in [row['id'] for row in payload(request.get(public_url))['items']]
    assert '验收测试点' not in [row['name'] for row in payload(request.get(heatmap_url))['items']]
    assert request.get(base + f'/api/sightings/{sighting_id}').status == 404
    assert request.post(base + f'/api/admin/sightings/{sighting_id}/review',
                        headers=user_headers, data={'action': 'approve'}).status == 403

    page.goto(base + '/admin')
    page.get_by_placeholder('管理员口令').fill('local-review-admin')
    page.get_by_role('button', name='进入管理台').click()
    expect(page.get_by_role('heading', name='管理台', exact=True)).to_be_visible()
    admin_token = page.evaluate("localStorage.getItem('admin_token')")
    admin_headers = {'Authorization': f'Bearer {admin_token}'}
    page.get_by_role('button', name='偶遇', exact=True).click()
    expect(page.get_by_text('验收测试点', exact=True)).to_be_visible()
    row = page.locator('article').filter(has=page.get_by_text('验收测试点', exact=True))
    expect(row.get_by_text('待审核', exact=True)).to_be_visible()
    with page.expect_response(lambda response: response.url.endswith(f'/api/admin/sightings/{sighting_id}/review') and response.request.method == 'POST') as reviewed:
        row.get_by_role('button', name='通过', exact=True).click()
    assert payload(reviewed.value)['status'] == 'approved'
    expect(row.get_by_text('已通过', exact=True)).to_be_visible()
    assert sighting_id in [row['id'] for row in payload(request.get(public_url))['items']]
    assert '验收测试点' in [row['name'] for row in payload(request.get(heatmap_url))['items']]
    assert cat_id in payload(request.get(base + '/api/users/me/encountered-cats', headers=user_headers))
    checks['save_api_pending_review_ui_public_api'] = 'passed'

    # Deliberate transport failure only; never substitutes a successful API response.
    def unavailable(route):
        route.fulfill(status=503, content_type='application/json', body='{"detail":"smoke service unavailable"}')
    page.route('**/api/admin/me', unavailable)
    page.reload()
    expect(page.get_by_role('alert')).to_contain_text('暂时无法验证管理身份')
    assert page.evaluate("localStorage.getItem('admin_token')") == admin_token
    assert page.evaluate("localStorage.getItem('token')") == user_token
    expect(page.get_by_role('heading', name='管理台', exact=True)).to_have_count(0)
    page.unroute('**/api/admin/me', unavailable)
    page.get_by_role('button', name='重试', exact=True).click()
    expect(page.get_by_role('heading', name='管理台', exact=True)).to_be_visible()
    checks['admin_503_preserves_credentials_and_retry_ui'] = 'passed'

    # Expired but correctly signed test token is rejected by the real server.
    claims = jwt.get_unverified_claims(admin_token)
    claims['exp'] = int(time.time()) - 60
    expired = jwt.encode(claims, SECRET, algorithm='HS256')
    page.evaluate('(token) => localStorage.setItem("admin_token", token)', expired)
    page.reload()
    expect(page.get_by_role('heading', name='猫协管理登录')).to_be_visible()
    expect(page.get_by_text('登录已过期', exact=True)).to_be_visible()
    assert page.evaluate("localStorage.getItem('admin_token')") is None
    assert page.evaluate("localStorage.getItem('token')") == user_token
    checks['expired_admin_isolated_from_user_ui'] = 'passed'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser-channel', default=None, help='Default: bundled Chromium; local Windows: msedge')
    parser.add_argument('--api-port', type=int, default=8017)
    parser.add_argument('--web-port', type=int, default=5187)
    parser.add_argument('--output-dir', type=Path, default=ROOT/'artifacts'/'browser'/datetime.now().strftime('%Y%m%d-%H%M%S'))
    parser.add_argument('--screenshots', action='store_true', help='Also capture five successful page previews')
    args = parser.parse_args()
    output = args.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    report = {'status': 'running', 'checks': {}, 'page_errors': [], 'http_errors': [],
              'started_at': datetime.now(timezone.utc).isoformat()}
    base = f'http://127.0.0.1:{args.web_port}'
    api_base = f'http://127.0.0.1:{args.api_port}'
    try:
        check_ports(args.api_port, args.web_port)
        with tempfile.TemporaryDirectory(prefix='cat-browser-validation-') as directory:
            fixture = Path(directory)
            env = {**os.environ, 'DATABASE_URL': f'sqlite:///{(fixture/"fixture.db").as_posix()}',
                   'JWT_SECRET': SECRET, 'ALGORITHM': 'HS256', 'ADMIN_PASSWORD': 'local-review-admin',
                   'INIT_DEMO_USER': '0', 'REDIS_URL': '', 'UPLOAD_DIR': str(fixture/'uploads'),
                   'REFERENCE_DIR': str(fixture/'reference'), 'REFERENCE_STORE': '',
                   'AGENT_ENABLED': '0', 'AGENT_API_KEY': '', 'WECHAT_APPID': '', 'WECHAT_SECRET': '',
                   'WECHAT_DEV_MODE': '0', 'VITE_API_TARGET': api_base, 'VITE_AMAP_KEY': '',
                   'PYTHON_DOTENV_DISABLED': '1'}
            flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            processes = []
            with (output/'servers.log').open('w', encoding='utf-8') as log:
                try:
                    subprocess.run([sys.executable, '-m', 'alembic', 'upgrade', 'head'],
                                   cwd=ROOT/'cat-backend', env=env, check=True, stdout=log, stderr=log)
                    seed = '''
from app.database import SessionLocal
from app import models
from passlib.context import CryptContext
with SessionLocal() as db:
    user=models.User(username='review_demo', nickname='验收演示用户', password_hash=CryptContext(schemes=['bcrypt']).hash('local-review-password'))
    db.add(user); db.flush()
    cats=[models.Cat(name=n,color=c,location=l) for n,c,l in [('演示小橘','橘色','图书馆门口'),('演示小白','白色','光华楼'),('演示小花','三花','二食堂')]]
    db.add_all(cats); db.flush()
    db.add(models.Sighting(cat_id=cats[0].id,user_id=user.id,status='approved',location_name='图书馆门口',latitude=31.3009,longitude=121.5037))
    db.add(models.Post(user_id=user.id,content='本地验收演示数据：在图书馆旁看见小橘，已记录偶遇。',topic='daily'))
    db.commit()
'''
                    subprocess.run([sys.executable, '-c', seed], cwd=ROOT/'cat-backend', env=env,
                                   check=True, stdout=log, stderr=log)
                    api = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1',
                                            '--port', str(args.api_port), '--no-access-log'], cwd=ROOT/'cat-backend',
                                           env=env, stdout=log, stderr=log, creationflags=flags)
                    processes.append(api)
                    web = subprocess.Popen([shutil.which('node'), 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1',
                                            '--port', str(args.web_port), '--strictPort'], cwd=ROOT/'cat-frontend',
                                           env=env, stdout=log, stderr=log, creationflags=flags)
                    processes.append(web)
                    wait_http(api_base + '/docs', api)
                    wait_http(base, web)
                    with sync_playwright() as p:
                        browser = p.chromium.launch(channel=args.browser_channel, headless=True)
                        report['browser'] = browser.version
                        context = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
                        context.tracing.start(screenshots=True, snapshots=True, sources=True)
                        page = context.new_page()
                        page.set_default_timeout(15000)
                        page.on('pageerror', lambda error: report['page_errors'].append(str(error)))
                        page.on('response', lambda response: report['http_errors'].append({
                            'status': response.status, 'path': urlparse(response.url).path
                        }) if response.status >= 400 else None)
                        try:
                            smoke(page, base, report['checks'])
                            if args.screenshots:
                                for name, route in [('home','/'), ('scan','/scan'), ('map','/map'), ('community','/community'), ('badges','/badges')]:
                                    page.goto(base + route)
                                    page.wait_for_timeout(1000)
                                    for dismiss in [page.get_by_text('跳过', exact=True), page.get_by_role('button', name='暂不开启', exact=True)]:
                                        if dismiss.is_visible():
                                            dismiss.click()
                                    page.screenshot(path=str(output/f'{name}.png'))
                            assert not report['page_errors'], report['page_errors']
                        except Exception:
                            page.screenshot(path=str(output/'failure.png'))
                            context.tracing.stop(path=str(output/'trace.zip'))
                            raise
                        else:
                            context.tracing.stop()
                        finally:
                            context.close()
                            browser.close()
                finally:
                    for process in reversed(processes):
                        stop_process(process)
                    if os.name == 'nt':
                        time.sleep(1)
        report['status'] = 'passed'
    except Exception:
        report['status'] = 'failed'
        (output/'failure.txt').write_text(traceback.format_exc(), encoding='utf-8')
        raise
    finally:
        (output/'result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(report, ensure_ascii=False))
        print(f'Artifacts: {output}')


if __name__ == '__main__':
    main()
