"""Validated reference bundles. Never infer identity from a name or legacy ID.

B1 deliberately validates content on each use. Publication/caching is a separate
lifecycle concern; a directory without a complete manifest is never searchable.
"""
from dataclasses import dataclass, replace
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
from typing import Annotated, Literal
import uuid
from threading import RLock

import numpy as np
from PIL import Image
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select

from app import models
from app.config import settings
from app.services.artifact_hash import sha256_file

DIMENSION = 256
PREPROCESS_VERSION = 'rgb-bicubic-short256-center224-imagenet-cls-linear256-l2-v1'
CROP_VERSION = 'yolov8m-cat15-conf0.3-margin0.1-or-original-v1'
BACKEND = Path(__file__).resolve().parents[2]
HexId = Annotated[str, Field(pattern=r'^[0-9a-f]{32}$')]
Digest = Annotated[str, Field(pattern=r'^[0-9a-f]{64}$')]


class ReferenceUnavailable(RuntimeError):
    def __init__(self, code: str, detail: str):
        self.code = code
        super().__init__(detail)


class Contract(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True, frozen=True, protected_namespaces=())


class CatBinding(Contract):
    cat_id: int = Field(gt=0)
    reference_id: HexId


class Source(Contract):
    image_id: int = Field(gt=0)
    reference_id: HexId
    path: str
    sha256: Digest


class Pipeline(Contract):
    preprocessing: Literal[PREPROCESS_VERSION] = PREPROCESS_VERSION
    crop: Literal[CROP_VERSION, 'none-v1']
    detector_sha256: Digest | None


class Manifest(Contract):
    format_version: Literal[2] = 2
    snapshot_id: HexId
    database_id: HexId
    catalog_revision: Digest
    catalog_generation: int = Field(ge=0)
    model_sha256: Digest
    pipeline: Pipeline
    dimension: int = Field(gt=0)
    created_at: str
    cats: list[CatBinding]
    sources: list[Source]
    artifacts: dict[Literal['vectors.json'], Digest]


class Vector(Contract):
    image_id: int = Field(gt=0)
    reference_id: HexId
    embedding: list[float]


def canonical(data) -> bytes:
    return json.dumps(data, sort_keys=True, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')


def source_path(upload_root: Path, resource: str) -> Path:
    if not resource.startswith('/uploads/'):
        raise ReferenceUnavailable('invalid_source', 'Reference photos must be registered local /uploads/ resources')
    root = upload_root.resolve()
    path = (root / resource[len('/uploads/'):]).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ReferenceUnavailable('invalid_source', 'Reference photo is missing or outside the upload directory')
    return path


@dataclass(frozen=True)
class Catalog:
    database_id: str
    generation: int
    revision: str
    cats: tuple[CatBinding, ...]
    sources: tuple[Source, ...]
    names: dict[str, str]


def capture_catalog(db, upload_root: Path) -> Catalog:
    state = db.execute(select(models.ReferenceCatalog.database_id, models.ReferenceCatalog.generation)
                       .where(models.ReferenceCatalog.id == 1)).one_or_none()
    if not state:
        raise ReferenceUnavailable('missing_database_identity', 'Apply the reference identity migration first')
    identity, generation = state
    # One joined SELECT gives a consistent set of IDs even if another writer commits.
    rows = db.execute(select(models.Cat.id, models.Cat.reference_id, models.Cat.name,
                             models.CatImage.id, models.CatImage.image_path)
                      .outerjoin(models.CatImage, models.Cat.id == models.CatImage.cat_id)
                      .order_by(models.Cat.id, models.CatImage.id)).all()
    cats, sources, names = {}, [], {}
    for cat_id, reference_id, name, image_id, path in rows:
        cats[cat_id] = CatBinding(cat_id=cat_id, reference_id=reference_id)
        names[reference_id] = name
        if image_id is not None:
            try:
                digest = sha256_file(source_path(upload_root, path))
            except (ReferenceUnavailable, OSError) as exc:
                raise ReferenceUnavailable('invalid_source', f'Reference photo {image_id} ({path}): {exc}') from exc
            sources.append(Source(image_id=image_id, reference_id=reference_id, path=path, sha256=digest))
    content = {'database_id': identity, 'cats': [c.model_dump() for c in cats.values()],
               'sources': [s.model_dump() for s in sources]}
    # Names are display data. Renaming never changes identity or requires new vectors.
    revision = hashlib.sha256(canonical(content)).hexdigest()
    return Catalog(identity, generation, revision, tuple(cats.values()), tuple(sources), names)


def runtime_identity(crop: bool = True) -> tuple[str, Pipeline]:
    from app.services import model_loader, detector
    try:
        digest = sha256_file(model_loader.MODEL_PATH)
    except OSError as exc:
        raise ReferenceUnavailable('model_unavailable', 'Required model checkpoint is missing or unreadable') from exc
    detector_digest = None
    if crop:
        if not detector.YOLO_AVAILABLE:
            raise ReferenceUnavailable('detector_unavailable', 'YOLO runtime is unavailable')
        try:
            detector_digest = sha256_file(detector._MODEL_PATH)
        except OSError as exc:
            raise ReferenceUnavailable('detector_unavailable', 'Required local detector checkpoint is missing') from exc
    return digest, Pipeline(crop=CROP_VERSION if crop else 'none-v1', detector_sha256=detector_digest)


def validate_vector(vector: list[float], dimension: int = DIMENSION) -> None:
    value = np.asarray(vector, dtype=np.float64)
    if value.shape != (dimension,) or not np.isfinite(value).all():
        raise ReferenceUnavailable('invalid_vector', 'Vector must have the expected dimension and finite values')
    if not np.isclose(np.linalg.norm(value), 1.0, atol=1e-4):
        raise ReferenceUnavailable('invalid_vector', 'Reference and query vectors must be L2 normalized')


@dataclass(frozen=True)
class Snapshot:
    manifest: Manifest
    catalog: Catalog
    vectors: tuple[Vector, ...]
    publication_id: str | None = None


_snapshot_lock = RLock()
_snapshot_cache = None


def load_snapshot(directory: Path, db, upload_root: Path, model_digest: str, pipeline: Pipeline,
                  *, expected_manifest_sha256: str | None = None) -> Snapshot:
    global _snapshot_cache
    try:
        if not (directory / 'manifest.json').is_file():
            raise ReferenceUnavailable('manifest_missing', 'Legacy or missing reference bundle; rebuild with a manifest')
        manifest_bytes = (directory / 'manifest.json').read_bytes()
        if (expected_manifest_sha256 is not None
                and hashlib.sha256(manifest_bytes).hexdigest() != expected_manifest_sha256):
            raise ReferenceUnavailable('pointer_manifest_mismatch', 'Loaded manifest differs from the publication pointer')
        manifest = Manifest.model_validate_json(manifest_bytes)
        timestamp = datetime.fromisoformat(manifest.created_at)
        if timestamp.tzinfo is None:
            raise ValueError('Build timestamp must include timezone')
        if manifest.dimension != DIMENSION:
            raise ReferenceUnavailable('dimension_mismatch', 'Reference dimension differs from the extractor')
        if manifest.model_sha256 != model_digest:
            raise ReferenceUnavailable('model_mismatch', 'Reference bundle was built with a different checkpoint')
        if manifest.pipeline != pipeline:
            raise ReferenceUnavailable('pipeline_mismatch', 'Preprocessing or detector differs from the reference bundle')
        catalog = capture_catalog(db, upload_root)
        if manifest.database_id != catalog.database_id:
            raise ReferenceUnavailable('database_mismatch', 'Reference bundle belongs to another database')
        if manifest.catalog_generation != catalog.generation:
            raise ReferenceUnavailable('generation_mismatch', 'Catalog generation changed; rebuild required')
        if manifest.cats != list(catalog.cats):
            raise ReferenceUnavailable('identity_mismatch', 'Cat identity mapping differs from this database')
        if manifest.catalog_revision != catalog.revision or manifest.sources != list(catalog.sources):
            raise ReferenceUnavailable('catalog_changed', 'Reference photos or catalog changed; rebuild required')
        if set(manifest.artifacts) != {'vectors.json'}:
            raise ValueError('The vector artifact is required')
        raw = (directory / 'vectors.json').read_bytes()
        if hashlib.sha256(raw).hexdigest() != manifest.artifacts['vectors.json']:
            raise ReferenceUnavailable('artifact_mismatch', 'Reference vector content hash does not match the manifest')
        # Content and current inputs are checked even on cache hits. No stat/TTL
        # shortcut may keep a deleted identity or overwritten photo searchable.
        key = (hashlib.sha256(manifest_bytes).hexdigest(), catalog.revision, catalog.generation)
        with _snapshot_lock:
            cached = _snapshot_cache
        if cached and cached[0] == key:
            return replace(cached[1], catalog=catalog)
        vectors = tuple(Vector.model_validate(v) for v in json.loads(raw))
        expected = {s.image_id: s.reference_id for s in catalog.sources}
        actual = {v.image_id: v.reference_id for v in vectors}
        if not vectors or len(actual) != len(vectors) or actual != expected:
            raise ReferenceUnavailable('mapping_mismatch', 'Each registered reference photo must have exactly one matching vector')
        for vector in vectors:
            validate_vector(vector.embedding, manifest.dimension)
        snapshot = Snapshot(manifest, catalog, vectors)
        with _snapshot_lock:
            _snapshot_cache = (key, snapshot)
        return snapshot
    except ReferenceUnavailable:
        raise
    except Exception as exc:
        raise ReferenceUnavailable('invalid_bundle', 'Reference bundle or source data is malformed or unreadable') from exc


def reference_directory() -> Path:
    return Path(settings.REFERENCE_DIR) if settings.REFERENCE_DIR else BACKEND / 'embeddings'


def load_active_snapshot(crop: bool = True) -> Snapshot:
    if settings.REFERENCE_STORE:
        from app.services.reference_lifecycle import load_published_snapshot
        return load_published_snapshot(crop)
    from app.database import SessionLocal
    directory = reference_directory()
    # Diagnose a legacy bundle before attempting optional heavyweight dependencies.
    if not (directory / 'manifest.json').is_file():
        raise ReferenceUnavailable('manifest_missing', 'Legacy or missing reference bundle; rebuild with a manifest')
    digest, pipeline = runtime_identity(crop)
    with SessionLocal() as db:
        return load_snapshot(directory, db, Path(settings.UPLOAD_DIR), digest, pipeline)


def reference_status(crop: bool = True) -> dict:
    try:
        snapshot = load_active_snapshot(crop)
        return {'status': 'compatible', 'code': 'validated',
                'snapshot_id': snapshot.manifest.snapshot_id,
                'catalog_revision': snapshot.manifest.catalog_revision,
                'catalog_generation': snapshot.manifest.catalog_generation,
                'publication_id': snapshot.publication_id,
                'reference_cat_count': len({v.reference_id for v in snapshot.vectors}),
                'photo_count': len(snapshot.vectors), 'dimension': snapshot.manifest.dimension}
    except ReferenceUnavailable as exc:
        return {'status': 'unavailable', 'code': exc.code, 'detail': str(exc)}
    except Exception:
        return {'status': 'unavailable', 'code': 'validation_failed', 'detail': 'Unable to validate reference inputs'}


def build_candidate(output: Path, db, upload_root: Path, *, crop: bool, identity_provider=runtime_identity,
                    extractor=None, cropper=None, on_started=None, on_progress=None) -> Manifest:
    """Build a new, inactive directory from registered CatImage records; no DB writes."""
    from app.services.model_loader import extract_embedding
    from app.services.detector import detect_and_crop
    extractor = extractor or extract_embedding
    cropper = cropper or detect_and_crop
    if db.new or db.dirty or db.deleted:
        raise ReferenceUnavailable('uncommitted_catalog', 'Use a clean, dedicated read session for candidate builds')
    if output.exists():
        raise ReferenceUnavailable('output_exists', 'Choose a new output directory; existing bundles are never overwritten')
    digest, pipeline = identity_provider(crop)
    catalog = capture_catalog(db, upload_root)
    if not catalog.sources:
        raise ReferenceUnavailable('no_reference_photos', 'Register reference photos before building')
    if on_started:
        on_started(catalog, digest, pipeline)
    vectors = []
    for source in catalog.sources:
        try:
            raw = source_path(upload_root, source.path).read_bytes()
            if hashlib.sha256(raw).hexdigest() != source.sha256:
                raise ReferenceUnavailable('catalog_changed', 'Reference photo changed during the build')
            with Image.open(io.BytesIO(raw)) as original:
                image = original.convert('RGB')
            if crop:
                image = cropper(image, expected_digest=pipeline.detector_sha256)
            embedding = extractor(image, expected_digest=digest)
            validate_vector(embedding)
        except Exception as exc:
            code = exc.code if isinstance(exc, ReferenceUnavailable) else 'source_build_failed'
            raise ReferenceUnavailable(code, f'Reference photo {source.image_id} ({source.path}): {exc}') from exc
        vectors.append(Vector(image_id=source.image_id, reference_id=source.reference_id, embedding=embedding))
        if on_progress:
            on_progress(len(vectors), len(catalog.sources))
    db.rollback()  # End the read transaction so the final check sees new commits.
    current = capture_catalog(db, upload_root)
    if (current.revision != catalog.revision or current.generation != catalog.generation
            or identity_provider(crop) != (digest, pipeline)):
        raise ReferenceUnavailable('inputs_changed', 'Database, photos or model changed during the build')
    data = canonical([vector.model_dump() for vector in vectors])
    manifest = Manifest(snapshot_id=uuid.uuid4().hex, database_id=catalog.database_id,
                        catalog_revision=catalog.revision, catalog_generation=catalog.generation,
                        model_sha256=digest, pipeline=pipeline,
                        dimension=DIMENSION, created_at=datetime.now(timezone.utc).isoformat(),
                        cats=list(catalog.cats), sources=list(catalog.sources),
                        artifacts={'vectors.json': hashlib.sha256(data).hexdigest()})
    output.mkdir(parents=True, exist_ok=False)
    (output / 'vectors.json').write_bytes(data)
    (output / 'manifest.json').write_bytes(canonical(manifest.model_dump()))
    load_snapshot(output, db, upload_root, digest, pipeline)
    return manifest
