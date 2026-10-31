"""Exercise the actual application startup in separate processes and databases."""
import os
from pathlib import Path
import subprocess
import sys

import pytest
from sqlalchemy import create_engine, text

BACKEND = Path(__file__).resolve().parents[1]


def run(path, *arguments):
    env = {
        **os.environ, "DATABASE_URL": f"sqlite:///{path.as_posix()}",
        "JWT_SECRET": "schema-test-only", "ADMIN_PASSWORD": "schema-test-admin",
        "INIT_DEMO_USER": "0", "REDIS_URL": "", "AGENT_ENABLED": "0",
        "UPLOAD_DIR": str(path.parent / "uploads"),
    }
    return subprocess.run([sys.executable, *arguments], cwd=BACKEND, env=env,
                          capture_output=True, text=True, timeout=45)


def startup(path):
    return run(path, "-c", "from app.main import app\nfrom fastapi.testclient import TestClient\nwith TestClient(app) as c: assert c.get('/').status_code == 200")


def upgrade(path, revision="head"):
    result = run(path, "-m", "alembic", "upgrade", revision)
    assert result.returncode == 0, result.stderr


def test_import_does_not_create_database_and_missing_schema_blocks_startup(tmp_path):
    path = tmp_path / "absent.db"
    result = run(path, "-c", "import app.main")
    assert result.returncode == 0, result.stderr
    assert not path.exists()
    result = startup(path)
    assert result.returncode != 0
    assert "Database is not initialized" in result.stderr
    assert "alembic upgrade head" in result.stderr
    assert not path.exists()
    upgrade(path)
    assert startup(path).returncode == 0


@pytest.mark.parametrize("revision", [None, "e20261030"])
def test_unversioned_or_old_schema_is_not_silently_upgraded(tmp_path, revision):
    path = tmp_path / "old.db"
    if revision:
        upgrade(path, revision)
    else:
        result = run(path, "-c", "from app.database import Base, engine\nimport app.models\nBase.metadata.create_all(engine)")
        assert result.returncode == 0, result.stderr
    engine = create_engine(f"sqlite:///{path.as_posix()}")
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO cats (id, name) VALUES (1, 'preserved')"))
    result = startup(path)
    assert result.returncode != 0
    assert "Database migration mismatch" in result.stderr
    with engine.connect() as connection:
        assert connection.execute(text("SELECT count(*) FROM users")).scalar() == 0
        if revision:
            assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar() == revision
    upgrade(path)
    result = startup(path)
    assert result.returncode == 0, result.stderr
    with engine.connect() as connection:
        assert connection.execute(text("SELECT name FROM cats WHERE id=1")).scalar() == "preserved"
    engine.dispose()


def test_current_revision_with_missing_column_is_rejected_without_repair(tmp_path):
    path = tmp_path / "drift.db"
    upgrade(path)
    engine = create_engine(f"sqlite:///{path.as_posix()}")
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE cats DROP COLUMN story"))
    result = startup(path)
    assert result.returncode != 0
    assert "Database schema drift: missing cats.story" in result.stderr
    engine.dispose()


def test_current_revision_with_nonunique_identity_index_is_rejected(tmp_path):
    path = tmp_path / 'nonunique.db'
    upgrade(path)
    engine = create_engine(f'sqlite:///{path.as_posix()}')
    with engine.begin() as conn:
        conn.execute(text('DROP INDEX ix_users_username'))
        conn.execute(text('CREATE INDEX ix_users_username ON users(username)'))
    result = startup(path)
    assert result.returncode != 0
    assert 'missing unique indexes users.ix_users_username' in result.stderr
    engine.dispose()
