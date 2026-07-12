"""FAISS index wrapper for cat ReID. Uses inner-product (cosine) search.

All vectors are assumed L2-normalized so inner-product equals cosine similarity.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

import faiss
import numpy as np

logger = logging.getLogger(__name__)

_INDEX_DIR = Path(__file__).parent.parent.parent / "embeddings"
_INDEX_PATH = _INDEX_DIR / "faiss_index.npz"


class FaissIndex:
    """Manages a FAISS inner-product index for cat embedding search.

    Each reference image is a separate vector entry. Multiple images of the
    same cat share the same cat_id. Search returns per-cat scores by taking
    the max similarity across all reference images of each cat.
    """

    def __init__(self, dim: int = 256):
        self.dim = dim
        self.index: Optional[faiss.IndexFlatIP] = None
        self.cat_ids: list[int] = []
        self._vector_list: list[np.ndarray] = []

    # -- build / search --------------------------------------------------

    def build(self) -> None:
        """Build the FAISS index from accumulated vectors."""
        if self._vector_list:
            vecs = np.vstack(self._vector_list).astype(np.float32)
        else:
            vecs = np.zeros((0, self.dim), dtype=np.float32)
        self._vector_list.clear()
        self.index = faiss.IndexFlatIP(self.dim)
        if vecs.shape[0] > 0:
            self.index.add(vecs)

    def add(self, cat_id: int, vector: list[float]) -> None:
        """Add a single reference vector with its cat_id."""
        v = np.array(vector, dtype=np.float32).reshape(1, -1)
        if v.shape[1] != self.dim:
            raise ValueError(f"Vector dim {v.shape[1]} != index dim {self.dim}")
        self.cat_ids.append(cat_id)
        self._vector_list.append(v)
        if self.index is not None:
            self.index.add(v)

    def search(self, query: list[float], top_k: int = 5) -> list[tuple[int, float]]:
        """Search for the top-k unique cats by max similarity.

        Returns a list of (cat_id, confidence) sorted highest first.
        Falls back to brute-force if the FAISS index hasn't been built.
        """
        q = np.array(query, dtype=np.float32).reshape(1, -1)

        if self.index is not None and self.index.ntotal > 0:
            # Search all vectors, then deduplicate by max score per cat
            scores, indices = self.index.search(q, self.index.ntotal)
            return self._deduplicate(scores[0], indices[0], top_k)

        # Fallback brute-force
        if not self._vector_list:
            return []

        vecs = np.vstack(self._vector_list).astype(np.float32)
        sims = (vecs @ q.T).squeeze(1)
        order = np.argsort(-sims)
        return self._deduplicate(sims, order, top_k)

    @property
    def ntotal(self) -> int:
        if self.index is not None:
            return self.index.ntotal
        return len(self._vector_list)

    # -- persistence -----------------------------------------------------

    def save(self, path: Optional[Path] = None) -> None:
        """Save index vectors and cat_ids to disk."""
        p = path or _INDEX_PATH
        p.parent.mkdir(parents=True, exist_ok=True)

        if self._vector_list:
            vecs = np.vstack(self._vector_list).astype(np.float32)
        elif self.index is not None:
            vecs = self._get_all_vectors()
        else:
            vecs = np.zeros((0, self.dim), dtype=np.float32)

        np.savez(p, cat_ids=np.array(self.cat_ids, dtype=np.int32), vectors=vecs)
        logger.info("FAISS index saved to %s (%d vectors, %d unique cats)",
                     p, vecs.shape[0], len(set(self.cat_ids)))

    def load(self, path: Optional[Path] = None) -> bool:
        """Load index from disk. Returns True on success."""
        p = path or _INDEX_PATH
        if not p.exists():
            return False

        try:
            data = np.load(p, allow_pickle=False)
            self.cat_ids = data["cat_ids"].tolist()
            vecs = data["vectors"]

            if vecs.ndim != 2 or vecs.shape[1] != self.dim:
                logger.warning("Index dim mismatch (%d != %d), discarding", vecs.shape[1], self.dim)
                self.cat_ids = []
                self._vector_list = []
                return False

            self._vector_list = [vecs[i:i + 1] for i in range(vecs.shape[0])]
            self.build()
            logger.info("FAISS index loaded: %d vectors, %d unique cats",
                        self.ntotal, len(set(self.cat_ids)))
            return True
        except Exception:
            logger.exception("Failed to load FAISS index")
            return False

    # -- helpers ---------------------------------------------------------

    def _deduplicate(
        self, scores: np.ndarray, indices: np.ndarray, top_k: int
    ) -> list[tuple[int, float]]:
        """Deduplicate by cat_id, keeping max score per cat."""
        cat_best: dict[int, float] = {}
        for score, idx in zip(scores, indices):
            if idx < 0 or idx >= len(self.cat_ids):
                continue
            cid = self.cat_ids[idx]
            s = float(score)
            if cid not in cat_best or s > cat_best[cid]:
                cat_best[cid] = s

        # Sort by score descending
        sorted_cats = sorted(cat_best.items(), key=lambda x: x[1], reverse=True)
        return sorted_cats[:top_k]

    def _get_all_vectors(self) -> np.ndarray:
        """Extract all vectors from the FAISS index."""
        if self.index is None or self.index.ntotal == 0:
            return np.zeros((0, self.dim), dtype=np.float32)
        return self.index.reconstruct_n(0, self.index.ntotal).reshape(self.index.ntotal, self.dim)
