"""Select on calibration only, then assess one frozen policy on held-out queries.

No model or database is loaded here. Reports must contain real evaluator ranks.
Exit 3 means empirical quality targets failed; exit 2 means invalid evidence.
"""
import argparse
from collections import Counter, defaultdict
from dataclasses import asdict
import hashlib
import itertools
import json
import math
from pathlib import Path
import sys

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from app.services.recognition_policy import RecognitionPolicy  # noqa: E402
from scripts.recognition_metrics import summarize  # noqa: E402


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def gallery(manifest):
    return sorted((s['identity'], s['reference_id'], s['sha256']) for s in manifest['samples'] if s['split'] == 'reference')


def validate_partition(manifest, protocol, partition):
    if (manifest['dataset_id'] != protocol['study_id'] + '-' + partition
            or manifest['provenance']['partition'] != partition
            or manifest['provenance']['protocol'] != protocol
            or manifest['provenance']['visual_review']['status'] != 'completed_before_inference'):
        raise ValueError('Wrong/unreviewed study partition or protocol')
    rows = [s for s in manifest['samples'] if s['split'] == 'query']
    counts = protocol['sampling']
    expected = {'known': counts['known_identities_per_partition'] * counts['queries_per_cat_identity'],
                'unknown_cat': counts['unknown_identities_per_partition'] * counts['queries_per_cat_identity'],
                'no_cat': counts['dog_negatives_per_partition']}
    if Counter(s['kind'] for s in rows) != expected:
        raise ValueError('Incomplete query groups')
    for kind, number in [('known', counts['known_identities_per_partition']), ('unknown_cat', counts['unknown_identities_per_partition'])]:
        ids = Counter(s['identity'] for s in rows if s['kind'] == kind)
        if len(ids) != number or set(ids.values()) != {counts['queries_per_cat_identity']}:
            raise ValueError('Incomplete identity groups')
    return rows


def validate_study(calibration, holdout, protocol, previous):
    cal = validate_partition(calibration, protocol, 'calibration')
    test = validate_partition(holdout, protocol, 'holdout')
    refs = gallery(calibration)
    expected = protocol['sampling']
    identities = Counter(row[0] for row in refs)
    if (refs != gallery(holdout) or len(identities) != 2 * expected['known_identities_per_partition']
            or set(identities.values()) != {expected['references_per_known_identity']}):
        raise ValueError('The two partitions must share the complete fixed gallery')
    cal_ids = {s['identity'] for s in cal if s['identity']}
    test_ids = {s['identity'] for s in test if s['identity']}
    old_ids = {s['identity'] for s in previous['samples'] if s['identity']}
    if cal_ids & test_ids or (cal_ids | test_ids | set(identities)) & old_ids:
        raise ValueError('Query identities overlap partitions or the previous pilot')
    all_rows = [s for s in calibration['samples'] if s['split'] == 'reference'] + cal + test
    hashes = [s['sha256'] for s in all_rows]
    if len(hashes) != len(set(hashes)) or set(hashes) & {s['sha256'] for s in previous['samples']}:
        raise ValueError('Image leakage across gallery, queries or previous pilot')
    known = {s['identity']: s['reference_id'] for s in all_rows if s['split'] == 'reference'}
    if len(set(known.values())) != len(known):
        raise ValueError('Gallery aliases multiple identities')
    for s in cal + test:
        if s['kind'] == 'unknown_cat' and s['identity'] in known:
            raise ValueError('Unknown cat enrolled in gallery')
        if s['kind'] == 'known' and known.get(s['identity']) != s['reference_id']:
            raise ValueError('Known identity missing or mapped incorrectly')
    return {'unique_images': len(all_rows), 'gallery_identities': len(identities),
            'calibration_queries': len(cal), 'holdout_queries': len(test), 'query_identity_overlap': 0}


def require_report(report, manifest, protocol, partition):
    expected = validate_partition(manifest, protocol, partition)
    if report['status'] != 'completed' or report.get('errors') or report['dataset_id'] != manifest['dataset_id']:
        raise ValueError('Only complete reports from the intended partition are valid')
    samples = {s['sample_id']: s for s in expected}
    rows = report['predictions']
    if len(rows) != len(samples) or {p['sample_id'] for p in rows} != set(samples):
        raise ValueError('Missing, duplicate or extra query predictions')
    reference_ids = {row[1] for row in gallery(manifest)}
    for p in rows:
        s = samples[p['sample_id']]
        if any(p[key] != s[key] for key in ('sha256', 'file', 'kind', 'identity')) or p['expected_reference_id'] != s['reference_id']:
            raise ValueError('Predictions do not match frozen labels and image hashes')
        if (p['result']['status'] == 'unavailable' or len(p['ranking']) != len(p['ranking_scores'])
                or len(p['ranking']) < min(3, len(reference_ids))
                or len(p['ranking']) != len(set(p['ranking'])) or not set(p['ranking']) <= reference_ids):
            raise ValueError('Unavailable or invalid identity ranks')
        RecognitionPolicy(.57, .49).classify(p['ranking_scores'])
    actual_refs = sorted((s['reference_id'], s['sha256']) for s in report['reference']['manifest']['sources'])
    if actual_refs != sorted((r[1], r[2]) for r in gallery(manifest)):
        raise ValueError('Result uses a different gallery')
    reference = report['reference']['manifest']
    if any(reference[k] != v for k, v in protocol['model_assets'].items()):
        raise ValueError('Result uses a different frozen model or pipeline')
    return rows


def rescore(rows, policy):
    result = []
    for p in rows:
        status = policy.classify(p['ranking_scores'])
        accepted = p['ranking'][0] if status == 'confirmed' else None
        result.append({**p, 'result': {'status': status, 'confidence': p['ranking_scores'][0],
                                      'accepted_reference_id': accepted},
                       'confirmed_correct': p['kind'] == 'known' and accepted == p['expected_reference_id']})
    return result


def gates(summary, targets):
    g = summary['groups']; k = g['known']; u = g['unknown_cat']; n = g['no_cat']
    if not k['n'] or not u['n'] or not n['n']:
        raise ValueError('Cannot assess empty quality groups')
    return {'known_correct_confirmation': k['confirmed_correct'] / k['n'] >= targets['known_correct_confirmation_rate_min'],
            'known_wrong_confirmation': k['confirmed_wrong'] / k['n'] <= targets['known_wrong_confirmation_rate_max'],
            'unknown_false_accept': u['false_accept_rate'] <= targets['unknown_cat_false_accept_rate_max'],
            'no_cat_false_accept': n['false_accept_rate'] <= targets['no_cat_false_accept_rate_max'],
            'available': summary['unavailable'] <= targets['unavailable_max']}


def selection_key(row):
    g, p = row['summary']['groups'], row['policy']
    return (-g['known']['confirmed_correct'], g['unknown_cat']['false_accepts'] + g['no_cat']['false_accepts'],
            g['known']['confirmed_wrong'], p['minimum_margin'] != 0, -p['confirmed'], -p['minimum_margin'])


def policy_code_hash():
    return hashlib.sha256((BACKEND / 'app/services/recognition_policy.py').read_bytes().replace(b'\r\n', b'\n')).hexdigest()


def select(report, manifest, holdout, protocol):
    validate_study(manifest, holdout, protocol, {'samples': []})
    rows = require_report(report, manifest, protocol, 'calibration')
    candidates = []
    grid = protocol['candidate_policies']
    for threshold, margin in itertools.product(grid['confirmed_thresholds'], grid['minimum_margins']):
        policy = RecognitionPolicy(threshold, grid['uncertain_threshold'], margin)
        summary = summarize(rescore(rows, policy))
        candidates.append({'policy': asdict(policy), 'summary': summary, 'gates': gates(summary, protocol['targets'])})
    feasible = sorted((c for c in candidates if all(c['gates'].values())), key=selection_key)
    return {'status': 'selected' if feasible else 'no_feasible_policy', 'study_id': protocol['study_id'],
            'protocol_sha256': digest(protocol), 'calibration_manifest_sha256': digest(manifest),
            'holdout_manifest_sha256': digest(holdout), 'calibration_result_sha256': digest(report),
            'gallery_sha256': digest(gallery(manifest)), 'policy_code_sha256_lf': policy_code_hash(),
            'model_sha256': report['reference']['manifest']['model_sha256'],
            'pipeline': report['reference']['manifest']['pipeline'],
            'selected': feasible[0] if feasible else None, 'candidates': candidates,
            'holdout_used_for_selection': False}


def wilson(successes, n):
    z = 1.959963984540054
    p = successes / n; denominator = 1 + z * z / n
    center = (p + z * z / (2 * n)) / denominator
    radius = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denominator
    return [max(0., center - radius), min(1., center + radius)]


def assess(report, manifest, selection, protocol):
    if (selection['status'] != 'selected' or selection['holdout_used_for_selection'] is not False
            or selection['protocol_sha256'] != digest(protocol)
            or selection['holdout_manifest_sha256'] != digest(manifest)
            or selection['gallery_sha256'] != digest(gallery(manifest))
            or selection['policy_code_sha256_lf'] != policy_code_hash()):
        raise ValueError('Selection, protocol, gallery or holdout changed after policy freeze')
    rows = require_report(report, manifest, protocol, 'holdout')
    reference = report['reference']['manifest']
    if reference['model_sha256'] != selection['model_sha256'] or reference['pipeline'] != selection['pipeline']:
        raise ValueError('Model or preprocessing changed after calibration')
    values = selection['selected']['policy']; policy = RecognitionPolicy(**values)
    if any(report['thresholds'].get(k) != v for k, v in values.items()):
        raise ValueError('Held-out inference did not execute the frozen policy')
    actual = rescore(rows, policy)
    if any(a['result']['status'] != p['result']['status'] or a['confirmed_correct'] != p['confirmed_correct'] for a, p in zip(actual, rows)):
        raise ValueError('Offline and live policy decisions disagree')
    summary = summarize(rows); checks = gates(summary, protocol['targets'])
    identities = defaultdict(list)
    for p in rows:
        if p['identity']:
            identities[(p['kind'], p['identity'])].append(p)
    affected = [{'kind': kind, 'identity': identity,
                 'samples': [p['sample_id'] for p in ps if (kind == 'known' and not p['confirmed_correct'])
                             or (kind == 'unknown_cat' and p['result']['status'] == 'confirmed')]}
                for (kind, identity), ps in identities.items()]
    intervals = {}
    for kind in ('unknown_cat', 'no_cat'):
        g = summary['groups'][kind]
        intervals[kind] = wilson(g['false_accepts'], g['n'])
    return {'status': 'empirical_targets_met' if all(checks.values()) else 'targets_not_met',
            'gates': checks, 'policy': values, 'summary': summary,
            'legacy_summary_same_ranks': summarize(rescore(rows, RecognitionPolicy(.57, .49))),
            'selection_sha256': digest(selection), 'holdout_result_sha256': digest(report),
            'affected_identities': [a for a in affected if a['samples']],
            'false_accept_wilson_95_image_intervals': intervals,
            'interval_limit': 'Descriptive image-level intervals assume independent trials; repeated cats/sessions violate that assumption. No population guarantee.',
            'release_quality_passed': False, 'limitations': protocol['limitations']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    for name in ('validate', 'select', 'assess'):
        p = sub.add_parser(name)
        p.add_argument('--protocol', type=Path, required=True)
        p.add_argument('--output', type=Path, required=True)
        if name in ('validate', 'select'):
            p.add_argument('--calibration-manifest', type=Path, required=True)
            p.add_argument('--holdout-manifest', type=Path, required=True)
        if name == 'validate':
            p.add_argument('--previous-manifest', type=Path, required=True)
        else:
            p.add_argument('--result', type=Path, required=True)
        if name == 'assess':
            p.add_argument('--manifest', type=Path, required=True)
            p.add_argument('--selection', type=Path, required=True)
    args = parser.parse_args()
    if args.output.exists():
        parser.error('Refusing to overwrite existing evidence')
    try:
        protocol = read(args.protocol)
        if args.command == 'validate':
            out = validate_study(read(args.calibration_manifest), read(args.holdout_manifest), protocol, read(args.previous_manifest))
        elif args.command == 'select':
            out = select(read(args.result), read(args.calibration_manifest), read(args.holdout_manifest), protocol)
        else:
            out = assess(read(args.result), read(args.manifest), read(args.selection), protocol)
    except (KeyError, TypeError, ValueError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        return 2
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(out, ensure_ascii=False, indent=2, allow_nan=False) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in out.items() if k not in ('candidates', 'affected_identities')}, ensure_ascii=False))
    return 3 if out.get('status') in ('no_feasible_policy', 'targets_not_met') else 0


if __name__ == '__main__':
    raise SystemExit(main())
