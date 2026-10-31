import hashlib
import json
import logging
import functools
from collections import OrderedDict
from fnmatch import fnmatchcase
from threading import RLock
from time import monotonic
from typing import Optional, Callable

logger = logging.getLogger("cat_community.cache")

_redis_client = None
_memory_cache = None

try:
    import redis as _redis_sync
    _REDIS_AVAILABLE = True
except ImportError:
    _REDIS_AVAILABLE = False

class TTLCache:
    def __init__(self, maxsize=512, ttl=300):
        self._store = OrderedDict()
        self._maxsize = maxsize
        self._ttl = ttl
        self._lock = RLock()

    def get(self, key, default=None):
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return default
            expires, value = entry
            if expires <= monotonic():
                self._store.pop(key, None)
                return default
            self._store.move_to_end(key)
            return value

    def set(self, key, value, ttl=None):
        with self._lock:
            now = monotonic()
            for old_key, (expires, _) in list(self._store.items()):
                if expires <= now:
                    self._store.pop(old_key, None)
            lifetime = self._ttl if ttl is None else ttl
            self._store.pop(key, None)
            if lifetime <= 0 or self._maxsize <= 0:
                return
            self._store[key] = (now + lifetime, value)
            while len(self._store) > self._maxsize:
                self._store.popitem(last=False)

    def delete(self, pattern):
        with self._lock:
            for key in list(self._store):
                if fnmatchcase(key, pattern):
                    self._store.pop(key, None)


def init_cache(redis_url: Optional[str] = None):
    global _redis_client, _memory_cache
    _redis_client = None
    _memory_cache = TTLCache(maxsize=512, ttl=300)
    if _REDIS_AVAILABLE and redis_url:
        try:
            _redis_client = _redis_sync.from_url(
                redis_url, decode_responses=True, socket_connect_timeout=2, socket_timeout=2,
                retry_on_timeout=False,
            )
            _redis_client.ping()
            logger.info("Cache: Redis connected")
            return
        except Exception:
            if _redis_client is not None:
                _redis_client.close()
            _redis_client = None
            logger.warning("Cache: Redis connection failed, using in-memory TTLCache")
    _memory_cache = TTLCache(maxsize=512, ttl=300)
    logger.info("Cache: Using in-memory TTLCache")


def cache_get(key: str) -> Optional[str]:
    if _redis_client:
        try:
            return _redis_client.get(key)
        except Exception:
            return None
    if _memory_cache:
        return _memory_cache.get(key)
    return None


def cache_set(key: str, value: str, ttl: int = 300) -> None:
    if _redis_client:
        try:
            _redis_client.setex(key, ttl, value)
            return
        except Exception:
            pass
    if _memory_cache:
        _memory_cache.set(key, value, ttl=ttl)


def cache_invalidate(pattern: str) -> None:
    if _redis_client:
        try:
            keys = list(_redis_client.scan_iter(match=pattern))
            if keys:
                _redis_client.delete(*keys)
        except Exception:
            pass
    if _memory_cache:
        _memory_cache.delete(pattern)


def _cacheable(value):
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, list):
        return [_cacheable(item) for item in value]
    if isinstance(value, tuple):
        return [_cacheable(item) for item in value]
    if isinstance(value, dict):
        return {key: _cacheable(item) for key, item in value.items()}
    return value


def cached(ttl: int = 300, key_fn: Optional[Callable] = None):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            cache_key = key_fn(*args, **kwargs) if key_fn else f"{func.__module__}:{func.__name__}:{hashlib.md5(json.dumps(list(args) + list(kwargs.items()), default=str).encode()).hexdigest()}"
            result = cache_get(cache_key)
            if result is not None:
                try:
                    return json.loads(result)
                except (json.JSONDecodeError, TypeError):
                    pass
            value = func(*args, **kwargs)
            try:
                cache_set(cache_key, json.dumps(_cacheable(value), default=str), ttl)
            except (TypeError, ValueError):
                pass
            return value
        return wrapper
    return decorator
