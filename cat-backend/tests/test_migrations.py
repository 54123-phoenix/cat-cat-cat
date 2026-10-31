import os
from pathlib import Path
import subprocess
import sys
import pytest
from sqlalchemy.exc import IntegrityError

from sqlalchemy import create_engine, inspect, text

from app.database import Base
from app import models  # register models

BACKEND = Path(__file__).resolve().parents[1]


def upgrade(path):
    env = {**os.environ, 'DATABASE_URL': f'sqlite:///{path.as_posix()}'}
    result = subprocess.run([sys.executable, '-m', 'alembic', 'upgrade', 'head'], cwd=BACKEND, env=env, capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr


def test_empty_database_can_upgrade_and_reupgrade(tmp_path):
    path = tmp_path/'empty.db'
    upgrade(path)
    upgrade(path)
    engine = create_engine(f'sqlite:///{path.as_posix()}')
    assert set(Base.metadata.tables) <= set(inspect(engine).get_table_names())
    for table in Base.metadata.tables.values():
        assert set(table.columns.keys()) == {c['name'] for c in inspect(engine).get_columns(table.name)}
        actual = {tuple(i['column_names']) for i in inspect(engine).get_indexes(table.name) if i['unique']}
        assert {tuple(c.name for c in i.columns) for i in table.indexes if i.unique} <= actual
    with engine.connect() as conn:
        assert conn.execute(text('PRAGMA foreign_key_check')).all() == []
        assert conn.execute(text('SELECT version_num FROM alembic_version')).scalar() == 'j20261031'
    engine.dispose()


@pytest.mark.parametrize('table,column,values', [
    ('users', 'username', "(username,password_hash,nickname) VALUES ('duplicate','x','x'),('duplicate','x','x')"),
    ('users', 'openid', "(username,openid,password_hash,nickname) VALUES ('one','duplicate','x','x'),('two','duplicate','x','x')"),
    ('campuses', 'slug', "(name,slug,center_lat,center_lng) VALUES ('one','duplicate',0,0),('two','duplicate',0,0)"),
    ('invite_codes', 'code', "(code,created_by) VALUES ('duplicate',1),('duplicate',1)"),
])
def test_unique_repair_refuses_duplicate_legacy_data_without_mutation(tmp_path, table, column, values):
    path = tmp_path / 'duplicate.db'
    env = {**os.environ, 'DATABASE_URL': f'sqlite:///{path.as_posix()}'}
    def migrate(revision):
        return subprocess.run([sys.executable, '-m', 'alembic', 'upgrade', revision], cwd=BACKEND,
                              env=env, capture_output=True, text=True, timeout=60)
    assert migrate('i20261031').returncode == 0
    engine = create_engine(env['DATABASE_URL'])
    with engine.begin() as conn:
        if table == 'invite_codes':
            conn.execute(text("INSERT INTO users (id,username,password_hash,nickname) VALUES (1,'inviter','x','x')"))
        conn.execute(text(f'INSERT INTO {table} {values}'))
    before = {name: inspect(engine).get_indexes(name) for name in ('users', 'campuses', 'invite_codes')}
    result = migrate('head')
    assert result.returncode != 0
    assert f'duplicate {table}.{column}' in result.stderr
    with engine.connect() as conn:
        assert conn.execute(text(f'SELECT count(*) FROM {table}')).scalar_one() == 2
        assert conn.execute(text('SELECT version_num FROM alembic_version')).scalar_one() == 'i20261031'
    assert {name: inspect(engine).get_indexes(name) for name in before} == before
    # Explicit correction in this disposable fixture preserves both records.
    with engine.begin() as conn:
        conn.execute(text(f"UPDATE {table} SET {column}='corrected' WHERE id=2"))
    assert migrate('head').returncode == 0
    with pytest.raises(IntegrityError):
        with engine.begin() as conn:
            conn.execute(text(f"UPDATE {table} SET {column}='duplicate' WHERE id=2"))
    with engine.connect() as conn:
        assert conn.execute(text(f'SELECT count(*) FROM {table}')).scalar_one() == 2
    engine.dispose()


def test_reference_generation_tracks_committed_identity_and_photo_changes(tmp_path):
    path = tmp_path / 'generation.db'
    upgrade(path)
    engine = create_engine(f'sqlite:///{path.as_posix()}')

    def generation(conn):
        return conn.execute(text('SELECT generation FROM reference_catalog WHERE id=1')).scalar_one()

    with engine.begin() as conn:
        before = generation(conn)
        conn.execute(text("INSERT INTO cats (id,name) VALUES (1,'one'),(2,'two')"))
        assert generation(conn) > before
        before = generation(conn)
        conn.execute(text("UPDATE cats SET name='renamed' WHERE id=1"))
        conn.execute(text('UPDATE cats SET id=id,reference_id=reference_id WHERE id=1'))
        assert generation(conn) == before
        conn.execute(text("INSERT INTO cat_images (id,cat_id,image_path) VALUES (1,1,'/uploads/one.png')"))
        assert generation(conn) == before + 1
        conn.execute(text('UPDATE cat_images SET image_path=image_path,cat_id=cat_id,id=id WHERE id=1'))
        assert generation(conn) == before + 1

    # The trigger update is part of the original transaction, including rollback.
    with engine.connect() as conn:
        before = generation(conn)
        conn.execute(text("UPDATE cat_images SET image_path='/uploads/changed.png' WHERE id=1"))
        assert generation(conn) == before + 1
        with engine.connect() as observer:
            assert generation(observer) == before
        conn.rollback()
        assert generation(conn) == before
        assert conn.execute(text('SELECT image_path FROM cat_images')).scalar_one() == '/uploads/one.png'

    for sql in ["UPDATE cat_images SET image_path='/uploads/two.png' WHERE id=1",
                'UPDATE cat_images SET cat_id=2 WHERE id=1',
                'UPDATE cat_images SET id=3 WHERE id=1',
                'DELETE FROM cat_images WHERE id=3', 'DELETE FROM cats WHERE id=2']:
        with engine.begin() as conn:
            before = generation(conn)
            conn.execute(text(sql))
            assert generation(conn) == before + 1
    with pytest.raises(IntegrityError):
        with engine.begin() as conn:
            conn.execute(text('UPDATE reference_catalog SET generation=0'))
    engine.dispose()


def test_unversioned_create_all_database_retains_data_and_fixes_rejectd(tmp_path):
    path = tmp_path/'legacy.db'
    engine = create_engine(f'sqlite:///{path.as_posix()}')
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO users (id,username,password_hash,nickname) VALUES (1,'legacy','x','legacy')"))
        conn.execute(text("INSERT INTO cats (id,name) VALUES (1,'legacy cat')"))
        conn.execute(text("INSERT INTO sightings (id,cat_id,user_id,status) VALUES (1,1,1,'rejectd')"))
    engine.dispose()
    upgrade(path)
    with engine.connect() as conn:
        assert conn.execute(text('SELECT username FROM users')).scalar() == 'legacy'
        assert conn.execute(text('SELECT status FROM sightings')).scalar() == 'rejected'
        assert conn.execute(text('SELECT token_version FROM users')).scalar() == 1
    engine.dispose()


def test_legacy_ownership_is_unknown_after_upgrade(tmp_path):
    path = tmp_path/'old-head.db'
    env = {**os.environ, 'DATABASE_URL': f'sqlite:///{path.as_posix()}'}
    result = subprocess.run([sys.executable, '-m', 'alembic', 'upgrade', 'e20261030'], cwd=BACKEND, env=env, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    engine = create_engine(f'sqlite:///{path.as_posix()}')
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO discoveries (note) VALUES ('legacy')"))
        conn.execute(text("INSERT INTO audit_logs (action,entity_type,performed_by) VALUES ('recognize','cat','legacy')"))
    upgrade(path)
    with engine.connect() as conn:
        assert conn.execute(text('SELECT user_id FROM discoveries')).scalar() is None
        assert conn.execute(text('SELECT user_id FROM audit_logs')).scalar() is None
        assert conn.execute(text('PRAGMA foreign_key_check')).all() == []
    engine.dispose()


def test_reference_migration_keeps_ids_and_foreign_keys_and_assigns_identity_once(tmp_path):
    path = tmp_path / 'reference-legacy.db'
    env = {**os.environ, 'DATABASE_URL': f'sqlite:///{path.as_posix()}'}
    result = subprocess.run([sys.executable, '-m', 'alembic', 'upgrade', 'g20261030'], cwd=BACKEND,
                            env=env, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    engine = create_engine(f'sqlite:///{path.as_posix()}')
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO cats (id,name) VALUES (7,'original'),(8,'other')"))
        conn.execute(text("INSERT INTO cat_images (id,cat_id,image_path) VALUES (2,7,'/uploads/cats/7.png')"))
    upgrade(path)
    with engine.connect() as conn:
        cats = conn.execute(text('SELECT id,reference_id FROM cats ORDER BY id')).all()
        identity = conn.execute(text('SELECT database_id FROM reference_catalog')).scalar_one()
        assert [row.id for row in cats] == [7, 8]
        assert len({row.reference_id for row in cats}) == 2
        assert all(len(row.reference_id) == 32 for row in cats)
        assert conn.execute(text('SELECT cat_id FROM cat_images WHERE id=2')).scalar_one() == 7
        assert conn.execute(text('PRAGMA foreign_key_check')).all() == []
    upgrade(path)
    with engine.begin() as conn:
        assert conn.execute(text('SELECT id,reference_id FROM cats ORDER BY id')).all() == cats
        assert conn.execute(text('SELECT database_id FROM reference_catalog')).scalar_one() == identity
        conn.execute(text("UPDATE cats SET name='renamed' WHERE id=7"))
        assert conn.execute(text('SELECT reference_id FROM cats WHERE id=7')).scalar_one() == cats[0].reference_id
    for sql in ["UPDATE cats SET reference_id='changed' WHERE id=7",
                "UPDATE reference_catalog SET database_id='changed'", "DELETE FROM reference_catalog"]:
        with pytest.raises(IntegrityError):
            with engine.begin() as conn:
                conn.execute(text(sql))
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO cats (id,name) VALUES (9,'new')"))
        assert len(conn.execute(text('SELECT reference_id FROM cats WHERE id=9')).scalar_one()) == 32
    engine.dispose()
