"""All fixtures are disposable; no test reads workspace databases or assets."""
import importlib.util
import json
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys

import pytest


SCRIPTS = Path(__file__).resolve().parents[2] / "scripts"
spec = importlib.util.spec_from_file_location("asset_bundle", SCRIPTS / "asset_bundle.py")
bundle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bundle)


@pytest.fixture
def source(tmp_path):
    root = tmp_path / "custom source 校园"
    root.mkdir()
    database = root / "active.db"
    connection = sqlite3.connect(database)
    connection.execute("CREATE TABLE evidence (value TEXT)")
    connection.execute("INSERT INTO evidence VALUES ('original record')")
    connection.commit()
    connection.close()
    assets = {}
    for name in ("uploads", "models", "reference_store"):
        assets[name] = root / ("custom " + name)
        assets[name].mkdir()
    (assets["uploads"] / "cats").mkdir()
    (assets["uploads"] / "cats" / "猫.jpg").write_bytes(b"disposable image fixture")
    (assets["uploads"] / "empty album").mkdir()
    (assets["models"] / "model.bin").write_bytes(b"disposable model fixture")
    (assets["reference_store"] / "current.json").write_text('{"snapshot_id":"fixture"}', encoding="utf-8")
    (assets["reference_store"] / "versions").mkdir()
    (assets["reference_store"] / "versions" / "vectors.bin").write_bytes(b"disposable vectors")
    return {"database": database, **assets}


def save(source, tmp_path):
    output = tmp_path / "complete bundle"
    bundle.backup_bundle(**source, output=output, writers_stopped=True)
    return output


def files_under(root):
    return {path.relative_to(root).as_posix(): path.read_bytes() for path in root.rglob("*") if path.is_file()}


def test_full_roundtrip_custom_paths_empty_dirs_and_hashes(source, tmp_path):
    saved = save(source, tmp_path)
    manifest = bundle.verify_bundle(saved)
    assert {"database", "uploads", "models", "reference-store"}.issubset(manifest["directories"])
    assert "uploads/empty album" in manifest["directories"]
    assert manifest["sources"]["uploads"] == str(source["uploads"])
    (source["models"] / "model.bin").write_bytes(b"later source version")
    restored = tmp_path / "isolated restore"
    result = bundle.restore_bundle(saved, restored, confirm_restore=True, writers_stopped=True)
    assert result["mode"] == "restore"
    assert files_under(restored) == files_under(saved)
    assert (restored / "uploads/empty album").is_dir()
    connection = sqlite3.connect(restored / "database/cat_community.db")
    assert connection.execute("SELECT value FROM evidence").fetchone() == ("original record",)
    connection.close()


def test_preview_and_missing_acknowledgements_never_write(source, tmp_path):
    destination = tmp_path / "preview"
    before = files_under(tmp_path)
    assert bundle.backup_bundle(**source, output=destination, dry_run=True)["mode"] == "preview"
    with pytest.raises(ValueError, match="writers-stopped"):
        bundle.backup_bundle(**source, output=destination)
    assert files_under(tmp_path) == before
    assert not destination.exists()
    saved = save(source, tmp_path)
    before = files_under(tmp_path)
    assert bundle.restore_bundle(saved, destination)["mode"] == "preview"
    assert bundle.restore_bundle(saved, destination, confirm_restore=True, dry_run=True)["mode"] == "preview"
    with pytest.raises(ValueError, match="writers-stopped"):
        bundle.restore_bundle(saved, destination, confirm_restore=True)
    assert not destination.exists()
    assert files_under(tmp_path) == before


@pytest.mark.parametrize("damage", ["changed", "missing", "extra", "incomplete"])
def test_corrupt_bundle_rejected_before_destination_creation(source, tmp_path, damage):
    saved = save(source, tmp_path)
    if damage == "changed":
        (saved / "models/model.bin").write_bytes(b"corruption")
    elif damage == "missing":
        (saved / "reference-store/current.json").unlink()
    elif damage == "extra":
        (saved / "uploads/unlisted.jpg").write_bytes(b"unlisted")
    else:
        (saved / bundle.INCOMPLETE).write_text("interrupted", encoding="utf-8")
    restored = tmp_path / "must not appear"
    with pytest.raises(ValueError):
        bundle.restore_bundle(saved, restored, confirm_restore=True, writers_stopped=True)
    assert not restored.exists()
    assert (source["models"] / "model.bin").read_bytes() == b"disposable model fixture"


@pytest.mark.parametrize("bad_path", ["../escape", "uploads/../../escape", "/absolute", "C:/escape", "uploads\\escape", ".", "uploads/CON", "uploads/file."])
def test_manifest_path_traversal_and_nonportable_paths_fail_before_writes(source, tmp_path, bad_path):
    saved = save(source, tmp_path)
    manifest = json.loads((saved / bundle.MANIFEST).read_text(encoding="utf-8"))
    manifest["files"][0]["path"] = bad_path
    (saved / bundle.MANIFEST).write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError):
        bundle.restore_bundle(saved, tmp_path / "restore", confirm_restore=True, writers_stopped=True)
    assert not (tmp_path / "restore").exists()
    assert not (tmp_path / "escape").exists()


def test_duplicate_paths_and_invalid_database_are_rejected(source, tmp_path):
    saved = save(source, tmp_path)
    manifest = json.loads((saved / bundle.MANIFEST).read_text(encoding="utf-8"))
    manifest["files"].append(dict(manifest["files"][0]))
    (saved / bundle.MANIFEST).write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ValueError, match="duplicate"):
        bundle.verify_bundle(saved)
    manifest["files"].pop()
    database = saved / "database/cat_community.db"
    database.write_bytes(b"not a SQLite file")
    for item in manifest["files"]:
        if item["path"] == "database/cat_community.db":
            item.update(bundle.digest(database))
    (saved / bundle.MANIFEST).write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(sqlite3.DatabaseError):
        bundle.restore_bundle(saved, tmp_path / "restore", confirm_restore=True, writers_stopped=True)
    assert not (tmp_path / "restore").exists()


def test_existing_targets_and_overlapping_sources_are_never_overwritten(source, tmp_path):
    target = tmp_path / "protected deployment"
    target.mkdir()
    (target / "keep.txt").write_text("existing data", encoding="utf-8")
    with pytest.raises(ValueError, match="new directory"):
        bundle.backup_bundle(**source, output=target, writers_stopped=True)
    saved = save(source, tmp_path)
    with pytest.raises(ValueError, match="new directory"):
        bundle.restore_bundle(saved, target, confirm_restore=True, writers_stopped=True)
    with pytest.raises(ValueError, match="overlap"):
        bundle.backup_bundle(**source, output=source["uploads"] / "nested", writers_stopped=True)
    with pytest.raises(ValueError, match="overlap"):
        bundle.restore_bundle(saved, saved / "nested", confirm_restore=True, writers_stopped=True)
    assert (target / "keep.txt").read_text(encoding="utf-8") == "existing data"


@pytest.mark.parametrize("suffix", ["-wal", "-shm", "-journal"])
def test_backup_cannot_create_a_directory_at_a_reserved_sqlite_sidecar(source, suffix):
    database = source["database"]
    sidecar = Path(str(database) + suffix)
    assert not sidecar.exists()
    before = files_under(database.parent)
    with pytest.raises(ValueError, match="overlap"):
        bundle.backup_bundle(**source, output=sidecar, writers_stopped=True)
    assert not sidecar.exists()
    assert files_under(database.parent) == before
    with pytest.raises(ValueError, match="overlap"):
        bundle.backup_bundle(**source, output=sidecar, dry_run=True)
    assert not sidecar.exists()
    assert files_under(database.parent) == before


@pytest.mark.parametrize("suffix", ["-wal", "-shm", "-journal"])
def test_backup_rejects_a_target_inside_a_reserved_sidecar_directory(source, suffix):
    database = source["database"]
    sidecar = Path(str(database) + suffix)
    sidecar.mkdir()
    (sidecar / "keep.txt").write_bytes(b"existing fixture, do not change")
    before = files_under(database.parent)
    destination = sidecar / "nested bundle"
    with pytest.raises(ValueError, match="overlap"):
        bundle.backup_bundle(**source, output=destination, writers_stopped=True)
    assert not destination.exists()
    assert files_under(database.parent) == before


def make_directory_link(link, target):
    try:
        link.symlink_to(target, target_is_directory=True)
    except OSError:
        shell = shutil.which("pwsh") or shutil.which("powershell")
        if sys.platform != "win32" or not shell:
            pytest.skip("Directory links unavailable")
        # Native PowerShell creates only this disposable fixture junction.
        command = f"New-Item -ItemType Junction -Path '{str(link).replace(chr(39), chr(39) * 2)}' -Target '{str(target).replace(chr(39), chr(39) * 2)}' | Out-Null"
        result = subprocess.run([shell, "-NoProfile", "-Command", command], capture_output=True, text=True)
        if result.returncode:
            pytest.skip("Cannot create a disposable directory junction")


def test_links_and_junctions_in_sources_bundle_and_destination_parent_rejected(source, tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "keep.txt").write_text("untouched", encoding="utf-8")
    link = tmp_path / "linked parent"
    make_directory_link(link, outside)
    with pytest.raises(ValueError, match="Links/reparse"):
        bundle.backup_bundle(**source, output=link / "output", writers_stopped=True)
    nested = source["uploads"] / "linked album"
    make_directory_link(nested, outside)
    with pytest.raises(ValueError, match="Links/reparse"):
        bundle.backup_bundle(**source, output=tmp_path / "output", writers_stopped=True)
    # unlink/rmdir removes only the fixture link, never the target directory.
    if nested.is_symlink():
        nested.unlink()
    else:
        nested.rmdir()
    saved = save(source, tmp_path)
    make_directory_link(saved / "uploads/linked album", outside)
    with pytest.raises(ValueError, match="Links/reparse"):
        bundle.restore_bundle(saved, tmp_path / "restore", confirm_restore=True, writers_stopped=True)
    assert not (outside / "output").exists()
    assert not (tmp_path / "restore").exists()
    assert (outside / "keep.txt").read_text(encoding="utf-8") == "untouched"


def test_changed_sources_leave_an_unusable_incomplete_bundle(source, tmp_path, monkeypatch):
    original = bundle.copy_file
    def copy_and_change(reader, writer, expected):
        original(reader, writer, expected)
        if reader.name == "model.bin":
            reader.write_bytes(b"changed while backing up")
    monkeypatch.setattr(bundle, "copy_file", copy_and_change)
    output = tmp_path / "interrupted"
    with pytest.raises(ValueError, match="Sources changed"):
        bundle.backup_bundle(**source, output=output, writers_stopped=True)
    assert (output / bundle.INCOMPLETE).is_file()
    with pytest.raises(ValueError, match="incomplete"):
        bundle.verify_bundle(output)


def test_full_bundle_includes_committed_wal_without_source_mutation(source, tmp_path):
    connection = sqlite3.connect(source["database"])
    try:
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA wal_autocheckpoint=0")
        connection.execute("INSERT INTO evidence VALUES ('committed WAL row')")
        connection.commit()
        assert Path(str(source["database"]) + "-wal").stat().st_size > 0
        saved = save(source, tmp_path)
        restored_connection = sqlite3.connect(saved / "database/cat_community.db")
        assert restored_connection.execute("SELECT count(*) FROM evidence").fetchone()[0] == 2
        restored_connection.close()
    finally:
        connection.close()


def test_powershell_full_mode_roundtrip_and_default_preview(source, tmp_path):
    shell = shutil.which("pwsh") or shutil.which("powershell")
    if not shell:
        pytest.skip("PowerShell runtime not available")
    project = tmp_path / "wrapper fixture"
    scripts = project / "scripts"
    scripts.mkdir(parents=True)
    for name in ("backup.ps1", "restore.ps1", "database_path.ps1", "asset_bundle.py"):
        shutil.copyfile(SCRIPTS / name, scripts / name)
    saved = tmp_path / "wrapper bundle"
    restored = tmp_path / "wrapper restored"
    def run(name, *args):
        result = subprocess.run([shell, "-NoProfile", "-File", str(scripts / name),
                                 "-Python", sys.executable, "-FullAssets", *args], capture_output=True, text=True)
        assert result.returncode == 0, result.stdout + result.stderr
    backup_args = ["-DatabasePath", str(source["database"]), "-UploadsPath", str(source["uploads"]),
                   "-ModelsPath", str(source["models"]), "-ReferenceStorePath", str(source["reference_store"]),
                   "-BundlePath", str(saved)]
    run("backup.ps1", *backup_args, "-DryRun")
    assert not saved.exists()
    run("backup.ps1", *backup_args, "-WritersStopped")
    run("restore.ps1", "-BackupPath", str(saved), "-RestoreDir", str(restored))
    assert not restored.exists()
    run("restore.ps1", "-BackupPath", str(saved), "-RestoreDir", str(restored), "-ConfirmRestore", "-WritersStopped")
    assert files_under(saved) == files_under(restored)
    legacy_target = project / "cat-backend/uploads"
    legacy_target.mkdir(parents=True)
    (legacy_target / "keep.txt").write_text("preserve existing deployment", encoding="utf-8")
    legacy = subprocess.run([shell, "-NoProfile", "-File", str(scripts / "restore.ps1"),
                             "-Python", sys.executable, "-BackupPath", str(saved), "-ConfirmRestore"],
                            capture_output=True, text=True)
    assert legacy.returncode != 0
    assert "full asset bundle" in legacy.stdout + legacy.stderr
    assert (legacy_target / "keep.txt").read_text(encoding="utf-8") == "preserve existing deployment"
    assert not (project / "backups").exists()


def test_restore_detects_file_changed_after_preflight_and_keeps_it_incomplete(source, tmp_path, monkeypatch):
    saved = save(source, tmp_path)
    original = bundle.copy_file
    def change_then_copy(reader, writer, expected):
        if reader.name == "model.bin":
            reader.write_bytes(b"changed after preflight")
        original(reader, writer, expected)
    monkeypatch.setattr(bundle, "copy_file", change_then_copy)
    restored = tmp_path / "new incomplete restore"
    with pytest.raises(ValueError, match="changed or is corrupt"):
        bundle.restore_bundle(saved, restored, confirm_restore=True, writers_stopped=True)
    assert (restored / bundle.INCOMPLETE).exists()
    with pytest.raises(ValueError, match="incomplete"):
        bundle.verify_bundle(restored)
    assert (source["models"] / "model.bin").read_bytes() == b"disposable model fixture"
