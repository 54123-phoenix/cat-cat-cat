"""Seed cat rows from cat_embeddings.json (no photo dir needed).

The recognition path resolves cat_id by matching the embedding key (cat name)
to a Cat row. This script creates any missing Cat rows so those names resolve.
Idempotent; safe to re-run. Meant to run as a one-off (single writer) to avoid
concurrent SQLite access on bind-mounted filesystems.

Usage:
    python scripts/seed_cats_from_embeddings.py
"""

import json
import sys
from datetime import datetime
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.database import SessionLocal, engine, Base  # noqa: E402
from app import models  # noqa: E402

EMBEDDINGS_PATH = BACKEND_DIR / "embeddings" / "cat_embeddings.json"


def main() -> int:
    # Ensure schema exists (a fresh DB has no tables until app startup runs).
    Base.metadata.create_all(bind=engine)

    data = json.loads(EMBEDDINGS_PATH.read_text(encoding="utf-8"))
    db = SessionLocal()
    created = existing = 0
    try:
        for cat_name in data:
            row = db.query(models.Cat).filter(models.Cat.name == cat_name).first()
            if row:
                existing += 1
                continue
            db.add(models.Cat(
                name=cat_name,
                color="待确认",
                location="",
                personality="校园猫猫",
                created_at=datetime.now(),
            ))
            created += 1
        db.commit()
        total = db.query(models.Cat).count()
        print(f"[DONE] created={created} existing={existing} | total cats in DB={total}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
