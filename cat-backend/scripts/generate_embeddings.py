"""Generate cat_embeddings.json for ALL cats that have scraper photo data."""
import os

# DATABASE_URL must be set in the environment before running

import sys, json, shutil
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from PIL import Image

from app.database import SessionLocal
from app.models import Cat
from app.services.model_loader import load_model, extract_embedding

SCRAPER_DIR = r"D:\code\python\Cat\data_crops"
EMBEDDINGS_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "embeddings", "cat_embeddings.json")
MAX_PHOTOS_PER_CAT = 5

print("Loading model...")
model = load_model()
if model is None:
    print("[ERROR] Failed to load model")
    sys.exit(1)
print("Model loaded.")

db = SessionLocal()
all_cats = db.query(Cat).all()
print(f"Total cats in DB: {len(all_cats)}")

embeddings_data = {}
matched = 0
skipped = 0

for cat in all_cats:
    # Try to find scraper directory for this cat
    # DB name -> scraper directory name may differ
    cat_dir = None

    # Exact match first
    exact = os.path.join(SCRAPER_DIR, cat.name)
    if os.path.isdir(exact):
        cat_dir = exact

    # If no exact match, try case-insensitive
    if not cat_dir and os.path.isdir(SCRAPER_DIR):
        for d in os.listdir(SCRAPER_DIR):
            full = os.path.join(SCRAPER_DIR, d)
            if os.path.isdir(full) and d.lower() == cat.name.lower():
                cat_dir = full
                break

    if not cat_dir:
        skipped += 1
        continue

    # Find photos
    photos = sorted([
        f for f in os.listdir(cat_dir)
        if f.lower().endswith((".jpg", ".jpeg", ".png"))
    ])[:MAX_PHOTOS_PER_CAT]

    if not photos:
        skipped += 1
        continue

    # Generate embeddings
    embs = []
    for p in photos:
        try:
            img_path = os.path.join(cat_dir, p)
            img = Image.open(img_path).convert("RGB")
            emb = extract_embedding(img)
            embs.append(emb)
        except Exception as e:
            print(f"  WARN: failed {p}: {e}")

    if embs:
        embeddings_data[cat.name] = {
            "cat_id": cat.id,
            "embeddings": embs,
        }
        matched += 1
        print(f"  OK {cat.name}: {len(embs)} embeddings", flush=True)
    else:
        skipped += 1

# Save
os.makedirs(os.path.dirname(EMBEDDINGS_PATH), exist_ok=True)
with open(EMBEDDINGS_PATH, "w", encoding="utf-8") as f:
    json.dump(embeddings_data, f, ensure_ascii=False)

print(f"\nDone! {matched} cats with embeddings, {skipped} skipped")
print(f"Saved to {EMBEDDINGS_PATH}")
print(f"File size: {os.path.getsize(EMBEDDINGS_PATH) / 1024 / 1024:.1f} MB")
db.close()
