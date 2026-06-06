"""Integration tests for cat recognition system.

Tests:
1. Model loading
2. Embedding extraction
3. Reference embedding loading
4. Recognition endpoint (API)
5. Database consistency
"""

import io
import json
import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent))

PASSED = 0
FAILED = 0


def test(name, fn):
    global PASSED, FAILED
    try:
        fn()
        print(f"  PASS: {name}")
        PASSED += 1
    except Exception as e:
        print(f"  FAIL: {name} -> {e}")
        FAILED += 1


# ─── 1. Model Loading ─────────────────────────────────────────────────

print("\n[1] Model Loading")

def test_model_loads():
    from app.services.model_loader import load_model
    model = load_model()
    assert model is not None, "Model is None"

test("Model loads successfully", test_model_loads)


# ─── 2. Embedding Extraction ──────────────────────────────────────────

print("\n[2] Embedding Extraction")

def test_embedding_shape():
    from PIL import Image
    from app.services.model_loader import extract_embedding
    # Create a dummy 224x224 image
    img = Image.new("RGB", (224, 224), color=(128, 128, 128))
    emb = extract_embedding(img)
    assert len(emb) == 256, f"Expected 256-dim, got {len(emb)}"

test("Embedding has 256 dimensions", test_embedding_shape)


def test_embedding_normalized():
    import math
    from PIL import Image
    from app.services.model_loader import extract_embedding
    img = Image.new("RGB", (224, 224), color=(128, 128, 128))
    emb = extract_embedding(img)
    norm = math.sqrt(sum(x * x for x in emb))
    assert abs(norm - 1.0) < 0.01, f"Expected L2 norm ~1.0, got {norm}"

test("Embedding is L2-normalized", test_embedding_normalized)


def test_cosine_similarity_self():
    from app.services.model_loader import cosine_similarity
    a = [1.0, 0.0, 0.0]
    sim = cosine_similarity(a, a)
    assert abs(sim - 1.0) < 0.001, f"Expected 1.0, got {sim}"

test("Cosine similarity of identical vectors = 1.0", test_cosine_similarity_self)


def test_cosine_similarity_orthogonal():
    from app.services.model_loader import cosine_similarity
    a = [1.0, 0.0, 0.0]
    b = [0.0, 1.0, 0.0]
    sim = cosine_similarity(a, b)
    assert abs(sim) < 0.001, f"Expected ~0.0, got {sim}"

test("Cosine similarity of orthogonal vectors = 0.0", test_cosine_similarity_orthogonal)


# ─── 3. Reference Embeddings ──────────────────────────────────────────

print("\n[3] Reference Embeddings")

def test_embeddings_file_exists():
    p = Path(__file__).parent / "embeddings" / "cat_embeddings.json"
    assert p.exists(), f"File not found: {p}"

test("Embeddings file exists", test_embeddings_file_exists)


def test_embeddings_file_valid():
    p = Path(__file__).parent / "embeddings" / "cat_embeddings.json"
    with open(p) as f:
        data = json.load(f)
    assert len(data) == 17, f"Expected 17 cats, got {len(data)}"
    for name, cat_data in data.items():
        assert "embeddings" in cat_data, f"Missing 'embeddings' key for {name}"
        assert len(cat_data["embeddings"]) > 0, f"Empty embeddings for {name}"
        assert len(cat_data["embeddings"][0]) == 256, f"Wrong embedding dim for {name}"

test("Embeddings file has 17 cats with valid data", test_embeddings_file_valid)


def test_embedding_loading():
    from app.services.ai import _load_reference_embeddings
    # Reset singleton to force reload
    import app.services.ai as ai_mod
    ai_mod._reference_embeddings = None
    data = _load_reference_embeddings()
    assert len(data) == 17, f"Expected 17, got {len(data)}"
    # Verify cat_ids are resolved
    for name, cat_data in data.items():
        assert cat_data["cat_id"] is not None, f"cat_id is None for {name}"

test("Reference embeddings load with cat_id resolution", test_embedding_loading)


# ─── 4. Recognition Logic ─────────────────────────────────────────────

print("\n[4] Recognition Logic")

def test_recognize_self():
    """Test recognizing an image that IS a reference image."""
    from app.services.ai import recognize_cat_image
    img_path = Path(__file__).parent / "uploads" / "cats" / "Amber" / "1.jpg"
    with open(img_path, "rb") as f:
        image_bytes = f.read()
    result = recognize_cat_image(image_bytes)
    assert result.status in ("confirmed", "uncertain"), f"Unexpected status: {result.status}"
    assert result.confidence > 0, f"Confidence should be > 0"
    if result.status == "uncertain":
        assert result.candidates is not None and len(result.candidates) > 0
    elif result.status == "confirmed":
        assert result.cat_name == "Amber", f"Expected Amber, got {result.cat_name}"

test("Recognize Amber's own image", test_recognize_self)


def test_recognize_returns_valid_structure():
    from app.services.ai import recognize_cat_image
    from app.schemas import RecognizeResponse
    img_path = Path(__file__).parent / "uploads" / "cats" / "Baguette" / "avatar.jpg"
    with open(img_path, "rb") as f:
        image_bytes = f.read()
    result = recognize_cat_image(image_bytes)
    assert isinstance(result, RecognizeResponse), "Wrong return type"
    assert result.status in ("confirmed", "uncertain", "unknown"), f"Invalid status: {result.status}"
    assert 0 <= result.confidence <= 1, f"Confidence out of range: {result.confidence}"

test("Recognize returns valid RecognizeResponse structure", test_recognize_returns_valid_structure)


def test_recognize_returns_candidates_for_uncertain():
    from app.services.ai import recognize_cat_image
    img_path = Path(__file__).parent / "uploads" / "cats" / "Shasha" / "1.jpg"
    with open(img_path, "rb") as f:
        image_bytes = f.read()
    result = recognize_cat_image(image_bytes)
    if result.status == "uncertain":
        assert result.candidates is not None, "Uncertain status should have candidates"
        assert len(result.candidates) <= 3, "Should return at most 3 candidates"
        # Candidates should be sorted by confidence desc
        for i in range(len(result.candidates) - 1):
            assert result.candidates[i].confidence >= result.candidates[i+1].confidence, \
                "Candidates not sorted by confidence"

test("Uncertain results have sorted candidates", test_recognize_returns_candidates_for_uncertain)


def test_recognize_empty_image():
    from app.services.ai import recognize_cat_image
    # Empty bytes should not crash
    result = recognize_cat_image(b"")
    assert result.status == "unknown", "Empty image should return unknown"

test("Empty image returns unknown (no crash)", test_recognize_empty_image)


# ─── 5. Database Consistency ──────────────────────────────────────────

print("\n[5] Database Consistency")

def test_database_cats():
    from app.database import SessionLocal
    from app import models
    db = SessionLocal()
    try:
        cats = db.query(models.Cat).all()
        assert len(cats) == 17, f"Expected 17 cats, got {len(cats)}"
        names = {c.name for c in cats}
        expected = {"Amber", "Awu", "Baguette", "Chewy", "Coco", "Curry",
                    "DarkChocolate", "Glaze", "LittleStick", "Meimei",
                    "Nana", "Naonao", "osmanthus", "PeanutCandy", "Roll",
                    "Salmon", "Shasha"}
        assert names == expected, f"Cat names mismatch: {names - expected}, {expected - names}"
    finally:
        db.close()

test("Database has 17 cats with correct names", test_database_cats)


def test_database_images():
    from app.database import SessionLocal
    from app import models
    db = SessionLocal()
    try:
        count = db.query(models.CatImage).count()
        assert count == 170, f"Expected 170 images, got {count}"
    finally:
        db.close()

test("Database has 170 cat images", test_database_images)


def test_database_sightings():
    from app.database import SessionLocal
    from app import models
    db = SessionLocal()
    try:
        count = db.query(models.Sighting).count()
        assert count == 8, f"Expected 8 sightings, got {count}"
    finally:
        db.close()

test("Database has 8 sightings", test_database_sightings)


def test_embeddings_match_database():
    """Verify every cat in embeddings file exists in database."""
    from app.database import SessionLocal
    from app import models
    import json
    db = SessionLocal()
    try:
        p = Path(__file__).parent / "embeddings" / "cat_embeddings.json"
        with open(p) as f:
            data = json.load(f)
        for cat_name in data:
            cat = db.query(models.Cat).filter(models.Cat.name == cat_name).first()
            assert cat is not None, f"Cat '{cat_name}' not in database"
    finally:
        db.close()

test("All embedding cats exist in database", test_embeddings_match_database)


# ─── Summary ──────────────────────────────────────────────────────────

print(f"\n{'='*50}")
print(f"Results: {PASSED} passed, {FAILED} failed, {PASSED + FAILED} total")
print(f"{'='*50}")

if FAILED > 0:
    sys.exit(1)
