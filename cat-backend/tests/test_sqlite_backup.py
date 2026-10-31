import importlib.util
from pathlib import Path
import sqlite3
import shutil
import subprocess
import sys
import pytest

spec = importlib.util.spec_from_file_location('sqlite_backup', Path(__file__).resolve().parents[2]/'scripts/sqlite_backup.py')
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


def test_snapshot_includes_live_wal_and_restores_into_disposable_copy(tmp_path):
    source, saved, restored = (tmp_path/name for name in ['live.db','backup.db','restored.db'])
    with sqlite3.connect(source) as writer:
        writer.execute('PRAGMA journal_mode=WAL')
        writer.execute('PRAGMA wal_autocheckpoint=0')
        writer.execute('CREATE TABLE evidence (id INTEGER PRIMARY KEY, value TEXT)')
        writer.commit()
        writer.execute("INSERT INTO evidence VALUES (1, 'committed in WAL')")
        writer.commit()
        assert Path(str(source)+'-wal').stat().st_size > 0
        backup.snapshot(source, saved)
        writer.execute("INSERT INTO evidence VALUES (2, 'after snapshot')")
        writer.commit()
        backup.snapshot(saved, restored)
        with sqlite3.connect(restored) as verify:
            assert verify.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
            assert verify.execute('SELECT * FROM evidence').fetchall() == [(1, 'committed in WAL')]


def test_powershell_wrappers_backup_and_restore_only_disposable_project(tmp_path):
    shell = shutil.which('pwsh') or shutil.which('powershell')
    if not shell:
        pytest.skip('PowerShell runtime not available')
    project = tmp_path/'fixture-project'
    scripts = project/'scripts'
    scripts.mkdir(parents=True)
    for name in ('backup.ps1', 'restore.ps1', 'database_path.ps1', 'sqlite_backup.py'):
        shutil.copyfile(Path(__file__).resolve().parents[2]/'scripts'/name, scripts/name)
    data = project/'cat-backend'/'data'
    data.mkdir(parents=True)
    database = data/'cat_community.db'
    with sqlite3.connect(database) as conn:
        conn.execute('CREATE TABLE evidence (value TEXT)')
        conn.execute("INSERT INTO evidence VALUES ('before')")
    def run(name, *args):
        result = subprocess.run([shell, '-NoProfile', '-File', str(scripts/name), '-Python', sys.executable, *args],
                                capture_output=True, text=True)
        assert result.returncode == 0, result.stdout + result.stderr
    run('backup.ps1', '-SkipUploads')
    saved = next((project/'backups').glob('*/cat_community.db'))
    with sqlite3.connect(database) as conn:
        conn.execute("UPDATE evidence SET value='after'")
    run('restore.ps1', '-BackupPath', str(saved.parent), '-SkipUploads')
    with sqlite3.connect(database) as conn:
        assert conn.execute('SELECT value FROM evidence').fetchone()[0] == 'after'
    run('restore.ps1', '-BackupPath', str(saved.parent), '-ConfirmRestore', '-SkipUploads')
    with sqlite3.connect(database) as conn:
        assert conn.execute('SELECT value FROM evidence').fetchone()[0] == 'before'
        assert conn.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    pre_restore = next((project/'backups').glob('pre-restore-*/cat_community.db'))
    with sqlite3.connect(pre_restore) as conn:
        assert conn.execute('SELECT value FROM evidence').fetchone()[0] == 'after'
