"""Inventory campus candidate images and check human-reviewed metadata.

This is a preparation check, not a model evaluation or an identity verifier.
No model, business database, or reference store is opened. Outputs are exclusive.
"""
import argparse
from collections import Counter
from datetime import datetime
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageOps

RASTER = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'}
PARTITIONS = {'reference', 'calibration', 'holdout'}


def write_new(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('x', encoding='utf-8') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write('\n')


def inside(root, name):
    path = (root / name).resolve()
    if Path(name).is_absolute() or not path.is_relative_to(root.resolve()):
        raise ValueError('Image path escapes data root')
    return path


def inspect_image(path):
    raw = path.read_bytes()
    if raw.startswith(b'version https://git-lfs.github.com/spec/'):
        raise ValueError('Unresolved Git LFS pointer')
    with Image.open(path) as source:
        if getattr(source, 'n_frames', 1) != 1:
            raise ValueError('Multi-frame images need an explicit reviewed still frame')
        exif = source.getexif()
        original = exif.get(36867)
        if not original:
            original = exif.get_ifd(34665).get(36867)
        image = ImageOps.exif_transpose(source).convert('RGB')
        image.load()
        pixel = hashlib.sha256(str(image.size).encode() + image.tobytes()).hexdigest()
        small = image.convert('L').resize((9, 8)).tobytes()
        dhash = sum((small[y * 9 + x + 1] > small[y * 9 + x]) << (y * 8 + x)
                    for y in range(8) for x in range(8))
        return {'sha256': hashlib.sha256(raw).hexdigest(), 'pixel_sha256': pixel,
                'dhash': f'{dhash:016x}', 'width': image.width, 'height': image.height,
                'exif_datetime_original_candidate': str(original) if original else None}


def inventory(root, source_ref):
    root = root.resolve()
    if not root.is_dir():
        raise ValueError('Data root must be an existing directory')
    samples = []
    for path in sorted(root.rglob('*')):
        if not path.is_file() or path.suffix.lower() not in RASTER:
            continue
        name = path.relative_to(root).as_posix()
        row = {'sample_id': 'photo-' + hashlib.sha256(name.encode()).hexdigest()[:16],
               'file': name, 'partition': 'unassigned', 'kind': None, 'identity_id': None,
               'session_id': None, 'scene': None, 'source_evidence': None,
               'usage_evidence': None, 'review': {'reviewer': None, 'evidence': None},
               'excluded_reason': None}
        try:
            row.update(inspect_image(inside(root, name)))
        except (OSError, ValueError, SyntaxError) as exc:
            row['inspection_error'] = str(exc)
        samples.append(row)
    return {'format_version': 1, 'purpose': 'campus-data-preparation',
            'dataset_id': None, 'source_ref': source_ref, 'campus': None,
            'gallery': {'identity_ids': [], 'reviewer': None, 'evidence': None},
            'identities': [], 'sessions': [], 'near_duplicate_reviews': [], 'samples': samples}


def filled(value):
    return isinstance(value, str) and bool(value.strip())


def reviewed(value):
    return isinstance(value, dict) and filled(value.get('reviewer')) and filled(value.get('evidence'))


def check_manifest(manifest, root):
    """Check all three partitions together; dates/labels still require human truth."""
    errors, near, counts = [], [], Counter()

    def error(code, sample_id=None, detail=None):
        errors.append({'code': code, 'sample_id': sample_id, 'detail': detail})

    if manifest.get('format_version') != 1 or manifest.get('purpose') != 'campus-data-preparation':
        error('unsupported_manifest')
    for key in ('dataset_id', 'source_ref', 'campus'):
        if not filled(manifest.get(key)):
            error('missing_' + key)
    gallery = manifest.get('gallery', {})
    gallery_ids = gallery.get('identity_ids', [])
    if not gallery_ids or len(gallery_ids) != len(set(gallery_ids)) or not reviewed(gallery):
        error('actual_gallery_not_reviewed')

    def records(key, id_key):
        result = {}
        for record in manifest.get(key, []):
            identity = record.get(id_key)
            if not filled(identity) or identity in result or not reviewed(record):
                error('invalid_' + key + '_record', detail=identity)
            result[identity] = record
        return result

    identities = records('identities', 'identity_id')
    sessions = records('sessions', 'session_id')
    for session_id, record in sessions.items():
        try:
            datetime.fromisoformat(record['captured_at'])
            if record.get('time_basis') not in {'original_exif_reviewed', 'photographer_record'}:
                raise ValueError('Unsupported time basis')
        except (ValueError, KeyError, TypeError):
            error('unverified_capture_time', detail=session_id)
    if any(identity not in identities for identity in gallery_ids):
        error('gallery_identity_not_reviewed')
    seen, hashes, pixels, perceptual = set(), {}, {}, []
    session_partitions, reference_ids = {}, set()
    near_reviews = {}
    for record in manifest.get('near_duplicate_reviews', []):
        pair = tuple(sorted((record['first'], record['second'])))
        if pair in near_reviews:
            error('duplicate_pair_review', detail=list(pair))
        near_reviews[pair] = record
    for sample in manifest.get('samples', []):
        sid = sample.get('sample_id')
        if not filled(sid) or sid in seen:
            error('invalid_sample_id', sid)
        seen.add(sid)
        partition = sample.get('partition')
        counts[partition or 'missing'] += 1
        if partition == 'excluded':
            if not filled(sample.get('excluded_reason')):
                error('exclusion_reason_required', sid)
            continue
        if partition not in PARTITIONS:
            error('partition_not_assigned', sid)
        identity = sample.get('identity_id')
        kind, scene = sample.get('kind'), sample.get('scene')
        if kind in {'known', 'unknown_cat'}:
            if identity not in identities or scene != 'single_cat':
                error('cat_identity_or_single_subject_not_reviewed', sid)
            if kind == 'known' and identity not in gallery_ids:
                error('known_identity_outside_gallery', sid)
            if kind == 'unknown_cat' and identity in gallery_ids:
                error('unknown_identity_in_gallery', sid)
        elif kind == 'no_cat':
            if identity is not None or scene not in {'no_cat', 'screen', 'toy'}:
                error('invalid_negative_label', sid)
        else:
            error('label_not_supported', sid, 'Multi-cat scenes need a separate detection/selection protocol')
        if partition == 'reference':
            if kind != 'known':
                error('reference_must_be_known', sid)
            reference_ids.add(identity)
        for key in ('source_evidence', 'usage_evidence'):
            if not filled(sample.get(key)):
                error('missing_' + key, sid)
        if not reviewed(sample.get('review')):
            error('sample_not_reviewed', sid)
        session_id = sample.get('session_id')
        if session_id not in sessions:
            error('session_not_reviewed', sid)
        elif partition in PARTITIONS:
            previous = session_partitions.setdefault(session_id, partition)
            if previous != partition:
                error('session_leakage', sid, session_id)
        try:
            info = inspect_image(inside(root, sample['file']))
            if info['sha256'] != sample.get('sha256'):
                raise ValueError('Image differs from inventoried SHA256')
            digest, pixel, dhash = info['sha256'], info['pixel_sha256'], int(info['dhash'], 16)
            if digest in hashes or pixel in pixels:
                error('duplicate_content', sid, hashes.get(digest) or pixels[pixel])
            hashes[digest] = pixels[pixel] = sid
            for other, other_hash in perceptual:
                distance = (dhash ^ other_hash).bit_count()
                if distance > 4:
                    continue
                pair = tuple(sorted((other['sample_id'], sid)))
                review = near_reviews.get(pair, {})
                accepted = (reviewed(review) and review.get('decision') == 'distinct_capture'
                            and review.get('sha256_by_sample') == {
                                other['sample_id']: other['sha256'], sid: sample['sha256']})
                near.append({'first': pair[0], 'second': pair[1], 'distance': distance,
                             'reviewed': bool(accepted)})
                if not accepted:
                    error('near_duplicate_needs_review', sid, other['sample_id'])
            perceptual.append((sample, dhash))
        except (OSError, ValueError, SyntaxError) as exc:
            error('invalid_image', sid, str(exc))
    if reference_ids != set(gallery_ids):
        error('reference_gallery_incomplete')
    for partition in PARTITIONS:
        if not counts[partition]:
            error('empty_partition', detail=partition)
    for partition in ('calibration', 'holdout'):
        group = [s for s in manifest.get('samples', []) if s.get('partition') == partition]
        if not {'known', 'unknown_cat', 'no_cat'} <= {s.get('kind') for s in group}:
            error('missing_query_groups', detail=partition)
        if not {'no_cat', 'screen', 'toy'} <= {s.get('scene') for s in group}:
            error('missing_negative_scenarios', detail=partition)
    return {'status': 'metadata_preflight_passed' if not errors else 'needs_preparation',
            'release_quality_passed': False, 'counts': dict(counts), 'errors': errors,
            'error_counts': dict(Counter(e['code'] for e in errors)), 'near_duplicates': near,
            'limits': ['Human identity, source and session evidence is recorded, not independently authenticated.',
                       'Passing does not run inference, bind a live gallery, freeze a study or establish sample sufficiency.',
                       'Multi-cat selection, training overlap and hardware capacity require separate acceptance.']}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    init = sub.add_parser('inventory')
    init.add_argument('--root', type=Path, required=True)
    init.add_argument('--source-ref', required=True)
    init.add_argument('--output', type=Path, required=True)
    check = sub.add_parser('check')
    check.add_argument('--root', type=Path, required=True)
    check.add_argument('--manifest', type=Path, required=True)
    check.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(argv)
    if args.output.exists():
        parser.error('Output already exists; choose a new path')
    try:
        if args.command == 'inventory':
            result = inventory(args.root, args.source_ref)
            code = 0
        else:
            raw = args.manifest.read_bytes()
            result = check_manifest(json.loads(raw), args.root)
            result['manifest_sha256'] = hashlib.sha256(raw).hexdigest()
            code = 0 if result['status'] == 'metadata_preflight_passed' else 2
    except (OSError, ValueError, TypeError, KeyError, AttributeError) as exc:
        result = {'status': 'needs_preparation', 'release_quality_passed': False,
                  'errors': [{'code': 'invalid_input', 'detail': str(exc)}]}
        code = 2
    write_new(args.output, result)
    print(json.dumps({'output': str(args.output), 'status': result.get('status', 'inventoried'),
                      'samples': len(result.get('samples', [])), 'error_counts': result.get('error_counts')}, ensure_ascii=False))
    return code


if __name__ == '__main__':
    raise SystemExit(main())
