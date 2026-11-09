"""Preview behavior with generated images only; never accesses real uploads."""
from io import BytesIO
import os
from pathlib import Path
from unittest.mock import Mock

import numpy as np
from PIL import Image, ImageChops, ImageStat
import pytest

import app.main as main
from app.services import upload_thumbnail as thumbnails
from test_upload_serving import client, _directory_link


@pytest.fixture
def image_root(tmp_path, monkeypatch):
    root = tmp_path / "uploads"
    root.mkdir()
    monkeypatch.setattr(main, "UPLOAD_DIR", str(root))
    monkeypatch.setattr(thumbnails, "_cache", thumbnails.ThumbnailCache())
    return root


def write_image(path, size=(1600, 800), color="orange", image_format="PNG", **options):
    with Image.new("RGB", size, color=color) as image:
        image.save(path, format=image_format, **options)
    return path.read_bytes()


@pytest.mark.parametrize("image_format", ["JPEG", "PNG", "WEBP"])
@pytest.mark.parametrize("width", thumbnails.ALLOWED_WIDTHS)
def test_preview_uses_requested_width_and_keeps_original_bytes(client, image_root, image_format, width):
    original = write_image(image_root / "photo.bin", image_format=image_format)
    response = client.get(f"/uploads/photo.bin?w={width}")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/webp"
    with Image.open(BytesIO(response.content)) as preview:
        assert preview.size == (width, width // 2)
        assert preview.format == "WEBP"
    assert (image_root / "photo.bin").read_bytes() == original
    assert client.get("/uploads/photo.bin").content == original


def test_small_sources_are_not_upscaled_and_portraits_keep_srcset_width(client, image_root):
    write_image(image_root / "small.png", size=(80, 40))
    write_image(image_root / "portrait.png", size=(800, 2400))
    with Image.open(BytesIO(client.get("/uploads/small.png?w=320").content)) as preview:
        assert preview.size == (80, 40)
    with Image.open(BytesIO(client.get("/uploads/portrait.png?w=640").content)) as preview:
        assert preview.size == (640, 1920)


def test_preview_saves_bytes_while_preserving_resized_image_content(client, image_root):
    rng = np.random.default_rng(21)
    path = image_root / "photo.jpg"
    with Image.fromarray(rng.integers(0, 256, (900, 1200, 3), dtype=np.uint8)) as image:
        image.save(path, quality=95)
    original = path.read_bytes()
    response = client.get("/uploads/photo.jpg?w=320")
    assert response.status_code == 200
    assert len(response.content) < len(original) * .25
    with Image.open(BytesIO(original)) as source, Image.open(BytesIO(response.content)) as preview:
        source.thumbnail((320, 4096), Image.Resampling.LANCZOS, reducing_gap=3.0)
        # Generated detail/noise fixture measures encoding fidelity after the
        # requested resize, not an unsupported quality claim about campus photos.
        assert max(ImageStat.Stat(ImageChops.difference(source.convert("RGB"), preview.convert("RGB"))).mean) < 15


@pytest.mark.parametrize("mode", ["RGBA", "palette"])
def test_png_transparency_survives_preview(client, image_root, mode):
    path = image_root / "transparent.png"
    if mode == "RGBA":
        with Image.new("RGBA", (640, 320), (220, 80, 30, 37)) as image:
            image.save(path)
        expected_alpha = (37, 37)
    else:
        with Image.new("P", (640, 320), 0) as image:
            image.putpalette([220, 80, 30] + [0] * 765)
            image.save(path, transparency=0)
        expected_alpha = (0, 0)
    response = client.get("/uploads/transparent.png?w=320")
    assert response.status_code == 200
    with Image.open(BytesIO(response.content)) as preview:
        assert preview.convert("RGBA").getchannel("A").getextrema() == expected_alpha


def test_exif_orientation_is_applied_and_metadata_not_carried_to_preview(client, image_root):
    path = image_root / "rotated.jpg"
    exif = Image.Exif()
    exif[274] = 6
    exif[270] = "fixture metadata must not be copied"
    original = write_image(path, size=(300, 600), image_format="JPEG", exif=exif)
    response = client.get("/uploads/rotated.jpg?w=320")
    assert response.status_code == 200
    with Image.open(BytesIO(response.content)) as preview:
        assert preview.size == (320, 160)
        assert not preview.getexif()
    assert path.read_bytes() == original


@pytest.mark.parametrize("query", ["w=0", "w=-320", "w=321", "w=320.0", "w=0320", "w=+320", "w=", "w=wide", "w=320&w=640", "w=320&w=320"])
def test_noncanonical_or_duplicate_widths_are_rejected(client, image_root, query):
    write_image(image_root / "photo.png", size=(8, 8))
    assert client.get("/uploads/photo.png?" + query).status_code == 422


def test_corrupt_unsupported_and_animated_sources_fail_without_changing_original(client, image_root):
    corrupt = image_root / "broken.png"
    corrupt.write_bytes(b"\x89PNG\r\n\x1a\ninvalid")
    write_image(image_root / "unsupported.gif", size=(16, 16), image_format="GIF")
    with Image.new("RGB", (16, 16), "red") as first, Image.new("RGB", (16, 16), "blue") as second:
        first.save(image_root / "animated.webp", format="WEBP", save_all=True, append_images=[second], duration=100, loop=0)
    for name, status in [("broken.png", 422), ("unsupported.gif", 415), ("animated.webp", 415)]:
        original = (image_root / name).read_bytes()
        assert client.get(f"/uploads/{name}?w=160").status_code == status
        assert client.get(f"/uploads/{name}").content == original


@pytest.mark.parametrize("limit,value", [("MAX_SOURCE_BYTES", 10), ("MAX_SOURCE_PIXELS", 10),
                                         ("MAX_SOURCE_EDGE", 3), ("MAX_OUTPUT_BYTES", 1), ("MAX_OUTPUT_HEIGHT", 3)])
def test_resource_limits_return_413_without_mutating_source(client, image_root, monkeypatch, limit, value):
    original = write_image(image_root / "photo.png", size=(8, 8))
    monkeypatch.setattr(thumbnails, limit, value)
    assert client.get("/uploads/photo.png?w=160").status_code == 413
    assert (image_root / "photo.png").read_bytes() == original


def test_pillow_decompression_bomb_is_refused(client, image_root, monkeypatch):
    write_image(image_root / "photo.png", size=(8, 8))
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 2)
    assert client.get("/uploads/photo.png?w=160").status_code == 413


def test_etag_revalidation_and_source_change_invalidate_cached_bytes(client, image_root, monkeypatch):
    path = image_root / "photo.png"
    original = write_image(path, size=(80, 40), color="red", compress_level=0)
    initial_stat = path.stat()
    renderer = Mock(wraps=thumbnails._render)
    monkeypatch.setattr(thumbnails, "_render", renderer)
    first = client.get("/uploads/photo.png?w=160")
    assert first.status_code == 200
    assert first.headers["cache-control"] == "public, no-cache"
    second = client.get("/uploads/photo.png?w=160", headers={"If-None-Match": '"other", W/' + first.headers["etag"]})
    assert second.status_code == 304 and second.content == b""
    assert renderer.call_count == 1
    changed = write_image(path, size=(80, 40), color="blue", compress_level=0)
    assert len(changed) == len(original)
    os.utime(path, ns=(initial_stat.st_atime_ns, initial_stat.st_mtime_ns))
    replaced = client.get("/uploads/photo.png?w=160", headers={"If-None-Match": first.headers["etag"]})
    assert replaced.status_code == 200
    assert replaced.headers["etag"] != first.headers["etag"]
    assert renderer.call_count == 2
    path.unlink()
    assert client.get("/uploads/photo.png?w=160").status_code == 404


def test_warm_cache_never_bypasses_link_boundary(client, image_root, tmp_path):
    inside = image_root / "cats"
    outside = tmp_path / "private"
    inside.mkdir()
    outside.mkdir()
    write_image(inside / "photo.png", size=(16, 16), color="red")
    secret = write_image(outside / "photo.png", size=(16, 16), color="blue")
    link = image_root / "alias"
    _directory_link(link, inside)
    assert client.get("/uploads/alias/photo.png?w=160").status_code == 200
    if os.name == "nt":
        link.rmdir()  # Removes only the disposable junction, not its target.
    else:
        link.unlink()
    _directory_link(link, outside)
    response = client.get("/uploads/alias/photo.png?w=160")
    assert response.status_code == 403 and response.content != secret
    assert response.json() == {"detail": "Access denied"}


def test_root_replaced_after_route_validation_is_not_retrusted(client, image_root, tmp_path, monkeypatch):
    write_image(image_root / "photo.png", size=(16, 16), color="red")
    assert client.get("/uploads/photo.png?w=160").status_code == 200
    outside = tmp_path / "private"
    outside.mkdir()
    write_image(outside / "photo.png", size=(16, 16), color="blue")
    run_in_threadpool = main.run_in_threadpool

    async def replace_root_before_worker(function, *args):
        # Only remove the generated file and its now-empty temporary directory.
        # This simulates a root swap in the route-to-worker scheduling window.
        (image_root / "photo.png").unlink()
        image_root.rmdir()
        _directory_link(image_root, outside)
        return await run_in_threadpool(function, *args)

    monkeypatch.setattr(main, "run_in_threadpool", replace_root_before_worker)
    response = client.get("/uploads/photo.png?w=160")

    assert response.status_code == 403
    assert response.json() == {"detail": "Access denied"}


def test_cache_evicts_by_total_bytes_and_entries():
    cache = thumbnails.ThumbnailCache(max_bytes=10, max_entries=2)
    item = thumbnails.Thumbnail(b"1234", 1, 1, '"etag"')
    cache.put("a", item)
    cache.put("b", item)
    assert cache.get("a") is item
    cache.put("c", item)
    assert cache.get("b") is None and cache.size_bytes == 8
    cache.put("large", thumbnails.Thumbnail(b"1234567", 1, 1, '"large"'))
    assert cache.get("a") is None and cache.get("c") is None
    assert cache.size_bytes == 7
    cache.put("oversized", thumbnails.Thumbnail(b"x" * 11, 1, 1, '"too-big"'))
    assert cache.get("oversized") is None and cache.size_bytes <= 10


def test_busy_preview_returns_retry_hint_and_original_remains_available(client, image_root, monkeypatch):
    original = write_image(image_root / "photo.png", size=(8, 8))
    limiter = Mock()
    limiter.acquire.return_value = False
    monkeypatch.setattr(thumbnails, "_operations", limiter)
    response = client.get("/uploads/photo.png?w=160")
    assert response.status_code == 503 and response.headers["retry-after"] == "1"
    limiter.release.assert_not_called()
    assert client.get("/uploads/photo.png").content == original
