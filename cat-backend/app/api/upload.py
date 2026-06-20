import os
import uuid

from fastapi import HTTPException, UploadFile

MAX_UPLOAD_SIZE = 10 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAGIC_BYTES = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG": "image/png",
    b"RIFF": "image/webp",
}
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")


async def validate_upload(file: UploadFile) -> bytes:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Allowed: {', '.join(sorted(ALLOWED_IMAGE_TYPES))}",
        )
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max size: {MAX_UPLOAD_SIZE // (1024 * 1024)}MB",
        )
    _check_magic_bytes(content)
    return content


def _check_magic_bytes(content: bytes) -> None:
    header = content[:12]
    matched = False
    for magic, mime in MAGIC_BYTES.items():
        if header.startswith(magic):
            matched = True
            break
    if not matched:
        raise HTTPException(status_code=400, detail="File content does not match an allowed image format")


async def save_upload(file: UploadFile, subdir: str) -> str:
    content = await validate_upload(file)
    ext = os.path.splitext(file.filename or ".jpg")[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    dest_dir = os.path.join(UPLOAD_DIR, subdir)
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, filename)
    with open(dest, "wb") as f:
        f.write(content)
    return f"/uploads/{subdir}/{filename}"
