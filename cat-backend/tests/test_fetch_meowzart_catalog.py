"""Synthetic API tests. These do not establish live collection or image quality."""
import json

import httpx
import pytest

from scripts import fetch_meowzart_catalog as collector


def pet(pet_id=1, **changes):
    return {"petId": pet_id, "societyId": 1, "category": "cat", "name": "同名猫",
            "avatar": "https://static.nordri.co/a.jpg",
            "info": {"photos": ["https://static.nordri.co/a.jpg", "https://static.nordri.co/b.jpg"]},
            "ownerPhone": "must-not-be-persisted", **changes}


def source(handler):
    return collector.Source("synthetic-test-token", transport=httpx.MockTransport(handler), interval=0)


def ok(value):
    return httpx.Response(200, json={"errno": 0, "response": value})


def test_collects_same_names_as_distinct_ids_and_keeps_dates_unknown(tmp_path):
    requests = []

    def handler(request):
        requests.append(request)
        assert request.method == "GET"
        assert request.url.host == "api.meowzart.com"
        if request.url.path.endswith("/list"):
            assert request.url.params["societyId"] == "1"
            assert request.url.params["category"] == "cat"
            return ok([pet(1), pet(2)] if request.url.params["start"] == "0" else [])
        return ok(pet(int(request.url.path.split("/")[-1])))

    client = source(handler)
    try:
        report = collector.collect(client, tmp_path)
    finally:
        client.close()
    records = json.loads((tmp_path / "catalog.json").read_text(encoding="utf-8"))
    assert [r["source_pet_id"] for r in records] == ["1", "2"]
    assert len(records[0]["photos"]) == 2
    assert records[0]["captured_at"] is None
    assert report["catalog_pagination_finished"]
    assert not report["complete_recrawl"] and not report["consistent_snapshot_verified"]
    assert report["images_downloaded"] == 0
    persisted = "".join(p.read_text(encoding="utf-8") for p in tmp_path.glob("*.json"))
    assert "must-not-be-persisted" not in persisted
    assert "synthetic-test-token" not in persisted
    assert len(requests) == 4


@pytest.mark.parametrize("status,body", [(401, {}), (403, {}), (200, {"errno": 40304})])
def test_auth_failure_stops_after_one_request_and_records_incomplete(tmp_path, status, body):
    calls = []
    client = source(lambda request: (calls.append(request), httpx.Response(status, json=body))[1])
    try:
        with pytest.raises(collector.AuthenticationRequired):
            collector.collect(client, tmp_path)
    finally:
        client.close()
    assert len(calls) == 1
    assert json.loads((tmp_path / "run.json").read_text())["status"] == "authentication_required"
    assert not (tmp_path / "catalog.json").exists()


def test_redirect_is_not_followed_or_given_credential(tmp_path):
    calls = []
    client = source(lambda request: (calls.append(request), httpx.Response(302, headers={"location": "https://other.example/"}))[1])
    try:
        with pytest.raises(collector.CollectionError, match="HTTP 302"):
            collector.collect(client, tmp_path)
        with pytest.raises(collector.CollectionError, match="Unexpected API path"):
            client.get("https://other.example/")
    finally:
        client.close()
    assert len(calls) == 1


@pytest.mark.parametrize("item,pattern", [(pet(societyId=2), "society"), (pet(category=None), "category")])
def test_missing_or_wrong_scope_fails_closed(tmp_path, item, pattern):
    client = source(lambda request: ok([item]))
    try:
        with pytest.raises(collector.CollectionError, match=pattern):
            collector.collect(client, tmp_path)
    finally:
        client.close()


def test_non_cats_are_counted_without_fetching_details(tmp_path):
    client = source(lambda r: ok([pet(category="dog")] if r.url.params["start"] == "0" else []))
    try:
        report = collector.collect(client, tmp_path)
    finally:
        client.close()
    assert report["excluded_non_cat_count"] == 1 and report["cat_count"] == 0


def test_repeated_page_cannot_report_completion(tmp_path):
    client = source(lambda r: ok([pet()] if r.url.path.endswith("/list") else pet()))
    try:
        with pytest.raises(collector.CollectionError, match="Repeated pet ID"):
            collector.collect(client, tmp_path)
    finally:
        client.close()
    assert json.loads((tmp_path / "run.json").read_text())["status"] == "incomplete"


def test_resume_retains_checkpoint_after_new_auth_failure_and_checks_hash(tmp_path):
    client = source(lambda r: ok([pet()] if r.url.path.endswith("/list") else pet()))
    try:
        with pytest.raises(collector.CollectionError, match="Page limit"):
            collector.collect(client, tmp_path, max_pages=1)
    finally:
        client.close()
    client = source(lambda r: httpx.Response(401))
    try:
        with pytest.raises(collector.AuthenticationRequired):
            collector.collect(client, tmp_path, resume=True)
    finally:
        client.close()
    assert "1" in json.loads((tmp_path / "run.json").read_text())["detail_sha256"]
    (tmp_path / "pet-1.json").write_text("tampered")
    client = source(lambda r: ok([pet()]))
    try:
        with pytest.raises(collector.CollectionError, match="hash mismatch"):
            collector.collect(client, tmp_path, resume=True)
    finally:
        client.close()


@pytest.mark.parametrize("payload", [{"items": []}, None, "unexpected"])
def test_unknown_list_shapes_are_errors_not_empty_results(tmp_path, payload):
    client = source(lambda r: ok(payload))
    try:
        with pytest.raises(collector.CollectionError, match="list shape"):
            collector.collect(client, tmp_path)
    finally:
        client.close()


def test_output_is_not_overwritten_without_resume(tmp_path):
    sentinel = tmp_path / "old.json"
    sentinel.write_text("original")
    with pytest.raises(collector.CollectionError, match="not empty"):
        collector.collect(None, tmp_path)
    assert sentinel.read_text() == "original"
