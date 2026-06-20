try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    limiter = Limiter(key_func=get_remote_address)
    _SLOWAPI_AVAILABLE = True
except ImportError:
    limiter = None
    _SLOWAPI_AVAILABLE = False


def limit(rate: str):
    if limiter is None:
        def _noop(func):
            return func
        return _noop
    return limiter.limit(rate)
