"""Derive Web assets from the approved image, without regenerating the character.

Run with the isolated imagegen-local Python environment. rembg's IS-Net model
is cached outside the repository; --reuse-mask skips model inference.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
PUBLIC = ROOT / "cat-frontend/public/brand"
SOURCE = HERE / "mascot-hybrid-v1.png"
os.environ.setdefault("U2NET_HOME", "D:/.cache/imagegen-models/rembg")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reuse-mask", action="store_true")
    args = parser.parse_args()
    PUBLIC.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGB")
    mask_path = HERE / "foreground-mask.png"
    if not args.reuse_mask:
        from rembg import new_session, remove
        mask = remove(source, session=new_session("isnet-general-use"), only_mask=True)
        mask.save(mask_path)
    mask = Image.open(mask_path).convert("L")
    from rembg.bg import alpha_matting_cutout
    cutout = alpha_matting_cutout(source, mask, 240, 10, 10)
    cutout.save(HERE / "mascot-transparent-v1.png")
    bounds = cutout.getchannel("A").point(lambda value: 255 if value > 16 else 0).getbbox()
    full = ImageOps.pad(cutout.crop(bounds), (768, 768), method=Image.Resampling.LANCZOS, color=(0, 0, 0, 0))
    full = ImageOps.expand(full.resize((736, 736), Image.Resampling.LANCZOS), border=16, fill=(0, 0, 0, 0))
    for size in (192, 384, 768):
        full.resize((size, size), Image.Resampling.LANCZOS).save(PUBLIC / f"mascot-{size}.webp", quality=88, method=6)
    full.resize((384, 384), Image.Resampling.LANCZOS).save(PUBLIC / "mascot-384.png", optimize=True)

    # A head crop keeps the approved face legible at 28–36 CSS pixels.
    head = cutout.crop((264, 66, 790, 592))
    for size in (96, 192):
        head.resize((size, size), Image.Resampling.LANCZOS).save(PUBLIC / f"mascot-head-{size}.webp", quality=90, method=6)
    head.resize((192, 192), Image.Resampling.LANCZOS).save(PUBLIC / "mascot-head-192.png", optimize=True)
    icon = Image.new("RGBA", (192, 192))
    ImageDraw.Draw(icon).ellipse((0, 0, 191, 191), fill="#E7EFFD")
    icon.alpha_composite(head.resize((180, 180), Image.Resampling.LANCZOS), (6, 6))
    for size in (32, 64, 180):
        icon.resize((size, size), Image.Resampling.LANCZOS).save(PUBLIC / f"icon-{size}.png", optimize=True)

    # Neutral square preview works in link cards without implying an official seal.
    social = Image.new("RGB", (1024, 1024), "#EFF4FC")
    social.paste(full, (128, 128), full)
    social.save(PUBLIC / "mascot-social.png", optimize=True)

    board = Image.new("RGB", (1200, 640), "white")
    for col, background in enumerate(("#FFFFFF", "#EFF4FC", "#111B2D")):
        tile = Image.new("RGBA", (400, 640), background)
        tile.alpha_composite(full.resize((376, 376), Image.Resampling.LANCZOS), (12, 30))
        for size, left in ((28, 20), (36, 82), (64, 154), (96, 260)):
            thumb = head.resize((size, size), Image.Resampling.LANCZOS)
            tile.alpha_composite(thumb, (left, 470))
        board.paste(tile.convert("RGB"), (col * 400, 0))
    board.save(HERE / "web-asset-preview.png")
    outputs = {}
    for path in sorted(PUBLIC.iterdir()):
        if path.suffix not in (".png", ".webp"):
            continue
        with Image.open(path) as asset:
            outputs[path.name] = {"bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "size": list(asset.size), "mode": asset.mode}
    manifest = {"source": SOURCE.name, "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(), "segmentation": "rembg 2.0.67 / isnet-general-use", "matting": {"foreground_threshold": 240, "background_threshold": 10, "erode_structure_size": 10}, "bounds": bounds, "head_crop": [264, 66, 790, 592], "outputs": outputs}
    (HERE / "web-asset-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2), flush=True)


if __name__ == "__main__":
    main()
