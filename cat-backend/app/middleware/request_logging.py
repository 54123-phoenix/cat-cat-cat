import json
import logging
import re
import time
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("cat_community.request")

_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{1,80}$")


def normalize_request_id(value: str | None) -> str:
    if value and _REQUEST_ID_PATTERN.match(value):
        return value
    return uuid4().hex


def structured_log(event: str, **fields) -> str:
    payload = {"event": event, **fields}
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = normalize_request_id(request.headers.get("X-Request-ID"))
        request.state.request_id = request_id
        start = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.exception(
                structured_log(
                    "request_failed",
                    request_id=request_id,
                    method=request.method,
                    path=request.url.path,
                    duration_ms=duration_ms,
                    client=request.client.host if request.client else None,
                )
            )
            raise

        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            structured_log(
                "request_completed",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=duration_ms,
                client=request.client.host if request.client else None,
                user_agent=request.headers.get("User-Agent", ""),
            )
        )
        return response
