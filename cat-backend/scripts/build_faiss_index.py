"""Rebuild FAISS index from existing cat_embeddings.json.

Usage:
    python scripts/build_faiss_index.py
"""
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.services.faiss_index import FaissIndex  # noqa: E402

EMBEDDINGS_JSON = BACKEND_DIR / "embeddings" / "cat_embeddings.json"


def main() -> int:
    if not EMBEDDINGS_JSON.exists():
        print(f"[ERROR] {EMBEDDINGS_JSON} not found")
        return 1

    with open(EMBEDDINGS_JSON) as f:
        data = json.load(f)

    idx = FaissIndex(dim=256)
    for cat_name, cat_data in data.items():
        cat_id = cat_data.get("cat_id")
        if cat_id is None:
            print(f"  [SKIP] {cat_name}: no cat_id")
            continue
        for emb in cat_data["embeddings"]:
            idx.add(cat_id, emb)

    idx.build()
    idx.save()
    print(f"Done: {idx.ntotal} vectors, {len(set(idx.cat_ids))} unique cats")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
