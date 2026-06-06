"""DINOv2-style ViT model loader for cat recognition.

The checkpoint uses a Vision Transformer with:
- 768-dim embeddings, 12 transformer blocks
- 16x16 patch embedding
- 4 register tokens (DINOv2-style)
- LayerScale (gamma_1, gamma_2) in each block
- Embedding head: 768 -> 256 dimensions
"""

import os
import logging
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image

logger = logging.getLogger(__name__)

# ─── Model Architecture ───────────────────────────────────────────────

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
        qkv = self.qkv(x).reshape(B, N, 3, self.num_heads, self.head_dim).permute(2, 0, 3, 1, 4)
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

        # LayerScale parameters (initialized to 1.0 in the checkpoint)
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

        # Patch embedding
        self.patch_embed = nn.Conv2d(in_chans, embed_dim, kernel_size=patch_size, stride=patch_size)

        # Learnable tokens
        self.cls_token = nn.Parameter(torch.zeros(1, 1, embed_dim))
        self.reg_token = nn.Parameter(torch.zeros(1, num_register_tokens, embed_dim))

        # Transformer blocks
        self.blocks = nn.ModuleList([
            Block(embed_dim, num_heads, mlp_ratio) for _ in range(depth)
        ])

        # Final layer norm
        self.norm = nn.LayerNorm(embed_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B = x.shape[0]

        # Patch embedding: [B, 3, H, W] -> [B, num_patches, embed_dim]
        x = self.patch_embed(x)  # [B, embed_dim, H/P, W/P]
        x = x.flatten(2).transpose(1, 2)  # [B, num_patches, embed_dim]

        # Prepend CLS and register tokens
        cls_tokens = self.cls_token.expand(B, -1, -1)
        reg_tokens = self.reg_token.expand(B, -1, -1)
        x = torch.cat([cls_tokens, reg_tokens, x], dim=1)

        # Transformer blocks
        for block in self.blocks:
            x = block(x)

        # Final norm, return CLS token
        x = self.norm(x)
        return x[:, 0]  # CLS token: [B, embed_dim]


class CatRecognitionModel(nn.Module):
    """Full cat recognition model: ViT backbone + embedding head."""

    def __init__(self, embed_dim: int = 768, out_dim: int = 256):
        super().__init__()
        self.backbone = VisionTransformer()
        self.emb_head = nn.Linear(embed_dim, out_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Extract 256-dim feature embedding from image."""
        features = self.backbone(x)  # [B, 768]
        embeddings = self.emb_head(features)  # [B, 256]
        # L2 normalize for cosine similarity
        embeddings = F.normalize(embeddings, p=2, dim=1)
        return embeddings


# ─── Image Preprocessing ──────────────────────────────────────────────

# ImageNet normalization constants
_MEAN = [0.485, 0.456, 0.406]
_STD = [0.229, 0.224, 0.225]


def preprocess_image(image: Image.Image) -> torch.Tensor:
    """Preprocess PIL image for ViT inference (without torchvision).

    Steps: Resize(256, bicubic) -> CenterCrop(224) -> ToTensor -> Normalize(ImageNet)
    Returns: [1, 3, 224, 224] tensor
    """
    # Resize to 256 (shortest side), bicubic interpolation
    w, h = image.size
    scale = 256 / min(w, h)
    new_w, new_h = int(w * scale), int(h * scale)
    image = image.resize((new_w, new_h), Image.BICUBIC)

    # Center crop 224x224
    left = (new_w - 224) // 2
    top = (new_h - 224) // 2
    image = image.crop((left, top, left + 224, top + 224))

    # To tensor [0, 1] and normalize
    arr = np.array(image).astype(np.float32) / 255.0  # [224, 224, 3]
    arr = arr.transpose(2, 0, 1)  # [3, 224, 224]

    mean = np.array(_MEAN, dtype=np.float32).reshape(3, 1, 1)
    std = np.array(_STD, dtype=np.float32).reshape(3, 1, 1)
    arr = (arr - mean) / std

    tensor = torch.from_numpy(arr).unsqueeze(0)  # [1, 3, 224, 224]
    return tensor


# ─── Singleton Loader ─────────────────────────────────────────────────

_model: Optional[CatRecognitionModel] = None

MODEL_DIR = Path(__file__).parent.parent.parent / "models"
MODEL_PATH = MODEL_DIR / "finetuned_best.pt"


def load_model() -> CatRecognitionModel:
    """Load the cat recognition model (singleton)."""
    global _model

    if _model is not None:
        return _model

    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")

    logger.info("Loading cat recognition model from %s ...", MODEL_PATH)
    checkpoint = torch.load(str(MODEL_PATH), map_location="cpu", weights_only=False)

    model = CatRecognitionModel()

    # The checkpoint is a raw state_dict with "backbone.model.*" and "emb_head.*" keys.
    # Our model uses "backbone.*" (without "model." prefix).
    # We need to remap the keys.
    new_state_dict = {}
    for k, v in checkpoint.items():
        new_key = k
        # Remove "model." from backbone paths
        if new_key.startswith("backbone.model."):
            new_key = "backbone." + new_key[len("backbone.model."):]
        # checkpoint has "patch_embed.proj.*", our model has "patch_embed.*" (Conv2d)
        if "patch_embed.proj." in new_key:
            new_key = new_key.replace("patch_embed.proj.", "patch_embed.")
        # checkpoint has "emb_head.proj.*", our model has "emb_head.*" (Linear)
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


@torch.no_grad()
def extract_embedding(image: Image.Image) -> list[float]:
    """Extract 256-dim feature embedding from a PIL image.

    Returns a list of 256 floats (L2-normalized).
    """
    model = load_model()

    # Preprocess
    tensor = preprocess_image(image)  # [1, 3, 224, 224]

    # Inference
    embedding = model(tensor)  # [1, 256]

    return embedding.squeeze(0).cpu().tolist()


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two embedding vectors."""
    ta = torch.tensor(a)
    tb = torch.tensor(b)
    return F.cosine_similarity(ta.unsqueeze(0), tb.unsqueeze(0)).item()
