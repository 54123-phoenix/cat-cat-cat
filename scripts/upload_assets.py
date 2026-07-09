"""Upload model & data assets to Hugging Face.

Usage:
    # Set your HF token first
    set HF_TOKEN=hf_your_token_here

    # Upload everything
    python scripts/upload_assets.py

    # Upload only model (343 MB)
    python scripts/upload_assets.py --model-only

    # Upload only data (8.7 GB)
    python scripts/upload_assets.py --data-only

Requires: pip install huggingface_hub tqdm
"""

import os
import sys
import tarfile
import tempfile
import argparse
from pathlib import Path

from tqdm import tqdm
from huggingface_hub import HfApi, login

# ─── Config ───────────────────────────────────────────────────────────

HF_TOKEN = os.environ.get("HF_TOKEN", "")
MODEL_REPO = "echophoenix/cat-cat-model"
DATA_REPO = "echophoenix/cat-cat-data"

BACKEND_DIR = Path(__file__).parent.parent / "cat-backend"
MODEL_PATH = BACKEND_DIR / "models" / "finetuned_best.pt"
UPLOADS_DIR = BACKEND_DIR / "uploads"


# ─── Upload Tasks ─────────────────────────────────────────────────────


def upload_model(api: HfApi) -> None:
    """Upload model to echophoenix/cat-cat-model"""
    if not MODEL_PATH.exists():
        print(f"[!] Model not found at {MODEL_PATH}")
        return

    print(f"[~] Uploading model ({MODEL_PATH.stat().st_size // 1024 // 1024} MB) ...")
    api.upload_file(
        path_or_fileobj=str(MODEL_PATH),
        path_in_repo="finetuned_best.pt",
        repo_id=MODEL_REPO,
        repo_type="model",
    )
    print(f"[✓] Model uploaded to https://huggingface.co/{MODEL_REPO}")


def upload_data(api: HfApi) -> None:
    """Package uploads/ into tar.gz and upload to echophoenix/cat-cat-data"""
    if not UPLOADS_DIR.exists():
        print(f"[!] Uploads directory not found at {UPLOADS_DIR}")
        return

    # create archive
    archive_name = "cat-cat-uploads.tar.gz"
    print(f"[~] Creating archive of {UPLOADS_DIR} ...")

    with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
        tmp_path = tmp.name

    with tarfile.open(tmp_path, "w:gz") as tar:
        tar.add(UPLOADS_DIR, arcname="uploads")

    size = os.path.getsize(tmp_path)
    print(f"[~] Archive created: {size // 1024 // 1024} MB")

    # upload
    print(f"[~] Uploading archive ...")
    api.upload_file(
        path_or_fileobj=tmp_path,
        path_in_repo=archive_name,
        repo_id=DATA_REPO,
        repo_type="dataset",
    )
    os.unlink(tmp_path)
    print(f"[✓] Data uploaded to https://huggingface.co/datasets/{DATA_REPO}")


# ─── Main ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--model-only", action="store_true", help="Upload model only")
    group.add_argument("--data-only", action="store_true", help="Upload data only")
    args = parser.parse_args()

    if not HF_TOKEN:
        print("[!] Please set HF_TOKEN environment variable")
        print("    set HF_TOKEN=hf_your_token_here")
        sys.exit(1)

    login(token=HF_TOKEN)
    api = HfApi()

    if args.model_only:
        upload_model(api)
    elif args.data_only:
        upload_data(api)
    else:
        upload_model(api)
        upload_data(api)

    print("[✓] All uploads complete")
