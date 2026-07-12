"""Seed the cat database and build reference embeddings from a crops directory.

This replaces the legacy import_cats.py + generate_embeddings.py pair, which
were written for the old hand-rolled ViT and a Windows scraper path.

It uses the CURRENT DINOv3 feature extractor (app.services.model_loader), so
the produced cat_embeddings.json is compatible with the live recognition path.

Source layout expected (already YOLO-cropped, e.g. Campus-Cat-ReID/data_crops):

    <crops_dir>/
        <cat_name>/
            img1.jpg
            img2.jpg
        <another_cat>/
            ...

Usage (run inside the backend container or with backend on PYTHONPATH):

    python scripts/build_reference_db.py \
        --crops-dir /data/data_crops \
        --min-photos 3 --max-photos 10 \
        [--copy-uploads] [--reset]
"""

import argparse
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

from PIL import Image

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.database import SessionLocal  # noqa: E402
from app import models  # noqa: E402
from app.services.model_loader import load_model, extract_embedding, MODEL_PATH  # noqa: E402

EMBEDDINGS_PATH = BACKEND_DIR / "embeddings" / "cat_embeddings.json"
UPLOADS_DIR = BACKEND_DIR / "uploads" / "cats"
IMG_EXTS = (".jpg", ".jpeg", ".png")


def list_photos(cat_dir: Path) -> list[Path]:
    return sorted(
        f for f in cat_dir.iterdir()
        if f.suffix.lower() in IMG_EXTS and not f.name.startswith("._")
    )


def _build_faiss(embeddings_data: dict) -> None:
    """Build and save a FAISS index from the generated embeddings."""
    try:
        from app.services.faiss_index import FaissIndex   # noqa: E402
    except ImportError:
        print("[WARN] faiss-cpu not installed, skipping FAISS index")
        return

    idx = FaissIndex(dim=256)
    for cat_name, cat_data in embeddings_data.items():
        cat_id = cat_data["cat_id"]
        if cat_id is None:
            continue
        for emb in cat_data["embeddings"]:
            idx.add(cat_id, emb)
    idx.build()
    idx.save()
    print("[SAVED] FAISS index (%d vectors)" % idx.ntotal)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--crops-dir", required=True, help="Directory of <cat_name>/*.jpg crops")
    parser.add_argument("--min-photos", type=int, default=3)
    parser.add_argument("--max-photos", type=int, default=10)
    parser.add_argument("--copy-uploads", action="store_true",
                        help="Copy photos into uploads/cats/<name>/ and set avatar")
    parser.add_argument("--reset", action="store_true",
                        help="Delete existing cats/cat_images before importing")
    parser.add_argument("--holdout", type=int, default=0,
                        help="reserve the last N photos per cat (exclude from reference) for unbiased eval")
    args = parser.parse_args()

    crops_dir = Path(args.crops_dir)
    if not crops_dir.is_dir():
        print(f"[ERROR] crops dir not found: {crops_dir}")
        return 1

    model = load_model()
    if model is None:
        print(f"[ERROR] Feature extractor unavailable (torch/timm missing or {MODEL_PATH} not found)")
        return 1
    print("[OK] Feature extractor ready (DINOv3, dim=256)")

    db = SessionLocal()
    try:
        if args.reset:
            n_img = db.query(models.CatImage).delete()
            n_cat = db.query(models.Cat).delete()
            db.commit()
            print(f"[RESET] removed {n_cat} cats, {n_img} images")

        def _is_cat_dir(d: Path) -> bool:
            # Skip macOS AppleDouble/hidden entries (._name, .DS_Store) which
            # can't even be stat'd on some external filesystems.
            if d.name.startswith("._") or d.name.startswith("."):
                return False
            try:
                return d.is_dir()
            except OSError:
                return False

        cat_dirs = sorted(d for d in crops_dir.iterdir() if _is_cat_dir(d))
        embeddings_data: dict = {}
        imported = 0
        skipped = 0

        for cat_dir in cat_dirs:
            cat_name = cat_dir.name
            photos = list_photos(cat_dir)
            if len(photos) < args.min_photos:
                skipped += 1
                continue
            # Reserve the last N photos as an eval holdout (never referenced),
            # so eval_recognition.py --per-cat N tests on unseen images.
            ref_photos = photos[:-args.holdout] if args.holdout else photos
            selected = ref_photos[:args.max_photos]
            if not selected:
                skipped += 1
                continue

            # Upsert cat record
            cat = db.query(models.Cat).filter(models.Cat.name == cat_name).first()
            if cat is None:
                cat = models.Cat(
                    name=cat_name,
                    color="待确认",
                    location="",
                    personality="校园猫猫",
                    created_at=datetime.now(),
                )
                db.add(cat)
                db.flush()

            # Optionally copy photos into uploads and register CatImage rows
            if args.copy_uploads:
                dest_dir = UPLOADS_DIR / cat_name
                dest_dir.mkdir(parents=True, exist_ok=True)
                for i, photo in enumerate(selected):
                    dest = dest_dir / photo.name
                    if not dest.exists():
                        shutil.copy2(photo, dest)
                    rel = f"/uploads/cats/{cat_name}/{photo.name}"
                    if i == 0 and not cat.avatar:
                        cat.avatar = rel
                    if not db.query(models.CatImage).filter(
                        models.CatImage.cat_id == cat.id,
                        models.CatImage.image_path == rel,
                    ).first():
                        db.add(models.CatImage(cat_id=cat.id, image_path=rel, created_at=datetime.now()))

            # Generate embeddings. Crops are already YOLO-cut, so extract directly.
            embs = []
            for photo in selected:
                try:
                    img = Image.open(photo).convert("RGB")
                    embs.append(extract_embedding(img))
                except Exception as exc:  # noqa: BLE001
                    print(f"  [WARN] {cat_name}/{photo.name}: {exc}")

            if not embs:
                skipped += 1
                continue

            db.commit()
            embeddings_data[cat_name] = {"cat_id": cat.id, "embeddings": embs}
            imported += 1
            print(f"  [OK] {cat_name}: id={cat.id}, {len(embs)} embeddings", flush=True)

        EMBEDDINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(EMBEDDINGS_PATH, "w", encoding="utf-8") as f:
            json.dump(embeddings_data, f, ensure_ascii=False)

        size_mb = EMBEDDINGS_PATH.stat().st_size / 1024 / 1024
        print(f"\n[DONE] {imported} cats embedded, {skipped} skipped")
        print(f"[SAVED] {EMBEDDINGS_PATH} ({size_mb:.1f} MB)")

        # Build FAISS index for fast retrieval
        _build_faiss(embeddings_data)
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
