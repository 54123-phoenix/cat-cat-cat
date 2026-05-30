from dataclasses import dataclass
from typing import Optional

from app.schemas import RecognizeCandidate, RecognizeResponse


@dataclass
class DiscoveryAIReview:
    ai_status: str
    ai_confidence: float
    ai_summary: str
    suggested_name: str
    suggested_color: str


def recognize_cat_image(filename: str, image_path: Optional[str] = None) -> RecognizeResponse:
    """Swappable cat recognition adapter.

    Current implementation is deterministic mock behavior for demos. Replace this
    function with YOLO/CLIP/FAISS or a remote model service without changing API
    or business workflow code.
    """
    normalized = (filename or image_path or "").lower()

    if "unknown" in normalized:
        return RecognizeResponse(status="unknown", confidence=0.32)

    if "uncertain" in normalized:
        return RecognizeResponse(
            status="uncertain",
            confidence=0.68,
            candidates=[
                RecognizeCandidate(cat_id=1, cat_name="小白", confidence=0.68),
                RecognizeCandidate(cat_id=2, cat_name="橘子", confidence=0.61),
                RecognizeCandidate(cat_id=3, cat_name="黑咪", confidence=0.55),
            ],
        )

    return RecognizeResponse(status="confirmed", cat_id=1, cat_name="小白", confidence=0.92)


def review_new_cat_discovery(image_path: Optional[str], note: Optional[str]) -> DiscoveryAIReview:
    """Swappable AI-assisted new-cat review adapter.

    This is an initial AI screening step only. Human admin review remains the
    source of truth for creating or rejecting cat records.
    """
    text = note or ""
    color = "橘白" if "橘" in text else "待确认"
    return DiscoveryAIReview(
        ai_status="needs_review",
        ai_confidence=0.72,
        ai_summary="AI 初审：疑似未入库校园猫，建议猫协结合地点与照片复核。",
        suggested_name="新朋友",
        suggested_color=color,
    )
