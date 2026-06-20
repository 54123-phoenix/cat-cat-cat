"""Generate cat_embeddings.json for ALL cats that have scraper photo data."""
import os

# DATABASE_URL must be set in the environment before running

import sys, json, shutil
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import torch
from PIL import Image
import numpy as np

from app.database import SessionLocal
from app.models import Cat
from app.services.model_loader import CatRecognitionModel, preprocess_image

SCRAPER_DIR = r"D:\Desktop\meowzart_scraper\output\cats"
EMBEDDINGS_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "embeddings", "cat_embeddings.json")
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "finetuned_best.pt")
MAX_PHOTOS_PER_CAT = 5

print("Loading model...")
checkpoint = torch.load(MODEL_PATH, map_location="cpu", weights_only=False)
model = CatRecognitionModel()
sd = {}
for k, v in checkpoint.items():
    nk = k
    if nk.startswith("backbone.model."):
        nk = "backbone." + nk[len("backbone.model."):]
    if "patch_embed.proj." in nk:
        nk = nk.replace("patch_embed.proj.", "patch_embed.")
    if "emb_head.proj." in nk:
        nk = nk.replace("emb_head.proj.", "emb_head.")
    sd[nk] = v
model.load_state_dict(sd, strict=False)
model.eval()
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
            tensor = preprocess_image(img)
            with torch.no_grad():
                emb = model(tensor)
            embs.append(emb.squeeze(0).tolist())
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
