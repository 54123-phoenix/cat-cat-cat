"""Bounded, on-demand previews of local uploads. Original files are never changed.

Every request revalidates the path and hashes bounded source bytes before a cache
lookup. Cache hits therefore cannot serve a deleted, replaced or escaped source.
"""
from collections import OrderedDict
from dataclasses import dataclass
import hashlib
from io import BytesIO
import os
from pathlib import Path
import stat
from threading import BoundedSemaphore, RLock

from PIL import Image, ImageOps, UnidentifiedImageError


ALLOWED_WIDTHS = (160, 320, 640, 960, 1280)
MAX_SOURCE_BYTES = 10 * 1024 * 1024
MAX_SOURCE_PIXELS = 16_000_000
MAX_SOURCE_EDGE = 16_384
MAX_OUTPUT_HEIGHT = 4096
MAX_OUTPUT_BYTES = 4 * 1024 * 1024
WEBP_QUALITY = 78
CACHE_MAX_BYTES = 32 * 1024 * 1024
CACHE_MAX_ENTRIES = 128
_operations = BoundedSemaphore(2)


class ThumbnailError(Exception):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class Thumbnail:
    body: bytes
    width: int
    height: int
    etag: str
    media_type: str = "image/webp"


class ThumbnailCache:
    def __init__(self, max_bytes=CACHE_MAX_BYTES, max_entries=CACHE_MAX_ENTRIES):
        self.max_bytes = max_bytes
        self.max_entries = max_entries
        self.size_bytes = 0
        self.entries = OrderedDict()
        self.lock = RLock()

    def get(self, key):
        with self.lock:
            item = self.entries.get(key)
            if item is not None:
                self.entries.move_to_end(key)
            return item

    def put(self, key, item):
        with self.lock:
            previous = self.entries.pop(key, None)
            if previous is not None:
                self.size_bytes -= len(previous.body)
            if len(item.body) > self.max_bytes or self.max_entries < 1:
                return
            self.entries[key] = item
            self.size_bytes += len(item.body)
            while self.size_bytes > self.max_bytes or len(self.entries) > self.max_entries:
                _, removed = self.entries.popitem(last=False)
                self.size_bytes -= len(removed.body)


_cache = ThumbnailCache()


def _inside(path: Path, root: Path) -> Path:
    try:
        resolved = path.resolve()
    except (OSError, RuntimeError, ValueError) as error:
        raise ThumbnailError(403, "Access denied") from error
    if not resolved.is_relative_to(root):
        raise ThumbnailError(403, "Access denied")
    return resolved


def _identity(info):
    return info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns


def _read_source(path: Path, root: Path) -> bytes:
    path = _inside(path, root)
    try:
        with path.open("rb") as stream:
            before = os.fstat(stream.fileno())
            if not stat.S_ISREG(before.st_mode):
                raise ThumbnailError(404, "File not found")
            if before.st_size > MAX_SOURCE_BYTES:
                raise ThumbnailError(413, "Image is too large for a preview")
            # Recheck after opening, before reading through a potentially changed
            # parent link. Retargeted links are rejected even on a warm cache.
            if _inside(path, root) != path:
                raise ThumbnailError(403, "Access denied")
            content = stream.read(MAX_SOURCE_BYTES + 1)
            after = os.fstat(stream.fileno())
        if len(content) > MAX_SOURCE_BYTES:
            raise ThumbnailError(413, "Image is too large for a preview")
        if _inside(path, root) != path:
            raise ThumbnailError(403, "Access denied")
        if _identity(before) != _identity(after) or _identity(after) != _identity(path.stat()):
            raise ThumbnailError(409, "Image changed while creating its preview; retry")
        return content
    except FileNotFoundError as error:
        raise ThumbnailError(404, "File not found") from error
    except PermissionError as error:
        raise ThumbnailError(403, "Access denied") from error
    except OSError as error:
        raise ThumbnailError(503, "Image preview temporarily unavailable") from error


def _render(content: bytes, width: int) -> Thumbnail:
    try:
        with Image.open(BytesIO(content)) as original:
            if original.format not in {"JPEG", "PNG", "WEBP"}:
                raise ThumbnailError(415, "Preview supports only static JPEG, PNG and WebP images")
            if getattr(original, "n_frames", 1) != 1:
                raise ThumbnailError(415, "Animated images do not support previews; use the original")
            pixel_limit = min(MAX_SOURCE_PIXELS, Image.MAX_IMAGE_PIXELS or MAX_SOURCE_PIXELS)
            if (original.width * original.height > pixel_limit
                    or max(original.size) > MAX_SOURCE_EDGE):
                raise ThumbnailError(413, "Image dimensions are too large for a preview")
            original.load()
            with ImageOps.exif_transpose(original) as oriented:
                output_scale = min(1, width / oriented.width)
                if round(oriented.height * output_scale) > MAX_OUTPUT_HEIGHT:
                    raise ThumbnailError(413, "Image is too tall for this preview width; use the original")
                has_alpha = "A" in oriented.getbands() or "transparency" in oriented.info
                with oriented.convert("RGBA" if has_alpha else "RGB") as preview:
                    # Preserve the actual width promised by a browser srcset.
                    # Extreme aspect ratios fail rather than silently downsize.
                    preview.thumbnail((width, MAX_OUTPUT_HEIGHT), Image.Resampling.LANCZOS, reducing_gap=3.0)
                    result = BytesIO()
                    preview.save(result, format="WEBP", quality=WEBP_QUALITY, method=4)
                    body = result.getvalue()
                    if len(body) > MAX_OUTPUT_BYTES:
                        raise ThumbnailError(413, "Encoded preview is too large")
                    return Thumbnail(body, *preview.size, '"' + hashlib.sha256(body).hexdigest() + '"')
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise ThumbnailError(413, "Image dimensions are too large for a preview") from error
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError) as error:
        raise ThumbnailError(422, "Image cannot be decoded for a preview") from error


def create_thumbnail(path: Path, upload_root: Path, width: int) -> Thumbnail:
    if type(width) is not int or width not in ALLOWED_WIDTHS:
        raise ThumbnailError(422, "Invalid preview width")
    # Bound concurrent byte buffers and decoded pixels per API worker. Briefly
    # queue normal browser image bursts, then fail without unbounded work.
    if not _operations.acquire(timeout=0.5):
        raise ThumbnailError(503, "Image preview busy; retry shortly")
    try:
        # The route supplies its already canonical upload boundary. If the root
        # was replaced by a junction before this worker starts, do not silently
        # adopt the junction's new target as a trusted upload directory.
        root = upload_root
        if _inside(root, root) != root:
            raise ThumbnailError(403, "Access denied")
        resolved = _inside(path, root)
        content = _read_source(resolved, root)
        source_digest = hashlib.sha256(content).hexdigest()
        key = (str(resolved), source_digest, width)
        cached = _cache.get(key)
        if cached is not None:
            return cached
        preview = _render(content, width)
        _cache.put(key, preview)
        return preview
    finally:
        _operations.release()
