"""Add reference candidates deterministically, without consulting query scores.

Input manifests are already inspected development data, including retired
holdouts. Query images and pixel/perceptual duplicates cannot become references.
The resulting manifest is pending visual review and is not an acceptance set.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import random
from urllib.parse import quote

import httpx
from PIL import Image, ImageDraw

from prepare_recognition_pilot import DATASET, KAGGLE, download, fingerprints


def prepare(args):
    root = args.output_dir.resolve()
    root.mkdir(parents=True, exist_ok=False)
    manifests = [json.loads(p.read_bytes()) for p in args.manifest]
    originals = {s['sample_id']: s for m in manifests for s in m['samples']}
    refs = sorted({s['identity'] for s in originals.values() if s['split'] == 'reference'})
    sources = {s['sample_id']: m['provenance']['assets'][s['sample_id']]
               for m in manifests for s in m['samples']}
    used_paths = {a['source_path'] for a in sources.values()}
    hashes = {s['sha256'] for s in originals.values()}
    seen = [fingerprints((args.data_dir / s['file']).read_bytes()) for s in originals.values()]
    catalogue = json.loads(args.cat_catalogue.read_bytes())
    with httpx.Client(proxy=args.proxy, follow_redirects=True, timeout=45) as client:
        def select(identity):
            suffix = identity.split(':')[-1]
            files = sorted(i['name'] for i in catalogue if len(Path(i['name']).parts) == 3
                           and Path(i['name']).parts[1] == suffix
                           and Path(i['name']).suffix.lower() in ('.jpg', '.jpeg', '.png')
                           and i['name'] not in used_paths)
            random.Random(f'{args.seed}:{identity}').shuffle(files)
            selected, rejected, local_seen = [], [], list(seen)
            reference_id = next(s['reference_id'] for s in originals.values() if s['identity'] == identity)
            for remote in files:
                local = 'images/cats/' + suffix + '/' + Path(remote).name
                url = KAGGLE + 'download/' + DATASET + '/' + quote(remote, safe='') + '?datasetVersionNumber=1'
                data, digest = download(client, root, local, url)
                pixel, dhash = fingerprints(data)
                if digest in hashes or any(pixel == p or (dhash ^ h).bit_count() <= 4 for p, h in local_seen):
                    rejected.append({'source_path': remote, 'reason': 'existing/near-duplicate image'})
                    continue
                local_seen.append((pixel, dhash))
                selected.append({'sample_id': f'coverage-cat-{suffix}-{len(selected)}', 'file': local,
                                 'sha256': digest, 'split': 'reference', 'kind': 'known', 'identity': identity,
                                 'reference_id': reference_id, 'source_path': remote, 'url': url,
                                 'license': 'CC BY 4.0', 'capture_session': 'unknown'})
                if len(selected) == args.extra_per_identity:
                    break
            if len(selected) != args.extra_per_identity:
                raise ValueError('Insufficient distinct extra references: ' + identity)
            print(identity, len(selected), flush=True)
            return selected, rejected
        with ThreadPoolExecutor(max_workers=4) as pool:
            selections = list(pool.map(select, refs))
    samples = [s for rows, _ in selections for s in rows]
    # Check newly selected candidates across identities as well.
    new_fingerprints = [fingerprints((root / s['file']).read_bytes()) for s in samples]
    for i, (pixel, dhash) in enumerate(new_fingerprints):
        if any(pixel == p or (dhash ^ h).bit_count() <= 4 for p, h in new_fingerprints[:i]):
            raise ValueError('New references contain cross-identity duplicate candidates; review selection')
    manifest = {'format_version': 1, 'scope': 'Development reference coverage ablation only',
                'seed': args.seed, 'extra_per_identity': args.extra_per_identity,
                'input_manifest_sha256': [hashlib.sha256(p.read_bytes()).hexdigest() for p in args.manifest],
                'samples': samples, 'skipped': [s for _, rows in selections for s in rows],
                'visual_review': {'status': 'pending'},
                'limitations': ['Source identities are not owner verified',
                                'Additional views do not establish cross-session coverage']}
    (root / 'extra-references.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    for start in range(0, len(refs), 6):
        sheet = Image.new('RGB', (1000, 6 * 210), 'white'); draw = ImageDraw.Draw(sheet)
        for row, identity in enumerate(refs[start:start + 6]):
            old = sorted((s for s in originals.values() if s['identity'] == identity and s['split'] == 'reference'), key=lambda s: s['sample_id'])
            new = [s for s in samples if s['identity'] == identity]
            for col, (s, location) in enumerate([(s, args.data_dir) for s in old] + [(s, root) for s in new]):
                x, y = col * 250, row * 210
                draw.text((x + 4, y + 4), s['sample_id'], fill='black')
                with Image.open(location / s['file']) as original:
                    im = original.convert('RGB'); im.thumbnail((245, 180)); sheet.paste(im, (x + 4, y + 25))
        sheet.save(root / f'review-{start // 6}.jpg')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, action='append', required=True)
    parser.add_argument('--data-dir', type=Path, required=True)
    parser.add_argument('--cat-catalogue', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--seed', type=int, default=2026110103)
    parser.add_argument('--extra-per-identity', type=int, default=2)
    parser.add_argument('--proxy')
    prepare(parser.parse_args())
