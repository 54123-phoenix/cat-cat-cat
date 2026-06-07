"""Import cats from meowzart_scraper output into the database and generate embeddings.

Usage:
    python scripts/import_cats.py [--min-photos 5] [--skip-existing]

Requirements:
    - torch, Pillow, numpy (for embedding generation)
    - Backend database accessible (uses same DATABASE_URL as the app)
"""

import os
import sys
import json
import shutil
import argparse
from pathlib import Path
from datetime import datetime

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from PIL import Image

# ─── Config ───────────────────────────────────────────────────────────

SCRAPER_CATS_DIR = Path(r"D:\Desktop\meowzart_scraper\output\cats")
BACKEND_DIR = Path(__file__).parent.parent
UPLOADS_DIR = BACKEND_DIR / "uploads" / "cats"
EMBEDDINGS_DIR = BACKEND_DIR / "embeddings"
MODEL_PATH = BACKEND_DIR / "models" / "finetuned_best.pt"

MIN_PHOTOS_DEFAULT = 5
MAX_PHOTOS_PER_CAT = 20  # Limit photos per cat to keep embeddings file small


def count_photos(cat_dir: Path) -> int:
    """Count image files in a cat directory."""
    return len([f for f in cat_dir.iterdir() if f.suffix.lower() in (".jpg", ".jpeg", ".png")])


def select_cats(min_photos: int) -> list[tuple[str, Path, int]]:
    """Select cats with at least min_photos photos, sorted by count descending."""
    cats = []
    for d in SCRAPER_CATS_DIR.iterdir():
        if not d.is_dir():
            continue
        n = count_photos(d)
        if n >= min_photos:
            cats.append((d.name, d, n))
    cats.sort(key=lambda x: x[2], reverse=True)
    return cats


def import_cat_to_db(cat_name: str, cat_dir: Path, photo_count: int, db_session) -> int:
    """Insert a cat record into the database and copy photos. Returns cat_id."""
    from app.models import Cat, CatImage

    # Check if cat already exists
    existing = db_session.query(Cat).filter(Cat.name == cat_name).first()
    if existing:
        print(f"  [SKIP] {cat_name} already exists (id={existing.id})")
        return existing.id

    # Create cat upload directory
    cat_upload_dir = UPLOADS_DIR / cat_name
    cat_upload_dir.mkdir(parents=True, exist_ok=True)

    # Copy photos (limit to MAX_PHOTOS_PER_CAT)
    photo_files = sorted([f for f in cat_dir.iterdir() if f.suffix.lower() in (".jpg", ".jpeg", ".png")])
    selected = photo_files[:MAX_PHOTOS_PER_CAT]

    avatar_path = None
    for i, photo in enumerate(selected):
        dest = cat_upload_dir / photo.name
        shutil.copy2(photo, dest)
        if i == 0:
            avatar_path = f"/uploads/cats/{cat_name}/{photo.name}"

    # Insert cat record
    cat = Cat(
        name=cat_name,
        color="待确认",
        location="",
        avatar=avatar_path,
        created_at=datetime.now(),
    )
    db_session.add(cat)
    db_session.flush()  # Get cat.id

    # Insert cat_image records
    for photo in selected:
        img_record = CatImage(
            cat_id=cat.id,
            image_path=f"/uploads/cats/{cat_name}/{photo.name}",
            created_at=datetime.now(),
        )
        db_session.add(img_record)

    db_session.commit()
    print(f"  [OK] {cat_name} imported (id={cat.id}, {len(selected)} photos)")
    return cat.id


def generate_embeddings(cat_name: str, cat_dir: Path, model, preprocess_fn) -> list[list[float]]:
    """Generate embeddings for all photos of a cat using the model."""
    photo_files = sorted([f for f in cat_dir.iterdir() if f.suffix.lower() in (".jpg", ".jpeg", ".png")])
    selected = photo_files[:MAX_PHOTOS_PER_CAT]

    embeddings = []
    for photo_path in selected:
        try:
            img = Image.open(photo_path).convert("RGB")
            tensor = preprocess_fn(img)
            import torch
            with torch.no_grad():
                emb = model(tensor)
            embeddings.append(emb.squeeze(0).cpu().tolist())
        except Exception as e:
            print(f"  [WARN] Failed to process {photo_path.name}: {e}")
            continue

    return embeddings


def load_model():
    """Load the cat recognition model."""
    import torch
    sys.path.insert(0, str(BACKEND_DIR))
    from app.services.model_loader import CatRecognitionModel, preprocess_image

    if not MODEL_PATH.exists():
        print(f"[ERROR] Model not found: {MODEL_PATH}")
        sys.exit(1)

    print(f"Loading model from {MODEL_PATH} ...")
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
        print(f"  [WARN] Missing keys: {missing}")
    if unexpected:
        print(f"  [WARN] Unexpected keys: {unexpected}")

    model.eval()
    print("Model loaded successfully.")
    return model, preprocess_image


def main():
    parser = argparse.ArgumentParser(description="Import cats and generate embeddings")
    parser.add_argument("--min-photos", type=int, default=MIN_PHOTOS_DEFAULT,
                        help=f"Minimum number of photos to import a cat (default: {MIN_PHOTOS_DEFAULT})")
    parser.add_argument("--skip-existing", action="store_true",
                        help="Skip cats that already exist in the database")
    parser.add_argument("--no-embeddings", action="store_true",
                        help="Skip embedding generation (only import to DB)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would be imported without making changes")
    args = parser.parse_args()

    # Select cats
    cats = select_cats(args.min_photos)
    print(f"\nFound {len(cats)} cats with >= {args.min_photos} photos:")
    for name, _, count in cats:
        print(f"  {name}: {count} 张")
    print()

    if args.dry_run:
        print("[DRY RUN] No changes made.")
        return

    # Setup database
    from app.database import SessionLocal
    from app.models import Cat

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    # Import cats to database
    print("=== Importing cats to database ===")
    cat_ids = {}
    for cat_name, cat_dir, photo_count in cats:
        db = SessionLocal()
        try:
            cat_id = import_cat_to_db(cat_name, cat_dir, photo_count, db)
            cat_ids[cat_name] = cat_id
        finally:
            db.close()

    # Generate embeddings
    if not args.no_embeddings:
        print(f"\n=== Generating embeddings ===")
        try:
            model, preprocess_fn = load_model()
        except ImportError:
            print("[ERROR] torch not available, skipping embedding generation")
            return

        EMBEDDINGS_DIR.mkdir(parents=True, exist_ok=True)
        embeddings_data = {}

        # Also include existing cats from DB
        db = SessionLocal()
        all_cats = db.query(Cat).all()
        db.close()

        for cat in all_cats:
            cat_name = cat.name
            cat_dir = SCRAPER_CATS_DIR / cat_name

            if not cat_dir.exists():
                print(f"  [SKIP] {cat_name}: no scraper data directory")
                continue

            print(f"  Generating embeddings for {cat_name} ...")
            embs = generate_embeddings(cat_name, cat_dir, model, preprocess_fn)
            if embs:
                embeddings_data[cat_name] = {
                    "cat_id": cat.id,
                    "embeddings": embs,
                }
                print(f"    -> {len(embs)} embeddings generated")

        # Save embeddings
        output_path = EMBEDDINGS_DIR / "cat_embeddings.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(embeddings_data, f, ensure_ascii=False)
        print(f"\nEmbeddings saved to {output_path}")
        print(f"Total cats with embeddings: {len(embeddings_data)}")

    print("\nDone!")


if __name__ == "__main__":
    main()
