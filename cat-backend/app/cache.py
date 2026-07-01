import hashlib
import json
import logging
import functools
from typing import Optional, Callable

logger = logging.getLogger("cat_community.cache")

_redis_client = None
_memory_cache = None

try:
    import redis as _redis_sync
    _REDIS_AVAILABLE = True
except ImportError:
    _REDIS_AVAILABLE = False

try:
    from cachetools import TTLCache
    _MEMORY_CACHE_AVAILABLE = True
except ImportError:
    _MEMORY_CACHE_AVAILABLE = False
    _TTLCache = None
    class TTLCache:
        def __init__(self, maxsize=512, ttl=300):
            self._store = {}
            self._maxsize = maxsize
            self._ttl = ttl

        def get(self, key, default=None):
            return self._store.get(key, default)

        def set(self, key, value):
            self._store[key] = value

        def delete(self, key):
            self._store.pop(key, None)


def init_cache(redis_url: Optional[str] = None):
    global _redis_client, _memory_cache
    if _REDIS_AVAILABLE and redis_url:
        try:
            _redis_client = _redis_sync.from_url(redis_url, decode_responses=True)
            _redis_client.ping()
            logger.info("Cache: Redis connected")
            return
        except Exception:
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
        _memory_cache.set(key, value)


def cache_invalidate(pattern: str) -> None:
    if _redis_client:
        try:
            keys = _redis_client.keys(pattern)
            if keys:
                _redis_client.delete(*keys)
            return
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
