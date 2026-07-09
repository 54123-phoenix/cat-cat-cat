"""Download model & data assets from Hugging Face.

Usage:
    python scripts/download_assets.py

Requires: pip install huggingface_hub requests tqdm
"""

import os
import sys
import tarfile
import tempfile
from pathlib import Path

import requests
from tqdm import tqdm

# ─── Config ───────────────────────────────────────────────────────────

HF_TOKEN = os.environ.get("HF_TOKEN", "")
MODEL_REPO = "echophoenix/cat-cat-model"
DATA_REPO = "echophoenix/cat-cat-data"

BACKEND_DIR = Path(__file__).parent.parent / "cat-backend"
MODEL_DIR = BACKEND_DIR / "models"
UPLOADS_DIR = BACKEND_DIR / "uploads"


# ─── Helpers ──────────────────────────────────────────────────────────


def _headers() -> dict:
    if HF_TOKEN:
        return {"Authorization": f"Bearer {HF_TOKEN}"}
    return {}


def download_file(url: str, dest: Path, desc: str = "") -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)

    resp = requests.get(url, stream=True, headers=_headers())
    resp.raise_for_status()

    total = int(resp.headers.get("content-length", 0))
    chunk_size = 8 * 1024 * 1024  # 8 MB

    with tqdm(total=total, unit="B", unit_scale=True, desc=desc) as pbar:
        with open(dest, "wb") as f:
            for chunk in resp.iter_content(chunk_size=chunk_size):
                f.write(chunk)
                pbar.update(len(chunk))


# ─── Download Tasks ───────────────────────────────────────────────────


def download_model() -> Path:
    """Download finetuned_best.pt → cat-backend/models/"""
    dest = MODEL_DIR / "finetuned_best.pt"
    if dest.exists() and dest.stat().st_size > 300_000_000:
        print(f"[✓] Model already exists ({dest.stat().st_size // 1024 // 1024} MB)")
        return dest

    url = f"https://huggingface.co/{MODEL_REPO}/resolve/main/finetuned_best.pt"
    print(f"[~] Downloading model (343 MB) ...")
    download_file(url, dest, desc="Model")
    print(f"[✓] Model saved to {dest}")
    return dest


def download_data() -> Path:
    """Download & extract cat images archive → cat-backend/uploads/"""
    # check if already populated
    cat_count = len(list(UPLOADS_DIR.glob("cats/*.jpg"))) if UPLOADS_DIR.exists() else 0
    if cat_count > 50:
        print(f"[✓] Data already exists ({cat_count} cat images)")
        return UPLOADS_DIR

    url = f"https://huggingface.co/datasets/{DATA_REPO}/resolve/main/cat-cat-uploads.tar.gz"
    print(f"[~] Downloading & extracting data archive (8.7 GB) ...")

    with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
        tmp_path = tmp.name
        resp = requests.get(url, stream=True, headers=_headers())
        resp.raise_for_status()
        total = int(resp.headers.get("content-length", 0))
        chunk_size = 8 * 1024 * 1024

        with tqdm(total=total, unit="B", unit_scale=True, desc="Data") as pbar:
            for chunk in resp.iter_content(chunk_size=chunk_size):
                tmp.write(chunk)
                pbar.update(len(chunk))

    print("[~] Extracting archive ...")
    with tarfile.open(tmp_path, "r:gz") as tar:
        tar.extractall(path=BACKEND_DIR)

    os.unlink(tmp_path)
    cat_count = len(list(UPLOADS_DIR.glob("cats/*.jpg")))
    print(f"[✓] Data extracted: {cat_count} cat images to {UPLOADS_DIR}")
    return UPLOADS_DIR


# ─── Main ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    download_model()
    download_data()
    print("[✓] All assets ready")
