"""Guard conservative confirmation, leakage boundaries and frozen evaluation."""
import copy
import hashlib

import pytest

from app.config import Settings
from app.services.recognition_policy import RecognitionPolicy
from scripts import calibrate_recognition as calibration


def test_ambiguous_high_score_is_not_confirmed_and_single_identity_is_not_separation():
    legacy = RecognitionPolicy(.8, .49)
    conservative = RecognitionPolicy(.8, .49, .125)
    assert legacy.classify([.9, .89]) == 'confirmed'
    assert conservative.classify([.9, .89]) == 'uncertain'
    assert conservative.classify([.875, .75]) == 'confirmed'  # Exact inclusive margin boundary.
    assert conservative.classify([.8]) == 'uncertain'
    assert legacy.classify([.8]) == 'confirmed'
    assert conservative.classify([.49, .2]) == 'uncertain'
    assert conservative.classify([.48, .2]) == 'unknown'


@pytest.mark.parametrize('values', [(float('nan'), .49, 0), (float('inf'), .49, 0),
                                   (.8, .8, 0), (1.1, .49, 0), (.8, .49, -.1), (.8, .49, 2.1)])
def test_invalid_policy_cannot_start_application(values):
    with pytest.raises(ValueError):
        Settings(JWT_SECRET='test', ADMIN_PASSWORD='test', RECOGNIZE_THRESHOLD_CONFIRMED=values[0],
                 RECOGNIZE_THRESHOLD_UNCERTAIN=values[1], RECOGNIZE_MIN_MARGIN=values[2], _env_file=None)


@pytest.fixture
def study():
    counts = {'known_identities_per_partition': 1, 'unknown_identities_per_partition': 1,
              'references_per_known_identity': 2, 'queries_per_cat_identity': 3, 'dog_negatives_per_partition': 1}
    protocol = {'study_id': 'synthetic', 'sampling': counts,
                'targets': {'unknown_cat_false_accept_rate_max': .05, 'known_correct_confirmation_rate_min': .8,
                            'known_wrong_confirmation_rate_max': .05, 'no_cat_false_accept_rate_max': .05, 'unavailable_max': 0},
                'model_assets': {'model_sha256': 'model', 'pipeline': {'crop': True}},
                'candidate_policies': {'confirmed_thresholds': [.57, .85], 'minimum_margins': [0, .05],
                                       'uncertain_threshold': .49}, 'limitations': ['Synthetic tool test only']}
    def sample(name, kind, identity, ref, split='query'):
        return dict(sample_id=name, file=name + '.jpg', sha256=hashlib.sha256(name.encode()).hexdigest(),
                    split=split, kind=kind, identity=identity, reference_id=ref)
    refs = [sample(f'r-{part}-{i}', 'known', 'known-' + part, ref, 'reference')
            for part, ref in [('calibration', '1' * 32), ('holdout', '2' * 32)] for i in range(2)]
    manifests = {}
    for part, ref in [('calibration', '1' * 32), ('holdout', '2' * 32)]:
        queries = [sample(f'{part}-known-{i}', 'known', 'known-' + part, ref) for i in range(3)]
        queries += [sample(f'{part}-unknown-{i}', 'unknown_cat', 'unknown-' + part, None) for i in range(3)]
        queries += [sample(f'{part}-dog', 'no_cat', None, None)]
        manifests[part] = {'dataset_id': 'synthetic-' + part, 'samples': copy.deepcopy(refs + queries),
                           'provenance': {'partition': part, 'protocol': protocol,
                                          'visual_review': {'status': 'completed_before_inference'}}}
    def report(part):
        manifest = manifests[part]
        rows = []
        for s in manifest['samples'][4:]:
            first = s['reference_id'] or '1' * 32
            scores = [.9, .2] if s['kind'] == 'known' else [.8, .79] if s['kind'] == 'unknown_cat' else [.4, .2]
            rows.append({**{k: s[k] for k in ('sample_id', 'file', 'sha256', 'kind', 'identity')},
                         'expected_reference_id': s['reference_id'], 'ranking_scores': scores,
                         'ranking': [first, ('2' if first == '1' * 32 else '1') * 32]})
        rows = calibration.rescore(rows, RecognitionPolicy(.57, .49))
        return {'status': 'completed', 'errors': [], 'dataset_id': manifest['dataset_id'], 'predictions': rows,
                'thresholds': {'confirmed': .57, 'uncertain': .49, 'minimum_margin': 0},
                'reference': {'manifest': {'sources': refs, 'model_sha256': 'model', 'pipeline': {'crop': True}}}}
    return protocol, manifests, report


def test_selects_only_calibration_then_checks_real_heldout_policy(study):
    protocol, manifests, report = study
    selected = calibration.select(report('calibration'), manifests['calibration'], manifests['holdout'], protocol)
    assert selected['status'] == 'selected'
    assert selected['selected']['policy'] == {'confirmed': .85, 'uncertain': .49, 'minimum_margin': 0}
    actual = report('holdout')
    with pytest.raises(ValueError, match='did not execute'):
        calibration.assess(actual, manifests['holdout'], selected, protocol)
    actual['thresholds'] = selected['selected']['policy']
    actual['predictions'] = calibration.rescore(actual['predictions'], RecognitionPolicy(**actual['thresholds']))
    assessed = calibration.assess(actual, manifests['holdout'], selected, protocol)
    assert assessed['status'] == 'empirical_targets_met' and not assessed['release_quality_passed']
    assert assessed['legacy_summary_same_ranks']['groups']['unknown_cat']['false_accepts'] == 3
    assert assessed['summary']['groups']['unknown_cat']['false_accepts'] == 0
    changed = copy.deepcopy(manifests['holdout']); changed['samples'][-1]['sha256'] = '0' * 64
    with pytest.raises(ValueError, match='changed after policy freeze'):
        calibration.assess(actual, changed, selected, protocol)


def test_cannot_select_with_holdout_scores_or_incomplete_calibration(study):
    protocol, manifests, report = study
    with pytest.raises(ValueError, match='intended partition'):
        calibration.select(report('holdout'), manifests['calibration'], manifests['holdout'], protocol)
    bad = report('calibration'); bad['predictions'].pop()
    with pytest.raises(ValueError, match='query predictions'):
        calibration.select(bad, manifests['calibration'], manifests['holdout'], protocol)
    bad = report('calibration'); bad['predictions'][0]['result']['status'] = 'unavailable'
    with pytest.raises(ValueError, match='Unavailable'):
        calibration.select(bad, manifests['calibration'], manifests['holdout'], protocol)


def test_infeasible_calibration_does_not_fabricate_a_policy(study):
    protocol, manifests, report = study
    bad = report('calibration')
    for p in bad['predictions']:
        p['ranking_scores'] = [.4, .2]
    result = calibration.select(bad, manifests['calibration'], manifests['holdout'], protocol)
    assert result['status'] == 'no_feasible_policy' and result['selected'] is None
    assert result['holdout_used_for_selection'] is False


@pytest.mark.parametrize('fault', ['old_identity', 'query_hash', 'query_identity', 'gallery_change'])
def test_study_refuses_cross_partition_or_previous_pilot_leakage(study, fault):
    protocol, manifests, _ = study
    cal, test, previous = manifests['calibration'], manifests['holdout'], {'samples': []}
    if fault == 'old_identity':
        previous['samples'] = [cal['samples'][4]]
    elif fault == 'query_hash':
        test['samples'][4]['sha256'] = cal['samples'][4]['sha256']
    elif fault == 'query_identity':
        for p in test['samples'][4:7]:
            p['identity'] = cal['samples'][4]['identity']
    else:
        test['samples'][0]['sha256'] = '0' * 64
    with pytest.raises(ValueError):
        calibration.validate_study(cal, test, protocol, previous)
