import json
import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware.request_logging import RequestLoggingMiddleware, normalize_request_id, structured_log


def _client():
    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware)

    @app.get("/ping")
    def ping():
        return {"ok": True}

    return TestClient(app)


def test_request_logging_preserves_valid_request_id(caplog):
    client = _client()

    with caplog.at_level(logging.INFO, logger="cat_community.request"):
        resp = client.get("/ping", headers={"X-Request-ID": "trace-123"})

    assert resp.status_code == 200
    assert resp.headers["X-Request-ID"] == "trace-123"
    log_payload = json.loads(caplog.records[-1].message)
    assert log_payload["event"] == "request_completed"
    assert log_payload["request_id"] == "trace-123"
    assert log_payload["method"] == "GET"
    assert log_payload["path"] == "/ping"
    assert log_payload["status_code"] == 200
    assert "duration_ms" in log_payload


def test_request_logging_replaces_invalid_request_id():
    client = _client()

    resp = client.get("/ping", headers={"X-Request-ID": "bad id with spaces"})

    assert resp.status_code == 200
    assert resp.headers["X-Request-ID"] != "bad id with spaces"
    assert len(resp.headers["X-Request-ID"]) == 32


def test_request_id_normalization_and_structured_log_helpers():
    assert normalize_request_id("abc_123.ok") == "abc_123.ok"
    assert normalize_request_id("bad id") != "bad id"
    payload = json.loads(structured_log("sample", request_id="r1", status_code=200))
    assert payload == {"event": "sample", "request_id": "r1", "status_code": 200}
