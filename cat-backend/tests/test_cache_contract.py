from app import cache


def test_expiry_is_per_entry_and_refreshable(monkeypatch):
    now = [0.0]
    monkeypatch.setattr(cache, 'monotonic', lambda: now[0])
    store = cache.TTLCache(ttl=30)
    store.set('short', 'old', ttl=2)
    store.set('long', 'value')
    now[0] = 2
    assert store.get('short') is None
    assert store.get('long') == 'value'
    store.set('long', 'new', ttl=5)
    now[0] = 7
    assert store.get('long') is None


def test_capacity_evicts_least_recently_used():
    store = cache.TTLCache(maxsize=2)
    store.set('a', 1)
    store.set('b', 2)
    assert store.get('a') == 1
    store.set('c', 3)
    assert store.get('b') is None
    assert store.get('c') == 3


def test_pattern_invalidation_and_zero_ttl(monkeypatch):
    monkeypatch.setattr(cache, '_redis_client', None)
    monkeypatch.setattr(cache, '_memory_cache', cache.TTLCache())
    cache.cache_set('heatmap:1', 'a')
    cache.cache_set('heatmap:2', 'b')
    cache.cache_set('other', 'c')
    cache.cache_invalidate('heatmap:*')
    assert cache.cache_get('heatmap:1') is None
    assert cache.cache_get('heatmap:2') is None
    assert cache.cache_get('other') == 'c'
    cache.cache_set('other', 'discard', ttl=0)
    assert cache.cache_get('other') is None
