import os
import uuid
import hashlib
import logging
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

MAX_UPLOAD_SIZE = 10 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_SUBDIRS = {"cats", "sightings", "posts", "discoveries", "avatars"}
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
logger = logging.getLogger(__name__)


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
    return save_validated_upload(content, file.content_type, subdir)


def save_validated_upload(content: bytes, content_type: str, subdir: str) -> str:
    """Persist bytes already checked by validate_upload in the same request."""
    if subdir not in ALLOWED_SUBDIRS:
        raise HTTPException(status_code=400, detail="Invalid upload target")
    ext = EXTENSIONS_BY_MIME[content_type]
    filename = f"{uuid.uuid4().hex}{ext}"
    dest_dir = os.path.join(UPLOAD_DIR, subdir)
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, filename)
    created = False
    try:
        with open(dest, "xb") as f:
            created = True
            f.write(content)
    except Exception:
        # An exclusive open establishes ownership. A collision must never remove
        # the existing file; a partial write has not been returned to any caller.
        if created:
            try:
                os.unlink(dest)
            except OSError:
                logger.warning('Could not remove incomplete new upload %s', dest, exc_info=True)
        raise
    return f"/uploads/{subdir}/{filename}"


def discard_created_upload(image_path: str, expected_sha256: str) -> None:
    """Remove a caller-owned new file only after its database references were checked."""
    parts = image_path.split('/')
    if len(parts) != 4 or parts[:2] != ['', 'uploads'] or parts[2] not in ALLOWED_SUBDIRS:
        raise ValueError('Not a generated upload path')
    name, ext = os.path.splitext(parts[3])
    if len(name) != 32 or any(c not in '0123456789abcdef' for c in name) or ext not in EXTENSIONS_BY_MIME.values():
        raise ValueError('Not a generated upload filename')
    root = Path(UPLOAD_DIR).resolve()
    path = root.joinpath(parts[2], parts[3])
    if path.is_symlink() or not path.resolve().is_relative_to(root):
        raise ValueError('Upload path is outside the configured directory')
    try:
        with path.open('rb') as handle:
            actual_sha256 = hashlib.file_digest(handle, 'sha256').hexdigest()
        if actual_sha256 != expected_sha256:
            raise ValueError('New upload content changed; preserving it')
        path.unlink()
    except FileNotFoundError:
        pass
