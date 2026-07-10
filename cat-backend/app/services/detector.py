"""YOLOv8m cat detector — crops cat from image before recognition."""

import logging
from pathlib import Path
from typing import Optional

from PIL import Image

logger = logging.getLogger(__name__)

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    YOLO = None

# COCO class id for "cat"
_CAT_CLASS_ID = 15

_MODEL_DIR = Path(__file__).parent.parent.parent / "models"
_MODEL_PATH = _MODEL_DIR / "yolov8m.pt"

_model: Optional = None


def _load_model():
    """Load YOLOv8m singleton (local file first, auto-download fallback)."""
    global _model
    if not YOLO_AVAILABLE:
        return None
    if _model is None:
        model_path = str(_MODEL_PATH) if _MODEL_PATH.exists() else "yolov8m.pt"
        logger.info("Loading YOLOv8m from %s ...", model_path)
        _model = YOLO(model_path)
        logger.info("YOLOv8m loaded")
    return _model


def detect_and_crop(image: Image.Image, margin: float = 0.1) -> Image.Image:
    """Detect cat in image and crop to the best detection.

    If no cat is detected or YOLO is unavailable, returns the original image.

    Args:
        image: PIL RGB image.
        margin: Fraction to expand the bounding box (0.1 = 10% on each side).

    Returns:
        Cropped PIL image (or original if no cat detected).
    """
    model = _load_model()
    if model is None:
        return image

    try:
        results = model(image, verbose=False)
    except Exception as e:
        logger.warning("YOLO inference failed: %s", e)
        return image

    if not results or len(results) == 0:
        return image

    result = results[0]
    if result.boxes is None or len(result.boxes) == 0:
        return image

    # Find all cat detections
    cat_boxes = []
    for box in result.boxes:
        cls_id = int(box.cls[0])
        conf = float(box.conf[0])
        if cls_id == _CAT_CLASS_ID and conf > 0.3:
            cat_boxes.append((conf, box.xyxy[0].tolist()))

    if not cat_boxes:
        logger.info("No cat detected in image")
        return image

    # Pick highest-confidence cat
    cat_boxes.sort(key=lambda x: x[0], reverse=True)
    _, bbox = cat_boxes[0]
    x1, y1, x2, y2 = bbox

    # Expand bounding box with margin
    w, h = image.size
    bw, bh = x2 - x1, y2 - y1
    x1 = max(0, int(x1 - bw * margin))
    y1 = max(0, int(y1 - bh * margin))
    x2 = min(w, int(x2 + bw * margin))
    y2 = min(h, int(y2 + bh * margin))

    logger.info("Cat detected at [%d, %d, %d, %d], cropping", x1, y1, x2, y2)
    return image.crop((x1, y1, x2, y2))
