"""Reference-conditioned mascot refinement with local SDXL; preserves source files."""
import argparse
import hashlib
import json
import time
from pathlib import Path

import torch
from diffusers import AutoPipelineForImage2Image, AutoPipelineForInpainting, DPMSolverMultistepScheduler
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / 'flux/01-campus-cat-v1.png'
STYLE_REFERENCE = ROOT.parent / 'flux/02-library-cat.png'
MODEL = Path(r'D:\.cache\imagegen-models\sdxl-base-1.0')
MODEL_REVISION = '462165984030d82259a11f4367a4eed129e94a7b'
PROMPT = (
    'Elegant storybook illustration of a seated blue and white cat mascot, big sapphire eyes, '
    'pointed ears, round face, asymmetric blue forehead patch, white muzzle and chest, blue '
    'curled tail, same pose, clean white background. Soft painterly shading, subtle short fur, '
    'dimensional rounded forms, gentle studio lighting, delicate contact shadow, refined editorial art.'
)
STYLE_PROMPT = (
    'Refined hand-painted editorial cat illustration, expressive friendly face, white short fur '
    'with deep university blue patches, delicate confident thin contours, soft cool gray shadows '
    'modeling the cheeks and paws, smooth rounded anatomy, restrained fine fur strokes, '
    'soft key light from upper left, gentle ambient occlusion, sophisticated picture-book artwork '
    'on a pure white background, full body portrait.'
)
NEGATIVE = (
    'badge, medal, jewelry, accessory, letters, text, watermark, signature, book, multiple cats, '
    'human, photograph, plastic toy, flat vector, thick black outline, sketch, grain, extra limbs, '
    'deformed paws, malformed anatomy, cropped ears, cropped tail, orange fur'
)
VOLUME_PROMPT = (
    'Softly painted three-dimensional blue and white cat character, rounded cheeks and body, '
    'soft short fur, large sapphire blue eyes, pointed ears, asymmetric cobalt blue forehead '
    'patch, white muzzle and chest, blue curled tail, seated pose. Gentle studio lighting, '
    'rich soft blue-gray shadows, subtle fur texture, illustrated depth, white background.'
)
VOLUME_STYLE = (
    'Dimensional hand-painted storybook cat, beautiful soft fur shading, volume modeled by '
    'light, thin delicate contours, fine painted fur strokes, soft light from upper left, '
    'ambient occlusion beneath the chin and between paws, gentle shadow on the floor, '
    'friendly stylized face, refined editorial illustration, clear blue and white colors.'
)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--size', type=int, default=768)
    parser.add_argument('--strengths', type=float, nargs='+', default=[0.42, 0.55])
    parser.add_argument('--seed', type=int, default=1109)
    parser.add_argument('--steps', type=int, default=32)
    parser.add_argument('--skip-inpaint', action='store_true')
    parser.add_argument('--style', choices=['subtle', 'volume'], default='subtle')
    parser.add_argument('--input', type=Path)
    parser.add_argument('--tag', default='')
    parser.add_argument('--guidance', type=float, default=6.0)
    args = parser.parse_args()
    ROOT.mkdir(parents=True, exist_ok=True)
    assert torch.cuda.is_available(), 'CUDA is required for this local workflow.'
    print(json.dumps({'event': 'cuda_ready', 'torch': torch.__version__, 'cuda': torch.version.cuda,
                      'gpu': torch.cuda.get_device_name(0), 'arch': torch.cuda.get_device_capability(0)}), flush=True)
    torch.set_num_threads(8)
    pipe = AutoPipelineForImage2Image.from_pretrained(
        str(MODEL), torch_dtype=torch.float16, variant='fp16', use_safetensors=True,
        local_files_only=True, add_watermarker=False,
    )
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config, use_karras_sigmas=True)
    pipe.enable_model_cpu_offload()
    pipe.enable_vae_tiling()
    source = Image.open(SOURCE).convert('RGB')
    clean_path = ROOT / 'reference-a-cleaned.png'
    if args.skip_inpaint:
        source = Image.open(args.input if args.input else clean_path).convert('RGB')
    else:
        mask = Image.new('L', source.size, 0)
        draw = ImageDraw.Draw(mask)
        draw.polygon([(491, 640), (552, 640), (579, 733), (575, 817), (480, 817), (465, 746), (489, 721)], fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(4))
        mask.save(ROOT / 'chest-cleanup-mask.png')
        inpaint = AutoPipelineForInpainting.from_pipe(pipe)
        inpaint.enable_model_cpu_offload()
        inpaint.enable_vae_tiling()
        print('Removing the unwanted chest ornament inside the mask.', flush=True)
        source = inpaint(
            prompt='White furry chest and front legs of a seated blue and white cat illustration. Plain white fur, natural chest anatomy, two front paws, soft gray shadow between the front legs.',
            negative_prompt='badge, medal, ribbon, jewelry, clothes, text, watermark, blue spot on chest, deformed legs',
            image=source, mask_image=mask, strength=0.99, num_inference_steps=28, guidance_scale=5.0,
            generator=torch.Generator('cpu').manual_seed(args.seed),
        ).images[0]
        source.save(clean_path)
        pipe = AutoPipelineForImage2Image.from_pipe(inpaint)
        pipe.enable_model_cpu_offload()
        pipe.enable_vae_tiling()
    init = source.resize((args.size, args.size), Image.Resampling.LANCZOS)
    results = []
    prompt, style_prompt = (VOLUME_PROMPT, VOLUME_STYLE) if args.style == 'volume' else (PROMPT, STYLE_PROMPT)
    for strength in args.strengths:
        start = time.monotonic()
        suffix = '-volume' if args.style == 'volume' else ''
        suffix += f'-{args.tag}' if args.tag else ''
        filename = f'hybrid-{args.size}-s{round(strength * 100):02d}-seed{args.seed}{suffix}.png'
        print(json.dumps({'event': 'generating', 'file': filename, 'strength': strength}), flush=True)
        image = pipe(
            prompt=prompt, prompt_2=style_prompt, negative_prompt=NEGATIVE, negative_prompt_2=NEGATIVE,
            image=init, strength=strength, guidance_scale=args.guidance, num_inference_steps=args.steps,
            generator=torch.Generator('cpu').manual_seed(args.seed),
        ).images[0]
        image.save(ROOT / filename)
        entry = {'file': filename, 'size': list(image.size), 'strength': strength,
                 'seed': args.seed, 'steps': args.steps, 'guidance_scale': args.guidance,
                 'elapsed_seconds': round(time.monotonic() - start, 2), 'sha256': digest(ROOT / filename)}
        results.append(entry)
        print(json.dumps({'event': 'saved', **entry}), flush=True)
    record = {
        'date': '2026-11-09', 'mode': 'local_reference_conditioned_image_to_image',
        'model': 'stabilityai/stable-diffusion-xl-base-1.0', 'revision': MODEL_REVISION,
        'reference_a': {'file': str(SOURCE), 'role': 'image input; identity and composition', 'sha256': digest(SOURCE)},
        'reference_b': {'file': str(STYLE_REFERENCE), 'role': 'visual style reference translated into prompts; not a direct model input', 'sha256': digest(STYLE_REFERENCE)},
        'prompt': prompt, 'prompt_2': style_prompt, 'negative_prompt': NEGATIVE,
        'cleanup': {'file': clean_path.name, 'method': 'local SDXL masked inpainting', 'mask': 'chest-cleanup-mask.png'},
        'initial_image': str(args.input if args.input else clean_path),
        'outputs': results,
    }
    strengths = '-'.join(str(round(x * 100)) for x in args.strengths)
    tag = f'-{args.tag}' if args.tag else ''
    (ROOT / f'run-{args.size}-seed{args.seed}-{args.style}-s{strengths}{tag}.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
