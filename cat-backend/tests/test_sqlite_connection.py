"""Real file locks during SQLite connection initialization."""
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from contextlib import closing
import sqlite3
from threading import Event
import time

import pytest

from app.database import _set_sqlite_pragma


@pytest.fixture
def locked_database(tmp_path):
    path = tmp_path / 'locked.db'
    with closing(sqlite3.connect(path)) as reader:
        reader.execute('CREATE TABLE sample (id INTEGER PRIMARY KEY)')
        reader.execute('INSERT INTO sample VALUES (1)')
        reader.commit()
        reader.execute('BEGIN')
        reader.execute('SELECT * FROM sample').fetchall()
        try:
            yield path, reader
        finally:
            reader.rollback()


def test_wal_initialization_waits_for_real_reader_then_enforces_foreign_keys(locked_database):
    path, reader = locked_database
    attempted = Event()

    def connect():
        with closing(sqlite3.connect(path, timeout=0)) as connection:
            connection.set_trace_callback(lambda sql: attempted.set() if 'journal_mode=WAL' in sql else None)
            _set_sqlite_pragma(connection, None)
            assert connection.execute('PRAGMA journal_mode').fetchone()[0] == 'wal'
            assert connection.execute('PRAGMA busy_timeout').fetchone()[0] == 5000
            connection.execute('CREATE TABLE child (parent_id INTEGER REFERENCES sample(id))')
            with pytest.raises(sqlite3.IntegrityError):
                connection.execute('INSERT INTO child VALUES (999)')

    with ThreadPoolExecutor(max_workers=1) as executor:
        pending = executor.submit(connect)
        try:
            assert attempted.wait(2), 'Connection did not attempt the journal-mode transition'
            with pytest.raises(TimeoutError):
                pending.result(timeout=.1)
        finally:
            reader.rollback()
        pending.result(timeout=2)


def test_persistent_lock_fails_within_deadline(locked_database):
    path, _ = locked_database
    with closing(sqlite3.connect(path, timeout=0)) as connection:
        started = time.monotonic()
        with pytest.raises(sqlite3.OperationalError) as error:
            _set_sqlite_pragma(connection, None, wal_timeout=.1)
        assert error.value.sqlite_errorcode == sqlite3.SQLITE_BUSY
        assert .08 <= time.monotonic() - started < 1


def test_readonly_error_is_not_retried_or_hidden(tmp_path):
    path = tmp_path / 'readonly.db'
    with closing(sqlite3.connect(path)) as writer:
        writer.execute('CREATE TABLE sample (id INTEGER PRIMARY KEY)')
    with closing(sqlite3.connect(f'{path.as_uri()}?mode=ro', uri=True)) as connection:
        started = time.monotonic()
        with pytest.raises(sqlite3.OperationalError) as error:
            _set_sqlite_pragma(connection, None)
        assert error.value.sqlite_errorcode == sqlite3.SQLITE_READONLY
        assert time.monotonic() - started < 1
