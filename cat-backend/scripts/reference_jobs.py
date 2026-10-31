"""Submit or execute persistent reference jobs. Workers never migrate the DB."""
import argparse
import json
from pathlib import Path
import signal
import sys
import time

from dotenv import load_dotenv

BACKEND = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND / '.env')
sys.path.insert(0, str(BACKEND))

from app.database import SessionLocal, engine
from app.schema_readiness import require_current_schema
from app.services import reference_lifecycle as lifecycle
from app.services.reference_snapshot import ReferenceUnavailable
from app.services.reference_store import StoreBusy


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    enqueue = commands.add_parser('enqueue')
    enqueue.add_argument('--no-crop', action='store_true')
    enqueue.add_argument('--no-publish', action='store_true')
    for name in ('publish', 'rollback'):
        command = commands.add_parser(name)
        command.add_argument('snapshot_id')
        command.add_argument('--no-crop', action='store_true')
    commands.add_parser('status')
    worker = commands.add_parser('worker')
    worker.add_argument('--once', action='store_true')
    worker.add_argument('--wait-schema', type=float, default=0)
    args = parser.parse_args()
    try:
        deadline = time.monotonic() + (args.wait_schema if args.command == 'worker' else 0)
        while True:
            try:
                require_current_schema(engine)
                break
            except Exception:
                if time.monotonic() >= deadline:
                    raise
                time.sleep(1)
        if args.command == 'status':
            print(json.dumps([job.model_dump() for job in lifecycle.list_jobs(lifecycle.store_root())], ensure_ascii=False))
            return 0
        if args.command != 'worker':
            with SessionLocal() as db:
                job = lifecycle.enqueue(db, kind='rebuild' if args.command == 'enqueue' else args.command,
                                        crop=not args.no_crop, publish=not getattr(args, 'no_publish', False),
                                        snapshot_id=getattr(args, 'snapshot_id', None))
            print(job.model_dump_json())
            return 0
        signal.signal(signal.SIGTERM, lambda *_: sys.exit(143))
        while True:
            try:
                job = lifecycle.run_once()
            except StoreBusy:
                if args.once:
                    return 2
                time.sleep(1)
                continue
            if job:
                print(job.model_dump_json(), flush=True)
            if args.once:
                return 0 if job is None or job.status == 'succeeded' else 1
            time.sleep(1)
    except (ReferenceUnavailable, RuntimeError) as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
