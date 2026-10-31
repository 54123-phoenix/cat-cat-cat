"""Fail builds on missing, unresolved LFS, corrupt or placeholder image assets."""
import argparse
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

from PIL import Image

RASTER = {'.png', '.jpg', '.jpeg', '.gif', '.webp'}


def check_assets(roots):
    failures, checked = [], 0
    for root in roots:
        if not root.is_dir():
            failures.append(f'{root}: required asset directory missing')
            continue
        files = sorted(p for p in root.rglob('*') if p.suffix.lower() in RASTER | {'.svg'} and p.is_file())
        if not files:
            failures.append(f'{root}: no images found')
        for path in files:
            checked += 1
            try:
                with path.open('rb') as stream:
                    if stream.read(128).startswith(b'version https://git-lfs.github.com/spec/'):
                        raise ValueError('unresolved Git LFS pointer; fetch LFS objects before building')
                if path.suffix.lower() == '.svg':
                    if ET.parse(path).getroot().tag.split('}')[-1] != 'svg':
                        raise ValueError('not an SVG document')
                else:
                    with Image.open(path) as image:
                        if min(image.size) <= 1:
                            raise ValueError(f'placeholder size {image.size}')
                        image.verify()
                    with Image.open(path) as image:
                        image.load()
            except Exception as exc:
                failures.append(f'{path}: {exc}')
    return checked, failures


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('roots', type=Path, nargs='+')
    args = parser.parse_args()
    checked, failures = check_assets(args.roots)
    for failure in failures:
        print(failure, file=sys.stderr)
    print(f'Checked {checked} images; {len(failures)} failure(s).')
    return int(bool(failures))


if __name__ == '__main__':
    raise SystemExit(main())
