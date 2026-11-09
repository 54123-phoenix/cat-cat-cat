"""Bind reviewed campus metadata and a predeclared protocol to an evaluation.

No model is loaded here. Metadata checks cannot authenticate a human review.
"""
from collections import Counter
import hashlib
import json
import math
import re

from scripts.prepare_campus_dataset import check_manifest, reviewed
from app.services.recognition_policy import RecognitionPolicy


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                    separators=(',', ':'), allow_nan=False).encode()).hexdigest()


def validate(preparation, protocol, root, reference, policy=None):
    result = check_manifest(preparation, root)
    if result['errors']:
        raise ValueError('Campus metadata preflight failed: ' + ', '.join(result['error_counts']))
    if (protocol.get('format_version') != 1 or protocol.get('purpose') != 'campus-recognition-protocol'
            or protocol.get('dataset_id') != preparation['dataset_id'] or not reviewed(protocol)):
        raise ValueError('A reviewed campus protocol is required')
    if protocol.get('preparation_sha256') != digest(preparation):
        raise ValueError('Campus protocol is bound to different preparation metadata')
    if protocol.get('reference_manifest_sha256') != digest(reference):
        raise ValueError('Campus protocol is bound to a different reference snapshot')
    bindings = protocol.get('identity_bindings', {})
    if (set(bindings) != set(preparation['gallery']['identity_ids'])
            or any(not isinstance(v, str) or not re.fullmatch('[0-9a-f]{32}', v) for v in bindings.values())
            or len(set(bindings.values())) != len(bindings)):
        raise ValueError('Complete one-to-one campus identity bindings are required')
    sources = [s for s in preparation['samples'] if s['partition'] == 'reference']
    if Counter((bindings[s['identity_id']], s['sha256']) for s in sources) != Counter(
            (s['reference_id'], s['sha256']) for s in reference['sources']):
        raise ValueError('Campus preparation must cover every photo in the actual gallery')
    minimum = protocol.get('minimum_counts', {})
    per_identity = minimum.get('reference_per_identity')
    if type(per_identity) is not int or per_identity < 1:
        raise ValueError('Predeclare a positive reference minimum per identity')
    if any(n < per_identity for n in Counter(s['identity_id'] for s in sources).values()):
        raise ValueError('Insufficient reference coverage for the frozen protocol')
    for partition in ('calibration', 'holdout'):
        actual = Counter(s['kind'] for s in preparation['samples'] if s['partition'] == partition)
        for kind in ('known', 'unknown_cat', 'no_cat'):
            required = minimum.get(partition, {}).get(kind)
            if type(required) is not int or required < 1 or actual[kind] < required:
                raise ValueError(f'Insufficient or unspecified {partition}/{kind} sample minimum')
    frozen = protocol.get('policy', {})
    if set(frozen) != {'confirmed', 'uncertain', 'minimum_margin'}:
        raise ValueError('Freeze all three policy parameters before evaluation')
    if any(type(v) not in (int, float) or not math.isfinite(v) for v in frozen.values()):
        raise ValueError('Policy parameters must be finite numbers')
    RecognitionPolicy(**frozen)
    if policy is not None and frozen != policy:
        raise ValueError('Runtime thresholds differ from the frozen campus policy')
    targets = protocol.get('targets', {})
    names = {'known_correct_confirmation_rate_min', 'known_wrong_confirmation_rate_max',
             'unknown_cat_false_accept_rate_max', 'no_cat_false_accept_rate_max'}
    if set(targets) != names or any(type(v) not in (int, float) or not math.isfinite(v) or not 0 <= v <= 1
                                    for v in targets.values()):
        raise ValueError('Freeze all four empirical quality targets before evaluation')
    return result


def freeze(preparation, protocol, root, reference, partition, crop=True):
    validate(preparation, protocol, root, reference)
    if partition not in {'calibration', 'holdout'}:
        raise ValueError('Select calibration or holdout')
    bindings = protocol['identity_bindings']
    samples = [{'sample_id': s['sample_id'], 'file': s['file'], 'sha256': s['sha256'],
                'split': 'reference' if s['partition'] == 'reference' else 'query',
                'kind': s['kind'], 'identity': s['identity_id'],
                'reference_id': bindings[s['identity_id']] if s['kind'] == 'known' else None}
               for s in preparation['samples'] if s['partition'] in {'reference', partition}]
    return {'format_version': 1, 'evaluation_scope': 'campus',
            'dataset_id': preparation['dataset_id'] + '-' + partition,
            'database_id': reference['database_id'], 'snapshot_id': reference['snapshot_id'],
            'reference_manifest_sha256': digest(reference), 'crop': crop,
            'provenance': {'campus_preflight': {'partition': partition, 'preparation': preparation,
                'preparation_sha256': digest(preparation), 'protocol': protocol,
                'protocol_sha256': digest(protocol)}}, 'samples': samples}


def validate_evaluation(dataset, root, reference, policy):
    evidence = dataset.provenance.get('campus_preflight', {})
    preparation, protocol = evidence.get('preparation', {}), evidence.get('protocol', {})
    if (evidence.get('preparation_sha256') != digest(preparation)
            or evidence.get('protocol_sha256') != digest(protocol)):
        raise ValueError('Missing or changed frozen campus evidence')
    if protocol.get('policy') != policy:
        raise ValueError('Runtime thresholds differ from the frozen campus policy')
    expected = freeze(preparation, protocol, root, reference, evidence.get('partition'), dataset.crop)
    if dataset.model_dump() != expected:
        raise ValueError('Evaluation samples or bindings differ from the frozen campus partition')
    return {'partition': evidence['partition'], 'preparation_sha256': digest(preparation),
            'protocol_sha256': digest(protocol), 'targets': protocol['targets'],
            'limits': ['Human identities, capture sessions and rights evidence require real review.',
                       'Empirical targets do not certify campus-wide reliability or release readiness.']}


def assess(summary, targets):
    groups = summary['groups']
    known, unknown, negative = (groups[k] for k in ('known', 'unknown_cat', 'no_cat'))
    return {
        'known_correct': known['confirmed_correct'] / known['n'] >= targets['known_correct_confirmation_rate_min'],
        'known_wrong': known['confirmed_wrong'] / known['n'] <= targets['known_wrong_confirmation_rate_max'],
        'unknown_false_accept': unknown['false_accept_rate'] <= targets['unknown_cat_false_accept_rate_max'],
        'no_cat_false_accept': negative['false_accept_rate'] <= targets['no_cat_false_accept_rate_max'],
        'available': summary['unavailable'] == 0,
    }
