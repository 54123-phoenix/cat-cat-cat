"""DINOv3 ViT model loader for cat recognition.

Uses official Meta dinov3 vit_base_patch16_dinov3 model.
If torch is not installed, recognition gracefully degrades to unknown status.
"""

import logging
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    try:
        import timm
        TIMM_AVAILABLE = True
    except ImportError:
        TIMM_AVAILABLE = False
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    TIMM_AVAILABLE = False
    nn = None
    F = None

logger = logging.getLogger(__name__)

# ─── Image Preprocessing ──────────────────────────────────────────────

# ImageNet normalization constants
_MEAN = [0.485, 0.456, 0.406]
_STD = [0.229, 0.224, 0.225]


def preprocess_image(image: Image.Image):
    """Preprocess PIL image for ViT inference.
    
    Returns: [1, 3, 224, 224] tensor or None if torch unavailable.
    """
    if not TORCH_AVAILABLE:
        return None

    w, h = image.size
    scale = 256 / min(w, h)
    new_w, new_h = int(w * scale), int(h * scale)
    image = image.resize((new_w, new_h), Image.BICUBIC)

    left = (new_w - 224) // 2
    top = (new_h - 224) // 2
    image = image.crop((left, top, left + 224, top + 224))

    arr = np.array(image).astype(np.float32) / 255.0
    arr = arr.transpose(2, 0, 1)

    mean = np.array(_MEAN, dtype=np.float32).reshape(3, 1, 1)
    std = np.array(_STD, dtype=np.float32).reshape(3, 1, 1)
    arr = (arr - mean) / std

    tensor = torch.from_numpy(arr).unsqueeze(0)
    return tensor


# ─── Model Wrapper (DINOv3 + Linear Projection) ───────────────────────

if TORCH_AVAILABLE and nn is not None:
    class _LinearHead(nn.Module):
        """Single Linear + L2-norm — aligned with training code state-dict keys."""
        def __init__(self, in_dim, out_dim):
            super().__init__()
            self.proj = nn.Linear(in_dim, out_dim)

        def forward(self, x):
            return F.normalize(self.proj(x), p=2, dim=1)

    class _BackboneWrapper(nn.Module):
        """Wraps timm DINOv3 ViT to match training-code state-dict keys.

        The training code's build_backbone() nests the ViT under ``self.model``,
        producing checkpoint keys like ``backbone.model.cls_token``.

        Forward returns only the CLS token (shape [B, 768]) — same behaviour
        as the training backbone.
        """

        def __init__(self, vit_model):
            super().__init__()
            self.model = vit_model

        def forward(self, x):
            features = self.model.forward_features(x)  # [B, N+1, 768]
            return features[:, 0, :]                    # [B, 768] — CLS token

    class DINOv3WithProjection(nn.Module):
        """DINOv3 backbone with 768->256 embedding head.

        State-dict keys match the training code:
          backbone.model.*    — DINOv3 ViT (nested via _BackboneWrapper)
          emb_head.proj.*     — projection layer
        """

        def __init__(self, dinov3_model):
            super().__init__()
            self.backbone = _BackboneWrapper(dinov3_model)
            self.emb_head = _LinearHead(768, 256)

        def forward(self, x):
            # _BackboneWrapper extracts CLS token [B, 768]
            cls_token = self.backbone(x)
            # Project to 256 dimensions (L2-normalized by _LinearHead)
            return self.emb_head(cls_token)  # [batch, 256]

        def forward_features(self, x):
            """Forward pass to get raw features (before CLS extraction)."""
            return self.backbone.model.forward_features(x)


# ─── Singleton Model Loader ──────────────────────────────────────────

_model: Optional = None

MODEL_DIR = Path(__file__).parent.parent.parent / "models"
MODEL_PATH = MODEL_DIR / "finetuned_best.pt"


def load_model() -> Optional:
    """Load dinov3 (vit_base_patch16_dinov3) model with optional finetuned weights.
    
    Returns None if torch/timm unavailable.
    """
    global _model

    if not TORCH_AVAILABLE or not TIMM_AVAILABLE:
        logger.warning("torch or timm not available")
        return None

    if _model is not None:
        return _model

    try:
        # Load official dinov3 model
        logger.info("Loading official dinov3 (vit_base_patch16_dinov3) model...")
        backbone = timm.create_model('vit_base_patch16_dinov3', pretrained=False)
        backbone.eval()

        # Wrap with projection head (768 -> 256)
        model = DINOv3WithProjection(backbone)
        model.eval()

        # Load finetuned weights if available
        if MODEL_PATH.exists():
            try:
                logger.info("Loading finetuned weights from %s ...", MODEL_PATH)
                checkpoint = torch.load(str(MODEL_PATH), map_location="cpu", weights_only=False)

                # Handle both direct state dict and checkpoint wrapper
                if isinstance(checkpoint, dict) and 'state_dict' in checkpoint:
                    state_dict = checkpoint['state_dict']
                elif isinstance(checkpoint, dict) and 'model' in checkpoint:
                    state_dict = checkpoint['model']
                else:
                    state_dict = checkpoint

                # Remove any 'module.' prefix (from DataParallel)
                if all(k.startswith('module.') for k in state_dict.keys()):
                    state_dict = {k.replace('module.', ''): v for k, v in state_dict.items()}

                # Load into wrapped model
                missing, unexpected = model.load_state_dict(state_dict, strict=False)
                if missing:
                    logger.warning("Missing keys in checkpoint: %d keys", len(missing))
                if unexpected:
                    logger.warning("Unexpected keys in checkpoint: %d keys", len(unexpected))

                logger.info("Finetuned weights loaded successfully (including projection head)")
            except Exception as e:
                logger.warning("Failed to load finetuned weights (%s), using model with random projection", e)
        else:
            logger.warning("Checkpoint not found at %s, using model with random weights", MODEL_PATH)

        _model = model
        logger.info("Model ready for inference (DINOv3 + 768->256 projection)")
        return _model

    except Exception as e:
        logger.error("Failed to load model: %s", e)
        return None


def extract_embedding(image: Image.Image) -> list[float]:
    """Extract embedding from image using dinov3 + projection head.
    
    Returns a normalized 256-dim embedding vector from the projection head.
    Returns empty list if torch unavailable.
    """
    if not TORCH_AVAILABLE or not TIMM_AVAILABLE:
        return []

    model = load_model()
    if model is None:
        return []

    try:
        tensor = preprocess_image(image)
        if tensor is None:
            return []
            
        with torch.no_grad():
            # Forward pass through dinov3 backbone + embedding head
            # _LinearHead already applies L2-normalization internally
            embedding = model(tensor)  # [1, 256], L2-normalized

            return embedding.squeeze(0).cpu().tolist()
    except Exception as e:
        logger.error("Failed to extract embedding: %s", e)
        return []


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two embedding vectors.
    
    Returns 0 if torch unavailable.
    """
    if not TORCH_AVAILABLE:
        return 0.0
    
    try:
        ta = torch.tensor(a)
        tb = torch.tensor(b)
        return F.cosine_similarity(ta.unsqueeze(0), tb.unsqueeze(0)).item()
    except Exception as e:
        logger.error("Failed to compute cosine similarity: %s", e)
        return 0.0
