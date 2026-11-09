"""Save the selected real model output with a restrained blue hue correction."""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
RAW = ROOT / 'hybrid-1024-s26-seed1109-volume-refined.png'
ORIGINAL = ROOT.parent / 'flux/01-campus-cat-v1.png'
rgb = Image.open(RAW).convert('RGB')
hsv = np.asarray(rgb.convert('HSV')).astype(np.float32)
h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
weight = np.clip((s - 40) / 60, 0, 1) * ((h >= 135) & (h <= 177))
hsv[..., 0] = h * (1 - weight) + 155 * weight
hsv[..., 1] = np.minimum(255, s * (1 + 0.06 * weight))
final = Image.fromarray(hsv.clip(0, 255).astype('uint8'), mode='HSV').convert('RGB')
final_path = ROOT / 'mascot-hybrid-v1.png'
final.save(final_path)

def font(size, bold=False):
    return ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc' if bold else 'C:/Windows/Fonts/msyh.ttc', size)

board = Image.new('RGB', (1600, 1000), '#F4F7FC')
draw = ImageDraw.Draw(board)
draw.text((60, 36), '蓝白形象保留 · 插画质感增强', font=font(46, True), fill='#18253D')
draw.text((62, 107), '保留大耳朵、蓝白额纹和大眼睛；增加毛发层次、柔和光影与体积感。', font=font(25), fill='#465775')
for x, label, img in [(60, '第一版 · 形象参考', Image.open(ORIGINAL).convert('RGB')), (840, '融合版 · 立体插画', final)]:
    draw.rounded_rectangle((x, 173, x + 700, 940), radius=18, fill='white', outline='#D7E2F4', width=2)
    board.paste(img.resize((680, 680), Image.Resampling.LANCZOS), (x + 10, 183))
    draw.text((x + 24, 880), label, font=font(29, True), fill='#0E419C')
board.save(ROOT / 'before-after.png')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

record = {
    'date': '2026-11-09', 'timezone': 'Asia/Kuala_Lumpur', 'status': 'generated_and_visually_reviewed',
    'selected_file': final_path.name, 'size': list(final.size), 'sha256': sha(final_path),
    'raw_selected_file': RAW.name, 'raw_sha256': sha(RAW), 'comparison': 'before-after.png',
    'model': 'stabilityai/stable-diffusion-xl-base-1.0',
    'model_page': 'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0',
    'model_revision': '462165984030d82259a11f4367a4eed129e94a7b',
    'mode': 'local CUDA image-to-image, not the OpenAI CLI or a hosted image API',
    'design': 'A character identity with B-inspired editorial texture and stronger dimensional shading',
    'references': {'A': 'Image input', 'B': 'Visual style reference translated into text prompts; not a direct model input'},
    'stages': [
        {'name': 'Remove chest ornament', 'method': 'Masked local SDXL inpainting', 'file': 'reference-a-cleaned.png'},
        {'name': 'Select dimensional draft', 'file': 'hybrid-768-s82-seed1109-volume.png', 'record': 'run-768-seed1109-volume-s72-82.json'},
        {'name': 'Refine at 1024 pixels', 'file': RAW.name, 'record': 'run-1024-seed1109-volume-s26-34-refined.json'},
        {'name': 'Blue palette refinement', 'method': 'Hue moves toward 218.8 degrees only in saturated blue regions; saturation +0–6%; HSV value preserved'},
    ],
    'review': {'retained': ['Blue and white asymmetrical face', 'Large blue eyes and pointed ears', 'Seated character with tail on viewer left'],
               'changed': ['Removed extra chest ornament', 'Softer painted fur and shadows', 'More rounded cheeks and paws', 'Fuller, furrier tail with white accent'],
               'rejected': ['First low-strength drafts remained too flat', 'Direct 1024 drafts changed the expression and shading too much'],
               'remaining_scope': 'Concept review; not yet integrated into Web assets'},
    'local_runtime': r'D:\Desktop\fdmm\cat-cat-cat-review\imagegen-local\.venv',
    'local_model_directory': r'D:\.cache\imagegen-models\sdxl-base-1.0',
    'versions': {'torch': '2.7.1+cu128', 'diffusers': '0.36.0', 'transformers': '4.57.1', 'accelerate': '1.11.0'},
}
(ROOT / 'final-manifest.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'final': str(final_path), 'size': list(final.size), 'comparison': str(ROOT / 'before-after.png')}, ensure_ascii=False))
