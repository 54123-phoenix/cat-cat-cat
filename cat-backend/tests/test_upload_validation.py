import asyncio
import io

import pytest
from fastapi import HTTPException
from PIL import Image

from app.api.upload import validate_upload


class FakeUpload:
    def __init__(self, content: bytes, content_type: str = "image/png", filename: str = "test.png"):
        self._content = content
        self.content_type = content_type
        self.filename = filename

    async def read(self) -> bytes:
        return self._content


def _png_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), color="orange").save(buffer, format="PNG")
    return buffer.getvalue()


def test_validate_upload_accepts_real_image():
    content = _png_bytes()
    result = asyncio.run(validate_upload(FakeUpload(content)))
    assert result == content


def test_validate_upload_rejects_empty_file():
    with pytest.raises(HTTPException) as exc:
        asyncio.run(validate_upload(FakeUpload(b"")))
    assert exc.value.status_code == 400


def test_validate_upload_rejects_declared_type_mismatch():
    content = _png_bytes()
    with pytest.raises(HTTPException) as exc:
        asyncio.run(validate_upload(FakeUpload(content, content_type="image/jpeg", filename="test.jpg")))
    assert exc.value.status_code == 400


def test_validate_upload_rejects_fake_image_with_magic_header():
    fake_png = b"\x89PNG\r\n\x1a\nnot really an image"
    with pytest.raises(HTTPException) as exc:
        asyncio.run(validate_upload(FakeUpload(fake_png)))
    assert exc.value.status_code == 400
