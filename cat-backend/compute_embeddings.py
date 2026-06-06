"""Pre-compute embeddings for all reference cat images.

Run this script to generate embeddings for all cats in the uploads/cats/ directory.
Output: embeddings/cat_embeddings.json
"""

import json
import os
import sys
from pathlib import Path

from PIL import Image

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from app.services.model_loader import extract_embedding, load_model

UPLOADS_DIR = Path(__file__).parent / "uploads" / "cats"
EMBEDDINGS_DIR = Path(__file__).parent / "embeddings"
EMBEDDINGS_FILE = EMBEDDINGS_DIR / "cat_embeddings.json"


def compute_embeddings():
    """Compute embeddings for all cats and save to JSON."""
    # Ensure embeddings directory exists
    EMBEDDINGS_DIR.mkdir(exist_ok=True)

    # Load model first (this will take a moment)
    print("Loading model...")
    load_model()
    print("Model loaded.")

    # Process each cat
    cat_embeddings = {}

    for cat_name in sorted(os.listdir(UPLOADS_DIR)):
        cat_dir = UPLOADS_DIR / cat_name
        if not cat_dir.is_dir():
            continue

        print(f"\nProcessing {cat_name}...")

        # Get all images for this cat
        images = [
            f for f in cat_dir.iterdir()
            if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")
        ]

        if not images:
            print(f"  No images found for {cat_name}")
            continue

        # Compute embedding for each image
        embeddings = []
        for img_path in images:
            try:
                image = Image.open(img_path).convert("RGB")
                embedding = extract_embedding(image)
                embeddings.append(embedding)
                print(f"  {img_path.name}: OK")
            except Exception as e:
                print(f"  {img_path.name}: FAILED - {e}")

        if embeddings:
            # Get cat_id from database (or use index as fallback)
            # For now, we'll store the cat_name and let ai.py resolve cat_id from DB
            cat_embeddings[cat_name] = {
                "cat_id": None,  # Will be resolved from DB
                "embeddings": embeddings,
            }
            print(f"  Computed {len(embeddings)} embeddings")

    # Save to JSON
    with open(EMBEDDINGS_FILE, "w") as f:
        json.dump(cat_embeddings, f, indent=2)

    print(f"\nSaved embeddings to {EMBEDDINGS_FILE}")
    print(f"Total cats: {len(cat_embeddings)}")


if __name__ == "__main__":
    compute_embeddings()
