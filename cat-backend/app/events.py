import asyncio
import json
import logging
import time
from typing import Optional
import anyio

logger = logging.getLogger("cat_community.events")

_redis_client: Optional[object] = None
_in_memory_subscribers: dict = {}
_event_loop = None
_publish_tasks: set = set()

STREAM_ERRORS = (OSError, TimeoutError)
try:
    import redis.asyncio as aioredis
    from redis.exceptions import RedisError
    STREAM_ERRORS += (RedisError,)
    _REDIS_AVAILABLE = True
except ImportError:
    _REDIS_AVAILABLE = False

REDIS_CHANNEL = "cat_community:events"


async def init_redis(url: Optional[str] = None):
    global _redis_client, _event_loop
    _event_loop = asyncio.get_running_loop()
    _redis_client = None
    if not url:
        logger.info("No Redis URL, using single-process pub/sub")
        return
    if not _REDIS_AVAILABLE:
        raise RuntimeError("REDIS_URL is configured but redis is not installed")
    try:
        _redis_client = aioredis.from_url(
            url, decode_responses=True, socket_connect_timeout=2, socket_timeout=2,
            retry_on_timeout=False,
        )
        await _redis_client.ping()
        logger.info("Redis connected for SSE pub/sub")
    except Exception:
        if _redis_client is not None:
            await _redis_client.aclose()
        _redis_client = None
        raise RuntimeError("Configured Redis is unavailable; refusing unreliable multi-worker pub/sub")


async def close_redis():
    global _redis_client
    # Let already scheduled cross-thread publishes register their tasks.
    await asyncio.sleep(0)
    if _publish_tasks:
        pending = list(_publish_tasks)
        try:
            await asyncio.wait_for(asyncio.gather(*pending, return_exceptions=True), timeout=3)
        except asyncio.TimeoutError:
            logger.warning("Pending Redis publishes cancelled during shutdown")
    if _redis_client:
        await _redis_client.aclose()
        _redis_client = None


def publish(event_type: str, data: dict) -> None:
    message = json.dumps(
        {"type": event_type, "data": data, "ts": time.time()},
        ensure_ascii=False,
        default=str,
    )
    if _redis_client and _event_loop and _event_loop.is_running():
        client = _redis_client
        async def deliver():
            try:
                await client.publish(REDIS_CHANNEL, message)
            except Exception:
                logger.exception("Redis event publish failed")
        def schedule():
            task = _event_loop.create_task(deliver())
            _publish_tasks.add(task)
            task.add_done_callback(_publish_tasks.discard)
        _event_loop.call_soon_threadsafe(schedule)
    else:
        _publish_in_memory(message)


def _publish_in_memory(message: str) -> None:
    def deliver(q):
        try:
            q.put_nowait(message)
        except asyncio.QueueFull:
            logger.warning("SSE subscriber queue full; client must refresh")
    for q, loop in list(_in_memory_subscribers.items()):
        if not loop.is_closed():
            loop.call_soon_threadsafe(deliver, q)


async def subscribe():
    if _redis_client:
        pubsub = _redis_client.pubsub()
        try:
            async def connect():
                await pubsub.subscribe(REDIS_CHANNEL)
                ack = await pubsub.get_message(ignore_subscribe_messages=False, timeout=2)
                if not ack or ack.get('type') != 'subscribe':
                    raise TimeoutError('Redis did not acknowledge subscription')
            await asyncio.wait_for(connect(), timeout=3)
        except BaseException:
            with anyio.CancelScope(shield=True):
                await pubsub.aclose()
            raise
        return pubsub
    q: asyncio.Queue = asyncio.Queue(maxsize=256)
    _in_memory_subscribers[q] = asyncio.get_running_loop()
    return q


async def unsubscribe(sub) -> None:
    if hasattr(sub, "unsubscribe"):
        try:
            await asyncio.wait_for(sub.unsubscribe(REDIS_CHANNEL), timeout=2)
        finally:
            await sub.aclose()
    else:
        _in_memory_subscribers.pop(sub, None)
