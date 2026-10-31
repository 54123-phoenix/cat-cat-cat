"""Durable local reference jobs and atomic publication, independent of Redis.

The filesystem pointer is the publication authority. Job journals are reconciled
under the OS writer lock after a crash; SQLite guards the final catalog check.
"""
from contextlib import contextmanager
from dataclasses import replace
from datetime import datetime, timezone
import hashlib
from pathlib import Path
from typing import Literal
import uuid

from pydantic import Field, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import ReferenceCatalog
from app.services.reference_snapshot import (
    Contract, Digest, HexId, Manifest, ReferenceUnavailable, build_candidate,
    load_snapshot, runtime_identity,
)
from app.services.reference_store import (
    StoreBusy, atomic_json, child_path, id_path, prepare_store, sync_directory, writer_lock,
)


class Pointer(Contract):
    format_version: Literal[1] = 1
    publication_id: HexId
    snapshot_id: HexId
    manifest_sha256: Digest
    database_id: HexId
    catalog_generation: int = Field(ge=0)
    job_id: HexId


class Job(Contract):
    job_id: HexId
    kind: Literal['rebuild', 'publish', 'rollback']
    status: Literal['queued', 'running', 'succeeded', 'failed', 'interrupted'] = 'queued'
    created_at: str
    updated_at: str
    requested_by: int | None = None
    requested_generation: int = Field(ge=0)
    crop: bool = True
    publish: bool = True
    target_snapshot_id: HexId | None = None
    input_revision: Digest | None = None
    input_generation: int | None = None
    model_sha256: Digest | None = None
    snapshot_id: HexId | None = None
    publication_id: HexId | None = None
    completed_photos: int = 0
    total_photos: int = 0
    code: str | None = None
    detail: str | None = None
    recovered: bool = False


def now():
    return datetime.now(timezone.utc).isoformat()


def store_root() -> Path:
    if not settings.REFERENCE_STORE:
        raise ReferenceUnavailable('store_not_configured', 'Configure REFERENCE_STORE before submitting jobs')
    return Path(settings.REFERENCE_STORE).resolve()


def catalog_state(db):
    state = db.execute(select(ReferenceCatalog.database_id, ReferenceCatalog.generation)
                       .where(ReferenceCatalog.id == 1)).one_or_none()
    if state is None:
        raise ReferenceUnavailable('missing_database_identity', 'Migrate the database before using reference jobs')
    return state


def read_pointer(root: Path) -> Pointer:
    try:
        return Pointer.model_validate_json(child_path(root, 'current.json').read_bytes())
    except Exception as exc:
        raise ReferenceUnavailable('pointer_unavailable', 'No complete current reference pointer is available') from exc


def read_job(root: Path, job_id: str) -> Job:
    try:
        job = Job.model_validate_json(id_path(root, 'jobs', job_id, '.json').read_bytes())
        if job.job_id != job_id:
            raise ReferenceUnavailable('job_unreadable', 'Job journal identity differs from its filename')
        return job
    except FileNotFoundError as exc:
        raise ReferenceUnavailable('job_not_found', 'Reference job not found') from exc
    except (OSError, ValidationError) as exc:
        raise ReferenceUnavailable('job_unreadable', f'Job journal {job_id} is malformed or unreadable') from exc


def list_jobs(root: Path, limit: int = 20) -> list[Job]:
    jobs = [read_job(root, path.stem) for path in child_path(root, 'jobs').glob('*.json')]
    return sorted(jobs, key=lambda job: (job.created_at, job.job_id), reverse=True)[:limit]


def _all_jobs(root: Path) -> list[Job]:
    return [read_job(root, path.stem) for path in child_path(root, 'jobs').glob('*.json')]


def save_job(root: Path, job: Job, **changes) -> Job:
    updated = Job.model_validate({**job.model_dump(), **changes, 'updated_at': now()})
    atomic_json(id_path(root, 'jobs', job.job_id, '.json'), updated.model_dump())
    return updated


def reconcile(root: Path):
    """Only while holding writer_lock: no other live writer can own running jobs."""
    try:
        pointer = read_pointer(root)
        manifest = id_path(root, 'versions', pointer.snapshot_id) / 'manifest.json'
        if hashlib.sha256(manifest.read_bytes()).hexdigest() != pointer.manifest_sha256:
            pointer = None
    except (OSError, ReferenceUnavailable):
        pointer = None
    for job in _all_jobs(root):
        if job.status != 'running':
            continue
        if pointer and pointer.job_id == job.job_id and pointer.snapshot_id == job.snapshot_id:
            save_job(root, job, status='succeeded', publication_id=pointer.publication_id,
                     code='published_recovered', detail='Publication completed before writer interruption', recovered=True)
        else:
            save_job(root, job, status='interrupted', code='writer_interrupted',
                     detail='Previous writer stopped before completing the job', recovered=True)


def enqueue(db, *, kind='rebuild', requested_by=None, crop=True, publish=True, snapshot_id=None) -> Job:
    root = store_root()
    database_id, generation = catalog_state(db)
    if kind != 'rebuild' and snapshot_id is None:
        raise ReferenceUnavailable('snapshot_required', 'A target snapshot ID is required')
    with writer_lock(root):
        prepare_store(root, database_id)
        reconcile(root)
        if any(job.status == 'queued' for job in _all_jobs(root)):
            raise StoreBusy()
        if snapshot_id is not None:
            if not id_path(root, 'versions', snapshot_id).is_dir():
                raise ReferenceUnavailable('snapshot_not_found', 'Target snapshot is not in this reference store')
        timestamp = now()
        job = Job(job_id=uuid.uuid4().hex, kind=kind, requested_by=requested_by,
                  requested_generation=generation, crop=crop, publish=publish,
                  target_snapshot_id=snapshot_id, created_at=timestamp, updated_at=timestamp)
        atomic_json(id_path(root, 'jobs', job.job_id, '.json'), job.model_dump())
        return job


@contextmanager
def publication_guard(factory):
    """Block SQL catalog mutations only during final validation and pointer swap."""
    with factory() as probe:
        engine = probe.get_bind()
    if engine.dialect.name != 'sqlite':
        raise ReferenceUnavailable('unsupported_database', 'Reference publication currently requires SQLite')
    with engine.connect() as connection:
        connection.exec_driver_sql('BEGIN IMMEDIATE')
        try:
            with Session(bind=connection) as db:
                yield db
        finally:
            connection.rollback()


def publish_snapshot(root: Path, snapshot_id: str, job: Job, factory) -> Pointer:
    directory = id_path(root, 'versions', snapshot_id)
    with publication_guard(factory) as db:
        digest, pipeline = runtime_identity(job.crop)
        snapshot = load_snapshot(directory, db, Path(settings.UPLOAD_DIR), digest, pipeline)
        if snapshot.manifest.snapshot_id != snapshot_id:
            raise ReferenceUnavailable('version_identity_mismatch', 'Version directory and manifest IDs differ')
        if snapshot.catalog.generation != job.requested_generation:
            raise ReferenceUnavailable('generation_mismatch', 'Catalog changed since the job was submitted')
        if runtime_identity(job.crop) != (digest, pipeline):
            raise ReferenceUnavailable('model_changed', 'Model changed during publication validation')
        manifest_bytes = (directory / 'manifest.json').read_bytes()
        if Manifest.model_validate_json(manifest_bytes) != snapshot.manifest:
            raise ReferenceUnavailable('candidate_changed', 'Candidate manifest changed during publication')
        pointer = Pointer(publication_id=uuid.uuid4().hex, snapshot_id=snapshot_id,
                          manifest_sha256=hashlib.sha256(manifest_bytes).hexdigest(),
                          database_id=snapshot.catalog.database_id,
                          catalog_generation=snapshot.catalog.generation, job_id=job.job_id)
        atomic_json(child_path(root, 'current.json'), pointer.model_dump())
        return pointer


def run_once(*, factory=None, builder=None) -> Job | None:
    from app.database import SessionLocal
    factory = factory or SessionLocal
    builder = builder or build_candidate
    root = store_root()
    with writer_lock(root):
        with factory() as db:
            database_id, _ = catalog_state(db)
        prepare_store(root, database_id)
        reconcile(root)
        queued = sorted((job for job in _all_jobs(root) if job.status == 'queued'), key=lambda job: job.created_at)
        if not queued:
            return None
        job = save_job(root, queued[0], status='running', code=None, detail=None)
        try:
            with factory() as db:
                _, generation = catalog_state(db)
                if generation != job.requested_generation:
                    raise ReferenceUnavailable('generation_mismatch', 'Catalog changed before the job started')
                if job.kind == 'rebuild':
                    def started(catalog, digest, pipeline):
                        nonlocal job
                        if catalog.generation != job.requested_generation:
                            raise ReferenceUnavailable('generation_mismatch', 'Catalog changed before input capture')
                        job = save_job(root, job, input_revision=catalog.revision,
                                       input_generation=catalog.generation, model_sha256=digest,
                                       total_photos=len(catalog.sources))

                    def progress(done, total):
                        nonlocal job
                        job = save_job(root, job, completed_photos=done, total_photos=total)

                    staging = id_path(root, 'staging', job.job_id)
                    manifest = builder(staging, db, Path(settings.UPLOAD_DIR), crop=job.crop,
                                       on_started=started, on_progress=progress)
                    destination = id_path(root, 'versions', manifest.snapshot_id)
                    if destination.exists():
                        raise ReferenceUnavailable('version_exists', 'Version directories are immutable')
                    for name in ('vectors.json', 'manifest.json'):
                        with (staging / name).open('r+b') as stream:
                            import os
                            os.fsync(stream.fileno())
                    sync_directory(staging)
                    staging.rename(destination)
                    sync_directory(staging.parent)
                    sync_directory(destination.parent)
                    job = save_job(root, job, snapshot_id=manifest.snapshot_id)
                else:
                    job = save_job(root, job, snapshot_id=job.target_snapshot_id)
            if job.publish or job.kind != 'rebuild':
                pointer = publish_snapshot(root, job.snapshot_id, job, factory)
                job = save_job(root, job, status='succeeded', publication_id=pointer.publication_id, code='published')
            else:
                job = save_job(root, job, status='succeeded', code='candidate_ready')
            return job
        except Exception as exc:
            # If a write failed after the atomic pointer swap, the pointer remains
            # authoritative. A later locked reconciliation can recover the journal.
            try:
                pointer = read_pointer(root)
            except ReferenceUnavailable:
                pointer = None
            if pointer and pointer.job_id == job.job_id and pointer.snapshot_id == job.snapshot_id:
                return save_job(root, job, status='succeeded', publication_id=pointer.publication_id,
                                code='published_recovered', recovered=True)
            return save_job(root, job, status='failed',
                            code=exc.code if isinstance(exc, ReferenceUnavailable) else 'build_failed',
                            detail=str(exc)[:1000])


def load_published_snapshot(crop=True):
    from app.database import SessionLocal
    root = store_root()
    pointer = read_pointer(root)
    directory = id_path(root, 'versions', pointer.snapshot_id)
    try:
        raw = (directory / 'manifest.json').read_bytes()
        if hashlib.sha256(raw).hexdigest() != pointer.manifest_sha256:
            raise ReferenceUnavailable('pointer_manifest_mismatch', 'Published manifest does not match the current pointer')
        digest, pipeline = runtime_identity(crop)
        with SessionLocal() as db:
            snapshot = load_snapshot(directory, db, Path(settings.UPLOAD_DIR), digest, pipeline,
                                     expected_manifest_sha256=pointer.manifest_sha256)
        if (snapshot.manifest.snapshot_id != pointer.snapshot_id
                or snapshot.manifest.database_id != pointer.database_id
                or snapshot.manifest.catalog_generation != pointer.catalog_generation):
            raise ReferenceUnavailable('pointer_identity_mismatch', 'Pointer and snapshot identities differ')
        if read_pointer(root) != pointer:
            raise ReferenceUnavailable('publication_changed', 'Publication changed while loading')
        return replace(snapshot, publication_id=pointer.publication_id)
    except ReferenceUnavailable:
        raise
    except Exception as exc:
        raise ReferenceUnavailable('published_snapshot_unreadable', 'Published reference snapshot cannot be read') from exc
