"""Build a comparison sheet from the three actual generated source images."""
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
MODEL_PAGE = 'https://huggingface.co/black-forest-labs/FLUX.1-schnell'
DEMO_PAGE = 'https://huggingface.co/spaces/black-forest-labs/FLUX.1-schnell'
ITEMS = [
    ('A', '01-campus-cat-v1.webp', '平面校园猫', '轮廓鲜明；多余胸饰待精修', '992258076136d685785666747069d4a4af50ef424e238c044fc64833498e4188'),
    ('B', '02-library-cat.webp', '图书馆的猫', '安静、书卷气，校园感更明确', 'efcfd1b9b50653b434a087c4e5b28a498bc13070ccb6c2358acd1e4870686b00'),
    ('C', '03-ceramic-cat.webp', '陶瓷质感猫', '形体柔和，适合较大的形象展示', 'ef8d3b42ceb77a9b4d4774bcd71527a8f5e0f612afb1433d412240438553ecbc'),
]


def font(size, bold=False):
    return ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc' if bold else 'C:/Windows/Fonts/msyh.ttc', size)


board = Image.new('RGB', (1800, 920), '#F4F7FC')
draw = ImageDraw.Draw(board)
draw.text((56, 36), '复旦蓝 · 校园猫形象探索', font=font(48, True), fill='#18253D')
draw.text((58, 106), '三种方向，同一蓝白基调。先比较形象气质，再选定一个方向完善。', font=font(25), fill='#465775')
outputs = []
for index, (key, name, label, note, remote_hash) in enumerate(ITEMS):
    path = ROOT / name
    with Image.open(path) as source:
        source.load()
        assert source.size == (1024, 1024), (name, source.size)
        rgb = source.convert('RGB')
        png_path = path.with_suffix('.png')
        rgb.save(png_path)
        preview = rgb.resize((512, 512), Image.Resampling.LANCZOS)
        x, y = 54 + index * 582, 178
        draw.rounded_rectangle((x, y, x + 528, y + 628), radius=18, fill='white', outline='#D7E2F4', width=2)
        board.paste(preview, (x + 8, y + 8))
        draw.text((x + 22, y + 535), f'{key} · {label}', font=font(30, True), fill='#0E419C')
        draw.text((x + 22, y + 581), note, font=font(22), fill='#465775')
        outputs.append({
            'id': key, 'label': label, 'source': name, 'png_copy': png_path.name,
            'width': source.width, 'height': source.height, 'mode': source.mode,
            'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'source_download_url': f'https://black-forest-labs-flux-1-schnell.hf.space/gradio_api/file=/tmp/gradio/{remote_hash}/image.webp',
            'review_note': note,
        })
draw.text((58, 848), 'FLUX.1 [schnell] 实际生成 · 原图 1024 × 1024 · 当前为概念选型，尚未替换网站素材', font=font(23), fill='#586780')
board.save(ROOT / 'contact-sheet.png')

manifest = {
    'date': '2026-11-09', 'timezone': 'Asia/Kuala_Lumpur',
    'status': 'three_concepts_generated', 'model': 'FLUX.1-schnell',
    'mode': 'official_public_demo_browser', 'model_page': MODEL_PAGE, 'demo_page': DEMO_PAGE,
    'model_license_as_listed': 'Apache-2.0',
    'prompts': 'prompts.jsonl', 'comparison': 'contact-sheet.png',
    'successful_generations': 3, 'outputs': outputs,
    'checks': ['Original files decoded with Pillow', 'All three originals are 1024x1024', 'Visual review of all three browser results', 'A has an extra chest ornament and is a concept requiring refinement'],
    'followup_attempt': {'id': 'A-refinement', 'status': 'blocked_guest_quota', 'generated_images': 0, 'message': 'Guest quota reached', 'retried': False},
    'other_routes': {
        'built_in_image_generation': 'not_available_in_current_tools',
        'existing_gateway': {'model_list_http_status': 200, 'available_models': ['gpt-6-astra', 'gpt-6-luna', 'gpt-6-sol'], 'prior_gpt_image_2_http_status': 403},
        'chatgpt_website': 'login_required',
        'fal_and_adobe': 'suggested_but_not_confirmed_connected',
        'local_generation': 'GPU present; no existing image generation runtime or weights; no installation needed after public demo succeeded',
    },
    'notes': ['Original WEBP outputs are retained. PNG copies and the comparison sheet contain no AI regeneration.', 'Requested blue palette is a design direction; exact output color values are model-generated.', 'No existing Web assets were replaced. The refinement requires available account quota.'],
}
(ROOT / 'generation-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'generated_images': len(outputs), 'comparison': str(ROOT / 'contact-sheet.png'), 'sources': [o['source'] for o in outputs]}, ensure_ascii=False))
