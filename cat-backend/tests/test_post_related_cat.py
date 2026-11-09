"""Related cats survive real multipart publication and eager-loaded reads."""
from io import BytesIO
import re

from PIL import Image
import pytest
from sqlalchemy import event

from app import models
from app.api import upload
from test_repair_contracts import api


def test_multipart_publication_returns_related_cat_and_uploaded_image(api, tmp_path, monkeypatch):
    client, db, _, headers = api
    monkeypatch.setattr(upload, "UPLOAD_DIR", str(tmp_path))
    cat = models.Cat(name="关联猫咪")
    db.add(cat)
    db.commit()
    cat_id = cat.id
    expected_cat = {"id": cat_id, "name": "关联猫咪"}
    image = BytesIO()
    with Image.new("RGB", (12, 12), "orange") as fixture:
        fixture.save(image, format="PNG")

    response = client.post(
        "/api/posts",
        headers=headers["user"],
        data={"topic": "daily", "content": "今天看见关联猫咪", "relatedCatId": str(cat_id)},
        files={"files": ("fixture.png", image.getvalue(), "image/png")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["relatedCat"] == expected_cat
    assert len(payload["images"]) == 1 and payload["images"][0].startswith("/uploads/posts/")
    post_id = payload["id"]
    assert db.get(models.Post, post_id).related_cat_id == cat_id
    detail = client.get(f"/api/posts/{post_id}", headers=headers["user"])
    assert detail.status_code == 200
    assert detail.json()["relatedCat"] == expected_cat
    assert detail.json()["images"] == payload["images"]
    listing = client.get("/api/posts", headers=headers["user"])
    assert listing.status_code == 200
    assert listing.json()["items"][0]["relatedCat"] == expected_cat


@pytest.mark.parametrize("route", ["list", "search", "detail"])
def test_related_cat_reads_do_not_issue_a_query_per_cat(api, route):
    client, db, users, headers = api
    expected = {}
    for index in range(4):
        cat = models.Cat(name=f"fixture cat {index}")
        db.add(cat)
        db.flush()
        post = models.Post(user_id=users["user"].id, related_cat_id=cat.id, content=f"linked fixture {index}")
        db.add(post)
        db.flush()
        expected[post.id] = {"id": cat.id, "name": cat.name}
    db.commit()
    post_id = next(iter(expected))
    # Avoid session identity-map hits masking an accidental lazy load.
    db.expunge_all()
    statements = []

    def record_sql(connection, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    engine = db.get_bind()
    event.listen(engine, "before_cursor_execute", record_sql)
    try:
        path = {
            "list": "/api/posts",
            "search": "/api/posts?keyword=linked",
            "detail": f"/api/posts/{post_id}",
        }[route]
        response = client.get(path, headers=headers["user"])
    finally:
        event.remove(engine, "before_cursor_execute", record_sql)

    assert response.status_code == 200
    items = [response.json()] if route == "detail" else response.json()["items"]
    assert len(items) == (1 if route == "detail" else 4)
    assert all(item["relatedCat"] == expected[item["id"]] for item in items)
    # Cat data must come from the post query's join, not separate SELECTs.
    assert not any(re.search(r"\bFROM\s+cats\b", statement, re.IGNORECASE) for statement in statements)


def test_post_without_related_cat_remains_supported(api):
    client, _, _, headers = api
    response = client.post("/api/posts", headers=headers["user"], data={"content": "No cat selected"})
    assert response.status_code == 200
    assert response.json()["relatedCat"] is None
    detail = client.get(f'/api/posts/{response.json()["id"]}', headers=headers["user"])
    assert detail.status_code == 200
    assert detail.json()["relatedCat"] is None
