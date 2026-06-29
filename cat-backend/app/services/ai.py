from typing import Optional
import io
import json
import logging
from pathlib import Path

from PIL import Image

from app.schemas import RecognizeCandidate, RecognizeResponse
from app.services.model_loader import extract_embedding, cosine_similarity, TORCH_AVAILABLE
from app.database import SessionLocal
from app import models
from app.config import settings

logger = logging.getLogger(__name__)

# ─── Reference Embeddings ─────────────────────────────────────────────

_EMBEDDINGS_DIR = Path(__file__).parent.parent.parent / "embeddings"
_reference_embeddings: Optional[dict] = None


def _load_reference_embeddings() -> dict:
    """Load pre-computed reference embeddings for all cats (singleton)."""
    global _reference_embeddings

    if _reference_embeddings is not None:
        return _reference_embeddings

    embeddings_file = _EMBEDDINGS_DIR / "cat_embeddings.json"
    if not embeddings_file.exists():
        logger.warning("Reference embeddings not found: %s", embeddings_file)
        return {}

    with open(embeddings_file, "r") as f:
        data = json.load(f)

    # Resolve cat_id from database
    db = SessionLocal()
    try:
        for cat_name, cat_data in data.items():
            cat = db.query(models.Cat).filter(models.Cat.name == cat_name).first()
            if cat:
                cat_data["cat_id"] = cat.id
            else:
                logger.warning("Cat not found in database: %s", cat_name)
                cat_data["cat_id"] = None
    finally:
        db.close()

    _reference_embeddings = data
    logger.info("Loaded reference embeddings for %d cats", len(_reference_embeddings))
    return _reference_embeddings


# ─── Recognition Logic ────────────────────────────────────────────────

def recognize_cat_image(image_bytes: bytes, filename: str = "") -> RecognizeResponse:
    if not TORCH_AVAILABLE:
        return RecognizeResponse(status="unavailable", confidence=0.0)

    THRESHOLD_CONFIRMED = settings.RECOGNIZE_THRESHOLD_CONFIRMED
    THRESHOLD_UNCERTAIN = settings.RECOGNIZE_THRESHOLD_UNCERTAIN
    """Recognize a cat from image bytes using DINOv2 embeddings.

    Compares the uploaded image against pre-computed reference embeddings
    for all known cats.
    """
    try:
        # Load and preprocess image
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        # Extract embedding from uploaded image
        query_embedding = extract_embedding(image)
        if not query_embedding:
            logger.warning("Recognition model unavailable or failed to produce embedding")
            return RecognizeResponse(status="unavailable", confidence=0.0)

        # Load reference embeddings
        references = _load_reference_embeddings()
        if not references:
            logger.error("No reference embeddings available")
            return RecognizeResponse(status="unknown", confidence=0.0)

        # Compare with all references
        similarities = []
        for cat_name, cat_data in references.items():
            cat_id = cat_data["cat_id"]
            ref_embeddings = cat_data["embeddings"]  # List of embeddings

            # Average similarity across all reference images for this cat
            sims = [cosine_similarity(query_embedding, ref_emb) for ref_emb in ref_embeddings]
            avg_sim = sum(sims) / len(sims)

            similarities.append({
                "cat_id": cat_id,
                "cat_name": cat_name,
                "confidence": avg_sim,
            })

        # Sort by confidence (highest first)
        similarities.sort(key=lambda x: x["confidence"], reverse=True)

        if not similarities:
            return RecognizeResponse(status="unknown", confidence=0.0)

        best = similarities[0]
        best_confidence = best["confidence"]

        # Determine status based on thresholds
        if best_confidence >= THRESHOLD_CONFIRMED:
            return RecognizeResponse(
                status="confirmed",
                cat_id=best["cat_id"],
                cat_name=best["cat_name"],
                confidence=best_confidence,
            )
        elif best_confidence >= THRESHOLD_UNCERTAIN:
            # Return top 3 candidates
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
