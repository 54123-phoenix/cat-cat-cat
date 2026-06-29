import json
import os

os.environ.setdefault("JWT_SECRET", "test-jwt-secret-key-for-pytest")
os.environ.setdefault("ADMIN_PASSWORD", "testadmin123")
os.environ.setdefault("DEMO_PASSWORD", "testdemo123")
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("INIT_DEMO_USER", "0")

from app.api.system import system_health
from app.services import model_health


def test_system_health_handler_returns_model_contract():
    data = system_health()
    assert data["service"] == "cat-community"
    assert data["status"] in {"healthy", "degraded", "unhealthy"}
    assert "checked_at" in data

    model = data["model"]
    assert model["status"] in {"healthy", "degraded", "unhealthy"}
    assert "runtime_available" in model
    assert "model_file" in model
    assert "embeddings_file" in model
    assert "thresholds" in model
    assert model["thresholds"]["confirmed"] > model["thresholds"]["uncertain"]
    assert model["warm_model_requested"] is False
    assert any(check["name"] == "reference_embeddings" for check in model["checks"])


def test_model_health_reports_invalid_thresholds(monkeypatch):
    monkeypatch.setattr(model_health.settings, "RECOGNIZE_THRESHOLD_CONFIRMED", 0.2)
    monkeypatch.setattr(model_health.settings, "RECOGNIZE_THRESHOLD_UNCERTAIN", 0.3)

    health = model_health.get_model_health()

    threshold_check = next(
        check for check in health["checks"] if check["name"] == "recognition_thresholds"
    )
    assert health["status"] == "unhealthy"
    assert health["thresholds"]["valid"] is False
    assert threshold_check["status"] == "fail"


def test_model_health_reports_missing_embeddings(monkeypatch, tmp_path):
    missing_path = tmp_path / "missing_embeddings.json"
    monkeypatch.setattr(model_health, "EMBEDDINGS_PATH", missing_path)

    health = model_health.get_model_health()

    embeddings_check = next(
        check for check in health["checks"] if check["name"] == "reference_embeddings"
    )
    assert health["status"] == "unhealthy"
    assert health["reference_cat_count"] == 0
    assert embeddings_check["status"] == "fail"


def test_model_health_accepts_consistent_embedding_dimensions(monkeypatch, tmp_path):
    embeddings_path = tmp_path / "cat_embeddings.json"
    embeddings_path.write_text(
        json.dumps({"TestCat": {"embeddings": [[0.1, 0.2, 0.3], [0.2, 0.1, 0.4]]}}),
        encoding="utf-8",
    )
    monkeypatch.setattr(model_health, "EMBEDDINGS_PATH", embeddings_path)

    health = model_health.get_model_health()

    embeddings_check = next(
        check for check in health["checks"] if check["name"] == "reference_embeddings"
    )
    assert health["reference_cat_count"] == 1
    assert health["embedding_dimensions"] == [3]
    assert embeddings_check["status"] == "pass"
