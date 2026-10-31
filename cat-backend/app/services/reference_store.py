"""Local-filesystem primitives: process lock, immutable version paths, durable JSON."""
from contextlib import contextmanager
import json
import os
from pathlib import Path
import re
import uuid
import time

from app.services.reference_snapshot import ReferenceUnavailable, canonical


class StoreBusy(ReferenceUnavailable):
    def __init__(self):
        super().__init__('writer_busy', 'A reference writer is already running')


def child_path(root: Path, *parts: str) -> Path:
    root = root.resolve()
    path = root.joinpath(*parts)
    if not path.resolve().is_relative_to(root):
        raise ReferenceUnavailable('invalid_store_path', 'Reference store path escapes its root')
    return path


def id_path(root: Path, category: str, identity: str, suffix: str = '') -> Path:
    if not re.fullmatch('[0-9a-f]{32}', identity):
        raise ReferenceUnavailable('invalid_id', 'Expected a reference UUID')
    return child_path(root, category, identity + suffix)


def sync_directory(path: Path):
    if os.name != 'nt':
        descriptor = os.open(path, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)


def atomic_json(path: Path, value: dict):
    """Readers see the old or new complete document, never a partial write."""
    temporary = path.with_name(f'.{path.name}.{uuid.uuid4().hex}.tmp')
    try:
        with temporary.open('xb') as stream:
            stream.write(canonical(value))
            stream.flush()
            os.fsync(stream.fileno())
        for attempt in range(20):
            try:
                os.replace(temporary, path)
                break
            except PermissionError:
                if os.name != 'nt' or attempt == 19:
                    raise
                time.sleep(.025)  # A Windows reader may briefly hold a non-delete-sharing handle.
        sync_directory(path.parent)
    finally:
        temporary.unlink(missing_ok=True)


@contextmanager
def writer_lock(root: Path):
    """Nonblocking OS lock; a killed process releases it without lease expiry."""
    root.mkdir(parents=True, exist_ok=True)
    with child_path(root, '.writer.lock').open('a+b') as stream:
        if stream.seek(0, os.SEEK_END) == 0:
            stream.write(b'\0')
            stream.flush()
        stream.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            raise StoreBusy() from exc
        try:
            yield
        finally:
            if os.name == 'nt':
                stream.seek(0)
                msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


def prepare_store(root: Path, database_id: str):
    """Caller holds writer_lock; refuse a store belonging to another dataset."""
    path = child_path(root, 'store.json')
    expected = {'format_version': 1, 'database_id': database_id}
    if path.exists():
        try:
            stored = json.loads(path.read_bytes())
        except (OSError, ValueError) as exc:
            raise ReferenceUnavailable('store_unreadable', 'Reference store identity is malformed or unreadable') from exc
        if stored != expected:
            raise ReferenceUnavailable('store_database_mismatch', 'This store belongs to another database')
    else:
        atomic_json(path, expected)
    for category in ('versions', 'staging', 'jobs'):
        child_path(root, category).mkdir(exist_ok=True)
