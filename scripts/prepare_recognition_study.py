"""Prepare identity-disjoint calibration/holdout manifests without model calls.

Uses existing bounded downloads from the pilot preparer. Images stay outside Git.
Visual exclusions must be supplied before either partition is used for inference.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import random
import shutil
from urllib.parse import quote
import uuid

import httpx
from PIL import Image, ImageDraw

from prepare_recognition_pilot import download, fingerprints, KAGGLE, DATASET, VISUAL_EXCLUSIONS


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def prepare(args):
    root = args.output_dir.resolve()
    root.mkdir(parents=True, exist_ok=True)
    if (root / 'calibration.json').exists() or (root / 'holdout.json').exists():
        raise ValueError('Existing manifests cannot be overwritten; use a new directory')
    protocol = read(args.protocol)
    seed, counts = protocol['seed'], protocol['sampling']
    previous_paths = [args.pilot_manifest] + args.previous_manifest
    previous = [read(p) for p in previous_paths]
    old = {'samples': list({s['sha256']: s for m in previous for s in m['samples']}.values())}
    excluded = {s['identity'].split(':')[-1]: 'Identity used in the previous pilot'
                for s in old['samples'] if s['identity']}
    excluded.update(VISUAL_EXCLUSIONS)
    baseline_exclusions = set(excluded)
    if args.visual_exclusions:
        excluded.update(read(args.visual_exclusions))
    groups = {}
    for item in read(args.cat_catalogue):
        path = Path(item['name'])
        if len(path.parts) == 3 and path.suffix.lower() in ('.jpg', '.jpeg', '.png'):
            groups.setdefault(path.parts[1], []).append(item['name'])
    minimum_images = max(8, counts['queries_per_cat_identity'] + counts['references_per_known_identity'])
    eligible = sorted(k for k, files in groups.items() if len(files) >= minimum_images and k not in baseline_exclusions)
    if len(eligible) < 2 * (counts['known_identities_per_partition'] + counts['unknown_identities_per_partition']):
        raise ValueError('Insufficient unseen identities for the frozen protocol')
    random.Random(seed).shuffle(eligible)
    k, u = counts['known_identities_per_partition'], counts['unknown_identities_per_partition']
    plan = []
    for part in ('calibration', 'holdout'):
        for kind, number in (('known', k), ('unknown_cat', u)):
            for _ in range(number):
                plan.append((part, kind, eligible.pop()))
    if args.previous_plan:
        prior = read(args.previous_plan)
        prior_hash = prior.get('protocol_sha256')
        if prior_hash is None:
            prior_hash = read(args.previous_plan.parent / 'calibration.json')['provenance']['protocol_sha256']
        if prior_hash != hashlib.sha256(args.protocol.read_bytes()).hexdigest():
            raise ValueError('Previous selection plan belongs to a different protocol')
        previous_plan = prior['plan']
        if ([(p, k) for p, k, _ in previous_plan] != [(p, k) for p, k, _ in plan]
                or len({i for _, _, i in previous_plan}) != len(plan)
                or any(i not in groups or i in baseline_exclusions for _, _, i in previous_plan)):
            raise ValueError('Invalid previous partition assignments')
        # Keep accepted replacements in their original partition and slot.
        # Replaying all exclusions would shift an earlier accepted replacement.
        occupied = {i for _, _, i in previous_plan}
        eligible = [i for i in eligible if i not in occupied]
        plan = [tuple(row) for row in previous_plan]
    # Replace only excluded positions, keeping all other assignments fixed.
    while any(identity in excluded for _, _, identity in plan):
        for index, (part, kind, identity) in enumerate(plan):
            if identity in excluded:
                plan[index] = (part, kind, eligible.pop())
    (root / 'selection-plan.json').write_text(json.dumps({'plan': plan, 'exclusions': excluded,
        'protocol_sha256': hashlib.sha256(args.protocol.read_bytes()).hexdigest(),
        'previous_plan_sha256': hashlib.sha256(args.previous_plan.read_bytes()).hexdigest() if args.previous_plan else None}, indent=2), encoding='utf-8')
    with httpx.Client(proxy=args.proxy, follow_redirects=True, timeout=45) as client:
        def get_image(local, url):
            if args.cache_dir and not (root / local).exists() and (args.cache_dir / local).is_file():
                (root / local).parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(args.cache_dir / local, root / local)
            return download(client, root, local, url)

        def select(entry):
            part, kind, identity = entry
            known = kind == 'known'
            needed = counts['queries_per_cat_identity'] + (counts['references_per_known_identity'] if known else 0)
            files = sorted(groups[identity])
            random.Random(f'{seed}:{identity}').shuffle(files)
            selected, seen, skipped = [], [], []
            for remote in files:
                url = KAGGLE + 'download/' + DATASET + '/' + quote(remote, safe='') + '?datasetVersionNumber=1'
                local = 'images/cats/' + identity + '/' + Path(remote).name
                data, digest = get_image(local, url)
                pixel, dhash = fingerprints(data)
                if any(pixel == p or (dhash ^ h).bit_count() <= 4 for p, h in seen):
                    skipped.append({'source_path': remote, 'reason': 'pixel duplicate or dhash <= 4 within identity'})
                    continue
                seen.append((pixel, dhash))
                n = len(selected)
                source_identity = 'catindividuals-v1:' + identity
                sample = {'sample_id': f'study-cat-{identity}-{n}', 'file': local, 'sha256': digest,
                          'split': 'reference' if known and n < counts['references_per_known_identity'] else 'query',
                          'kind': kind, 'identity': source_identity,
                          'reference_id': uuid.uuid5(uuid.NAMESPACE_URL, source_identity).hex if known else None}
                selected.append((sample, {'url': url, 'source_path': remote, 'license': 'CC BY 4.0',
                                         'partition': part, 'capture_session': 'unknown', 'bytes': len(data)}))
                if len(selected) == needed:
                    break
            if len(selected) != needed:
                raise ValueError('Insufficient distinct photos: ' + identity)
            print(f'{part} {kind} {identity}: {len(selected)} photos', flush=True)
            return selected, skipped
        with ThreadPoolExecutor(max_workers=4) as pool:
            selections = list(pool.map(select, plan))
        pairs = [pair for selected, _ in selections for pair in selected]
        old_dog_paths = {a['source_path'] for m in previous for a in m.get('provenance', {}).get('assets', {}).values()
                         if 'source_path' in a and '/dog/' in a['source_path']}
        dogs = sorted(item['name'] for item in read(args.dog_catalogue)
                      if '/dog/' in item['name'] and Path(item['name']).suffix.lower() == '.jpg'
                      and item['name'] not in old_dog_paths)
        random.Random(seed + 1).shuffle(dogs)
        for index, remote in enumerate(dogs[:2 * counts['dog_negatives_per_partition']]):
            part = 'calibration' if index < counts['dog_negatives_per_partition'] else 'holdout'
            url = KAGGLE + 'download/andrewmvd/animal-faces/' + quote(remote, safe='') + '?datasetVersionNumber=1'
            # The endpoint's ZIP member keeps its original basename.
            local = 'images/dogs/' + str(index) + '/' + Path(remote).name
            data, digest = get_image(local, url)
            sample = {'sample_id': f'study-dog-{index:02d}', 'file': local, 'sha256': digest,
                      'split': 'query', 'kind': 'no_cat', 'identity': None, 'reference_id': None}
            pairs.append((sample, {'url': url, 'source_path': remote, 'partition': part, 'bytes': len(data),
                                  'license': 'CC BY-NC 4.0', 'author': 'AFHQ / Choi et al.; Kaggle mirror andrewmvd',
                                  'capture_session': 'unknown', 'label': 'dog; requires visual review'}))
    # Scan the union before writing either partition, including the old pilot.
    hashes = {s['sha256']: 'previous pilot' for s in old['samples']}
    pixels, perceptual, near = {}, [], []
    for sample, source in pairs:
        pixel, dhash = fingerprints((root / sample['file']).read_bytes())
        if sample['sha256'] in hashes or pixel in pixels:
            raise ValueError('Duplicate content in study/prior pilot: ' + sample['sample_id'])
        hashes[sample['sha256']] = pixels[pixel] = sample['sample_id']
        for other, h in perceptual:
            distance = (dhash ^ h).bit_count()
            if distance <= 4:
                near.append({'first': other, 'second': sample['sample_id'], 'distance': distance})
        perceptual.append((sample['sample_id'], dhash))
    provenance = {'protocol_sha256': hashlib.sha256(args.protocol.read_bytes()).hexdigest(),
                  'protocol': protocol, 'previous_pilot_manifest_sha256': hashlib.sha256(args.pilot_manifest.read_bytes()).hexdigest(),
                  'previous_manifest_sha256': [hashlib.sha256(p.read_bytes()).hexdigest() for p in previous_paths],
                  'cat_source': 'https://www.kaggle.com/datasets/timost1234/cat-individuals',
                  'cat_author': 'Tzu-Yuan Lin; hosted by timost1234', 'cat_version': 1, 'cat_license': 'CC BY 4.0',
                  'dog_source': 'https://www.kaggle.com/datasets/andrewmvd/animal-faces', 'dog_version': 1,
                  'dog_license': 'CC BY-NC 4.0; research use, photographs not redistributed',
                  'dog_original': 'https://github.com/clovaai/stargan-v2/tree/875b70a150609e8a678ed8482562e7074cdce7e5',
                  'visual_exclusions_before_inference': excluded,
                  'skipped': [item for _, skipped in selections for item in skipped],
                  'near_duplicate_candidates': near, 'visual_review': 'pending; must complete before inference'}
    for part in ('calibration', 'holdout'):
        subset = [(s, a) for s, a in pairs if s['split'] == 'reference' or a['partition'] == part]
        samples = [s for s, _ in subset]
        random.Random(f'{seed}:{part}:queries').shuffle(samples)
        dataset = {'format_version': 1, 'dataset_id': protocol['study_id'] + '-' + part,
                   'crop': True, 'samples': samples,
                   'provenance': {**provenance, 'partition': part, 'assets': {s['sample_id']: a for s, a in subset}}}
        (root / f'{part}.json').write_text(json.dumps(dataset, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    # Fixed-order contact sheets for label review, never containing scores.
    columns = counts['references_per_known_identity'] + counts['queries_per_cat_identity']
    for start in range(0, len(plan), 8):
        canvas = Image.new('RGB', (180 * columns, 8 * 180), 'white'); draw = ImageDraw.Draw(canvas)
        for row, (part, kind, identity) in enumerate(plan[start:start + 8]):
            draw.text((4, row * 180), f'{part} / {kind} / {identity}', fill='black')
            images = [s for s, _ in pairs if s['identity'] == 'catindividuals-v1:' + identity]
            for col, sample in enumerate(images):
                with Image.open(root / sample['file']) as original:
                    thumb = original.convert('RGB'); thumb.thumbnail((174, 150))
                    canvas.paste(thumb, (col * 180, row * 180 + 24))
                draw.text((col * 180, row * 180 + 12), sample['split'], fill='black')
        canvas.save(root / f'review-cats-{start // 8:02d}.jpg')
    negatives = [s for s, _ in pairs if s['kind'] == 'no_cat']
    canvas = Image.new('RGB', (1000, 8 * 160), 'white'); draw = ImageDraw.Draw(canvas)
    for n, sample in enumerate(negatives):
        x, y = (n % 5) * 200, (n // 5) * 160
        draw.text((x, y), sample['sample_id'], fill='black')
        with Image.open(root / sample['file']) as original:
            thumb = original.convert('RGB'); thumb.thumbnail((195, 140)); canvas.paste(thumb, (x, y + 18))
    canvas.save(root / 'review-dogs.jpg')
    print(f'Prepared {len(pairs)} unique images; {len(near)} near-duplicate pairs require review', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('protocol', 'pilot-manifest', 'cat-catalogue', 'dog-catalogue', 'output-dir'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--visual-exclusions', type=Path)
    parser.add_argument('--previous-manifest', type=Path, action='append', default=[],
                        help='Additional retired experiments; exclude their identities and image hashes')
    parser.add_argument('--previous-plan', type=Path,
                        help='Keep previously reviewed assignments fixed when replacing newly excluded slots')
    parser.add_argument('--cache-dir', type=Path, help='Reuse previously downloaded images before manifest freeze')
    parser.add_argument('--proxy')
    prepare(parser.parse_args())
