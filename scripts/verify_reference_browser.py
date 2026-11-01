"""B4 browser acceptance: real HTTP/DB/worker, synthetic inference only."""
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

from PIL import Image
from playwright.sync_api import expect, sync_playwright

from verify_browser import wait_http, stop_process, payload

ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / 'cat-backend'


def port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def contrast(ink, surface):
    def luminance(color):
        values = [int(color.lstrip('#')[i:i+2], 16) / 255 for i in (0, 2, 4)]
        linear = [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in values]
        return sum(c * weight for c, weight in zip(linear, (.2126, .7152, .0722)))
    a, b = sorted([luminance(ink), luminance(surface)])
    return round((b + .05) / (a + .05), 2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'artifacts/optimization-b4-browser')
    args = parser.parse_args()
    output = args.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    report = {'status': 'running', 'checks': {}, 'page_errors': [], 'contrasts': {},
              'model': 'synthetic inference adapter; no quality claim',
              'started_at': datetime.now(timezone.utc).isoformat()}
    processes = []
    try:
        with tempfile.TemporaryDirectory(prefix='cat-reference-browser-') as temp, (output / 'servers.log').open('w', encoding='utf-8') as log:
            fixture = Path(temp)
            uploads = fixture / 'uploads'
            (uploads / 'cats').mkdir(parents=True)
            photo = uploads / 'cats/reference.png'
            Image.new('RGB', (32, 32), 'orange').save(photo)
            (fixture / 'weights.pt').write_bytes(b'test-only-model')
            (fixture / 'detector.pt').write_bytes(b'test-only-detector')
            api_port, web_port = port(), port()
            while web_port == api_port:
                web_port = port()
            base = f'http://127.0.0.1:{web_port}'
            api_base = f'http://127.0.0.1:{api_port}'
            env = {**os.environ, 'DATABASE_URL': f'sqlite:///{(fixture / "fixture.db").as_posix()}',
                   'JWT_SECRET': 'b4-isolated-test-secret', 'ADMIN_PASSWORD': 'local-review-admin',
                   'INIT_DEMO_USER': '0', 'REDIS_URL': '', 'AGENT_ENABLED': '0', 'AGENT_API_KEY': '',
                   'REFERENCE_STORE': str(fixture / 'store'), 'REFERENCE_DIR': '', 'UPLOAD_DIR': str(uploads),
                   'REFERENCE_TEST_ROOT': str(fixture), 'VITE_API_TARGET': api_base,
                   'PYTHON_DOTENV_DISABLED': '1', 'RATE_LOGIN_PER_MIN': '100'}
            flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0

            def run(command):
                subprocess.run(command, cwd=BACKEND, env=env, stdout=log, stderr=log, check=True, timeout=60)

            def launch(command, cwd=BACKEND):
                process = subprocess.Popen(command, cwd=cwd, env=env, stdout=log, stderr=log, creationflags=flags)
                processes.append(process)
                return process

            def worker(expected=0):
                process = launch([sys.executable, 'tests/reference_process_app.py', 'worker'])
                assert process.wait(timeout=45) == expected

            run([sys.executable, '-m', 'alembic', 'upgrade', 'head'])
            run([sys.executable, '-c', '''
from app.database import SessionLocal
from app import models
from passlib.context import CryptContext
with SessionLocal() as db:
    cat = models.Cat(name='参考测试猫')
    db.add(cat); db.flush()
    db.add_all([models.CatImage(cat_id=cat.id,image_path='/uploads/cats/reference.png') for _ in range(2)])
    db.add(models.User(username='b4-reviewer', nickname='审核测试', role='reviewer', password_hash=CryptContext(schemes=['bcrypt']).hash('reviewer-test-password')))
    db.commit()
'''])
            try:
                api = launch([sys.executable, 'tests/reference_process_app.py', 'serve', str(api_port)])
                web = launch([shutil.which('node'), 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', str(web_port), '--strictPort'], ROOT / 'cat-frontend')
                wait_http(api_base + '/docs', api)
                wait_http(base, web)
                with sync_playwright() as p:
                    browser = p.chromium.launch(headless=True)
                    report['browser'] = browser.version
                    context = browser.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce')
                    context.tracing.start(screenshots=True, snapshots=True, sources=True)
                    page = context.new_page()
                    page.set_default_timeout(20000)
                    # Locator defaults do not configure expect(). The UI polls every
                    # 5 seconds, so allow multiple polls plus request/render latency.
                    expect.set_options(timeout=15000)
                    page.on('pageerror', lambda error: report['page_errors'].append(str(error)))
                    checks = report['checks']
                    try:
                        page.goto(base + '/admin')
                        page.get_by_placeholder('管理员口令').fill('local-review-admin')
                        page.get_by_role('button', name='进入管理台').click()
                        page.get_by_role('button', name='识别参考库', exact=True).click()
                        expect(page.get_by_text('参考版本暂不可用', exact=True)).to_be_visible()
                        expect(page.get_by_text('1 只 / 2 张', exact=True)).to_be_visible()
                        headers = {'Authorization': 'Bearer ' + page.evaluate("localStorage.getItem('admin_token')")}

                        def status():
                            return payload(page.request.get(base + '/api/admin/reference/status', headers=headers))

                        def refresh():
                            button = page.get_by_role('button', name='刷新状态')
                            expect(button).to_be_enabled()
                            button.click()

                        page.get_by_role('button', name='重建并发布', exact=True).click()
                        expect(page.get_by_text('等待执行', exact=True)).to_be_visible()
                        expect(page.get_by_role('button', name='重建并发布')).to_be_disabled()
                        assert status()['published'] is None
                        checks['queued_is_not_published'] = 'passed'
                        (fixture / 'block').touch()
                        building = launch([sys.executable, 'tests/reference_process_app.py', 'worker'])
                        deadline = time.monotonic() + 20
                        while True:
                            job = status()['latest_job']
                            if building.poll() is not None:
                                raise AssertionError(f'Worker exited before progress: exit={building.returncode}, job={job}')
                            if job['status'] == 'running':
                                report['running_job'] = job
                                break
                            if time.monotonic() >= deadline:
                                raise AssertionError(f'Worker startup timed out: job={job}; see servers.log')
                            page.wait_for_timeout(100)
                        # API polling above does not update React Query. This assertion
                        # still requires the page to refresh itself without a click.
                        expect(page.get_by_text('正在处理', exact=True)).to_be_visible()
                        expect(page.get_by_role('progressbar')).to_have_attribute('value', '0')
                        page.screenshot(path=str(output / 'progress-mobile.png'), full_page=True)
                        (fixture / 'block').unlink()
                        assert building.wait(timeout=45) == 0
                        expect(page.get_by_text('参考版本可用', exact=True)).to_be_visible()
                        first = status()['published']['snapshot_id']
                        expect(page.get_by_text('已受理，请等待执行结果。', exact=False)).to_have_count(0)
                        checks['worker_progress_and_automatic_refresh'] = 'passed'

                        (fixture / 'fail').touch()
                        page.get_by_role('button', name='重建并发布', exact=True).click()
                        expect(page.get_by_text('等待执行', exact=True)).to_be_visible()
                        worker(1)
                        expect(page.get_by_role('button', name='重试重建任务')).to_be_visible()
                        assert status()['published']['snapshot_id'] == first
                        expect(page.get_by_text('参考版本可用', exact=True)).to_be_visible()
                        page.screenshot(path=str(output / 'failure-mobile.png'), full_page=True)
                        (fixture / 'fail').unlink()
                        page.get_by_role('button', name='重试重建任务').click()
                        expect(page.get_by_text('等待执行', exact=True)).to_be_visible()
                        worker()
                        expect(page.get_by_text('等待执行', exact=True)).to_have_count(0)
                        assert status()['published']['snapshot_id'] != first
                        checks['failed_build_preserves_old_version_and_ui_retry'] = 'passed'

                        # Real archive creation, injected upload failure, retry against the same cat.
                        page.get_by_role('button', name='猫档案', exact=True).click()
                        page.get_by_label('名字', exact=True).fill('浏览器新猫')
                        page.get_by_label('上传参考照片').set_input_files(str(photo))
                        page.route('**/api/cats/*/images', lambda route: route.fulfill(status=503, json={'detail': 'test upload failure'}))
                        page.get_by_role('button', name='保存档案', exact=True).click()
                        expect(page.get_by_text('档案已保存，但参考照片上传失败。请保留当前档案重试保存，照片尚未进入参考库。')).to_be_visible()
                        assert payload(page.request.get(base + '/api/cats'))['total'] == 2
                        page.unroute('**/api/cats/*/images')
                        page.get_by_role('button', name='保存档案', exact=True).click()
                        expect(page.get_by_text('猫档案已更新；识别参考状态请到“识别参考库”核对。')).to_be_visible()
                        assert payload(page.request.get(base + '/api/cats'))['total'] == 2
                        page.locator('header').get_by_role('button', name='识别参考库', exact=True).click()
                        expect(page.get_by_text('有资料尚未发布到当前参考库。')).to_be_visible()
                        expect(page.get_by_text('参考版本暂不可用', exact=True)).to_be_visible()
                        checks['archive_save_upload_failure_and_pending_changes'] = 'passed'
                        page.get_by_role('button', name='重建并发布', exact=True).click()
                        expect(page.get_by_text('等待执行', exact=True)).to_be_visible()
                        worker()
                        expect(page.get_by_text('参考版本可用', exact=True)).to_be_visible()

                        for theme, width in [('original', 390), ('dark', 360), ('original', 1280)]:
                            page.evaluate('(theme) => document.documentElement.dataset.theme = theme', theme)
                            page.set_viewport_size({'width': width, 'height': 900})
                            page.evaluate('() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))')
                            assert page.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), 'Horizontal page overflow'
                            colors = page.evaluate('''() => {
                              const style = getComputedStyle(document.documentElement);
                              return ['--color-ink','--color-text-secondary','--color-surface'].map(key => style.getPropertyValue(key).trim());
                            }''')
                            ratios = [contrast(colors[0], colors[2]), contrast(colors[1], colors[2])]
                            assert min(ratios) >= 4.5, ratios
                            report['contrasts'][f'{theme}-{width}'] = ratios
                            page.screenshot(path=str(output / f'reference-{theme}-{width}.png'), full_page=True)
                        checks['responsive_and_text_contrast'] = 'passed'

                        page.route('**/api/admin/reference/status', lambda route: route.fulfill(status=503, json={'detail': 'test outage'}))
                        refresh()
                        expect(page.get_by_role('alert')).to_contain_text('当前状态待确认')
                        expect(page.get_by_role('button', name='重建并发布')).to_be_disabled()
                        page.unroute('**/api/admin/reference/status')
                        page.get_by_role('button', name='刷新状态').focus()
                        page.keyboard.press('Enter')
                        expect(page.get_by_text('参考版本可用', exact=True)).to_be_visible()
                        checks['refresh_failure_and_keyboard_retry'] = 'passed'

                        reviewer = payload(page.request.post(base + '/api/auth/login', data={'username': 'b4-reviewer', 'password': 'reviewer-test-password'}))['token']
                        page.evaluate('(token) => localStorage.setItem("admin_token", token)', reviewer)
                        page.reload()
                        page.get_by_role('button', name='识别参考库', exact=True).click()
                        expect(page.get_by_text('审核员可查看状态；提交任务请联系管理员。')).to_be_visible()
                        expect(page.get_by_role('button', name='重建并发布')).to_have_count(0)
                        payload(page.request.post(base + '/api/admin/reference/jobs', headers={'Authorization': 'Bearer ' + reviewer}, data={}), 403)
                        checks['reviewer_read_only'] = 'passed'
                        page.evaluate('''() => { localStorage.setItem('admin_token','expired'); localStorage.setItem('token','ordinary-session-preserved'); }''')
                        refresh()
                        expect(page.get_by_role('heading', name='猫协管理登录')).to_be_visible()
                        assert page.evaluate("localStorage.getItem('token')") == 'ordinary-session-preserved'
                        checks['expired_admin_session_isolated'] = 'passed'
                        assert not report['page_errors'], report['page_errors']
                    except Exception:
                        page.screenshot(path=str(output / 'failure.png'), full_page=True)
                        context.tracing.stop(path=str(output / 'trace.zip'))
                        raise
                    else:
                        context.tracing.stop()
                    finally:
                        context.close()
                        browser.close()
            finally:
                for process in reversed(processes):
                    stop_process(process)
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
