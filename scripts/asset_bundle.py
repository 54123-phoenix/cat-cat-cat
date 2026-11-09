"""Offline, verified bundles of SQLite, uploads, models and reference-store.

This does not stop services or make a cross-resource transaction. Operators must
stop all writers and the reference worker before an executing operation. Restore
only creates a new directory; it never replaces an existing deployment.
"""
import argparse
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import sqlite3
import stat


COMPONENTS = ("database", "uploads", "models", "reference-store")
MANIFEST = "asset-manifest.json"
INCOMPLETE = ".bundle-incomplete"
FORMAT = "campus-cat-assets-v1"


def checked_path(value):
    """Do not follow symlinks or Windows junctions, including parent components."""
    path = Path(os.path.abspath(value))
    for entry in reversed((path, *path.parents)):
        try:
            info = entry.lstat()
        except FileNotFoundError:
            continue
        if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & 0x400:
            raise ValueError(f"Links/reparse points are not supported: {entry}")
    return path


def relative_path(value):
    if not isinstance(value, str) or not value or "\\" in value or ":" in value:
        raise ValueError("Invalid bundle path")
    path = PurePosixPath(value)
    if not path.parts or path.is_absolute() or str(path) != value or any(p in (".", "..") for p in path.parts):
        raise ValueError(f"Invalid bundle path: {value}")
    for part in path.parts:
        if (part.rstrip(". ") != part or any(ord(c) < 32 for c in part)
                or any(c in '<>"|?*' for c in part)
                or re.fullmatch(r"(?i)(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?", part)):
            raise ValueError(f"Non-portable bundle path: {value}")
    return path


def digest(path):
    checked_path(path)
    if not stat.S_ISREG(path.stat().st_mode):
        raise ValueError(f"Not a regular file: {path}")
    result = hashlib.sha256()
    size = 0
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(chunk)
            size += len(chunk)
    return {"size": size, "sha256": result.hexdigest()}


def tree(root):
    checked_path(root)
    if not root.is_dir():
        raise ValueError(f"Directory not found: {root}")
    directories, files = [], []
    def fail(error):
        raise error
    for current, dirnames, filenames in os.walk(root, followlinks=False, onerror=fail):
        current = Path(current)
        for name in sorted(dirnames):
            child = checked_path(current / name)
            if not child.is_dir():
                raise ValueError(f"Not a directory: {child}")
            directories.append(relative_path(child.relative_to(root).as_posix()).as_posix())
        for name in sorted(filenames):
            child = checked_path(current / name)
            if not stat.S_ISREG(child.stat().st_mode):
                raise ValueError(f"Not a regular file: {child}")
            files.append(relative_path(child.relative_to(root).as_posix()).as_posix())
    return sorted(directories), sorted(files)


def new_destination(value, protected):
    destination = checked_path(value)
    if destination.exists():
        raise ValueError(f"Destination must be a new directory: {destination}")
    if not destination.parent.is_dir():
        raise ValueError("Destination parent must already exist")
    for source in protected:
        if destination.is_relative_to(source) or source.is_relative_to(destination):
            raise ValueError("Destination must not overlap a source or bundle")
    return destination


def sources_state(database, assets, *, hash_files):
    directories = list(COMPONENTS)
    files = {}
    for component, root in assets.items():
        dirs, names = tree(root)
        directories.extend(f"{component}/{name}" for name in dirs)
        for name in names:
            key = f"{component}/{name}"
            files[key] = digest(root / name) if hash_files else None
    # WAL contains committed data that may not have reached the main database.
    database_files = {}
    for candidate in (database, Path(str(database) + "-wal"), Path(str(database) + "-journal")):
        checked_path(candidate)
        if candidate.exists():
            database_files[str(candidate)] = digest(candidate) if hash_files else None
    return {"directories": sorted(directories), "files": files, "database_files": database_files}


def copy_file(source, destination, expected):
    checked_path(source)
    checked_path(destination)
    result = hashlib.sha256()
    size = 0
    with source.open("rb") as reader, destination.open("xb") as writer:
        for chunk in iter(lambda: reader.read(1024 * 1024), b""):
            writer.write(chunk)
            result.update(chunk)
            size += len(chunk)
    actual = {"size": size, "sha256": result.hexdigest()}
    if actual != expected:
        raise ValueError(f"File changed or is corrupt: {source}")


def sqlite_integrity(path):
    # Bundles contain standalone snapshots. Immutable read avoids creating WAL/SHM
    # files during verification and during the default restore preview.
    with closing(sqlite3.connect(path.as_uri() + "?mode=ro&immutable=1", uri=True)) as connection:
        rows = connection.execute("PRAGMA integrity_check").fetchall()
    if rows != [("ok",)]:
        raise ValueError(f"SQLite integrity check failed: {rows[:3]}")


def sqlite_snapshot(source, destination):
    with closing(sqlite3.connect(source.as_uri() + "?mode=ro", uri=True)) as reader:
        with closing(sqlite3.connect(destination)) as writer:
            reader.backup(writer)
    sqlite_integrity(destination)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate manifest key: {key}")
        result[key] = value
    return result


def verify_bundle(value, *, allow_incomplete=False):
    root = checked_path(value)
    actual_dirs, actual_files = tree(root)
    if INCOMPLETE in actual_files and not allow_incomplete:
        raise ValueError("Bundle is incomplete; do not restore or activate it")
    if MANIFEST not in actual_files:
        raise ValueError("Asset manifest not found")
    manifest = json.loads((root / MANIFEST).read_text(encoding="utf-8"), object_pairs_hook=unique_object)
    if not isinstance(manifest, dict) or manifest.get("format") != FORMAT:
        raise ValueError("Unsupported asset bundle format")
    directories, records = manifest.get("directories"), manifest.get("files")
    if not isinstance(directories, list) or not isinstance(records, list):
        raise ValueError("Invalid manifest inventory")
    names = set()
    def claim(name):
        path = relative_path(name)
        if path.parts[0] not in COMPONENTS or name.casefold() in names:
            raise ValueError(f"Invalid or duplicate asset path: {name}")
        names.add(name.casefold())
    for name in directories:
        claim(name)
    expected = {}
    for record in records:
        if not isinstance(record, dict) or set(record) != {"path", "size", "sha256"}:
            raise ValueError("Invalid manifest file entry")
        name = record["path"]
        claim(name)
        if (type(record["size"]) is not int or record["size"] < 0
                or not isinstance(record["sha256"], str)
                or not re.fullmatch("[0-9a-f]{64}", record["sha256"])):
            raise ValueError("Invalid file hash or size")
        expected[name] = {"size": record["size"], "sha256": record["sha256"]}
    if not set(COMPONENTS).issubset(directories) or "database/cat_community.db" not in expected:
        raise ValueError("Bundle must include all four asset components and its database")
    if any(name.startswith("database/") and name != "database/cat_community.db" for name in expected):
        raise ValueError("Database component must contain one standalone snapshot")
    ignored = {MANIFEST} | ({INCOMPLETE} if allow_incomplete else set())
    if set(actual_dirs) != set(directories) or set(actual_files) - ignored != set(expected):
        raise ValueError("Bundle files/directories do not match the manifest")
    for name, metadata in expected.items():
        if digest(root / name) != metadata:
            raise ValueError(f"Asset hash/size mismatch: {name}")
    sqlite_integrity(root / "database/cat_community.db")
    return manifest


def backup_bundle(database, uploads, models, reference_store, output, *, writers_stopped=False, dry_run=False):
    database = checked_path(database)
    if not database.is_file():
        raise ValueError("Database must be an existing SQLite file")
    assets = {"uploads": checked_path(uploads), "models": checked_path(models),
              "reference-store": checked_path(reference_store)}
    protected = [database, *assets.values()]
    for index, source in enumerate(protected):
        for other in protected[index + 1:]:
            if source.is_relative_to(other) or other.is_relative_to(source):
                raise ValueError("Source components must not overlap")
    # SQLite owns these paths even when no sidecar currently exists. A failed
    # backup must not leave a directory where SQLite will later need a file.
    reserved = [Path(str(database) + suffix) for suffix in ("-wal", "-shm", "-journal")]
    destination = new_destination(output, [*protected, *reserved])
    before = sources_state(database, assets, hash_files=not dry_run)
    if dry_run:
        return {"mode": "preview", "destination": str(destination), "asset_files": len(before["files"]) + 1,
                "requires": "Stop all API/business writers and reference-worker; pass --writers-stopped"}
    if not writers_stopped:
        raise ValueError("Stop all business writers and reference-worker, then pass --writers-stopped")
    # mkdir is exclusive. Any failed operation leaves a visibly incomplete new
    # directory, never overwrites a prior bundle, and never alters source files.
    destination.mkdir()
    (destination / INCOMPLETE).write_text("Do not use: bundle operation has not completed.\n", encoding="utf-8")
    for name in before["directories"]:
        (destination / name).mkdir()
    records = []
    for name, metadata in sorted(before["files"].items()):
        component, relative = name.split("/", 1)
        copy_file(assets[component] / relative, destination / name, metadata)
        records.append({"path": name, **metadata})
    saved_database = destination / "database/cat_community.db"
    sqlite_snapshot(database, saved_database)
    records.append({"path": "database/cat_community.db", **digest(saved_database)})
    if before != sources_state(database, assets, hash_files=True):
        raise ValueError("Sources changed during backup; stop all writers and retry into a new directory")
    manifest = {"format": FORMAT, "created_at": datetime.now(timezone.utc).isoformat(),
                "consistency": "operator-confirmed-stopped-writers", "sqlite_snapshot": "sqlite-backup-api",
                "sources": {"database": str(database), **{key: str(path) for key, path in assets.items()}},
                "directories": before["directories"], "files": sorted(records, key=lambda item: item["path"])}
    (destination / MANIFEST).write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    verify_bundle(destination, allow_incomplete=True)
    (destination / INCOMPLETE).unlink()
    return {"mode": "backup", "destination": str(destination), "verified_files": len(records)}


def restore_bundle(bundle, destination, *, confirm_restore=False, writers_stopped=False, dry_run=False):
    root = checked_path(bundle)
    destination = new_destination(destination, [root])
    # Verify the entire package before creating even an empty destination.
    manifest = verify_bundle(root)
    if dry_run or not confirm_restore:
        return {"mode": "preview", "destination": str(destination), "verified_files": len(manifest["files"]),
                "requires": "--confirm-restore --writers-stopped; destination must be new"}
    if not writers_stopped:
        raise ValueError("Stop business writers and reference-worker, then pass --writers-stopped")
    destination.mkdir()
    (destination / INCOMPLETE).write_text("Do not activate: restore has not completed.\n", encoding="utf-8")
    for name in sorted(manifest["directories"]):
        (destination / name).mkdir()
    for entry in manifest["files"]:
        copy_file(root / entry["path"], destination / entry["path"],
                  {"size": entry["size"], "sha256": entry["sha256"]})
    # Copy the exact verified manifest, then verify it again: mid-copy package
    # changes cannot silently produce a successful restore.
    copy_file(root / MANIFEST, destination / MANIFEST, digest(root / MANIFEST))
    restored = verify_bundle(destination, allow_incomplete=True)
    if restored != manifest:
        raise ValueError("Bundle manifest changed during restore")
    (destination / INCOMPLETE).unlink()
    return {"mode": "restore", "destination": str(destination), "verified_files": len(manifest["files"]),
            "next": "Validate application/schema/model compatibility before configuring this isolated directory"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    backup = commands.add_parser("backup")
    for option in ("database", "uploads", "models", "reference-store", "output"):
        backup.add_argument("--" + option, type=Path, required=True)
    backup.add_argument("--writers-stopped", action="store_true")
    backup.add_argument("--dry-run", action="store_true")
    restore = commands.add_parser("restore")
    restore.add_argument("--bundle", type=Path, required=True)
    restore.add_argument("--destination", type=Path, required=True)
    restore.add_argument("--confirm-restore", action="store_true")
    restore.add_argument("--writers-stopped", action="store_true")
    restore.add_argument("--dry-run", action="store_true")
    verify = commands.add_parser("verify")
    verify.add_argument("--bundle", type=Path, required=True)
    arguments = vars(parser.parse_args())
    command = arguments.pop("command")
    try:
        if command == "backup":
            result = backup_bundle(**arguments)
        elif command == "restore":
            result = restore_bundle(**arguments)
        else:
            manifest = verify_bundle(arguments["bundle"])
            result = {"mode": "verify", "verified_files": len(manifest["files"])}
        print(json.dumps(result, ensure_ascii=True, indent=2))
    except (ValueError, OSError, sqlite3.Error) as error:
        parser.exit(1, f"Asset bundle failed: {error}\n")


if __name__ == "__main__":
    main()
