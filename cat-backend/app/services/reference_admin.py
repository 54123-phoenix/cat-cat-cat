"""Read-only management view; publication authority remains current.json."""
import hashlib
from pathlib import Path
from typing import Literal

from sqlalchemy import func, select

from app import models
from app.config import settings
from app.services import reference_lifecycle as lifecycle
from app.services.reference_snapshot import (
    Contract, HexId, Manifest, ReferenceUnavailable, capture_catalog,
    reference_directory, reference_status,
)
from app.services.reference_store import id_path


class Diagnostic(Contract):
    code: str
    message: str


class CatalogSummary(Contract):
    database_id: HexId
    generation: int
    cat_count: int
    photo_count: int
    cats_without_photos: int


class PublishedSummary(Contract):
    snapshot_id: HexId
    publication_id: HexId | None
    catalog_generation: int
    photo_count: int
    created_at: str


class ReferenceStatus(Contract):
    status: Literal['compatible', 'unavailable']
    code: str
    detail: str | None = None
    snapshot_id: HexId | None = None
    catalog_revision: str | None = None
    catalog_generation: int | None = None
    publication_id: HexId | None = None
    reference_cat_count: int | None = None
    photo_count: int | None = None
    dimension: int | None = None
    store_configured: bool
    current_catalog: CatalogSummary | None = None
    published: PublishedSummary | None = None
    pending_changes: bool | None = None
    catalog_error: Diagnostic | None = None
    publication_error: Diagnostic | None = None
    job_error: Diagnostic | None = None
    latest_job: lifecycle.Job | None = None
    jobs: list[lifecycle.Job]
    checked_at: str


def describe(crop=True) -> ReferenceStatus:
    from app.database import SessionLocal
    result = reference_status(crop)
    result.update(store_configured=bool(settings.REFERENCE_STORE), jobs=[], checked_at=lifecycle.now())
    catalog = None
    manifest = None
    pointer = None
    try:
        with SessionLocal() as db:
            database_id, generation = lifecycle.catalog_state(db)
            cat_count = db.scalar(select(func.count()).select_from(models.Cat))
            photo_count = db.scalar(select(func.count()).select_from(models.CatImage))
            empty_count = db.scalar(select(func.count()).select_from(models.Cat).where(
                ~select(models.CatImage.id).where(models.CatImage.cat_id == models.Cat.id).exists()))
            result['current_catalog'] = CatalogSummary(database_id=database_id, generation=generation,
                cat_count=cat_count, photo_count=photo_count, cats_without_photos=empty_count)
            catalog = capture_catalog(db, Path(settings.UPLOAD_DIR))
            if catalog.generation != generation:
                raise ReferenceUnavailable('catalog_changed', 'Catalog changed during status inspection; refresh')
    except Exception as exc:
        catalog = None
        result['catalog_error'] = diagnostic(exc, 'catalog_unreadable')

    try:
        if settings.REFERENCE_STORE:
            root = lifecycle.store_root()
            # Absence is an ordinary first-run state. Corruption is a distinct diagnostic.
            if (root / 'current.json').exists():
                pointer = lifecycle.read_pointer(root)
                raw = (id_path(root, 'versions', pointer.snapshot_id) / 'manifest.json').read_bytes()
                if hashlib.sha256(raw).hexdigest() != pointer.manifest_sha256:
                    raise ReferenceUnavailable('pointer_manifest_mismatch', 'Published manifest hash differs')
                manifest = Manifest.model_validate_json(raw)
                if (manifest.snapshot_id != pointer.snapshot_id or manifest.database_id != pointer.database_id
                        or manifest.catalog_generation != pointer.catalog_generation):
                    raise ReferenceUnavailable('pointer_identity_mismatch', 'Published identities differ')
                if lifecycle.read_pointer(root) != pointer:
                    raise ReferenceUnavailable('publication_changed', 'Publication changed; refresh')
        else:
            path = reference_directory() / 'manifest.json'
            if path.exists():
                manifest = Manifest.model_validate_json(path.read_bytes())
        if manifest:
            result['published'] = PublishedSummary(snapshot_id=manifest.snapshot_id,
                publication_id=pointer.publication_id if pointer else None,
                catalog_generation=manifest.catalog_generation, photo_count=len(manifest.sources),
                created_at=manifest.created_at)
        if catalog is not None:
            result['pending_changes'] = manifest is None or (
                catalog.database_id != manifest.database_id or catalog.generation != manifest.catalog_generation
                or catalog.revision != manifest.catalog_revision)
        # Never combine an earlier compatible result with newer incompatible metadata.
        if result['status'] == 'compatible' and (
            not manifest or result.get('pending_changes') is not False
            or result.get('snapshot_id') != manifest.snapshot_id
            or result.get('publication_id') != (pointer.publication_id if pointer else None)
        ):
            result.update(status='unavailable', code='inputs_changed', detail='Inputs changed; refresh status')
    except Exception as exc:
        result['publication_error'] = diagnostic(exc, 'publication_unreadable')
        result.update(status='unavailable', code=result['publication_error'].code)
    if settings.REFERENCE_STORE:
        try:
            jobs = lifecycle.list_jobs(lifecycle.store_root())
            result.update(jobs=jobs, latest_job=jobs[0] if jobs else None)
        except ReferenceUnavailable as exc:
            result['job_error'] = diagnostic(exc, 'job_unreadable')
    return ReferenceStatus.model_validate(result)


def diagnostic(exc, fallback):
    return Diagnostic(code=exc.code if isinstance(exc, ReferenceUnavailable) else fallback,
                      message=str(exc)[:1000])
