"""Evaluate a frozen identity-labelled manifest against the active reference store.

Run with --manifest dataset.json --output result.json. Display names are never
ground truth. Exit 2 means incomplete execution, not low accuracy.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
from importlib import metadata
import io
import json
import os
from pathlib import Path
import platform
import sys
import time
from typing import Literal

import numpy as np
from PIL import Image
from pydantic import BaseModel, ConfigDict, Field, model_validator

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.config import settings  # noqa: E402
from app.services.ai import recognize_with_details  # noqa: E402
from app.services.reference_snapshot import load_active_snapshot, canonical, ReferenceUnavailable  # noqa: E402
from scripts.recognition_metrics import summarize, fraction  # noqa: E402


class Sample(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    sample_id: str = Field(min_length=1)
    file: str = Field(min_length=1)
    sha256: str = Field(pattern=r'^[0-9a-f]{64}$')
    split: Literal['reference', 'query']
    kind: Literal['known', 'unknown_cat', 'no_cat']
    identity: str | None = None
    reference_id: str | None = Field(default=None, pattern=r'^[0-9a-f]{32}$')

    @model_validator(mode='after')
    def labels(self):
        if self.kind == 'known' and (not self.identity or not self.reference_id):
            raise ValueError('Known cats need source identity and reference_id')
        if self.kind == 'unknown_cat' and (not self.identity or self.reference_id is not None):
            raise ValueError('Unknown cats need a source identity but no reference_id')
        if self.kind == 'no_cat' and (self.identity is not None or self.reference_id is not None):
            raise ValueError('No-cat samples cannot carry a cat identity')
        if self.split == 'reference' and self.kind != 'known':
            raise ValueError('Only known cats can enter the reference set')
        return self


class Dataset(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    format_version: Literal[1] = 1
    dataset_id: str = Field(min_length=1)
    database_id: str = Field(pattern=r'^[0-9a-f]{32}$')
    snapshot_id: str = Field(pattern=r'^[0-9a-f]{32}$')
    reference_manifest_sha256: str = Field(pattern=r'^[0-9a-f]{64}$')
    crop: bool = True
    provenance: dict
    samples: list[Sample] = Field(min_length=1)


def fingerprint(data):
    with Image.open(io.BytesIO(data)) as source:
        image = source.convert('RGB')
        pixels = hashlib.sha256(str(image.size).encode() + image.tobytes()).hexdigest()
        small = np.asarray(image.convert('L').resize((9, 8)), dtype=np.int16)
        dhash = sum(int(bit) << index for index, bit in enumerate((small[:, 1:] > small[:, :-1]).flat))
    return pixels, dhash


def sample_path(root, name):
    path = (root / name).resolve()
    if Path(name).is_absolute() or not path.is_relative_to(root):
        raise ValueError('Sample path must stay within the manifest directory')
    return path


def validate_samples(dataset, root, snapshot):
    errors, near_duplicates = [], []
    if (dataset.database_id != snapshot.manifest.database_id
            or dataset.snapshot_id != snapshot.manifest.snapshot_id
            or dataset.reference_manifest_sha256 != hashlib.sha256(canonical(snapshot.manifest.model_dump())).hexdigest()):
        raise ValueError('Dataset is not bound to this database and reference snapshot')
    references = [s for s in dataset.samples if s.split == 'reference']
    queries = [s for s in dataset.samples if s.split == 'query']
    if not references or not queries:
        raise ValueError('Both reference and query samples are required')
    if Counter((s.reference_id, s.sha256) for s in references) != Counter(
            (s.reference_id, s.sha256) for s in snapshot.manifest.sources):
        raise ValueError('Declared reference photos do not match the complete active reference set')
    identities = {}
    for sample in references:
        if identities.setdefault(sample.identity, sample.reference_id) != sample.reference_id:
            raise ValueError('One source identity maps to multiple reference identities')
    if len(set(identities.values())) != len(identities):
        raise ValueError('Multiple source identities map to one reference identity')
    ids, hashes, pixels, perceptual = set(), {}, {}, []
    for sample in dataset.samples:
        try:
            if sample.sample_id in ids:
                raise ValueError('Duplicate sample_id')
            ids.add(sample.sample_id)
            if sample.kind == 'known' and identities.get(sample.identity) != sample.reference_id:
                raise ValueError('Known query identity is not registered in the reference set')
            if sample.kind == 'unknown_cat' and sample.identity in identities:
                raise ValueError('Unknown query identity is present in the reference set')
            data = sample_path(root, sample.file).read_bytes()
            digest = hashlib.sha256(data).hexdigest()
            if digest != sample.sha256:
                raise ValueError('Image content differs from its frozen SHA256')
            pixel_digest, dhash = fingerprint(data)
            if digest in hashes or pixel_digest in pixels:
                raise ValueError('Duplicate image content: ' + (hashes.get(digest) or pixels[pixel_digest]))
            hashes[digest] = pixels[pixel_digest] = sample.sample_id
            for other, other_hash in perceptual:
                distance = (dhash ^ other_hash).bit_count()
                if distance <= 4:
                    near_duplicates.append({'first': other.sample_id, 'second': sample.sample_id,
                                            'dhash_distance': distance, 'cross_split': other.split != sample.split})
            perceptual.append((sample, dhash))
        except (OSError, ValueError) as exc:
            errors.append({'sample_id': sample.sample_id, 'error': str(exc)})
    return queries, errors, near_duplicates


def evaluate(manifest_path):
    report = {'status': 'incomplete', 'started_at': datetime.now(timezone.utc).isoformat(),
              'errors': [], 'predictions': [], 'summary': None}
    try:
        raw = manifest_path.read_bytes()
        dataset = Dataset.model_validate_json(raw)
        report.update(dataset_id=dataset.dataset_id, dataset_sha256=hashlib.sha256(raw).hexdigest(),
                      provenance=dataset.provenance, crop=dataset.crop)
        snapshot = load_active_snapshot(dataset.crop)
        report['reference'] = {'manifest': snapshot.manifest.model_dump(), 'publication_id': snapshot.publication_id}
        queries, errors, near = validate_samples(dataset, manifest_path.parent.resolve(), snapshot)
        report['near_duplicate_candidates'] = near
        report['errors'].extend(errors)
        if errors:
            return report, 2
        report['thresholds'] = {'confirmed': settings.RECOGNIZE_THRESHOLD_CONFIRMED,
                                'uncertain': settings.RECOGNIZE_THRESHOLD_UNCERTAIN,
                                'minimum_margin': settings.RECOGNIZE_MIN_MARGIN, 'tuned_on_this_run': False}
        packages = {}
        for name in ('torch', 'torchvision', 'timm', 'ultralytics', 'faiss-cpu', 'Pillow', 'numpy'):
            try:
                packages[name] = metadata.version(name)
            except metadata.PackageNotFoundError:
                packages[name] = None
        report['environment'] = {'python': platform.python_version(), 'platform': platform.platform(),
                                 'cpu_count': os.cpu_count(), 'packages': packages,
                                 'threads': {k: os.environ.get(k) for k in ('OMP_NUM_THREADS', 'MKL_NUM_THREADS', 'OPENBLAS_NUM_THREADS')}}
        sources = ['scripts/eval_recognition.py', 'app/services/ai.py', 'app/services/detector.py',
                   'app/services/model_loader.py', 'app/services/reference_snapshot.py',
                   'scripts/recognition_metrics.py', 'app/services/recognition_policy.py']
        report['code_sha256'] = {p: hashlib.sha256((BACKEND_DIR / p).read_bytes()).hexdigest() for p in sources}
        bindings = {c.cat_id: c.reference_id for c in snapshot.catalog.cats}
        for sample in queries:
            data = sample_path(manifest_path.parent.resolve(), sample.file).read_bytes()
            if hashlib.sha256(data).hexdigest() != sample.sha256:
                raise ValueError('Query changed after preflight: ' + sample.sample_id)
            start = time.perf_counter()
            details = recognize_with_details(data, filename=Path(sample.file).name, crop=dataset.crop)
            elapsed = time.perf_counter() - start
            result = details.response
            if result.status != 'unavailable' and (details.snapshot_id != dataset.snapshot_id
                                                   or details.publication_id != snapshot.publication_id):
                raise ValueError('Reference publication changed during evaluation')
            ranking = [bindings[c.cat_id] for c in details.ranking]
            correct = bool(sample.kind == 'known' and result.status == 'confirmed'
                           and bindings.get(result.cat_id) == sample.reference_id)
            row = {'sample_id': sample.sample_id, 'file': sample.file, 'sha256': sample.sha256,
                   'kind': sample.kind, 'identity': sample.identity, 'expected_reference_id': sample.reference_id,
                   'result': result.model_dump(mode='json'), 'ranking': ranking,
                   'ranking_scores': [c.confidence for c in details.ranking], 'confirmed_correct': correct,
                   'seconds': round(elapsed, 6), 'failure_code': details.failure_code}
            report['predictions'].append(row)
            print(f'{sample.sample_id}: {result.status} score={result.confidence:.4f} seconds={elapsed:.3f}', flush=True)
        final = load_active_snapshot(dataset.crop)
        if final.manifest != snapshot.manifest or final.publication_id != snapshot.publication_id:
            raise ValueError('Reference publication changed during evaluation')
        report['summary'] = summarize(report['predictions'])
        times = [row['seconds'] for row in report['predictions']]
        report['latency'] = {'first_query_seconds': times[0], 'subsequent_queries_n': len(times) - 1,
                             'subsequent_p50_seconds': float(np.percentile(times[1:], 50)) if len(times) > 1 else None,
                             'subsequent_p95_seconds': float(np.percentile(times[1:], 95)) if len(times) > 1 else None,
                             'scope': 'Sequential internal recognition calls; includes reference checks, excludes HTTP; not capacity'}
        report['failed_samples'] = [r['sample_id'] for r in report['predictions']
                                    if (r['result']['status'] == 'unavailable'
                                        or (r['kind'] == 'known' and not r['confirmed_correct'])
                                        or (r['kind'] != 'known' and r['result']['status'] == 'confirmed'))]
        if report['summary']['unavailable']:
            report['errors'].append({'error': 'Recognition unavailable for one or more queries; evaluation incomplete'})
        else:
            report['status'] = 'completed'
        return report, 0 if report['status'] == 'completed' else 2
    except (OSError, ValueError, ReferenceUnavailable) as exc:
        report['errors'].append({'error': str(exc)})
        return report, 2


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(argv)
    if args.output.resolve() == args.manifest.resolve():
        parser.error('Output must not overwrite the dataset manifest')
    report, code = evaluate(args.manifest.resolve())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
    print(json.dumps({'status': report['status'], 'summary': report['summary'], 'errors': report['errors']}, ensure_ascii=False))
    return code


if __name__ == '__main__':
    raise SystemExit(main())
