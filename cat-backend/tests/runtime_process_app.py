"""Loopback-only acceptance entry point; never imported by production."""
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import uvicorn
from app.main import app
from app import cache


@app.middleware('http')
async def process_identity(request, call_next):
    response = await call_next(request)
    response.headers['X-Test-Process'] = str(os.getpid())
    return response


@app.put('/__acceptance/cache/{key}')
def set_cached(key: str, value: str):
    cache.cache_set('acceptance:' + key, value, ttl=120)
    return {'ok': True}


@app.get('/__acceptance/cache/{key}')
def get_cached(key: str):
    return {'value': cache.cache_get('acceptance:' + key)}


@app.delete('/__acceptance/cache/{key}')
def delete_cached(key: str):
    cache.cache_invalidate('acceptance:' + key)
    return {'ok': True}


if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=int(sys.argv[1]), log_level='warning', access_log=False)
