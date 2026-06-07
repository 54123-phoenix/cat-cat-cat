"""DINOv2-style ViT model loader for cat recognition (optional dependency).

If torch is not installed, recognition gracefully degrades to unknown status.
"""

import os
import logging
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image

try:
    import torch
    import torch.nn as nn
    import torch.nn.functional as F
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    nn = None
    F = None

logger = logging.getLogger(__name__)

# ─── Model Architecture (only defined when torch is available) ─────────

if TORCH_AVAILABLE:

    class Attention(nn.Module):
        """Multi-head self-attention with LayerScale."""

        def __init__(self, dim: int, num_heads: int = 12):
            super().__init__()
            self.num_heads = num_heads
            self.head_dim = dim // num_heads
            self.scale = self.head_dim ** -0.5

            self.qkv = nn.Linear(dim, dim * 3, bias=False)
            self.proj = nn.Linear(dim, dim)

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            B, N, C = x.shape
            qkv = self.qkv(x).reshape(B, N, 3, self.num_heads, self.head_dim).permute(2, 0, 3, 1, 2)
            q, k, v = qkv.unbind(0)

            attn = (q @ k.transpose(-2, -1)) * self.scale
            attn = attn.softmax(dim=-1)

            x = (attn @ v).transpose(1, 2).reshape(B, N, C)
            x = self.proj(x)
            return x


    class MLP(nn.Module):
        """MLP block with GELU activation."""

        def __init__(self, dim: int, mlp_ratio: float = 4.0):
            super().__init__()
            hidden_dim = int(dim * mlp_ratio)
            self.fc1 = nn.Linear(dim, hidden_dim)
            self.fc2 = nn.Linear(hidden_dim, dim)

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            x = self.fc1(x)
            x = F.gelu(x)
            x = self.fc2(x)
            return x


    class Block(nn.Module):
        """Transformer block with LayerScale."""

        def __init__(self, dim: int, num_heads: int = 12, mlp_ratio: float = 4.0):
            super().__init__()
            self.norm1 = nn.LayerNorm(dim)
            self.attn = Attention(dim, num_heads)
            self.norm2 = nn.LayerNorm(dim)
            self.mlp = MLP(dim, mlp_ratio)

            self.gamma_1 = nn.Parameter(torch.ones(dim))
            self.gamma_2 = nn.Parameter(torch.ones(dim))

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            x = x + self.gamma_1 * self.attn(self.norm1(x))
            x = x + self.gamma_2 * self.mlp(self.norm2(x))
            return x


    class VisionTransformer(nn.Module):
        """DINOv2-style ViT with register tokens."""

        def __init__(
            self,
            img_size: int = 224,
            patch_size: int = 16,
            in_chans: int = 3,
            embed_dim: int = 768,
            depth: int = 12,
            num_heads: int = 12,
            mlp_ratio: float = 4.0,
            num_register_tokens: int = 4,
        ):
            super().__init__()
            self.embed_dim = embed_dim
            self.patch_size = patch_size
            self.num_patches = (img_size // patch_size) ** 2

            self.patch_embed = nn.Conv2d(in_chans, embed_dim, kernel_size=patch_size, stride=patch_size)

            self.cls_token = nn.Parameter(torch.zeros(1, 1, embed_dim))
            self.reg_token = nn.Parameter(torch.zeros(1, num_register_tokens, embed_dim))

            self.blocks = nn.ModuleList([
                Block(embed_dim, num_heads, mlp_ratio) for _ in range(depth)
            ])

            self.norm = nn.LayerNorm(embed_dim)

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            B = x.shape[0]

            x = self.patch_embed(x)
            x = x.flatten(2).transpose(1, 2)

            cls_tokens = self.cls_token.expand(B, -1, -1)
            reg_tokens = self.reg_token.expand(B, -1, -1)
            x = torch.cat([cls_tokens, reg_tokens, x], dim=1)

            for block in self.blocks:
                x = block(x)

            x = self.norm(x)
            return x[:, 0]


    class CatRecognitionModel(nn.Module):
        """Full cat recognition model: ViT backbone + embedding head."""

        def __init__(self, embed_dim: int = 768, out_dim: int = 256):
            super().__init__()
            self.backbone = VisionTransformer()
            self.emb_head = nn.Linear(embed_dim, out_dim)

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            features = self.backbone(x)
            embeddings = self.emb_head(features)
            embeddings = F.normalize(embeddings, p=2, dim=1)
            return embeddings


# ─── Image Preprocessing ──────────────────────────────────────────────

# ImageNet normalization constants
_MEAN = [0.485, 0.456, 0.406]
_STD = [0.229, 0.224, 0.225]


def preprocess_image(image: Image.Image):
    """Preprocess PIL image for ViT inference (without torchvision).

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


# ─── Singleton Loader ─────────────────────────────────────────────────

_model: Optional = None

MODEL_DIR = Path(__file__).parent.parent.parent / "models"
MODEL_PATH = MODEL_DIR / "finetuned_best.pt"


def load_model() -> Optional:
    """Load the cat recognition model (singleton). Returns None if torch unavailable."""
    global _model

    if not TORCH_AVAILABLE:
        return None

    if _model is not None:
        return _model

    if not MODEL_PATH.exists():
        logger.warning("Model file not found: %s", MODEL_PATH)
        return None

    logger.info("Loading cat recognition model from %s ...", MODEL_PATH)
    checkpoint = torch.load(str(MODEL_PATH), map_location="cpu", weights_only=False)

    model = CatRecognitionModel()

    new_state_dict = {}
    for k, v in checkpoint.items():
        new_key = k
        if new_key.startswith("backbone.model."):
            new_key = "backbone." + new_key[len("backbone.model."):]
        if "patch_embed.proj." in new_key:
            new_key = new_key.replace("patch_embed.proj.", "patch_embed.")
        if "emb_head.proj." in new_key:
            new_key = new_key.replace("emb_head.proj.", "emb_head.")
        new_state_dict[new_key] = v

    missing, unexpected = model.load_state_dict(new_state_dict, strict=False)
    if missing:
        logger.warning("Missing keys: %s", missing)
    if unexpected:
        logger.warning("Unexpected keys: %s", unexpected)

    model.eval()
    _model = model
    logger.info("Model loaded successfully.")
    return _model


def extract_embedding(image: Image.Image) -> list[float]:
    """Extract 256-dim feature embedding. Returns empty list if torch unavailable."""
    if not TORCH_AVAILABLE:
        return []

    model = load_model()
    if model is None:
        return []

    tensor = preprocess_image(image)
    with torch.no_grad():
        embedding = model(tensor)
    return embedding.squeeze(0).cpu().tolist()


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity. Returns 0 if torch unavailable."""
    if not TORCH_AVAILABLE:
        return 0.0
    ta = torch.tensor(a)
    tb = torch.tensor(b)
    return F.cosine_similarity(ta.unsqueeze(0), tb.unsqueeze(0)).item()
