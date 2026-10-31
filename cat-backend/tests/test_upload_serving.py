"""HTTP regressions for the public upload directory boundary (ISS-001)."""

import os
import subprocess
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-key-for-pytest")
os.environ.setdefault("ADMIN_PASSWORD", "testadmin123")
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("INIT_DEMO_USER", "0")

import app.main as main


@pytest.fixture(scope="module")
def client():
    # File serving needs no startup jobs, database seeding, Redis, or model load.
    test_client = TestClient(main.app)
    try:
        yield test_client
    finally:
        test_client.close()


@pytest.fixture(params=["absolute", "relative"])
def upload_tree(request, tmp_path, monkeypatch):
    root = tmp_path / "uploads"
    (root / "cats").mkdir(parents=True)
    (root / "cats" / "sample.txt").write_bytes(b"public upload")
    neighbor = tmp_path / "uploads_neighbor"
    neighbor.mkdir()
    (neighbor / "marker.txt").write_bytes(b"outside upload directory")
    (tmp_path / "parent.txt").write_bytes(b"outside upload directory")

    monkeypatch.chdir(tmp_path)
    configured_root = str(root) if request.param == "absolute" else "./uploads"
    monkeypatch.setattr(main, "UPLOAD_DIR", configured_root)
    return root, neighbor


def _directory_link(link, target):
    # Junctions exercise real Windows path resolution without symlink privileges.
    if os.name == "nt":
        subprocess.run(
            ["cmd.exe", "/d", "/c", "mklink", "/J", str(link), str(target)],
            check=True,
            capture_output=True,
        )
    else:
        link.symlink_to(target, target_is_directory=True)


@pytest.mark.parametrize("path", ["cats/sample.txt", "cats/%2e%2e%2fcats%2fsample.txt"])
def test_upload_serves_files_inside_root(client, upload_tree, path):
    response = client.get(f"/uploads/{path}")
    assert response.status_code == 200
    assert response.content == b"public upload"


@pytest.mark.parametrize("path", ["cats/missing.txt", "cats", ""])
def test_upload_missing_file_or_directory_is_not_served(client, upload_tree, path):
    response = client.get(f"/uploads/{path}")
    assert response.status_code == 404


@pytest.mark.parametrize(
    "path",
    [
        "%2e%2e%2fuploads_neighbor%2fmarker.txt",
        "%2e%2e%2fparent.txt",
        "cats/%2e%2e%2f%2e%2e%2fuploads_neighbor%2fmarker.txt",
    ],
)
def test_upload_rejects_parent_and_prefix_sibling_traversal(client, upload_tree, path):
    # Encode traversal so the HTTP client does not normalize it before dispatch.
    response = client.get(f"/uploads/{path}")
    assert response.status_code == 403
    assert response.json() == {"detail": "Access denied"}


def test_upload_rejects_absolute_path(client, upload_tree):
    _, neighbor = upload_tree
    path = quote(str(neighbor / "marker.txt"), safe="")
    response = client.get(f"/uploads/{path}")
    assert response.status_code == 403
    assert response.json() == {"detail": "Access denied"}


def test_upload_does_not_allow_windows_separator_escape(client, upload_tree):
    response = client.get("/uploads/%2e%2e%5cuploads_neighbor%5cmarker.txt")
    # Backslash is an ordinary filename character on POSIX, so 404 is also safe.
    assert response.status_code == (403 if os.name == "nt" else 404)
    assert b"outside upload directory" not in response.content


def test_upload_rejects_link_resolving_outside_root(client, upload_tree):
    root, neighbor = upload_tree
    _directory_link(root / "external", neighbor)
    response = client.get("/uploads/external/marker.txt")
    assert response.status_code == 403
    assert response.json() == {"detail": "Access denied"}


def test_upload_allows_link_resolving_inside_root(client, upload_tree):
    root, _ = upload_tree
    _directory_link(root / "internal", root / "cats")
    response = client.get("/uploads/internal/sample.txt")
    assert response.status_code == 200
    assert response.content == b"public upload"


def test_upload_rejects_invalid_path_without_server_error(client, upload_tree):
    response = client.get("/uploads/cats/%00sample.txt")
    assert response.status_code in (403, 404)
