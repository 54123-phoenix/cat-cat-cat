"""Development-only, frozen 2x2 ablation of preprocessing and reference count.

Loads real weights but does not publish vectors or modify application settings.
Use a separately frozen production pipeline and fresh holdout for acceptance.
"""
import argparse
from collections import Counter
from dataclasses import asdict
import hashlib
import itertools
import json
import os
from pathlib import Path
import sys
import time

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.calibrate_recognition import digest, gates, rescore, selection_key
from scripts.recognition_metrics import summarize
from app.services.recognition_policy import RecognitionPolicy
from app.services.image_preprocessing import letterbox_image


def validate_inputs(manifest, extras, protocol):
    if manifest['provenance']['partition'] != 'calibration':
        raise ValueError('Only calibration queries may be used for development selection')
    if digest(manifest) != protocol['calibration_manifest_sha256'] or digest(extras) != protocol['extra_manifest_sha256']:
        raise ValueError('Input manifests differ from the frozen protocol')
    if extras['visual_review']['status'] != 'completed_before_inference':
        raise ValueError('Extra references require visual review')
    base = manifest['samples']; added = extras['samples']
    refs = [s for s in base if s['split'] == 'reference']
    identities = {s['identity']: s['reference_id'] for s in refs}
    if not added or any(s['split'] != 'reference' or s['kind'] != 'known'
                        or identities.get(s['identity']) != s['reference_id'] for s in added):
        raise ValueError('Extra images must belong to enrolled identities and be references')
    if Counter(s['identity'] for s in refs) != Counter({k: 2 for k in identities}) or Counter(s['identity'] for s in added) != Counter({k: 2 for k in identities}):
        raise ValueError('Expected exactly two original and two extra references per identity')
    for key in ('sample_id', 'sha256'):
        values = [s[key] for s in base + added]
        if len(values) != len(set(values)):
            raise ValueError('Duplicate/leaking images or sample identifiers')


def rank_queries(references, queries, vectors):
    matrix = np.asarray([vectors[s['sample_id']] for s in references], dtype=np.float32)
    rows = []
    for s in queries:
        best = {}
        for r, score in zip(references, matrix @ vectors[s['sample_id']]):
            ref = r['reference_id']
            best[ref] = max(best.get(ref, -1.), float(np.clip(score, -1, 1)))
        ranks = sorted(best.items(), key=lambda r: (-r[1], r[0]))[:5]
        rows.append({**{k: s[k] for k in ('sample_id', 'sha256', 'file', 'kind', 'identity')},
                     'expected_reference_id': s['reference_id'], 'ranking': [r[0] for r in ranks],
                     'ranking_scores': [r[1] for r in ranks]})
    return rows


def evaluate_grid(rows, protocol):
    candidates = []
    grid = protocol['candidate_policies']
    for threshold, margin in itertools.product(grid['confirmed_thresholds'], grid['minimum_margins']):
        policy = RecognitionPolicy(threshold, grid['uncertain_threshold'], margin)
        summary = summarize(rescore(rows, policy))
        candidates.append({'policy': asdict(policy), 'summary': summary, 'gates': gates(summary, protocol['targets'])})
    feasible = sorted((c for c in candidates if all(c['gates'].values())), key=selection_key)
    return {'selected': feasible[0] if feasible else None, 'candidates': candidates}


def run(args):
    os.environ.update(JWT_SECRET='isolated-ablation-only', ADMIN_PASSWORD='isolated-ablation-only',
                      DATABASE_URL='sqlite://', INIT_DEMO_USER='0', REDIS_URL='', PYTHON_DOTENV_DISABLED='1',
                      RECOGNIZE_PREPROCESS='center224')
    from app.services import detector, model_loader
    from app.services.reference_snapshot import runtime_identity, validate_vector
    from scripts.eval_recognition import sample_path
    import torch

    manifest = json.loads(args.manifest.read_bytes()); extra = json.loads(args.extra.read_bytes())
    protocol = json.loads(args.protocol.read_bytes())
    validate_inputs(manifest, extra, protocol)
    args.output.mkdir(parents=True, exist_ok=False)
    model_hash, pipeline = runtime_identity(True)
    if {'model_sha256': model_hash, 'pipeline': pipeline.model_dump()} != protocol['model_assets']:
        raise ValueError('Runtime differs from frozen baseline model assets')
    model = model_loader.load_model()
    if model is None:
        raise RuntimeError('Strict model loading failed')
    references = [s for s in manifest['samples'] if s['split'] == 'reference']
    queries = [s for s in manifest['samples'] if s['split'] == 'query']
    locations = [(s, args.manifest.parent) for s in manifest['samples']] + [(s, args.extra.parent) for s in extra['samples']]
    embeddings = {'center': {}, 'letterbox': {}}
    timings = {k: [] for k in embeddings}
    for index, (s, root) in enumerate(locations):
        path = sample_path(root, s['file'])
        if hashlib.sha256(path.read_bytes()).hexdigest() != s['sha256']:
            raise ValueError('Image differs from manifest: ' + s['sample_id'])
        with Image.open(path) as original:
            crop = detector.detect_and_crop(original.convert('RGB'), expected_digest=pipeline.detector_sha256)
        for variant in embeddings:
            started = time.perf_counter()
            if variant == 'center':
                tensor = model_loader.preprocess_image(crop)
            else:
                pixels = np.asarray(letterbox_image(crop), dtype=np.float32) / 255
                pixels = (pixels - np.asarray(model_loader._MEAN, dtype=np.float32)) / np.asarray(model_loader._STD, dtype=np.float32)
                tensor = torch.from_numpy(pixels.transpose(2, 0, 1).copy()).unsqueeze(0)
            with torch.no_grad():
                vector = model(tensor).squeeze(0).cpu().numpy()
            validate_vector(vector)
            embeddings[variant][s['sample_id']] = vector
            timings[variant].append(time.perf_counter() - started)
        print(f'{index + 1}/{len(locations)} {s["sample_id"]}', flush=True)
    experiments = []
    for variant, count in itertools.product(embeddings, (2, 4)):
        refs = references + (extra['samples'] if count == 4 else [])
        rows = rank_queries(refs, queries, embeddings[variant])
        grid = evaluate_grid(rows, protocol)
        experiments.append({'variant': variant, 'references_per_identity': count, **grid,
                            'fixed_policy_summary': summarize(rescore(rows, RecognitionPolicy(**protocol['fixed_policy']))),
                            'predictions': rows})
    prior = json.loads(args.baseline_result.read_bytes())
    if digest(prior) != protocol['baseline_result_sha256']:
        raise ValueError('Wrong baseline evidence')
    prior_rows = {p['sample_id']: p for p in prior['predictions']}
    deviations = []
    for p in experiments[0]['predictions']:
        old = prior_rows[p['sample_id']]
        if p['ranking'] != old['ranking']:
            raise ValueError('Baseline ranking mismatch: ' + p['sample_id'])
        deviations.extend(abs(a - b) for a, b in zip(p['ranking_scores'], old['ranking_scores']))
    if max(deviations) > 2e-5:
        raise ValueError('Baseline scores differ by more than 2e-5')
    # Simplicity tie-break order was frozen before running the experiment.
    ordered = sorted(experiments, key=lambda e: protocol['variant_order'].index(f'{e["variant"]}-{e["references_per_identity"]}'))
    feasible = sorted((e for e in ordered if e['selected']), key=lambda e: selection_key(e['selected']))
    best = feasible[0] if feasible else None
    baseline = experiments[0]['selected']
    improved = bool(best and baseline and selection_key(best['selected'])[:3] < selection_key(baseline)[:3])
    report = {'scope': 'Calibration development comparison; not independent or application end-to-end acceptance',
              'status': 'improved_candidate' if improved else 'no_improvement',
              'protocol_sha256': digest(protocol), 'baseline_max_score_delta': max(deviations),
              'baseline_ranks_match': True, 'model_sha256': model_hash, 'baseline_pipeline': pipeline.model_dump(),
              'selected_variant': f'{best["variant"]}-{best["references_per_identity"]}' if improved else None,
              'experiments': experiments, 'embedding_seconds_median': {k: float(np.median(v)) for k, v in timings.items()},
              'holdout_used': False, 'release_quality_passed': False}
    (args.output / 'comparison.json').write_text(json.dumps(report, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k != 'experiments'}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('manifest', 'extra', 'protocol', 'baseline-result', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    run(parser.parse_args())
