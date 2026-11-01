"""Preparation controls use synthetic images; none of these tests measure quality."""
import hashlib
import json

import numpy as np
from PIL import Image
import pytest

from scripts import prepare_campus_dataset as campus


@pytest.fixture
def study(tmp_path):
    rng = np.random.default_rng(834)
    labels = [('reference', 'known', 'cat-a', 'single_cat')]
    for split in ('calibration', 'holdout'):
        labels += [(split, 'known', 'cat-a', 'single_cat'),
                   (split, 'unknown_cat', 'cat-b', 'single_cat')]
        labels += [(split, 'no_cat', None, scene) for scene in ('no_cat', 'screen', 'toy')]
    for index in range(len(labels)):
        Image.fromarray(rng.integers(0, 256, (64, 64, 3), dtype=np.uint8)).save(tmp_path / f'{index:02}.png')
    manifest = campus.inventory(tmp_path, 'synthetic test fixture')
    review = {'reviewer': 'fixture-reviewer', 'evidence': 'fixture-only review record'}
    manifest.update(dataset_id='synthetic-campus-test', campus='test-campus',
                    gallery={'identity_ids': ['cat-a'], **review},
                    identities=[{'identity_id': identity, **review} for identity in ('cat-a', 'cat-b')])
    for index, (sample, label) in enumerate(zip(manifest['samples'], labels)):
        split, kind, identity, scene = label
        session = 'session-' + str(index)
        manifest['sessions'].append({'session_id': session, 'captured_at': f'2026-10-{index+1:02}T12:00:00+08:00',
                                     'time_basis': 'photographer_record', **review})
        sample.update(partition=split, kind=kind, identity_id=identity, scene=scene, session_id=session,
                      source_evidence='fixture source', usage_evidence='fixture rights', review=review)
    return tmp_path, manifest


def codes(result):
    return {error['code'] for error in result['errors']}


def test_inventory_leaves_labels_and_times_unconfirmed(study):
    root, _ = study
    manifest = campus.inventory(root, 'unreviewed source')
    assert not manifest['sessions'] and not manifest['identities']
    assert all(s['partition'] == 'unassigned' and s['identity_id'] is None for s in manifest['samples'])
    assert all(s['exif_datetime_original_candidate'] is None for s in manifest['samples'])
    report = campus.check_manifest(manifest, root)
    assert report['status'] == 'needs_preparation'
    assert {'sample_not_reviewed', 'session_not_reviewed', 'actual_gallery_not_reviewed'} <= codes(report)


def test_valid_metadata_is_never_release_acceptance(study):
    root, manifest = study
    report = campus.check_manifest(manifest, root)
    assert report['errors'] == []
    assert report['status'] == 'metadata_preflight_passed'
    assert report['release_quality_passed'] is False


@pytest.mark.parametrize('first,second', [(0, 1), (0, 6), (1, 6)])
def test_shared_capture_session_cannot_cross_any_partitions(study, first, second):
    root, manifest = study
    manifest['samples'][second]['session_id'] = manifest['samples'][first]['session_id']
    assert 'session_leakage' in codes(campus.check_manifest(manifest, root))


def test_unknown_cat_must_be_absent_from_complete_gallery(study):
    root, manifest = study
    manifest['samples'][2]['identity_id'] = 'cat-a'
    assert 'unknown_identity_in_gallery' in codes(campus.check_manifest(manifest, root))
    manifest['gallery']['identity_ids'].append('cat-b')
    assert 'reference_gallery_incomplete' in codes(campus.check_manifest(manifest, root))


@pytest.mark.parametrize('basis', ['file_mtime', 'database_created_at', None])
def test_import_and_filesystem_times_are_not_capture_evidence(study, basis):
    root, manifest = study
    manifest['sessions'][0]['time_basis'] = basis
    assert 'unverified_capture_time' in codes(campus.check_manifest(manifest, root))


def test_original_exif_is_a_candidate_not_an_automatic_session(tmp_path):
    exif = Image.Exif()
    exif[36867] = '2025:06:01 10:20:30'
    Image.new('RGB', (32, 32), 'red').save(tmp_path / 'photo.jpg', exif=exif)
    manifest = campus.inventory(tmp_path, 'camera')
    sample = manifest['samples'][0]
    assert sample['exif_datetime_original_candidate'] == '2025:06:01 10:20:30'
    assert sample['session_id'] is None and manifest['sessions'] == []


def test_reencoded_pixels_and_changed_content_block_preflight(study):
    root, manifest = study
    source, target = manifest['samples'][:2]
    with Image.open(root / source['file']) as image:
        image.save(root / target['file'], compress_level=0)
    target['sha256'] = hashlib.sha256((root / target['file']).read_bytes()).hexdigest()
    assert target['sha256'] != source['sha256']
    assert 'duplicate_content' in codes(campus.check_manifest(manifest, root))
    (root / target['file']).write_bytes(b'corrupt')
    assert 'invalid_image' in codes(campus.check_manifest(manifest, root))


def test_near_duplicate_review_is_bound_to_both_image_hashes(study):
    root, manifest = study
    first, second = manifest['samples'][:2]
    with Image.open(root / first['file']) as image:
        data = np.array(image)
    data[0, 0] ^= 1
    Image.fromarray(data).save(root / second['file'])
    second.update(campus.inspect_image(root / second['file']))
    report = campus.check_manifest(manifest, root)
    assert 'near_duplicate_needs_review' in codes(report)
    record = {'first': first['sample_id'], 'second': second['sample_id'],
              'reviewer': 'fixture', 'evidence': 'synthetic review test only',
              'decision': 'distinct_capture',
              'sha256_by_sample': {s['sample_id']: s['sha256'] for s in (first, second)}}
    manifest['near_duplicate_reviews'] = [record]
    assert campus.check_manifest(manifest, root)['errors'] == []
    record['sha256_by_sample'][second['sample_id']] = '0' * 64
    assert 'near_duplicate_needs_review' in codes(campus.check_manifest(manifest, root))


def test_multicat_not_forced_into_single_identity_metric(study):
    root, manifest = study
    manifest['samples'][1]['scene'] = 'multi_cat'
    assert 'cat_identity_or_single_subject_not_reviewed' in codes(campus.check_manifest(manifest, root))


def test_missing_negative_scenarios_and_unreviewed_sources_block(study):
    root, manifest = study
    manifest['samples'][5].update(partition='excluded', excluded_reason='not a toy photo')
    manifest['samples'][0]['source_evidence'] = None
    assert {'missing_negative_scenarios', 'missing_source_evidence'} <= codes(campus.check_manifest(manifest, root))


def test_path_escape_lfs_and_corrupt_images_are_not_usable(study):
    root, manifest = study
    manifest['samples'][0]['file'] = '../outside.png'
    assert 'invalid_image' in codes(campus.check_manifest(manifest, root))
    (root / 'lfs.jpg').write_text('version https://git-lfs.github.com/spec/v1\n')
    (root / 'bad.jpg').write_bytes(b'broken')
    rows = campus.inventory(root, 'test')['samples']
    assert sum('inspection_error' in row for row in rows) == 2


def test_cli_refuses_to_overwrite_and_records_malformed_input(tmp_path):
    manifest = tmp_path / 'input.json'
    manifest.write_text('{broken', encoding='utf-8')
    output = tmp_path / 'report.json'
    args = ['check', '--root', str(tmp_path), '--manifest', str(manifest), '--output', str(output)]
    assert campus.main(args) == 2
    assert json.loads(output.read_text())['errors'][0]['code'] == 'invalid_input'
    original = output.read_bytes()
    with pytest.raises(SystemExit):
        campus.main(args)
    assert output.read_bytes() == original
