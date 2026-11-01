"""Validate scoped Fiddler pages and archive cat names and source images.

This never reads credentials, changes the app database, or collects user posts.
Downloaded bytes retain source watermarks; archive time is not photo capture time.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import ssl
import time
from urllib.parse import parse_qs, urlsplit

import httpx
from PIL import Image


class StorageBudgetReached(Exception):
    pass


def save(path, data):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def build_catalog(captures):
    pages = {}
    details = []
    hashes = {}
    for path in sorted(captures.glob("response-*.json")):
        raw = path.read_bytes()
        data = json.loads(raw)
        if data["http_status"] != 200 or data.get("errno") != 0:
            continue
        endpoint = urlsplit(data["endpoint"])
        hashes[path.name] = hashlib.sha256(raw).hexdigest()
        if endpoint.path == "/api/v1/pet/society/list":
            query = parse_qs(endpoint.query, keep_blank_values=True)
            if (query.get("societyId") != ["1"] or query.get("size") != ["20"]
                    or any(query.get(k, [""])[0] for k in ("color", "status"))
                    or query.get("category", [""])[0] not in ("", "cat")):
                raise ValueError("Unexpected filtered or out-of-scope page")
            start = int(query["start"][0])
            if start in pages and pages[start]["records"] != data["records"]:
                raise ValueError("Page changed during collection")
            pages[start] = data
        elif endpoint.path.startswith("/api/v1/pet/"):
            details.extend(data["records"])
    if not pages or sorted(pages) != list(range(0, max(pages) + 1, 20)):
        raise ValueError("Missing catalog pages")
    records = {}
    for start, page in sorted(pages.items()):
        count = page["response_record_count"]
        if count > 20 or (start < max(pages) and count != 20):
            raise ValueError("Invalid pagination counts")
        for row in page["records"]:
            pet_id = str(row["petId"])
            if pet_id in records:
                raise ValueError("Duplicate pet ID across pages")
            if str(row["societyId"]) != "1" or row["category"] != "cat":
                raise ValueError("Record outside Fudan cat scope")
            if not isinstance(row["name"], str) or not row["name"].strip():
                raise ValueError("Missing name")
            records[pet_id] = {"source_pet_id": pet_id, "source_name": row["name"],
                "society_id": 1, "category": "cat", "photos": [],
                "identity_independently_verified": False, "captured_at": None}
            if row.get("avatar"):
                records[pet_id]["photos"].append({"source_field": "catalog.avatar", "url": row["avatar"]})
    for row in details:
        pet_id = str(row["petId"])
        if pet_id not in records:
            continue
        if row["name"] != records[pet_id]["source_name"]:
            raise ValueError("Detail/catalog name mismatch")
        seen = {p["url"] for p in records[pet_id]["photos"]}
        for url in row.get("photos", []):
            if url not in seen:
                records[pet_id]["photos"].append({"source_field": "detail.info.photos", "url": url})
                seen.add(url)
    for record in records.values():
        for photo in record["photos"]:
            parsed = urlsplit(photo["url"])
            if (parsed.scheme != "https" or parsed.hostname != "static.nordri.co"
                    or parsed.username or parsed.password or parsed.port not in (None, 443)):
                raise ValueError("Unreviewed image host or URL")
    names = Counter(r["source_name"] for r in records.values())
    report = {"collected_at": datetime.now(timezone.utc).isoformat(),
        "source_labeled_cat_count": len(records), "page_count": len(pages),
        "source_species_labels_independently_verified": False,
        "catalog_pagination_finished": pages[max(pages)]["response_record_count"] < 20,
        "consistent_snapshot_verified": False, "all_album_photos_collected": False,
        "dynamic_photos_collected": False, "independent_identity_verification": False,
        "excluded_records": sum(p["response_record_count"] - len(p["records"]) for p in pages.values()),
        "duplicate_names": {n: c for n, c in names.items() if c > 1},
        "capture_sha256": hashes}
    return list(records.values()), report


def download(url, destination, remaining_bytes=25 * 1024 * 1024):
    key = hashlib.sha256(url.encode()).hexdigest()
    metadata = destination / (key + ".json")
    if metadata.exists():
        old = json.loads(metadata.read_text(encoding="utf-8"))
        file = destination / old["file"]
        if file.is_file() and hashlib.sha256(file.read_bytes()).hexdigest() == old["sha256"]:
            return old
        raise ValueError("Cached image hash mismatch")
    for attempt in range(3):
        temp = destination / (key + ".part")
        try:
            with httpx.Client(verify=ssl.create_default_context(), timeout=30, follow_redirects=False) as client:
                with client.stream("GET", url) as response:
                    response.raise_for_status()
                    content_type = response.headers.get("content-type", "").split(";")[0]
                    if not content_type.startswith("image/"):
                        raise ValueError("Unexpected image content type")
                    count = 0
                    with temp.open("wb") as stream:
                        for chunk in response.iter_bytes():
                            count += len(chunk)
                            if count > remaining_bytes:
                                raise StorageBudgetReached()
                            if count > 25 * 1024 * 1024:
                                raise ValueError("Image exceeds size limit")
                            stream.write(chunk)
            with Image.open(temp) as image:
                width, height = image.size
                fmt = image.format
                image.verify()
            extension = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp", "GIF": ".gif"}.get(fmt)
            if not extension:
                raise ValueError("Unreviewed image format")
            digest = hashlib.sha256(temp.read_bytes()).hexdigest()
            target = destination / (digest + extension)
            temp.replace(target)
            value = {"url": url, "file": target.name, "sha256": digest,
                     "bytes": count, "width": width, "height": height,
                     "format": fmt, "content_type": content_type}
            save(metadata, value)
            time.sleep(0.3)
            return value
        except StorageBudgetReached:
            temp.unlink(missing_ok=True)
            raise
        except (httpx.HTTPError, OSError):
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--captures", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--max-images", type=int, default=100,
                        help="Maximum image URLs per run (default: 100)")
    parser.add_argument("--max-image-mib", type=int, default=50,
                        help="Local image-directory budget; packaging may double it (default: 50 MiB)")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    catalog, report = build_catalog(args.captures)
    save(args.output / "catalog.json", catalog)
    save(args.output / "report.json", report)
    if args.download:
        if not report["catalog_pagination_finished"]:
            raise ValueError("Finish catalog pagination before downloading")
        directory = args.output / "images"
        directory.mkdir(exist_ok=True)
        urls = sorted({p["url"] for r in catalog for p in r["photos"]})
        if args.max_images < 1 or args.max_image_mib < 1:
            raise ValueError("Storage limits must be positive")
        images = []
        budget = args.max_image_mib * 1024 * 1024
        for url in urls[:args.max_images]:
            try:
                used = sum(p.stat().st_size for p in directory.iterdir() if p.is_file())
                entry = download(url, directory, max(0, budget - used))
                images.append(entry)
                if len(images) % 25 == 0:
                    print(json.dumps({"downloaded": len(images), "total": len(urls)}), flush=True)
            except StorageBudgetReached:
                break
        save(args.output / "image-manifest.json", images)
        report.update({"downloaded_urls": len(images),
            "unique_image_hashes": len({i["sha256"] for i in images}),
            "downloaded_bytes": sum(i["bytes"] for i in images), "images_verified": True,
            "all_catalog_images_downloaded": len(images) == len(urls),
            "download_selection": "URL-sorted bounded sample; not a random evaluation sample"})
        save(args.output / "report.json", report)
    print(json.dumps({k: v for k, v in report.items() if k != "capture_sha256"}, ensure_ascii=False))


if __name__ == "__main__":
    main()
