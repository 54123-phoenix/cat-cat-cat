"""Build locally hosted Noto Sans SC subsets from an existing OFL font bundle.

Tool dependencies: fonttools==4.60.2 and brotli==1.1.0 (keep outside app deps).
Example: python scripts/build_web_fonts.py --font-root /path/to/original/fonts
No fonts are downloaded. Source fonts and existing assets are never deleted.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
from io import BytesIO
import json
from pathlib import Path


FAMILY = "Campus Sans SC"
SOURCES = {
    400: ("NotoSansSC-Regular.otf", "Regular"),
    500: ("NotoSansSC-Medium.otf", "Medium"),
    700: ("NotoSansSC-Bold.otf", "Bold"),
}
TEXT_SUFFIXES = {".ts", ".tsx", ".css", ".html", ".json"}
COMMON_PUNCTUATION = "，。！？；：、·…—～‘’“”（）【】《》〈〉〔〕［］｛｝﹏﹑﹔"
OFL_URL = "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/LICENSE"


def gb2312_characters() -> set[int]:
    result = set()
    for lead in range(0xA1, 0xF8):
        for trail in range(0xA1, 0xFF):
            try:
                result.update(map(ord, bytes([lead, trail]).decode("gb2312")))
            except UnicodeDecodeError:
                pass
    return result


def unicode_range(points: set[int] | list[int]) -> str:
    ordered = sorted(points)
    spans = []
    start = previous = ordered[0]
    for point in ordered[1:]:
        if point != previous + 1:
            spans.append(f"U+{start:X}" if start == previous else f"U+{start:X}-{previous:X}")
            start = point
        previous = point
    spans.append(f"U+{start:X}" if start == previous else f"U+{start:X}-{previous:X}")
    return ", ".join(spans)


def rename_subset(font, style: str, source_hash: str) -> None:
    postscript_name = "CampusSansSC-" + style
    names = {
        1: FAMILY, 2: style, 3: f"{FAMILY};{style};{source_hash[:12]}",
        4: f"{FAMILY} {style}", 6: postscript_name, 16: FAMILY, 17: style,
    }
    # Preserve copyright, version, attribution and the embedded OFL records.
    for record in list(font["name"].names):
        if record.nameID in names:
            font["name"].setName(names[record.nameID], record.nameID,
                                 record.platformID, record.platEncID, record.langID)
    for name_id, value in names.items():
        font["name"].setName(value, name_id, 3, 1, 0x409)
    if "CFF " in font:
        cff = font["CFF "].cff
        cff.fontNames = [postscript_name]
        cff.topDictIndex[0].FamilyName = FAMILY
        cff.topDictIndex[0].FullName = f"{FAMILY} {style}"


def build_weight(weight, style, source_data, source_hash, parts):
    from fontTools import subset
    from fontTools.ttLib import TTFont

    result = []
    for label, points in parts:
        font = TTFont(BytesIO(source_data), recalcTimestamp=False)
        options = subset.Options()
        options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 8, 9, 13, 14, 16, 17]
        options.name_languages = ["*"]
        # This SC web font keeps default and Simplified Chinese language rules.
        # Removing Japanese/Traditional locl variants reduces redundant glyphs;
        # the requested Unicode characters and normal shaping features remain.
        scripts = set()
        for table in ("GSUB", "GPOS"):
            if table in font:
                scripts.update(item.ScriptTag for item in font[table].table.ScriptList.ScriptRecord)
        options.layout_scripts = [f"{tag}.{language}" for tag in sorted(scripts)
                                  for language in ("dflt", "ZHS")]
        worker = subset.Subsetter(options=options)
        worker.populate(unicodes=points)
        worker.subset(font)
        rename_subset(font, style, source_hash)
        font.flavor = "woff2"
        output = BytesIO()
        font.save(output)
        font.close()
        body = output.getvalue()
        digest = hashlib.sha256(body).hexdigest()
        filename = f"campus-sans-sc-{weight}-{label}-{digest[:12]}.woff2"
        with TTFont(BytesIO(body)) as check:
            if not set(points).issubset(check.getBestCmap()):
                raise ValueError(f"Missing requested glyphs in {filename}")
            if check["OS/2"].usWeightClass != weight or "fvar" in check:
                raise ValueError(f"Incorrect static weight in {filename}")
            if check["name"].getDebugName(1) != FAMILY:
                raise ValueError(f"Incorrect font family in {filename}")
        result.append(({
            "file": filename, "weight": weight, "part": label,
            "bytes": len(body), "sha256": digest, "codepoints": len(points),
            "unicode_range": unicode_range(points),
        }, body))
        if label == "core" or int(label.split("-")[-1]) % 8 == 0:
            print(f"Prepared {weight} {label}: {len(body):,} bytes", flush=True)
    return result


def main() -> None:
    project = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--font-root", required=True, type=Path)
    parser.add_argument("--text-root", type=Path, default=project / "cat-frontend/src")
    parser.add_argument("--output-dir", type=Path, default=project / "cat-frontend/public/fonts")
    parser.add_argument("--chunk-size", type=int, default=256)
    parser.add_argument("--max-core-bytes", type=int, default=700 * 1024)
    parser.add_argument("--max-extension-bytes", type=int, default=150 * 1024)
    parser.add_argument("--max-total-bytes", type=int, default=10 * 1024 * 1024)
    args = parser.parse_args()
    if not 1 <= args.chunk_size <= 256:
        parser.error("chunk-size must be between 1 and 256")

    from fontTools import __version__ as fonttools_version
    from fontTools.ttLib import TTFont

    source_text = set()
    corpus_hash = hashlib.sha256()
    for path in sorted(args.text_root.rglob("*")):
        if path.is_file() and path.suffix in TEXT_SUFFIXES:
            text = path.read_text("utf-8")
            source_text.update(map(ord, text))
            corpus_hash.update(path.relative_to(args.text_root).as_posix().encode())
            corpus_hash.update(b"\0" + text.encode() + b"\0")
    if not source_text:
        raise ValueError("No source text found")
    core = set(range(0x20, 0x7F)) | set(map(ord, COMMON_PUNCTUATION)) | source_text
    gb2312 = gb2312_characters()
    all_requested = (gb2312 | source_text | set(range(0x20, 0x250))
                     | set(range(0x2000, 0x2070)) | set(range(0x3000, 0x3040))
                     | set(range(0xFF00, 0xFFF0)))
    originals = {}
    source_records = []
    coverage = None
    for weight, (filename, style) in SOURCES.items():
        data = (args.font_root / filename).read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        with TTFont(BytesIO(data)) as font:
            license_text = font["name"].getDebugName(13) or ""
            if "SIL Open Font License, Version 1.1" not in license_text:
                raise ValueError(f"Expected embedded OFL 1.1 in {filename}")
            if font["OS/2"].usWeightClass != weight or "fvar" in font:
                raise ValueError(f"Expected static weight {weight}: {filename}")
            available = set(font.getBestCmap())
            coverage = available if coverage is None else coverage & available
            source_records.append({
                "file": filename, "sha256": digest, "bytes": len(data),
                "weight": weight, "original_family": font["name"].getDebugName(1),
                "version": font["name"].getDebugName(5),
                "copyright": font["name"].getDebugName(0),
                "license": license_text,
            })
        originals[weight] = (style, data, digest)
    if gb2312 - coverage:
        raise ValueError("Every weight must contain the complete GB2312 repertoire")
    core &= coverage
    extension = sorted((all_requested & coverage) - core)
    parts = [("core", sorted(core))] + [
        (f"extended-{index // args.chunk_size:02d}", extension[index:index + args.chunk_size])
        for index in range(0, len(extension), args.chunk_size)
    ]
    with ThreadPoolExecutor(max_workers=3) as pool:
        pending = [pool.submit(build_weight, weight, *originals[weight], parts) for weight in SOURCES]
        outputs = [item for future in pending for item in future.result()]
    assets = [record for record, _ in outputs]
    core_bytes = sum(item["bytes"] for item in assets if item["part"] == "core")
    total_bytes = sum(item["bytes"] for item in assets)
    max_extension = max(item["bytes"] for item in assets if item["part"] != "core")
    if core_bytes > args.max_core_bytes or total_bytes > args.max_total_bytes or max_extension > args.max_extension_bytes:
        raise ValueError(f"Font budget exceeded: core={core_bytes}, total={total_bytes}, largest extension={max_extension}")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    css = ["/* Generated by scripts/build_web_fonts.py; SIL OFL 1.1. */"]
    for record, body in outputs:
        (args.output_dir / record["file"]).write_bytes(body)
        css.append("\n".join([
            "@font-face {", f"  font-family: '{FAMILY}';", "  font-style: normal;",
            f"  font-weight: {record['weight']};", "  font-display: swap;",
            f"  src: url('/fonts/{record['file']}') format('woff2');",
            f"  unicode-range: {record['unicode_range']};", "}",
        ]))
    (args.output_dir / "fonts.css").write_text("\n\n".join(css) + "\n", encoding="utf-8")
    manifest = {
        "family": FAMILY, "license": "SIL OFL 1.1", "license_source": OFL_URL,
        "fonttools_version": fonttools_version, "source_corpus_sha256": corpus_hash.hexdigest(),
        "gb2312_codepoints": len(gb2312), "core_codepoints": len(core),
        "extension_codepoints": len(extension), "extension_chunk_size": args.chunk_size,
        "missing_source_text": [f"U+{point:04X}" for point in sorted(source_text - coverage)
                                if point >= 0x20],
        "core_bytes": core_bytes, "total_bytes": total_bytes,
        "largest_extension_bytes": max_extension, "woff2_count": len(assets),
        "sources": source_records, "assets": assets,
    }
    (args.output_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: manifest[key] for key in (
        "core_bytes", "total_bytes", "largest_extension_bytes", "woff2_count",
        "core_codepoints", "extension_codepoints",
    )}), flush=True)


if __name__ == "__main__":
    main()
