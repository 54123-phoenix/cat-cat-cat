"""Read-only Fudan cat-name/photo index collector; no database writes or login hacks.

API contracts come from the source mini-program, not a successful authenticated
capture. A live authenticated run is still required to validate the contract.
Credentials must be supplied explicitly in MEOWZART_TOKEN or --token-file.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import time
from urllib.parse import urlsplit

import httpx


API = "https://api.meowzart.com"
SOCIETY_ID = 1
PAGE_SIZE = 20


class CollectionError(Exception):
    """A safe error that never contains response bodies or credentials."""


class AuthenticationRequired(CollectionError):
    pass


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def write_json(path, value):
    payload = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_bytes(payload)
    temp.replace(path)
    return hashlib.sha256(payload).hexdigest()


class Source:
    def __init__(self, token="", *, transport=None, interval=1.0):
        if any(c.isspace() for c in token):
            raise CollectionError("Credential must be a single token, without a Bearer prefix")
        self.client = httpx.Client(
            headers={"Authorization": f"Bearer {token}"} if token else {},
            timeout=30, follow_redirects=False, transport=transport,
        )
        self.interval = interval
        self.last_request = None

    def close(self):
        self.client.close()

    def get(self, path, params=None):
        # Never send credentials to a URL taken from a response or image field.
        if path != "/api/v1/pet/society/list" and not re.fullmatch(r"/api/v1/pet/[1-9][0-9]*", path):
            raise CollectionError("Unexpected API path")
        if self.last_request is not None:
            time.sleep(max(0, self.interval - (time.monotonic() - self.last_request)))
        self.last_request = time.monotonic()
        try:
            response = self.client.get(API + path, params=params)
        except httpx.HTTPError:
            raise CollectionError("Source network request failed") from None
        if response.status_code in (401, 403):
            raise AuthenticationRequired("Source requires a valid authorized API credential")
        if response.status_code != 200:
            raise CollectionError(f"Source returned HTTP {response.status_code}; collection stopped")
        try:
            body = response.json()
        except ValueError:
            raise CollectionError("Source returned invalid JSON") from None
        if not isinstance(body, dict):
            raise CollectionError("Unexpected response envelope")
        if body.get("errno") == 40304:
            raise AuthenticationRequired("Source requires a valid authorized API credential")
        if body.get("errno") != 0 or "response" not in body:
            raise CollectionError("Source API reported an error or changed its contract")
        return body["response"]

    def page(self, start):
        result = self.get("/api/v1/pet/society/list", {
            "societyId": SOCIETY_ID, "start": start, "size": PAGE_SIZE,
            "color": "", "status": "", "category": "cat",
        })
        if not isinstance(result, list) or len(result) > PAGE_SIZE:
            raise CollectionError("Unexpected list shape; do not infer an empty page")
        return result


def positive_id(value):
    if isinstance(value, bool) or not re.fullmatch(r"[1-9][0-9]*", str(value)):
        raise CollectionError("Missing or invalid stable pet ID")
    return str(value)


def scope(record):
    if not isinstance(record, dict) or str(record.get("societyId")) != str(SOCIETY_ID):
        raise CollectionError("Record lacks the expected Fudan society ID")
    category = record.get("category")
    if not isinstance(category, str) or not category:
        raise CollectionError("Record lacks an explicit species category")
    return category == "cat"


def normalize(record, expected_id):
    if not scope(record) or positive_id(record.get("petId")) != expected_id:
        raise CollectionError("Detail does not match the requested cat ID and scope")
    name = record.get("name")
    if not isinstance(name, str) or not name.strip():
        raise CollectionError("Cat name field is missing; source contract needs inspection")
    info = record.get("info")
    if not isinstance(info, dict) or not isinstance(info.get("photos"), list):
        raise CollectionError("Photo list is missing; source contract needs inspection")
    candidates = [("info.photos", u) for u in info["photos"]]
    if record.get("avatar"):
        candidates.insert(0, ("avatar", record["avatar"]))
    photos = []
    seen = set()
    for field, url in candidates:
        if not isinstance(url, str):
            raise CollectionError("Unexpected photo URL type")
        parsed = urlsplit(url)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise CollectionError("Unexpected photo URL; requires review before downloading")
        if url not in seen:
            photos.append({"source_field": field, "url": url})
            seen.add(url)
    return {"source_pet_id": expected_id, "source_name": name,
            "society_id": SOCIETY_ID, "category": "cat", "photos": photos,
            "retrieved_at": utc_now(), "captured_at": None,
            "identity_independently_verified": False}


def collect(source, output, *, max_pages=100, resume=False):
    """Restart pagination on resume; only reuse hash-verified completed details.

    Offset pagination is mutable. Repeated IDs stop the run instead of quietly
    skipping rows. Even reaching the end is not proof of a consistent snapshot.
    """
    output.mkdir(parents=True, exist_ok=True)
    report_path = output / "run.json"
    if any(output.iterdir()) and not resume:
        raise CollectionError("Output is not empty; use a new directory or --resume")
    prior = {}
    if resume and report_path.exists():
        old = json.loads(report_path.read_text(encoding="utf-8"))
        if old.get("api") != API or old.get("society_id") != SOCIETY_ID:
            raise CollectionError("Checkpoint source mismatch")
        prior = old.get("detail_sha256", {})
    report = {"api": API, "society_id": SOCIETY_ID, "started_at": utc_now(),
              "status": "running", "catalog_pagination_finished": False,
              "consistent_snapshot_verified": False, "complete_recrawl": False,
              "images_downloaded": 0, "dynamic_photos_collected": False,
              "cat_count": 0, "excluded_non_cat_count": 0,
              "detail_sha256": dict(prior), "page_sha256": {}}
    seen = set()
    index = []
    try:
        write_json(report_path, report)
        for page_index in range(max_pages):
            records = source.page(page_index * PAGE_SIZE)
            page_ids = []
            for item in records:
                is_cat = scope(item)
                pet_id = positive_id(item.get("petId"))
                if pet_id in seen:
                    raise CollectionError("Repeated pet ID across pages; pagination may have shifted")
                seen.add(pet_id)
                page_ids.append(pet_id)
                if not is_cat:
                    report["excluded_non_cat_count"] += 1
                    continue
                file = f"pet-{pet_id}.json"
                path = output / file
                if pet_id in prior:
                    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != prior[pet_id]:
                        raise CollectionError("Cached detail hash mismatch; preserve and inspect the checkpoint")
                    detail = json.loads(path.read_text(encoding="utf-8"))
                    if detail.get("source_pet_id") != pet_id or detail.get("society_id") != SOCIETY_ID:
                        raise CollectionError("Cached detail scope mismatch")
                    digest = prior[pet_id]
                else:
                    detail = normalize(source.get(f"/api/v1/pet/{pet_id}"), pet_id)
                    digest = write_json(path, detail)
                report["detail_sha256"][pet_id] = digest
                report["cat_count"] += 1
                index.append(detail)
                write_json(report_path, report)
            # Save only IDs, never raw user/author metadata returned by the API.
            page_file = f"page-{page_index:04}.json"
            report["page_sha256"][page_file] = write_json(output / page_file, {"pet_ids": page_ids})
            write_json(report_path, report)
            if not records:
                report["catalog_pagination_finished"] = True
                report["status"] = "catalog_collected_needs_review"
                report["index_sha256"] = write_json(output / "catalog.json", index)
                break
        else:
            raise CollectionError("Page limit reached before an empty page")
    except AuthenticationRequired:
        report["status"] = "authentication_required"
        raise
    except (CollectionError, OSError, ValueError):
        report["status"] = "incomplete"
        raise
    finally:
        report["finished_at"] = utc_now()
        write_json(report_path, report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--token-file", type=Path, help="Explicitly supplied plain token file; never committed")
    parser.add_argument("--max-pages", type=int, default=100)
    parser.add_argument("--resume", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.max_pages <= 1000:
        parser.error("max-pages must be in 1..1000")
    source = None
    try:
        token = (args.token_file.read_text(encoding="utf-8").strip() if args.token_file
                 else os.environ.get("MEOWZART_TOKEN", "").strip())
        source = Source(token)
        report = collect(source, args.output, max_pages=args.max_pages, resume=args.resume)
        print(json.dumps({k: report[k] for k in ("status", "cat_count", "images_downloaded")}, ensure_ascii=False))
        return 0
    except AuthenticationRequired as error:
        print(str(error))
        return 3
    except CollectionError as error:
        print(str(error))
        return 2
    except (OSError, ValueError):
        print("Input or checkpoint could not be read; no credential content is logged")
        return 2
    finally:
        if source:
            source.close()


if __name__ == "__main__":
    raise SystemExit(main())
