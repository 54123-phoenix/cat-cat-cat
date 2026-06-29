import json
from datetime import datetime
from pathlib import Path
from typing import Any

from app.config import settings
from app.services.model_loader import MODEL_PATH, TORCH_AVAILABLE, load_model

EMBEDDINGS_PATH = Path(__file__).parent.parent.parent / "embeddings" / "cat_embeddings.json"


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
    valid = 0 <= uncertain < confirmed <= 1
    return (
        {
            "confirmed": confirmed,
            "uncertain": uncertain,
            "valid": valid,
        },
        {
            "name": "recognition_thresholds",
            "status": "pass" if valid else "fail",
            "detail": "uncertain must be lower than confirmed, both within 0..1",
            "metadata": {
                "confirmed": confirmed,
                "uncertain": uncertain,
            },
        },
    )


def _embeddings_check(path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    metadata: dict[str, Any] = {
        "exists": path.exists(),
        "size_bytes": path.stat().st_size if path.exists() else 0,
        "reference_cat_count": 0,
        "embedding_dimensions": None,
    }

    if not path.exists() or metadata["size_bytes"] <= 0:
        return metadata, {
            "name": "reference_embeddings",
            "status": "fail",
            "detail": str(path),
            "metadata": metadata,
        }

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        metadata["error"] = str(exc)
        return metadata, {
            "name": "reference_embeddings",
            "status": "fail",
            "detail": "embedding file cannot be parsed",
            "metadata": metadata,
        }

    dimensions: set[int] = set()
    valid_cats = 0
    for cat_data in data.values():
        embeddings = cat_data.get("embeddings") if isinstance(cat_data, dict) else None
        if not embeddings:
            continue
        first_embedding = embeddings[0]
        if isinstance(first_embedding, list) and first_embedding:
            dimensions.add(len(first_embedding))
            valid_cats += 1

    metadata["reference_cat_count"] = valid_cats
    metadata["embedding_dimensions"] = sorted(dimensions)
    status = "pass" if valid_cats > 0 and len(dimensions) == 1 else "fail"

    return metadata, {
        "name": "reference_embeddings",
        "status": status,
        "detail": str(path),
        "metadata": metadata,
    }


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
            "path": str(EMBEDDINGS_PATH),
            "exists": EMBEDDINGS_PATH.exists(),
            "size_bytes": EMBEDDINGS_PATH.stat().st_size if EMBEDDINGS_PATH.exists() else 0,
        },
        "reference_cat_count": embeddings["reference_cat_count"],
        "embedding_dimensions": embeddings["embedding_dimensions"] or [],
        "thresholds": thresholds,
        "warm_model_requested": warm_model,
        "warm_model_loaded": warm_loaded,
        "checked_at": datetime.utcnow(),
        "checks": checks,
    }
