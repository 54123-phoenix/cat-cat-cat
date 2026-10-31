import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest

from app import events


def test_memory_events_cross_thread_boundaries_and_unsubscribe(monkeypatch):
    monkeypatch.setattr(events, '_redis_client', None)
    monkeypatch.setattr(events, '_in_memory_subscribers', {})
    async def scenario():
        sub = await events.subscribe()
        await asyncio.to_thread(events.publish, 'update', {'id': 1})
        result = json.loads(await asyncio.wait_for(sub.get(), 1))
        assert result['data'] == {'id': 1}
        await events.unsubscribe(sub)
        assert not events._in_memory_subscribers
    asyncio.run(scenario())


def test_async_redis_publish_uses_its_existing_loop_from_both_callers(monkeypatch):
    redis = SimpleNamespace(publish=AsyncMock())
    monkeypatch.setattr(events, '_redis_client', redis)
    monkeypatch.setattr(events, '_publish_tasks', set())
    async def scenario():
        monkeypatch.setattr(events, '_event_loop', asyncio.get_running_loop())
        events.publish('async-route', {})
        await asyncio.to_thread(events.publish, 'sync-route', {})
        await asyncio.sleep(0.01)
        assert redis.publish.await_count == 2
    asyncio.run(scenario())


def test_redis_subscription_closes_even_if_unsubscribe_fails():
    sub = SimpleNamespace(unsubscribe=AsyncMock(side_effect=RuntimeError('offline')), aclose=AsyncMock())
    with pytest.raises(RuntimeError):
        asyncio.run(events.unsubscribe(sub))
    assert sub.aclose.await_count == 1


def test_failed_http_response_start_releases_prepared_subscription(monkeypatch):
    from app.api import events as api
    sub = SimpleNamespace(unsubscribe=AsyncMock(), aclose=AsyncMock())
    monkeypatch.setattr(events, 'subscribe', AsyncMock(return_value=sub))
    monkeypatch.setattr(api, '_resolve_user', lambda *_: None)
    async def scenario():
        response = await api.event_stream(token='fixture', authorization='')
        async def receive():
            await asyncio.sleep(30)
        async def send(message):
            raise ConnectionError('client gone before response headers')
        with pytest.raises(ConnectionError):
            await response({'type': 'http'}, receive, send)
    asyncio.run(scenario())
    assert sub.aclose.await_count == 1


def test_failed_subscription_closes_pubsub_and_returns_503(monkeypatch):
    from fastapi import HTTPException
    from app.api import events as api
    sub = SimpleNamespace(subscribe=AsyncMock(side_effect=ConnectionError('offline')), aclose=AsyncMock())
    monkeypatch.setattr(events, '_redis_client', SimpleNamespace(pubsub=lambda: sub))
    monkeypatch.setattr(api, '_resolve_user', lambda *_: None)
    with pytest.raises(HTTPException) as failure:
        asyncio.run(api.event_stream(token='fixture', authorization=''))
    assert failure.value.status_code == 503
    assert sub.aclose.await_count == 1


def test_stream_ends_cleanly_and_closes_pubsub_on_redis_read_failure(monkeypatch):
    from app.api import events as api
    sub = SimpleNamespace(get_message=AsyncMock(side_effect=ConnectionError('offline')),
                          unsubscribe=AsyncMock(side_effect=ConnectionError('offline')), aclose=AsyncMock())
    monkeypatch.setattr(events, 'subscribe', AsyncMock(return_value=sub))
    monkeypatch.setattr(api, '_resolve_user', lambda *_: None)
    async def scenario():
        response = await api.event_stream(token='fixture', authorization='')
        assert [chunk async for chunk in response.body_iterator] == []
    asyncio.run(scenario())
    assert sub.aclose.await_count == 1
