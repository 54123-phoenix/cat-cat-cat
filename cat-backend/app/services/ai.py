"""Recognition only from content- and identity-validated reference snapshots."""
import io
import logging
from dataclasses import dataclass
from threading import RLock

import numpy as np
from PIL import Image

from app.schemas import RecognizeCandidate, RecognizeResponse
from app.services.model_loader import extract_embedding, TORCH_AVAILABLE
from app.services.detector import detect_and_crop
from app.services.reference_snapshot import load_active_snapshot, validate_vector, ReferenceUnavailable
from app.services.reference_snapshot import canonical
from app.config import settings

try:
    from app.services.faiss_index import FaissIndex
except ImportError:
    FaissIndex = None

logger = logging.getLogger(__name__)
_search_lock = RLock()
_search_cache = None


def search_snapshot(snapshot, query):
    global _search_cache
    key = (canonical(snapshot.manifest.model_dump()), FaissIndex)
    with _search_lock:
        cached = _search_cache
    if not cached or cached[0] != key:
        bindings = {item.reference_id: item.cat_id for item in snapshot.catalog.cats}
        ids = tuple(bindings[vector.reference_id] for vector in snapshot.vectors)
        if FaissIndex is not None:
            index = FaissIndex(dim=snapshot.manifest.dimension)
            for cat_id, vector in zip(ids, snapshot.vectors):
                index.add(cat_id, vector.embedding)
            index.build()
        else:
            index = np.asarray([vector.embedding for vector in snapshot.vectors], dtype=np.float32)
            index.setflags(write=False)
        cached = (key, index, ids)
        with _search_lock:
            _search_cache = cached
    _, index, ids = cached
    if FaissIndex is not None:
        return index.search(query, top_k=5)
    best = {}
    for cat_id, score in zip(ids, index @ np.asarray(query, dtype=np.float32)):
        best[cat_id] = max(best.get(cat_id, -1.0), float(score))
    return sorted(best.items(), key=lambda row: (-row[1], row[0]))[:5]


@dataclass(frozen=True)
class RecognitionDetails:
    response: RecognizeResponse
    ranking: tuple[RecognizeCandidate, ...] = ()
    snapshot_id: str | None = None
    publication_id: str | None = None
    failure_code: str | None = None


def recognize_cat_image(image_bytes: bytes, filename: str = '', *, crop: bool = True) -> RecognizeResponse:
    return recognize_with_details(image_bytes, filename, crop=crop).response


def recognize_with_details(image_bytes: bytes, filename: str = '', *, crop: bool = True) -> RecognitionDetails:
    """Internal diagnostics share the API path; raw ranks never alter its contract."""
    if not TORCH_AVAILABLE:
        return RecognitionDetails(RecognizeResponse(status='unavailable'), failure_code='runtime_unavailable')
    try:
        snapshot = load_active_snapshot(crop)
        with Image.open(io.BytesIO(image_bytes)) as original:
            image = original.convert('RGB')
        if crop:
            image = detect_and_crop(image, expected_digest=snapshot.manifest.pipeline.detector_sha256)
        query = extract_embedding(image, expected_digest=snapshot.manifest.model_sha256)
        validate_vector(query)
        scores = search_snapshot(snapshot, query)
        # Inference can be slow. Recheck inputs before exposing an identity.
        current = load_active_snapshot(crop)
        if (current.manifest.snapshot_id != snapshot.manifest.snapshot_id
                or current.manifest != snapshot.manifest
                or current.publication_id != snapshot.publication_id):
            raise ReferenceUnavailable('snapshot_changed', 'Reference snapshot changed during recognition')
        names = {binding.cat_id: current.catalog.names[binding.reference_id] for binding in current.catalog.cats}
        if not scores:
            raise ReferenceUnavailable('empty_reference', 'No reference vectors are searchable')
        scores = [(cat_id, max(-1.0, min(1.0, score))) for cat_id, score in scores]
        ranking = tuple(RecognizeCandidate(cat_id=cid, cat_name=names[cid], confidence=score)
                        for cid, score in scores)
        cat_id, confidence = scores[0]
        if confidence >= settings.RECOGNIZE_THRESHOLD_CONFIRMED:
            response = RecognizeResponse(status='confirmed', cat_id=cat_id, cat_name=names[cat_id], confidence=confidence)
        elif confidence >= settings.RECOGNIZE_THRESHOLD_UNCERTAIN:
            response = RecognizeResponse(status='uncertain', confidence=confidence, candidates=list(ranking[:3]))
        else:
            response = RecognizeResponse(status='unknown', confidence=confidence)
        return RecognitionDetails(response, ranking, current.manifest.snapshot_id, current.publication_id)
    except ReferenceUnavailable as exc:
        logger.warning('Reference unavailable [%s]: %s', exc.code, exc)
        return RecognitionDetails(RecognizeResponse(status='unavailable'), failure_code=exc.code)
    except Exception:
        logger.exception('Recognition failed')
        return RecognitionDetails(RecognizeResponse(status='unavailable'), failure_code='recognition_failed')
