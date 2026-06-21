import asyncio
import json
import logging
import time
from typing import Optional

logger = logging.getLogger("cat_community.events")

_redis_client: Optional[object] = None
_in_memory_subscribers: set = set()

try:
    import redis.asyncio as aioredis
    _REDIS_AVAILABLE = True
except ImportError:
    _REDIS_AVAILABLE = False

REDIS_CHANNEL = "cat_community:events"


async def init_redis(url: Optional[str] = None):
    global _redis_client
    if not _REDIS_AVAILABLE or not url:
        logger.info("Redis not available, using in-process pub/sub")
        return
    try:
        _redis_client = aioredis.from_url(url, decode_responses=True)
        await _redis_client.ping()
        logger.info("Redis connected for SSE pub/sub")
    except Exception:
        _redis_client = None
        logger.warning("Redis connection failed, falling back to in-process pub/sub")


async def close_redis():
    global _redis_client
    if _redis_client:
        await _redis_client.close()
        _redis_client = None


def publish(event_type: str, data: dict) -> None:
    message = json.dumps(
        {"type": event_type, "data": data, "ts": time.time()},
        ensure_ascii=False,
        default=str,
    )
    if _redis_client:
        try:
            asyncio.run(_redis_client.publish(REDIS_CHANNEL, message))
        except Exception:
            logger.warning("Redis publish failed, falling back to in-process")
            _publish_in_memory(message)
    else:
        _publish_in_memory(message)


def _publish_in_memory(message: str) -> None:
    if not _in_memory_subscribers:
        return
    for q in list(_in_memory_subscribers):
        try:
            q.put_nowait(message)
        except asyncio.QueueFull:
            pass
        except Exception:
            pass


async def subscribe():
    if _redis_client:
        pubsub = _redis_client.pubsub()
        await pubsub.subscribe(REDIS_CHANNEL)
        return pubsub
    q: asyncio.Queue = asyncio.Queue(maxsize=256)
    _in_memory_subscribers.add(q)
    return q


async def unsubscribe(sub) -> None:
    if _redis_client and isinstance(sub, aioredis.client.PubSub):
        await sub.unsubscribe(REDIS_CHANNEL)
        await sub.close()
    else:
        _in_memory_subscribers.discard(sub)
