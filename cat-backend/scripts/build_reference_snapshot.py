"""Build a new inactive snapshot from registered CatImage records.

Does not import cats, infer identities from folder names, reset the database, or
publish a version. Set REFERENCE_DIR to the validated output for an initial
installation; managed publication/rollback is implemented separately.
"""
import argparse
from pathlib import Path
import sys

from dotenv import load_dotenv

BACKEND = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND / '.env')
sys.path.insert(0, str(BACKEND))

from app.config import settings
from app.database import SessionLocal, engine
from app.schema_readiness import require_current_schema
from app.services.reference_snapshot import build_candidate, ReferenceUnavailable


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True, help='New, not-yet-existing snapshot directory')
    parser.add_argument('--no-crop', action='store_true', help='Explicit pipeline for already cropped photos; queries must also use crop=False')
    args = parser.parse_args()
    try:
        require_current_schema(engine)
        with SessionLocal() as db:
            manifest = build_candidate(args.output.resolve(), db, Path(settings.UPLOAD_DIR), crop=not args.no_crop)
        print(f'Validated inactive snapshot {manifest.snapshot_id}: {len(manifest.sources)} photos')
        print(f'Output: {args.output.resolve()}')
        return 0
    except ReferenceUnavailable as exc:
        print(f'Build refused [{exc.code}]: {exc}', file=sys.stderr)
        return 1
    except Exception as exc:
        print(f'Build failed: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
