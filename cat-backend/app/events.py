import asyncio
import json
import time

subscribers: set = set()


def publish(event_type: str, data: dict) -> None:
    if not subscribers:
        return
    message = json.dumps(
        {"type": event_type, "data": data, "ts": time.time()},
        ensure_ascii=False,
        default=str,
    )
    for q in list(subscribers):
        try:
            q.put_nowait(message)
        except asyncio.QueueFull:
            pass
        except Exception:
            pass


async def subscribe():
    q: asyncio.Queue = asyncio.Queue(maxsize=256)
    subscribers.add(q)
    return q


def unsubscribe(q) -> None:
    subscribers.discard(q)
