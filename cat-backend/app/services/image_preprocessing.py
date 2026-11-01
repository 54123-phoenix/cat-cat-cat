"""Versioned image geometry shared by reference and query embedding paths."""
from PIL import Image

PREPROCESS_VERSIONS = {
    'center224': 'rgb-bicubic-short256-center224-imagenet-cls-linear256-l2-v1',
    'letterbox224': 'rgb-bicubic-long224-round-pad124-116-104-imagenet-cls-linear256-l2-v1',
}


def letterbox_image(image: Image.Image) -> Image.Image:
    """Keep the complete crop and aspect ratio; pad with rounded ImageNet mean."""
    w, h = image.size
    scale = 224 / max(w, h)
    resized = image.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.Resampling.BICUBIC)
    canvas = Image.new('RGB', (224, 224), (124, 116, 104))
    canvas.paste(resized, ((224 - resized.width) // 2, (224 - resized.height) // 2))
    return canvas


def model_input_image(image: Image.Image, mode: str) -> Image.Image:
    if mode == 'letterbox224':
        return letterbox_image(image)
    if mode != 'center224':
        raise ValueError('Unsupported recognition preprocessing mode')
    w, h = image.size
    scale = 256 / min(w, h)
    new_w, new_h = int(w * scale), int(h * scale)
    resized = image.resize((new_w, new_h), Image.Resampling.BICUBIC)
    left, top = (new_w - 224) // 2, (new_h - 224) // 2
    return resized.crop((left, top, left + 224, top + 224))
