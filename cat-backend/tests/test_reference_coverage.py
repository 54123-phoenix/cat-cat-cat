"""Synthetic checks of experimental input boundaries, geometry and scoring."""
import copy

import numpy as np
from PIL import Image
import pytest

from scripts.compare_reference_coverage import digest, letterbox_image, rank_queries, validate_inputs


def inputs():
    refs = [dict(sample_id=f'r{i}', sha256=f'h{i}', split='reference', kind='known',
                 identity='cat', reference_id='ref') for i in range(4)]
    query = dict(sample_id='q', sha256='hq', split='query', kind='known', identity='cat', reference_id='ref')
    manifest = {'provenance': {'partition': 'calibration'}, 'samples': refs[:2] + [query]}
    extra = {'visual_review': {'status': 'completed_before_inference'}, 'samples': refs[2:]}
    protocol = {'calibration_manifest_sha256': digest(manifest), 'extra_manifest_sha256': digest(extra)}
    return manifest, extra, protocol


def test_rejects_holdout_and_modified_frozen_inputs():
    m, e, p = inputs()
    validate_inputs(m, e, p)
    m['provenance']['partition'] = 'holdout'
    with pytest.raises(ValueError, match='Only calibration'):
        validate_inputs(m, e, p)
    m['provenance']['partition'] = 'calibration'
    e['samples'][0]['sha256'] = 'changed'
    with pytest.raises(ValueError, match='differ'):
        validate_inputs(m, e, p)


@pytest.mark.parametrize('change,message', [
    ('query', 'must belong'), ('unenrolled', 'must belong'), ('duplicate', 'Duplicate/leaking'),
    ('missing', 'exactly two'), ('unreviewed', 'visual review'),
])
def test_rejects_invalid_extra_references_even_with_updated_hash(change, message):
    m, e, p = inputs()
    if change == 'query':
        e['samples'][0]['split'] = 'query'
    elif change == 'unenrolled':
        e['samples'][0]['identity'] = 'other'
    elif change == 'duplicate':
        e['samples'][0]['sha256'] = m['samples'][-1]['sha256']
    elif change == 'missing':
        e['samples'].pop()
    else:
        e['visual_review']['status'] = 'pending'
    p['extra_manifest_sha256'] = digest(e)
    with pytest.raises(ValueError, match=message):
        validate_inputs(m, e, p)


@pytest.mark.parametrize('size', [(224, 896), (896, 224), (224, 224), (1, 9000)])
def test_letterbox_preserves_opposite_edges_and_aspect_ratio(size):
    image = Image.new('RGB', size, 'red')
    result = letterbox_image(image)
    assert result.size == (224, 224)
    data = np.asarray(result)
    content = np.any(data != (124, 116, 104), axis=-1)
    ys, xs = np.where(content)
    assert max(xs.max() - xs.min() + 1, ys.max() - ys.min() + 1) == 224
    assert data[ys.min(), xs.min()].tolist() == [255, 0, 0]
    assert data[ys.max(), xs.max()].tolist() == [255, 0, 0]
    assert image.size == size


def test_ranking_aggregates_distinct_identities_and_retains_wrong_top1():
    refs = [{'sample_id': 'a1', 'reference_id': 'a'}, {'sample_id': 'a2', 'reference_id': 'a'},
            {'sample_id': 'b1', 'reference_id': 'b'}]
    q = dict(sample_id='q', file='q.png', sha256='hash', kind='known', identity='B', reference_id='b')
    vectors = {k: np.array(v, dtype=np.float32) for k, v in
               {'a1': [.9, .1], 'a2': [.8, .2], 'b1': [.6, .4], 'q': [1., 0.]}.items()}
    original = copy.deepcopy(q)
    rows = rank_queries(refs, [q], vectors)
    assert rows[0]['ranking'] == ['a', 'b']
    assert rows[0]['ranking_scores'] == pytest.approx([.9, .6])
    assert rows[0]['expected_reference_id'] == 'b' and q == original
