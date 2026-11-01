"""Pinned public weights for reproducible runtime acceptance, not a quality dataset."""
import argparse
import hashlib
import json
from pathlib import Path
import tempfile
import urllib.request

ASSETS = {
    'finetuned_best.pt': {
        'url': 'https://huggingface.co/theavenger/cat-reid-dinov3/resolve/fefdd206f2a77ef7247ca583e5604441e5b3259f/finetuned_best.pt',
        'sha256': '32f04b89e7f292ddfa9b6f9d1f97bc2f465981d40b149e383e988e6a1b4beb6e',
        'size': 343421597,
    },
    'yolov8m.pt': {
        'url': 'https://github.com/ultralytics/assets/releases/download/v8.3.0/yolov8m.pt',
        'sha256': '5d4a90cdc7a21786cc59cd19778e9eafff836df9e2da32524737c7ee6efe4fe5',
        'size': 52136884,
    },
}


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def verify_assets(directory):
    for name, spec in ASSETS.items():
        path = directory / name
        if not path.is_file() or path.stat().st_size != spec['size'] or digest(path) != spec['sha256']:
            raise ValueError(f'{name}: missing or different from the pinned acceptance weight')
    return ASSETS


def download_assets(directory):
    directory.mkdir(parents=True, exist_ok=True)
    for name, spec in ASSETS.items():
        target = directory / name
        if target.exists():
            if target.stat().st_size != spec['size'] or digest(target) != spec['sha256']:
                raise ValueError(f'{target}: refusing to overwrite an existing different file')
            continue
        with tempfile.NamedTemporaryFile(dir=directory, suffix='.partial', delete=False) as stream:
            partial = Path(stream.name)
            try:
                with urllib.request.urlopen(spec['url'], timeout=120) as response:
                    while chunk := response.read(1024 * 1024):
                        stream.write(chunk)
                stream.close()
                if partial.stat().st_size != spec['size'] or digest(partial) != spec['sha256']:
                    raise ValueError(f'{name}: downloaded size/hash differs from the pinned asset')
                partial.replace(target)
            finally:
                stream.close()
                partial.unlink(missing_ok=True)
    return verify_assets(directory)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(download_assets(args.output_dir.resolve()), indent=2))
