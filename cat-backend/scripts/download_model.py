"""Download model weights (DINOv3 checkpoint + YOLOv8m).

Usage:
    python scripts/download_model.py
"""
import sys
from pathlib import Path

MODELS_DIR = Path("models")

# DINOv3 finetuned weights from HuggingFace
HF_REPO_ID = "theavenger/cat-reid-dinov3"
HF_FILENAME = "finetuned_best.pt"


def _download_dinov3():
    try:
        from huggingface_hub import hf_hub_download
    except ImportError:
        print("ERROR: huggingface-hub not installed, cannot download DINOv3 weights")
        sys.exit(1)

    print(f"Downloading {HF_REPO_ID}/{HF_FILENAME} ...")
    path = hf_hub_download(
        repo_id=HF_REPO_ID,
        filename=HF_FILENAME,
        local_dir=str(MODELS_DIR),
        local_dir_use_symlinks=False,
    )
    print(f"  Saved to {path}")


def _download_yolo():
    try:
        from ultralytics import YOLO
    except ImportError:
        print("WARNING: ultralytics not available, skipping YOLOv8m (will auto-download at runtime)")
        return

    print("Downloading YOLOv8m ...")
    model = YOLO("yolov8m.pt")  # auto-downloads to cache
    model_path = Path(model.ckpt_path) if model.ckpt_path else None
    if model_path and model_path.exists():
        import shutil
        dest = MODELS_DIR / "yolov8m.pt"
        shutil.copy2(model_path, dest)
        print(f"  Saved to {dest}")
    else:
        print("  WARNING: could not locate downloaded YOLO model")


def main():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    _download_dinov3()
    _download_yolo()
    print("Done.")


if __name__ == "__main__":
    main()
