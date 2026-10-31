"""Legacy metadata-only import from cat_embeddings.json.

Creates display-name records only; this does not establish reference identity or
make legacy vectors usable. Prefer explicit admin-maintained cat/photo records.
An already migrated database is required. Never runs implicitly at startup.
"""

import json
import sys
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")
sys.path.insert(0, str(BACKEND_DIR))

from app.database import SessionLocal, engine  # noqa: E402
from app import models  # noqa: E402
from app.schema_readiness import require_current_schema

EMBEDDINGS_PATH = BACKEND_DIR / "embeddings" / "cat_embeddings.json"


def main() -> int:
    require_current_schema(engine)

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

            ))
            created += 1
        db.commit()
        total = db.query(models.Cat).count()
        print("[INFO] Metadata only: reference vectors have not been built or activated.")
        print(f"[DONE] created={created} existing={existing} | total cats in DB={total}")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
