"""Frozen metadata gates use synthetic pixels and never claim campus accuracy."""
from copy import deepcopy
import json

import pytest

from scripts import campus_protocol as protocol_tools
from scripts import prepare_campus_dataset as campus
from scripts import eval_recognition as evaluator
from test_prepare_campus_dataset import study
from test_eval_recognition import evaluation


@pytest.fixture
def frozen(study):
    root, preparation = study
    reference = {'database_id': 'd' * 32, 'snapshot_id': 'e' * 32,
                 'pipeline': {'crop': 'none-v1'},
                 'sources': [{'reference_id': 'a' * 32, 'sha256': preparation['samples'][0]['sha256']}]}
    protocol = {'format_version': 1, 'purpose': 'campus-recognition-protocol',
                'dataset_id': preparation['dataset_id'],
                'preparation_sha256': protocol_tools.digest(preparation),
                'reference_manifest_sha256': protocol_tools.digest(reference),
                'reviewer': 'fixture only', 'evidence': 'synthetic protocol, no field claims',
                'identity_bindings': {'cat-a': 'a' * 32},
                'minimum_counts': {'reference_per_identity': 1,
                    'calibration': {'known': 1, 'unknown_cat': 1, 'no_cat': 3},
                    'holdout': {'known': 1, 'unknown_cat': 1, 'no_cat': 3}},
                'policy': {'confirmed': .7, 'uncertain': .49, 'minimum_margin': 0},
                'targets': {'known_correct_confirmation_rate_min': .8,
                    'known_wrong_confirmation_rate_max': .05,
                    'unknown_cat_false_accept_rate_max': .05, 'no_cat_false_accept_rate_max': .05}}
    return root, preparation, reference, protocol


def test_freeze_binds_complete_gallery_and_only_selected_partition(frozen):
    root, preparation, reference, protocol = frozen
    raw = protocol_tools.freeze(preparation, protocol, root, reference, 'holdout', False)
    dataset = evaluator.Dataset.model_validate(raw)
    result = protocol_tools.validate_evaluation(dataset, root, reference, protocol['policy'])
    assert result['partition'] == 'holdout'
    ids = {s.sample_id for s in dataset.samples}
    assert ids == {s['sample_id'] for s in preparation['samples'] if s['partition'] in {'reference', 'holdout'}}
    assert not ids & {s['sample_id'] for s in preparation['samples'] if s['partition'] == 'calibration'}


@pytest.mark.parametrize('fault', ['session', 'rights', 'gallery', 'mapping', 'counts', 'targets', 'equal_thresholds', 'metadata_hash'])
def test_unreviewed_or_changed_inputs_cannot_freeze(frozen, fault):
    root, preparation, reference, protocol = frozen
    if fault == 'session':
        preparation['samples'][1]['session_id'] = preparation['samples'][0]['session_id']
    elif fault == 'rights':
        preparation['samples'][0]['usage_evidence'] = None
    elif fault == 'gallery':
        reference['sources'].append({'reference_id': 'b' * 32, 'sha256': 'b' * 64})
        protocol['reference_manifest_sha256'] = protocol_tools.digest(reference)
    elif fault == 'mapping':
        protocol['identity_bindings'] = {'cat-a': 'b' * 32}
    elif fault == 'counts':
        protocol['minimum_counts']['holdout']['known'] = 2
    elif fault == 'targets':
        protocol['targets'] = {}
    elif fault == 'equal_thresholds':
        protocol['policy']['confirmed'] = protocol['policy']['uncertain']
    else:
        protocol['preparation_sha256'] = '0' * 64
    with pytest.raises(ValueError):
        protocol_tools.freeze(preparation, protocol, root, reference, 'holdout')


@pytest.mark.parametrize('fault', ['runtime_policy', 'relabel', 'missing_query', 'embedded_metadata', 'scope'])
def test_runtime_gate_revalidates_every_binding(frozen, fault):
    root, preparation, reference, protocol = frozen
    raw = protocol_tools.freeze(preparation, protocol, root, reference, 'holdout')
    policy = deepcopy(protocol['policy'])
    if fault == 'runtime_policy':
        policy['confirmed'] = .57
    elif fault == 'relabel':
        raw['samples'][1]['identity'] = 'another-cat'
    elif fault == 'missing_query':
        raw['samples'].pop()
    elif fault == 'embedded_metadata':
        raw['provenance']['campus_preflight']['preparation']['source_ref'] = 'changed'
    else:
        raw['dataset_id'] = 'renamed-public-experiment'
    with pytest.raises(ValueError):
        protocol_tools.validate_evaluation(evaluator.Dataset.model_validate(raw), root, reference, policy)


def test_campus_flag_alone_never_starts_inference(evaluation):
    dataset, _, calls, run, _ = evaluation
    dataset['evaluation_scope'] = 'campus'
    report, code = run()
    assert code == 2 and not calls
    assert report['release_quality_passed'] is False
    assert 'campus evidence' in report['errors'][0]['error']


@pytest.mark.parametrize('scope,evidence', [('campus', None), ('campus', {'preparation': []}), ('general', {})])
def test_malformed_or_downgraded_campus_evidence_produces_incomplete_receipt(evaluation, scope, evidence):
    dataset, _, calls, run, _ = evaluation
    dataset['evaluation_scope'] = scope
    dataset['provenance']['campus_preflight'] = evidence
    report, code = run()
    assert code == 2 and not calls and report['errors']
    assert report['release_quality_passed'] is False


def test_freeze_cli_requires_output_in_image_root_and_keeps_originals(frozen):
    root, preparation, reference, protocol = frozen
    for name, value in [('prep.json', preparation), ('reference.json', reference), ('protocol.json', protocol)]:
        (root / name).write_text(json.dumps(value), encoding='utf-8')
    output = root / 'holdout.json'
    args = ['freeze', '--root', str(root), '--manifest', str(root / 'prep.json'),
            '--protocol', str(root / 'protocol.json'), '--reference-manifest', str(root / 'reference.json'),
            '--partition', 'holdout', '--output', str(output)]
    assert campus.main(args) == 0
    saved = output.read_bytes()
    assert json.loads(saved)['evaluation_scope'] == 'campus'
    with pytest.raises(SystemExit):
        campus.main(args)
    assert output.read_bytes() == saved
