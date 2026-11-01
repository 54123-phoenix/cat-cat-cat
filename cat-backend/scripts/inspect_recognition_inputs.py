"""Render real detector crops and denormalized model inputs, without ranking.

Use only development/diagnostic images. Output photographs remain local.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def inspect(manifest_path, output, identities):
    os.environ.update(JWT_SECRET='isolated-input-diagnosis-only', ADMIN_PASSWORD='isolated-input-diagnosis-only',
                      DATABASE_URL='sqlite://', INIT_DEMO_USER='0', REDIS_URL='', PYTHON_DOTENV_DISABLED='1')
    from app.services import detector, model_loader
    from app.services.reference_snapshot import runtime_identity
    from scripts.eval_recognition import sample_path

    manifest = json.loads(manifest_path.read_bytes())
    output.mkdir(parents=True, exist_ok=False)
    model_hash, pipeline = runtime_identity(True)
    samples = sorted((s for s in manifest['samples'] if s['identity'] in identities),
                     key=lambda s: (s['identity'], s['sample_id']))
    if not samples:
        raise ValueError('No matching identities')
    records = []
    for index, sample in enumerate(samples):
        path = sample_path(manifest_path.parent, sample['file'])
        if hashlib.sha256(path.read_bytes()).hexdigest() != sample['sha256']:
            raise ValueError('Manifest/image mismatch: ' + sample['sample_id'])
        with Image.open(path) as original:
            orientation = original.getexif().get(274)
            source = original.convert('RGB')
        crop = detector.detect_and_crop(source, expected_digest=pipeline.detector_sha256)
        tensor = model_loader.preprocess_image(crop)
        if tensor is None:
            raise RuntimeError('Complete inference runtime is required')
        pixels = tensor[0].cpu().numpy().transpose(1, 2, 0)
        pixels = pixels * np.array(model_loader._STD) + np.array(model_loader._MEAN)
        actual = Image.fromarray(np.clip(np.rint(pixels * 255), 0, 255).astype('uint8'))
        sheet = Image.new('RGB', (990, 380), 'white')
        draw = ImageDraw.Draw(sheet)
        draw.text((8, 5), sample['sample_id'] + ' / ' + sample['split'], fill='black')
        for col, (label, im) in enumerate([('Original RGB', source), ('Real YOLO crop', crop),
                                          ('Actual model input 224x224', actual)]):
            draw.text((col * 330 + 8, 25), label + f' {im.size}', fill='black')
            thumb = im.copy(); thumb.thumbnail((320, 320))
            sheet.paste(thumb, (col * 330 + 8, 50))
        filename = f'{index:03d}.jpg'
        sheet.save(output / filename)
        w, h = crop.size
        scale = 256 / min(w, h)
        resized = (int(w * scale), int(h * scale))
        records.append({'sample_id': sample['sample_id'], 'sha256': sample['sha256'],
                        'split': sample['split'], 'identity': sample['identity'],
                        'original_size': source.size, 'exif_orientation': orientation,
                        'detector_crop_size': crop.size,
                        'center_crop_retained_area': 224 * 224 / (resized[0] * resized[1]),
                        'sheet': filename,
                        'sheet_sha256': hashlib.sha256((output / filename).read_bytes()).hexdigest()})
        print(sample['sample_id'], crop.size, flush=True)
    report = {'scope': 'Post-evaluation input diagnosis; no independent quality claim',
              'manifest_sha256': hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
              'model_sha256': model_hash, 'pipeline': pipeline.model_dump(), 'samples': records}
    (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--identity', action='append', required=True)
    args = parser.parse_args()
    inspect(args.manifest.resolve(), args.output.resolve(), set(args.identity))
