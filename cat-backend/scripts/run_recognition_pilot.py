"""Create a new isolated fixture, publish real vectors, then run the evaluator.

Requires the complete inference runtime and local models. Does not accept an
existing business database. Input images are copied without modifying originals.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset', type=Path, required=True, help='Unbound dataset.json from prepare_recognition_pilot.py')
    parser.add_argument('--output', type=Path, required=True, help='New, not-yet-existing fixture directory')
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    uploads = output / 'uploads'
    (uploads / 'cats').mkdir(parents=True)
    os.environ.update(DATABASE_URL='sqlite:///' + (output / 'fixture.db').as_posix(),
                      UPLOAD_DIR=str(uploads), REFERENCE_STORE=str(output / 'reference-store'), REFERENCE_DIR='',
                      JWT_SECRET='isolated-evaluation-only', ADMIN_PASSWORD='isolated-evaluation-only',
                      INIT_DEMO_USER='0', AGENT_ENABLED='0', REDIS_URL='', PYTHON_DOTENV_DISABLED='1')
    subprocess.run([sys.executable, '-m', 'alembic', 'upgrade', 'head'], cwd=BACKEND, check=True)
    from app import models
    from app.database import SessionLocal, engine
    from app.services import reference_lifecycle as lifecycle
    from app.services.reference_snapshot import load_active_snapshot, canonical
    from scripts.eval_recognition import Sample, sample_path

    dataset_path = args.dataset.resolve()
    dataset = json.loads(dataset_path.read_bytes())
    samples = [Sample.model_validate(s) for s in dataset['samples']]
    try:
        for sample in samples:
            source = sample_path(dataset_path.parent, sample.file)
            if hashlib.sha256(source.read_bytes()).hexdigest() != sample.sha256:
                raise ValueError('Input image differs from its manifest: ' + sample.sample_id)
            target = sample_path(output, sample.file)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
        with SessionLocal() as db:
            cats = {}
            for sample in samples:
                if sample.split != 'reference':
                    continue
                if sample.reference_id not in cats:
                    cat = models.Cat(name='pilot-' + sample.identity, reference_id=sample.reference_id)
                    db.add(cat)
                    db.flush()
                    cats[sample.reference_id] = cat.id
                # Use an internally generated destination rather than untrusted sample IDs.
                filename = sample.sha256 + Path(sample.file).suffix.lower()
                shutil.copyfile(sample_path(output, sample.file), uploads / 'cats' / filename)
                db.add(models.CatImage(cat_id=cats[sample.reference_id], image_path='/uploads/cats/' + filename))
            db.commit()
            job = lifecycle.enqueue(db, crop=dataset['crop'], publish=True)
        subprocess.run([sys.executable, 'scripts/reference_jobs.py', 'worker', '--once'], cwd=BACKEND, check=True)
        snapshot = load_active_snapshot(dataset['crop'])
        completed = lifecycle.read_job(lifecycle.store_root(), job.job_id)
        if completed.status != 'succeeded' or not snapshot.publication_id:
            raise ValueError('Real reference build was not published')
        dataset.update(database_id=snapshot.manifest.database_id, snapshot_id=snapshot.manifest.snapshot_id,
                       reference_manifest_sha256=hashlib.sha256(canonical(snapshot.manifest.model_dump())).hexdigest())
        manifest = output / 'evaluation-manifest.json'
        manifest.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding='utf-8')
        (output / 'build-job.json').write_text(completed.model_dump_json(indent=2), encoding='utf-8')
        # New process keeps build-time model caches out of the query measurements.
        result = subprocess.run([sys.executable, 'scripts/eval_recognition.py', '--manifest', str(manifest),
                                 '--output', str(output / 'result.json')], cwd=BACKEND)
        return result.returncode
    finally:
        engine.dispose()


if __name__ == '__main__':
    raise SystemExit(main())
