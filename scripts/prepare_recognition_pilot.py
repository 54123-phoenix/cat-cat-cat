"""Download a small, frozen public pilot; never select using recognition scores.

Cat labels: Cat Individual Images v1 (Tzu-Yuan Lin / Kaggle timost1234).
No-cat controls: eight scikit-image v0.25.2 photographs/textures.
Only the manifest, hashes, labels and provenance need to be published.
"""
import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import hashlib
import io
import json
from pathlib import Path
import random
import time
from urllib.parse import quote
import uuid
import zipfile

import httpx
from PIL import Image

SEED = 20261101
KAGGLE = 'https://www.kaggle.com/api/v1/datasets/'
DATASET = 'timost1234/cat-individuals'
SKIMAGE = 'e8a42ba85aaf5fd9322ef9ca51bc21063b22fcae'
NEGATIVES = ['astronaut.png', 'camera.png', 'coffee.png', 'brick.png',
             'grass.png', 'gravel.png', 'hubble_deep_field.jpg', 'rocket.jpg']
VISUAL_EXCLUSIONS = {
    '0023': 'Suspected cross-ID overlap with 0026 in the pre-inference contact sheet',
    '0026': 'Suspected mixed identities; first selected references resemble 0023, queries differ',
    '0031': 'Multiple cats without a target identity bounding box',
    '0063': 'Multiple cats without a target identity bounding box',
    '0509': 'Multiple cats without a target identity bounding box',
}


def fetch(client, url, **kwargs):
    for attempt in range(3):
        try:
            response = client.get(url, **kwargs)
            response.raise_for_status()
            return response
        except (httpx.HTTPError, OSError):
            if attempt == 2:
                raise
            time.sleep(1)


def fingerprints(data):
    with Image.open(io.BytesIO(data)) as source:
        image = source.convert('RGB')
        pixels = hashlib.sha256(str(image.size).encode() + image.tobytes()).hexdigest()
        small = image.convert('L').resize((9, 8))
        dhash = sum(int(small.getpixel((x + 1, y)) > small.getpixel((x, y))) << (y * 8 + x)
                    for y in range(8) for x in range(8))
    return pixels, dhash


def download(client, output, name, url, expected=None):
    path = (output / name).resolve()
    if not path.is_relative_to(output.resolve()):
        raise ValueError('Asset must stay within output directory')
    data = path.read_bytes() if path.exists() else fetch(client, url).content
    if zipfile.is_zipfile(io.BytesIO(data)):
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            members = [m for m in archive.infolist() if not m.is_dir()]
            if (len(members) != 1 or Path(members[0].filename).name != path.name
                    or members[0].file_size > 32 * 1024 * 1024):
                raise ValueError('Expected one bounded image in the single-file download')
            data = archive.read(members[0])  # No archive paths are extracted to disk.
    digest = hashlib.sha256(data).hexdigest()
    if expected and digest != expected:
        raise ValueError('Frozen asset hash differs: ' + name)
    try:
        fingerprints(data)  # Reject non-images before saving any download.
    except OSError as exc:
        raise ValueError(f'Download is not an image: {url}; {len(data)} bytes, prefix={data[:40]!r}') from exc
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return data, digest


def prepare(args):
    output = args.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    target = output / 'dataset.json'
    if target.exists():
        raise ValueError('Choose a new output directory; existing manifests are not overwritten')
    with httpx.Client(proxy=args.proxy, follow_redirects=True, timeout=45) as client:
        if args.frozen_manifest:
            dataset = json.loads(args.frozen_manifest.read_bytes())
            def restore(sample):
                source = dataset['provenance']['assets'][sample['sample_id']]
                download(client, output, sample['file'], source['url'], sample['sha256'])
            with ThreadPoolExecutor(max_workers=4) as pool:
                list(pool.map(restore, dataset['samples']))
            # Binding is regenerated against the new isolated database.
            for key in ('database_id', 'snapshot_id', 'reference_manifest_sha256'):
                dataset.pop(key, None)
        else:
            if args.catalogue:
                catalogue = json.loads(args.catalogue.read_bytes())
            else:
                catalogue, params = [], {'pageSize': 200, 'datasetVersionNumber': 1}
                for _ in range(100):
                    page = fetch(client, KAGGLE + 'list/' + DATASET, params=params).json()
                    catalogue.extend(page['datasetFiles'])
                    if not page.get('nextPageToken'):
                        break
                    params['pageToken'] = page['nextPageToken']
                else:
                    raise ValueError('Catalogue pagination did not finish')
            groups = defaultdict(list)
            for entry in catalogue:
                path = Path(entry['name'])
                if len(path.parts) == 3 and path.suffix.lower() in ('.jpg', '.jpeg', '.png'):
                    groups[path.parts[1]].append(entry['name'])
            eligible = sorted(k for k, files in groups.items() if len(files) >= 8)
            identities = random.Random(SEED).sample(eligible, 18)
            replacements = sorted(set(eligible) - set(identities) - set(VISUAL_EXCLUSIONS))
            random.Random(SEED + 1).shuffle(replacements)
            identities = [replacements.pop() if identity in VISUAL_EXCLUSIONS else identity for identity in identities]

            def select(index_identity):
                index, identity = index_identity
                known = index < 12
                needed = 5 if known else 3
                files = sorted(groups[identity])
                random.Random(f'{SEED}:{identity}').shuffle(files)
                selected, excluded, seen = [], [], []
                for remote in files:
                    url = KAGGLE + 'download/' + DATASET + '/' + quote(remote, safe='') + '?datasetVersionNumber=1'
                    local = 'images/cats/' + identity + '/' + Path(remote).name
                    data, digest = download(client, output, local, url)
                    pixels, dhash = fingerprints(data)
                    if any(pixels == p or (dhash ^ h).bit_count() <= 4 for p, h in seen):
                        excluded.append({'source_path': remote, 'reason': 'duplicate pixels or dhash distance <= 4'})
                        continue
                    seen.append((pixels, dhash))
                    number = len(selected)
                    sample_id = f'cat-{identity}-{number}'
                    source_identity = 'catindividuals-v1:' + identity
                    selected.append(({'sample_id': sample_id, 'file': local, 'sha256': digest,
                                      'split': 'reference' if known and number < 2 else 'query',
                                      'kind': 'known' if known else 'unknown_cat', 'identity': source_identity,
                                      'reference_id': uuid.uuid5(uuid.NAMESPACE_URL, source_identity).hex if known else None},
                                     {'url': url, 'source_path': remote, 'license': 'CC BY 4.0', 'bytes': len(data)}))
                    if len(selected) == needed:
                        break
                if len(selected) != needed:
                    raise ValueError('Not enough distinct images for selected identity ' + identity)
                print(f'Identity {identity}: {len(selected)} selected, {len(excluded)} excluded', flush=True)
                return selected, excluded

            with ThreadPoolExecutor(max_workers=4) as pool:
                selections = list(pool.map(select, enumerate(identities)))
            pairs = [pair for selected, _ in selections for pair in selected]
            for name in NEGATIVES:
                url = f'https://raw.githubusercontent.com/scikit-image/scikit-image/{SKIMAGE}/skimage/data/{name}'
                local = 'images/no-cat/' + name
                data, digest = download(client, output, local, url)
                pairs.append(({'sample_id': 'no-cat-' + Path(name).stem, 'file': local, 'sha256': digest,
                               'split': 'query', 'kind': 'no_cat', 'identity': None, 'reference_id': None},
                              {'url': url, 'license': 'CC0 or public domain; see scikit-image data function documentation',
                               'bytes': len(data)}))
            samples = [sample for sample, _ in pairs]
            random.Random(SEED).shuffle(samples)
            dataset = {'format_version': 1, 'dataset_id': 'public-cat-pilot-20261101', 'crop': True,
                       'samples': samples, 'provenance': {
                           'purpose': 'Small public pilot; not campus acceptance or a training-independent benchmark',
                           'cat_source': 'https://www.kaggle.com/datasets/' + DATASET,
                           'cat_author': 'Tzu-Yuan Lin; hosted by timost1234', 'cat_version': 1,
                           'cat_license': 'CC BY 4.0', 'negative_source_revision': SKIMAGE,
                           'negative_license_reference': f'https://github.com/scikit-image/scikit-image/blob/{SKIMAGE}/skimage/data/_fetchers.py',
                           'negative_labels': 'No-cat labels require visual review before accepting results',
                           'seed': SEED, 'sampling': '12 known IDs x (2 reference + 3 query); 6 unseen-in-reference IDs x 3 query; 8 no-cat controls',
                           'selection': 'Seeded eligible IDs and per-ID shuffled files; reject pixel duplicates or dhash <= 4 before inference',
                           'excluded': [e for _, excluded in selections for e in excluded],
                           'visual_identity_exclusions_before_inference': VISUAL_EXCLUSIONS,
                           'training_overlap': 'unknown: model provider did not publish its 131-cat training manifest',
                           'session_independence': 'unknown: source lacks capture-session grouping; different files do not prove different sessions',
                           'assets': {sample['sample_id']: source for sample, source in pairs}}}
        target.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Frozen {len(dataset["samples"])} samples at {target}', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--catalogue', type=Path)
    parser.add_argument('--frozen-manifest', type=Path)
    parser.add_argument('--proxy', help='Optional HTTP proxy; never stored in the manifest')
    prepare(parser.parse_args())
