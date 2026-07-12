import io
import json
import logging
from pathlib import Path
from typing import Optional

from PIL import Image

from app.schemas import RecognizeCandidate, RecognizeResponse
from app.services.model_loader import extract_embedding, cosine_similarity, TORCH_AVAILABLE
from app.services.detector import detect_and_crop
try:
    from app.services.faiss_index import FaissIndex
    FAISS_AVAILABLE = True
except ImportError:
    FaissIndex = None
    FAISS_AVAILABLE = False

from app.database import SessionLocal
from app import models
from app.config import settings

logger = logging.getLogger(__name__)

# ─── Reference Index ──────────────────────────────────────────────────

_EMBEDDINGS_DIR = Path(__file__).parent.parent.parent / "embeddings"
_index: Optional[FaissIndex] = None
# cat_id → cat_name lookup (lazily populated from DB)
_id_to_name: dict[int, str] = {}


def _load_index():
    """Load FAISS index from disk, or build from cat_embeddings.json.

    Returns a FaissIndex on success, or a plain dict on fallback (when
    faiss-cpu is not installed).  The dict has the same shape as the
    legacy cat_embeddings.json {cat_name: {cat_id, embeddings}}.
    """
    global _index

    if _index is not None:
        return _index

    # ── FAISS path ──────────────────────────────────────────────
    if FAISS_AVAILABLE and FaissIndex is not None:
        idx = FaissIndex(dim=256)
        if idx.load():
            _index = idx
            _warm_name_cache()
            logger.info("FAISS index ready: %d vectors, %d cats", idx.ntotal, len(_id_to_name))
            return _index

        # Build from JSON
        json_path = _EMBEDDINGS_DIR / "cat_embeddings.json"
        if json_path.exists():
            logger.info("Building FAISS index from %s ...", json_path)
            with open(json_path) as f:
                data = json.load(f)
            db = SessionLocal()
            try:
                for cat_name, cat_data in data.items():
                    cat = db.query(models.Cat).filter(models.Cat.name == cat_name).first()
                    cat_id = cat.id if cat else None
                    if cat_id is None:
                        continue
                    for emb in cat_data["embeddings"]:
                        idx.add(cat_id, emb)
            finally:
                db.close()
            idx.build()
            idx.save()
            _index = idx
            _warm_name_cache()
            logger.info("FAISS index built: %d vectors, %d cats", idx.ntotal, len(_id_to_name))
            return _index

    # ── Brute-force fallback ────────────────────────────────────
    json_path = _EMBEDDINGS_DIR / "cat_embeddings.json"
    if json_path.exists():
        with open(json_path) as f:
            data = json.load(f)
        db = SessionLocal()
        try:
            for cat_name, cat_data in data.items():
                cat = db.query(models.Cat).filter(models.Cat.name == cat_name).first()
                if cat:
                    cat_data["cat_id"] = cat.id
                    _id_to_name[cat.id] = cat.name
                else:
                    cat_data["cat_id"] = None
        finally:
            db.close()
        _index = data
        logger.info("Loaded reference embeddings for %d cats (brute-force fallback)", len(data))
        return _index

    _index = {}
    return _index


def _warm_name_cache() -> None:
    """Populate cat_id → cat_name mapping from DB."""
    global _id_to_name
    if _id_to_name:
        return
    db = SessionLocal()
    try:
        for cat in db.query(models.Cat).all():
            _id_to_name[cat.id] = cat.name
    finally:
        db.close()


# ─── Recognition Logic ────────────────────────────────────────────────

def recognize_cat_image(image_bytes: bytes, filename: str = "") -> RecognizeResponse:
    if not TORCH_AVAILABLE:
        return RecognizeResponse(status="unavailable", confidence=0.0)

    THRESHOLD_CONFIRMED = settings.RECOGNIZE_THRESHOLD_CONFIRMED
    THRESHOLD_UNCERTAIN = settings.RECOGNIZE_THRESHOLD_UNCERTAIN

    try:
        # Load and preprocess image
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        # Detect and crop cat from image (YOLOv8m)
        image = detect_and_crop(image)

        # Extract embedding from uploaded image
        query_embedding = extract_embedding(image)
        if not query_embedding:
            logger.warning("Recognition model unavailable or failed to produce embedding")
            return RecognizeResponse(status="unavailable", confidence=0.0)

        # Load reference index / embeddings
        idx = _load_index()
        if not idx:
            logger.error("No reference embeddings available")
            return RecognizeResponse(status="unknown", confidence=0.0)

        # Search (FAISS or brute-force)
        if FAISS_AVAILABLE and isinstance(idx, FaissIndex):
            if idx.ntotal == 0:
                logger.error("Empty FAISS index")
                return RecognizeResponse(status="unknown", confidence=0.0)
            results = idx.search(query_embedding, top_k=5)
            similarities = [
                {"cat_id": cid, "cat_name": _id_to_name.get(cid), "confidence": conf}
                for cid, conf in results
            ]
        else:
            # Brute-force: iterate all cats, take max similarity per cat
            similarities = []
            for cat_name, cat_data in idx.items():
                cat_id = cat_data.get("cat_id")
                if cat_id is None or not cat_data.get("embeddings"):
                    continue
                best_sim = max(
                    cosine_similarity(query_embedding, ref_emb)
                    for ref_emb in cat_data["embeddings"]
                )
                similarities.append({
                    "cat_id": cat_id,
                    "cat_name": cat_name,
                    "confidence": best_sim,
                })
            similarities.sort(key=lambda x: x["confidence"], reverse=True)

        if not similarities:
            return RecognizeResponse(status="unknown", confidence=0.0)

        best = similarities[0]
        best_confidence = best["confidence"]

        if best_confidence >= THRESHOLD_CONFIRMED:
            return RecognizeResponse(
                status="confirmed",
                cat_id=best["cat_id"],
                cat_name=best["cat_name"],
                confidence=best_confidence,
            )
        elif best_confidence >= THRESHOLD_UNCERTAIN:
            candidates = [
                RecognizeCandidate(
                    cat_id=s["cat_id"],
                    cat_name=s["cat_name"],
                    confidence=s["confidence"],
                )
                for s in similarities[:3]
            ]
            return RecognizeResponse(
                status="uncertain",
                confidence=best_confidence,
                candidates=candidates,
            )
        else:
            return RecognizeResponse(status="unknown", confidence=best_confidence)

    except Exception as e:
        logger.error("Recognition failed: %s", e)
        return RecognizeResponse(status="unknown", confidence=0.0)
