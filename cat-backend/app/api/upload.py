import os
import uuid
from io import BytesIO

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

MAX_UPLOAD_SIZE = 10 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_SUBDIRS = {"cats", "sightings", "posts", "discoveries"}
MAGIC_BYTES = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG": "image/png",
    b"RIFF": "image/webp",
}
EXTENSIONS_BY_MIME = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")


async def validate_upload(file: UploadFile) -> bytes:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Allowed: {', '.join(sorted(ALLOWED_IMAGE_TYPES))}",
        )
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max size: {MAX_UPLOAD_SIZE // (1024 * 1024)}MB",
        )
    detected_type = _detect_magic_bytes(content)
    if detected_type != file.content_type:
        raise HTTPException(status_code=400, detail="File content does not match declared content type")
    _verify_image(content)
    return content


def _detect_magic_bytes(content: bytes) -> str:
    header = content[:12]
    for magic, mime in MAGIC_BYTES.items():
        if header.startswith(magic):
            if mime == "image/webp" and header[8:12] != b"WEBP":
                continue
            return mime
    raise HTTPException(status_code=400, detail="File content does not match an allowed image format")


def _verify_image(content: bytes) -> None:
    try:
        with Image.open(BytesIO(content)) as image:
            image.verify()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image") from exc


async def save_upload(file: UploadFile, subdir: str) -> str:
    if subdir not in ALLOWED_SUBDIRS:
        raise HTTPException(status_code=400, detail="Invalid upload target")
    content = await validate_upload(file)
    ext = EXTENSIONS_BY_MIME.get(file.content_type, ".jpg")
    filename = f"{uuid.uuid4().hex}{ext}"
    dest_dir = os.path.join(UPLOAD_DIR, subdir)
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, filename)
    with open(dest, "wb") as f:
        f.write(content)
    return f"/uploads/{subdir}/{filename}"
