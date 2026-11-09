"""Cat detail responses from real ORM relationships in an isolated database."""
from datetime import datetime

from app import models
from test_repair_contracts import api


def test_detail_serializes_health_records_and_images(api):
    client, db, users, _ = api
    cat = models.Cat(name="Care history fixture", aliases="橘子,小橘")
    db.add(cat)
    db.flush()
    record = models.HealthRecord(
        cat_id=cat.id,
        record_type="vaccination",
        title="年度疫苗",
        description="观察情况正常",
        record_date=datetime(2026, 11, 8, 9, 30),
        location=None,
        status="completed",
        created_at=datetime(2026, 11, 8, 10),
        created_by=users["admin"].id,
    )
    photo = models.CatImage(cat_id=cat.id, image_path="/uploads/cats/fixture.png")
    db.add_all([record, photo])
    db.commit()

    response = client.get(f"/api/cats/{cat.id}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["health_records"] == [{
        "id": record.id,
        "cat_id": cat.id,
        "record_type": "vaccination",
        "title": "年度疫苗",
        "description": "观察情况正常",
        "record_date": "2026-11-08T09:30:00Z",
        "location": None,
        "status": "completed",
        "created_at": "2026-11-08T10:00:00Z",
    }]
    assert payload["images"][0]["image_path"] == "/uploads/cats/fixture.png"
    assert payload["aliases_list"] == ["橘子", "小橘"]


def test_detail_without_health_records_keeps_empty_list(api):
    client, db, _, _ = api
    cat = models.Cat(name="No health history fixture")
    db.add(cat)
    db.commit()

    response = client.get(f"/api/cats/{cat.id}")

    assert response.status_code == 200
    assert response.json()["health_records"] == []
