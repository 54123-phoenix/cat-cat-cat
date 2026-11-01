import importlib.util
from contextlib import nullcontext
import json
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location("archive_capture", Path(__file__).with_name("archive_meowzart_capture.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def row(pet_id, name="same"):
    return {"petId": pet_id, "societyId": 1, "category": "cat", "name": name,
            "avatar": f"https://static.nordri.co/{pet_id}.jpg", "photos": []}


def page(path, start, rows, suffix=""):
    path.write_text(json.dumps({"http_status": 200, "errno": 0,
        "endpoint": f"/api/v1/pet/society/list?societyId=1&size=20&start={start}{suffix}",
        "response_record_count": len(rows), "records": rows}), encoding="utf-8")


def test_same_name_does_not_merge_identity_and_short_page_is_not_full_album(tmp_path):
    page(tmp_path / "response-1.json", 0, [row(1), row(2)])
    records, report = module.build_catalog(tmp_path)
    assert len(records) == 2
    assert report["duplicate_names"] == {"same": 2}
    assert report["catalog_pagination_finished"]
    assert not report["all_album_photos_collected"]
    assert not report["source_species_labels_independently_verified"]


def test_full_page_without_terminal_page_remains_incomplete(tmp_path):
    page(tmp_path / "response-1.json", 0, [row(i) for i in range(1, 21)])
    assert not module.build_catalog(tmp_path)[1]["catalog_pagination_finished"]


@pytest.mark.parametrize("case", ["missing_page", "duplicate_id", "changed_page", "filtered", "foreign_image", "foreign_society"])
def test_reject_inconsistent_or_out_of_scope_capture(tmp_path, case):
    rows = [row(i) for i in range(1, 21)]
    if case == "foreign_image":
        rows[0]["avatar"] = "https://example.org/foreign.jpg"
    if case == "foreign_society":
        rows[0]["societyId"] = 2
    page(tmp_path / "response-1.json", 0, rows, "&color=orange" if case == "filtered" else "")
    if case == "missing_page":
        page(tmp_path / "response-2.json", 40, [])
    if case == "duplicate_id":
        page(tmp_path / "response-2.json", 20, [row(1)])
    if case == "changed_page":
        page(tmp_path / "response-2.json", 0, [row(30)])
    with pytest.raises(ValueError):
        module.build_catalog(tmp_path)


def test_corrupt_cached_image_is_not_accepted(tmp_path):
    url = "https://static.nordri.co/example.jpg"
    key = module.hashlib.sha256(url.encode()).hexdigest()
    (tmp_path / (key + ".json")).write_text(json.dumps({"file": "image.jpg", "sha256": "wrong"}))
    (tmp_path / "image.jpg").write_bytes(b"corrupted")
    with pytest.raises(ValueError, match="hash mismatch"):
        module.download(url, tmp_path)


def test_storage_budget_stops_stream_and_removes_partial_file(tmp_path, monkeypatch):
    class Response:
        headers = {"content-type": "image/png"}

        def raise_for_status(self):
            pass

        def iter_bytes(self):
            yield b"more than five bytes"

    class Client:
        def stream(self, *args):
            return nullcontext(Response())

    monkeypatch.setattr(module.httpx, "Client", lambda **kwargs: nullcontext(Client()))
    with pytest.raises(module.StorageBudgetReached):
        module.download("https://static.nordri.co/example.png", tmp_path, remaining_bytes=5)
    assert not list(tmp_path.iterdir())
