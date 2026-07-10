#!/usr/bin/env python3
"""Import cats from embeddings JSON to database."""

import json
from pathlib import Path
from app.database import SessionLocal
from app import models

# Load embeddings
embeddings_file = Path(__file__).parent / "embeddings" / "cat_embeddings.json"
with open(embeddings_file, "r") as f:
    embeddings_data = json.load(f)

# Create database session
db = SessionLocal()

try:
    # Get existing cats
    existing_cats = db.query(models.Cat).all()
    existing_names = {cat.name for cat in existing_cats}
    
    print(f"Database already has {len(existing_cats)} cats")
    
    # Import new cats
    created_count = 0
    for cat_name in embeddings_data.keys():
        if cat_name in existing_names:
            print(f"  ✓ {cat_name} (already exists)")
            continue
        
        # Create new cat record
        new_cat = models.Cat(
            name=cat_name,
            nickname=cat_name,
            color="Unknown",
            location="Campus",
        )
        db.add(new_cat)
        created_count += 1
        print(f"  + {cat_name}")
    
    # Commit all new cats
    if created_count > 0:
        db.commit()
        print(f"\n✅ Successfully imported {created_count} new cats")
    else:
        print("\n✅ All cats already exist in database")
    
    # Verify
    total_cats = db.query(models.Cat).count()
    print(f"\nTotal cats in database: {total_cats}")
    
    # List all cats
    all_cats = db.query(models.Cat).order_by(models.Cat.id).all()
    print("\nCats in database:")
    for cat in all_cats:
        print(f"  {cat.id}. {cat.name}")

finally:
    db.close()
