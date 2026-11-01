from app.time_utils import utc_now
from pathlib import Path
from typing import Any

from app.config import settings
from app.services.model_loader import MODEL_PATH, TORCH_AVAILABLE, load_model
from app.services.recognition_policy import RecognitionPolicy

from app.services.reference_snapshot import (
    reference_directory, load_snapshot, load_active_snapshot, runtime_identity, ReferenceUnavailable,
)

EMBEDDINGS_PATH = reference_directory() / "vectors.json"


def _check_status(checks: list[dict[str, Any]]) -> str:
    failed = [check for check in checks if check["status"] == "fail"]
    warned = [check for check in checks if check["status"] == "warn"]
    if failed:
        return "unhealthy"
    if warned:
        return "degraded"
    return "healthy"


def _file_check(name: str, path: Path) -> dict[str, Any]:
    exists = path.exists()
    size_bytes = path.stat().st_size if exists else 0
    return {
        "name": name,
        "status": "pass" if exists and size_bytes > 0 else "fail",
        "detail": str(path),
        "metadata": {
            "exists": exists,
            "size_bytes": size_bytes,
        },
    }


def _threshold_check() -> tuple[dict[str, Any], dict[str, Any]]:
    confirmed = settings.RECOGNIZE_THRESHOLD_CONFIRMED
    uncertain = settings.RECOGNIZE_THRESHOLD_UNCERTAIN
    margin = settings.RECOGNIZE_MIN_MARGIN
    try:
        RecognitionPolicy(confirmed, uncertain, margin)
        valid = True
    except ValueError:
        valid = False
    return (
        {
            "confirmed": confirmed,
            "uncertain": uncertain,
            "minimum_margin": margin,
            "valid": valid,
        },
        {
            "name": "recognition_thresholds",
            "status": "pass" if valid else "fail",
            "detail": "finite ordered thresholds within -1..1 and minimum margin within 0..2",
            "metadata": {
                "confirmed": confirmed,
                "uncertain": uncertain,
                "minimum_margin": margin,
            },
        },
    )


def _embeddings_check(path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    managed = bool(settings.REFERENCE_STORE)
    metadata: dict[str, Any] = {
        "path": str(Path(settings.REFERENCE_STORE).resolve()) if managed else str(path),
        "exists": False,
        "size_bytes": 0,
        "reference_cat_count": 0,
        "embedding_dimensions": None,
        "managed": managed,
    }
    try:
        if managed:
            snapshot = load_active_snapshot()
            path = Path(settings.REFERENCE_STORE).resolve() / 'versions' / snapshot.manifest.snapshot_id / 'vectors.json'
            metadata['publication_id'] = snapshot.publication_id
        else:
            if not path.is_file():
                raise ReferenceUnavailable('manifest_missing', 'Reference embeddings are missing')
            from app.database import SessionLocal
            digest, pipeline = runtime_identity()
            with SessionLocal() as db:
                snapshot = load_snapshot(path.parent, db, Path(settings.UPLOAD_DIR), digest, pipeline)
        metadata.update(path=str(path), exists=path.is_file(), size_bytes=path.stat().st_size)
        metadata['reference_cat_count'] = len({v.reference_id for v in snapshot.vectors})
        metadata['embedding_dimensions'] = [snapshot.manifest.dimension]
        metadata['snapshot_id'] = snapshot.manifest.snapshot_id
        status, detail = 'pass', 'Reference identity and content validated'
    except ReferenceUnavailable as exc:
        status, detail = 'fail', exc.code
    except Exception:
        status, detail = 'fail', 'reference_validation_failed'
    return metadata, {'name': 'reference_embeddings', 'status': status,
                      'detail': detail, 'metadata': metadata}


def get_model_health(warm_model: bool = False) -> dict[str, Any]:
    checks: list[dict[str, Any]] = [
        {
            "name": "torch_runtime",
            "status": "pass" if TORCH_AVAILABLE else "fail",
            "detail": "torch available" if TORCH_AVAILABLE else "torch not installed",
            "metadata": {"available": TORCH_AVAILABLE},
        },
        _file_check("model_weights", MODEL_PATH),
    ]

    thresholds, threshold_check = _threshold_check()
    checks.append(threshold_check)

    embeddings, embeddings_check = _embeddings_check(EMBEDDINGS_PATH)
    checks.append(embeddings_check)

    warm_loaded = False
    warm_error = None
    if warm_model:
        try:
            warm_loaded = load_model() is not None
        except Exception as exc:
            warm_error = str(exc)
        checks.append({
            "name": "warm_model_load",
            "status": "pass" if warm_loaded else "fail",
            "detail": "model loaded" if warm_loaded else "model did not load",
            "metadata": {"requested": True, "error": warm_error},
        })
    else:
        checks.append({
            "name": "warm_model_load",
            "status": "skip",
            "detail": "skipped; pass warm_model=true to load model weights",
            "metadata": {"requested": False},
        })

    return {
        "status": _check_status(checks),
        "runtime_available": TORCH_AVAILABLE,
        "model_file": {
            "path": str(MODEL_PATH),
            "exists": MODEL_PATH.exists(),
            "size_bytes": MODEL_PATH.stat().st_size if MODEL_PATH.exists() else 0,
        },
        "embeddings_file": {
            "path": embeddings['path'],
            "exists": embeddings['exists'],
            "size_bytes": embeddings['size_bytes'],
        },
        "reference_cat_count": embeddings["reference_cat_count"],
        "embedding_dimensions": embeddings["embedding_dimensions"] or [],
        "thresholds": thresholds,
        "warm_model_requested": warm_model,
        "warm_model_loaded": warm_loaded,
        "checked_at": utc_now(),
        "checks": checks,
    }
