"""Offline recognition accuracy check (no HTTP / no rate limit).

Runs the SAME recognition path the API uses (crop -> extract -> match) directly
against held-out crops, and reports Top-1 / Top-3 / confirmed precision.

Usage inside container:
    python scripts/eval_recognition.py --crops-dir /data/data_crops \
        --per-cat 1 --limit 40
"""

import argparse
import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.services.ai import recognize_cat_image  # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--crops-dir", required=True)
    ap.add_argument("--per-cat", type=int, default=1, help="images per cat from an independently held-out directory")
    ap.add_argument("--output", help="write predictions and aggregate counts as JSON")
    ap.add_argument("--limit", type=int, default=0, help="max cats to test (0 = all)")
    ap.add_argument("--no-crop", action="store_true",
                    help="skip YOLO crop (inputs already cropped, symmetric with reference build)")
    args = ap.parse_args()
    if args.per_cat < 1 or args.limit < 0:
        ap.error("per-cat must be positive and limit must be non-negative")

    crops = Path(args.crops_dir)
    cat_dirs = sorted(d for d in crops.iterdir()
                      if d.is_dir() and not d.name.startswith(".") and not d.name.startswith("._"))
    if args.limit:
        cat_dirs = cat_dirs[:args.limit]

    total = top1 = top3 = confirmed = confirmed_correct = unavailable = 0
    predictions = []
    for cat_dir in cat_dirs:
        name = cat_dir.name
        photos = sorted(f for f in cat_dir.iterdir()
                        if f.suffix.lower() in (".jpg", ".jpeg", ".png") and not f.name.startswith("._"))
        # The caller must supply a held-out directory; filename order proves no split.
        for photo in photos[-args.per_cat:]:
            try:
                data = photo.read_bytes()
            except OSError:
                continue
            res = recognize_cat_image(data, filename=photo.name, crop=not args.no_crop)
            total += 1
            unavailable += int(res.status == "unavailable")
            predictions.append({"file": str(photo), "expected": name, "result": res.model_dump(mode="json")})
            pool = [c.cat_name for c in (res.candidates or [])]
            if res.cat_name == name:
                top1 += 1
            if name in pool or res.cat_name == name:
                top3 += 1
            if res.status == "confirmed":
                confirmed += 1
                if res.cat_name == name:
                    confirmed_correct += 1
            flag = "OK " if res.cat_name == name else "XX "
            print(f"{flag}{name:12s} -> {res.status:9s} {res.cat_name} "
                  f"({res.confidence:.3f}) top3={pool}", flush=True)

    if total:
        print(f"\n=== N={total} | Top1={top1} ({top1/total*100:.1f}%) "
              f"| Top3={top3} ({top3/total*100:.1f}%) "
              f"| confirmed={confirmed} precision={confirmed_correct}/{confirmed} "
              f"({(confirmed_correct/confirmed*100) if confirmed else 0:.1f}%)")
    summary = dict(total=total, top1=top1, top3=top3, confirmed=confirmed,
                   confirmed_correct=confirmed_correct, unavailable=unavailable)
    if args.output:
        Path(args.output).write_text(json.dumps({"summary": summary, "predictions": predictions}, ensure_ascii=False, indent=2), encoding="utf-8")
    if not total or unavailable:
        print("Evaluation incomplete: no samples or recognition unavailable", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
