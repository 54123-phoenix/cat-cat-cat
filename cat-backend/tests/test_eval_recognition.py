"""Synthetic predictions verify metrics and input gates, never model accuracy."""
import hashlib
import json
from types import SimpleNamespace

import numpy as np
from PIL import Image
import pytest

from scripts import eval_recognition as evaluator
from app.schemas import RecognizeResponse, RecognizeCandidate
from app.services.ai import RecognitionDetails


@pytest.fixture
def evaluation(tmp_path, monkeypatch):
    bindings = {index: str(index) * 32 for index in range(1, 5)}
    samples = []
    rng = np.random.default_rng(123)

    def sample(name, split, kind, identity=None):
        path = tmp_path / (name + '.png')
        Image.fromarray(rng.integers(0, 256, (16, 16, 3), dtype=np.uint8)).save(path)
        samples.append({'sample_id': name, 'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                        'split': split, 'kind': kind, 'identity': f'id-{identity}' if identity else None,
                        'reference_id': bindings[identity] if kind == 'known' else None})

    for index in bindings:
        sample('r' + str(index), 'reference', 'known', index)
    for name, index in [('q1', 1), ('q2', 4), ('q3', 1), ('q4', 2)]:
        sample(name, 'query', 'known', index)
    sample('u1', 'query', 'unknown_cat', 99)
    sample('n1', 'query', 'no_cat')
    sample('n2', 'query', 'no_cat')
    sources = [SimpleNamespace(reference_id=s['reference_id'], sha256=s['sha256']) for s in samples[:4]]
    content = {'database_id': 'd' * 32, 'snapshot_id': 'e' * 32,
               'sources': [vars(s) for s in sources]}
    manifest = SimpleNamespace(**{**content, 'sources': sources}, model_dump=lambda: content)
    snapshot = SimpleNamespace(manifest=manifest, publication_id='p' * 32,
                               catalog=SimpleNamespace(cats=[SimpleNamespace(cat_id=i, reference_id=rid) for i, rid in bindings.items()]))
    dataset = {'format_version': 1, 'dataset_id': 'synthetic-metric-test', 'database_id': 'd' * 32,
               'snapshot_id': 'e' * 32, 'reference_manifest_sha256': hashlib.sha256(evaluator.canonical(content)).hexdigest(),
               'crop': True, 'provenance': {'scope': 'synthetic predictions'}, 'samples': samples}
    path = tmp_path / 'dataset.json'

    def details(status, ids, accepted=None):
        # All names intentionally coincide, so name-based metrics would be wrong.
        ranking = tuple(RecognizeCandidate(cat_id=i, cat_name='same-name', confidence=.6 - j * .02)
                        for j, i in enumerate(ids))
        response = RecognizeResponse(status=status, cat_id=accepted,
                                     cat_name='same-name' if accepted else None, confidence=.6,
                                     candidates=list(ranking[:3]) if status == 'uncertain' else [])
        return RecognitionDetails(response, ranking, 'e' * 32, 'p' * 32)

    predictions = {'q1.png': details('uncertain', [1, 2, 3]), 'q2.png': details('confirmed', [1, 2, 3, 4], 1),
                   'q3.png': details('unknown', [1, 2]), 'q4.png': details('confirmed', [2, 1], 2),
                   'u1.png': details('confirmed', [1], 1), 'n1.png': details('confirmed', [2], 2),
                   'n2.png': details('uncertain', [1, 2])}
    calls = []

    def recognize(data, *, filename, crop):
        calls.append(filename)
        assert crop is True and data
        return predictions[filename]

    monkeypatch.setattr(evaluator, 'load_active_snapshot', lambda crop: snapshot)
    monkeypatch.setattr(evaluator, 'recognize_with_details', recognize)

    def run():
        path.write_text(json.dumps(dataset), encoding='utf-8')
        return evaluator.evaluate(path)

    return dataset, predictions, calls, run, path


def test_raw_ranks_ids_open_set_metrics_and_zero_denominators(evaluation):
    _, _, calls, run, _ = evaluation
    report, code = run()
    assert code == 0 and len(calls) == 7
    known = report['summary']['groups']['known']
    # Uncertain/unknown predictions still rank the correct identity first.
    assert known['top1'] == 3 and known['top3'] == 3
    assert known['confirmed_correct'] == 1 and known['confirmed_wrong'] == 1
    assert known['false_rejection_rate'] == .25
    assert report['summary']['groups']['unknown_cat']['false_accept_rate'] == 1
    assert report['summary']['groups']['no_cat']['false_accept_rate'] == .5
    assert report['summary']['groups']['no_cat']['candidate_exposure_rate'] == .5
    assert report['summary']['confirmed_precision'] == .25
    assert evaluator.summarize([])['groups']['known']['top1_rate'] is None
    assert evaluator.summarize([])['confirmed_precision'] is None
    assert report['latency']['subsequent_queries_n'] == 6
    assert report['thresholds']['tuned_on_this_run'] is False


def test_unavailable_is_incomplete_and_retained_in_denominators(evaluation):
    _, predictions, _, run, _ = evaluation
    predictions['q1.png'] = RecognitionDetails(RecognizeResponse(status='unavailable'), failure_code='model_unavailable')
    report, code = run()
    assert code == 2 and report['status'] == 'incomplete'
    assert report['summary']['groups']['known']['n'] == 4
    assert report['summary']['unavailable'] == 1
    assert report['predictions'][0]['failure_code'] == 'model_unavailable'


@pytest.mark.parametrize('fault', ['missing', 'changed', 'undecodable', 'leak', 'reencoded_leak',
                                  'wrong_database', 'wrong_reference_set', 'unknown_overlap',
                                  'duplicate_id', 'traversal', 'missing_identity'])
def test_preflight_rejects_invalid_or_leaked_data_before_inference(evaluation, fault):
    dataset, _, calls, run, path = evaluation
    sample = dataset['samples'][4]
    query = path.parent / sample['file']
    if fault == 'missing':
        query.unlink()
    elif fault in ('changed', 'undecodable'):
        query.write_bytes(b'not-an-image')
        if fault == 'undecodable':
            sample['sha256'] = hashlib.sha256(query.read_bytes()).hexdigest()
    elif fault in ('leak', 'reencoded_leak'):
        reference = path.parent / dataset['samples'][0]['file']
        if fault == 'leak':
            query.write_bytes(reference.read_bytes())
        else:
            with Image.open(reference) as image:
                image.save(query, compress_level=0)
        sample['sha256'] = hashlib.sha256(query.read_bytes()).hexdigest()
    elif fault == 'wrong_database':
        dataset['database_id'] = 'a' * 32
    elif fault == 'wrong_reference_set':
        dataset['samples'].pop(0)
    elif fault == 'unknown_overlap':
        dataset['samples'][8]['identity'] = 'id-1'
    elif fault == 'duplicate_id':
        sample['sample_id'] = 'r1'
    elif fault == 'traversal':
        sample['file'] = '../escape.png'
    elif fault == 'missing_identity':
        sample['reference_id'] = None
    report, code = run()
    assert code == 2 and report['errors'] and not calls
    assert report['summary'] is None


def test_publication_changes_invalidate_evaluation(evaluation):
    _, predictions, _, run, _ = evaluation
    old = predictions['q1.png']
    predictions['q1.png'] = RecognitionDetails(old.response, old.ranking, 'e' * 32, 'other-publication')
    report, code = run()
    assert code == 2 and 'publication changed' in report['errors'][0]['error']


def test_cli_exports_complete_predictions(evaluation):
    _, _, _, run, path = evaluation
    run()
    output = path.parent / 'nested' / 'result.json'
    assert evaluator.main(['--manifest', str(path), '--output', str(output)]) == 0
    report = json.loads(output.read_bytes())
    assert report['status'] == 'completed' and len(report['predictions']) == 7
    assert report['dataset_sha256'] == hashlib.sha256(path.read_bytes()).hexdigest()
