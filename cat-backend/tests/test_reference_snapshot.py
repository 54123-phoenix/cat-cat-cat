"""Synthetic vectors exercise identity/control flow, never recognition quality."""
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid

from PIL import Image
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import models
from app.database import Base
from app.services import reference_snapshot as ref
from app.services import ai, model_loader


@pytest.fixture
def bundle(tmp_path, monkeypatch):
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    db = factory()
    uploads = tmp_path / 'uploads'
    (uploads / 'cats').mkdir(parents=True)
    photo = uploads / 'cats' / 'one.png'
    Image.new('RGB', (16, 16), 'orange').save(photo)
    db.add(models.ReferenceCatalog(id=1, database_id=uuid.uuid4().hex))
    cat = models.Cat(id=1, name='same-name')
    db.add(cat)
    db.flush()
    db.add(models.CatImage(id=1, cat_id=cat.id, image_path='/uploads/cats/one.png'))
    db.commit()
    weights = tmp_path / 'weights.pt'
    weights.write_bytes(b'synthetic-checkpoint-not-a-real-model')
    pipeline = ref.Pipeline(crop='none-v1', detector_sha256=None)
    identity = lambda crop=False: (ref.sha256_file(weights), pipeline)
    vector = [1.0] + [0.0] * 255
    output = tmp_path / 'candidate'
    manifest = ref.build_candidate(output, db, uploads, crop=False, identity_provider=identity,
                                   extractor=lambda image, **kw: vector)
    monkeypatch.setattr('app.database.SessionLocal', factory)
    monkeypatch.setattr(ref.settings, 'UPLOAD_DIR', str(uploads))
    monkeypatch.setattr(ref.settings, 'REFERENCE_DIR', str(output))
    monkeypatch.setattr(model_loader, 'MODEL_PATH', weights)
    monkeypatch.setattr(ai, 'TORCH_AVAILABLE', True)
    monkeypatch.setattr(ai, 'extract_embedding', lambda image, **kw: vector)
    yield db, output, uploads, weights, identity, manifest, photo, vector
    db.close()
    engine.dispose()


def load(bundle):
    db, output, uploads, _, identity, *_ = bundle
    return ref.load_snapshot(output, db, uploads, *identity())


def edit_manifest(output, edit):
    path = output / 'manifest.json'
    data = json.loads(path.read_bytes())
    edit(data)
    path.write_bytes(ref.canonical(data))


def test_compatible_bundle_and_renamed_cat_keep_identity(bundle):
    db, _, _, _, _, manifest, photo, _ = bundle
    before = load(bundle)
    cat = db.get(models.Cat, 1)
    original_id = cat.reference_id
    cat.name = 'renamed-cat'
    db.commit()
    after = load(bundle)
    assert after.catalog.revision == before.catalog.revision
    assert cat.reference_id == original_id == manifest.cats[0].reference_id
    assert after.catalog.names[original_id] == 'renamed-cat'
    result = ai.recognize_cat_image(photo.read_bytes(), crop=False)
    assert result.status == 'confirmed' and result.cat_id == 1 and result.cat_name == 'renamed-cat'
    assert ref.reference_status(False)['status'] == 'compatible'


def test_positive_margin_keeps_lone_gallery_identity_uncertain(bundle, monkeypatch):
    *_, photo, _ = bundle
    monkeypatch.setattr(ai.settings, 'RECOGNIZE_MIN_MARGIN', .1)
    details = ai.recognize_with_details(photo.read_bytes(), crop=False)
    assert details.response.status == 'uncertain' and details.response.cat_id is None
    assert len(details.ranking) == 1 and details.ranking[0].cat_id == 1
    assert details.response.candidates == list(details.ranking)


def test_preprocessing_switch_rejects_old_vectors_until_rebuild(bundle, monkeypatch, tmp_path):
    db, old_output, uploads, _, _, _, photo, vector = bundle
    assert ref.reference_status(False)['status'] == 'compatible'
    monkeypatch.setattr(ref.settings, 'RECOGNIZE_PREPROCESS', 'letterbox224')
    model_hash, pipeline = ref.runtime_identity(False)
    assert pipeline.preprocessing == ref.LETTERBOX_VERSION
    with pytest.raises(ref.ReferenceUnavailable):
        ref.load_snapshot(old_output, db, uploads, model_hash, pipeline)
    assert ai.recognize_cat_image(photo.read_bytes(), crop=False).status == 'unavailable'
    new_output = tmp_path / 'letterbox'
    ref.build_candidate(new_output, db, uploads, crop=False, extractor=lambda image, **kw: vector)
    assert ref.load_snapshot(new_output, db, uploads, model_hash, pipeline).manifest.pipeline == pipeline
    monkeypatch.setattr(ref.settings, 'REFERENCE_DIR', str(new_output))
    assert ai.recognize_cat_image(photo.read_bytes(), crop=False).status == 'confirmed'
    monkeypatch.setattr(ref.settings, 'RECOGNIZE_PREPROCESS', 'center224')
    assert ai.recognize_cat_image(photo.read_bytes(), crop=False).status == 'unavailable'


def test_other_database_with_identical_numeric_id_and_name_is_rejected(bundle, monkeypatch):
    _, output, uploads, _, identity, _, photo, _ = bundle
    other_engine = create_engine('sqlite://', poolclass=StaticPool)
    Base.metadata.create_all(other_engine)
    factory = sessionmaker(bind=other_engine)
    with factory() as other:
        other.add(models.ReferenceCatalog(id=1, database_id=uuid.uuid4().hex))
        other.add(models.Cat(id=1, name='same-name'))
        other.flush()
        other.add(models.CatImage(id=1, cat_id=1, image_path='/uploads/cats/one.png'))
        other.commit()
        with pytest.raises(ref.ReferenceUnavailable, match='another database'):
            ref.load_snapshot(output, other, uploads, *identity())
    monkeypatch.setattr('app.database.SessionLocal', factory)
    assert ai.recognize_cat_image(photo.read_bytes(), crop=False).status == 'unavailable'
    other_engine.dispose()


def test_reused_numeric_id_and_name_do_not_reuse_previous_cat_identity(bundle):
    db, _, _, _, _, manifest, photo, _ = bundle
    assert ai.recognize_cat_image(photo.read_bytes(), crop=False).status == 'confirmed'
    db.query(models.CatImage).delete()
    db.query(models.Cat).delete()
    db.add(models.Cat(id=1, name='same-name'))
    db.flush()
    db.add(models.CatImage(id=1, cat_id=1, image_path='/uploads/cats/one.png'))
    db.commit()
    assert db.get(models.Cat, 1).reference_id != manifest.cats[0].reference_id
    with pytest.raises(ref.ReferenceUnavailable, match='identity mapping'):
        load(bundle)
    assert ai.recognize_cat_image(photo.read_bytes(), crop=False).status == 'unavailable'


@pytest.mark.parametrize('change', ['model', 'dimension', 'pipeline', 'corrupt', 'missing', 'artifact', 'source', 'mapping', 'photo_removed', 'cat_added'])
def test_incompatible_or_incomplete_assets_fail_closed(bundle, change):
    db, output, _, weights, _, _, photo, _ = bundle
    if change == 'model':
        weights.write_bytes(b'different-checkpoint')
    elif change == 'dimension':
        edit_manifest(output, lambda data: data.update(dimension=128))
    elif change == 'pipeline':
        edit_manifest(output, lambda data: data['pipeline'].update(crop=ref.CROP_VERSION, detector_sha256='f' * 64))
    elif change == 'corrupt':
        (output / 'manifest.json').write_text('{broken')
    elif change == 'missing':
        (output / 'manifest.json').unlink()
    elif change == 'artifact':
        (output / 'vectors.json').write_text('[]')
    elif change == 'source':
        Image.new('RGB', (16, 16), 'white').save(photo)
    elif change == 'mapping':
        edit_manifest(output, lambda data: data['cats'][0].update(reference_id='f' * 32))
    elif change == 'photo_removed':
        db.query(models.CatImage).delete()
        db.commit()
    else:
        db.add(models.Cat(name='new-cat'))
        db.commit()
    with pytest.raises(ref.ReferenceUnavailable):
        load(bundle)
    assert ai.recognize_cat_image(photo.read_bytes(), crop=False).status == 'unavailable'
    assert ref.reference_status(False)['status'] == 'unavailable'


@pytest.mark.parametrize('mutation', ['empty', 'zero', 'short', 'nan', 'duplicate', 'wrong-cat'])
def test_matching_hash_is_not_enough_for_invalid_vectors(bundle, mutation):
    _, output, *_ = bundle
    data = json.loads((output / 'vectors.json').read_bytes())
    if mutation == 'empty': data = []
    elif mutation == 'zero': data[0]['embedding'] = [0.0] * 256
    elif mutation == 'short': data[0]['embedding'] = [1.0]
    elif mutation == 'nan': data[0]['embedding'][0] = float('nan')
    elif mutation == 'duplicate': data.append(data[0])
    else: data[0]['reference_id'] = 'f' * 32
    raw = json.dumps(data).encode()
    (output / 'vectors.json').write_bytes(raw)
    edit_manifest(output, lambda manifest: manifest['artifacts'].update({'vectors.json': hashlib.sha256(raw).hexdigest()}))
    with pytest.raises(ref.ReferenceUnavailable):
        load(bundle)


def test_failed_candidate_does_not_touch_existing_bundle_or_database(bundle):
    db, output, uploads, _, identity, _, _, _ = bundle
    before = (output / 'manifest.json').read_bytes()
    before_revision = ref.capture_catalog(db, uploads).revision
    failed_output = output.parent / 'failed'
    with pytest.raises(ref.ReferenceUnavailable, match='dimension'):
        ref.build_candidate(failed_output, db, uploads, crop=False, identity_provider=identity,
                            extractor=lambda *a, **kw: [])
    assert (output / 'manifest.json').read_bytes() == before
    assert not failed_output.exists()
    assert ref.capture_catalog(db, uploads).revision == before_revision
    with pytest.raises(ref.ReferenceUnavailable, match='never overwritten'):
        ref.build_candidate(output, db, uploads, crop=False, identity_provider=identity)


def test_input_change_during_build_prevents_candidate(bundle):
    db, output, uploads, weights, identity, _, _, vector = bundle
    def extract(*args, **kwargs):
        weights.write_bytes(b'changed-mid-build')
        return vector
    with pytest.raises(ref.ReferenceUnavailable, match='changed during the build'):
        ref.build_candidate(output.parent / 'new', db, uploads, crop=False,
                            identity_provider=identity, extractor=extract)


def test_model_change_during_inference_does_not_return_old_match(bundle, monkeypatch):
    _, _, _, weights, _, _, photo, vector = bundle
    def extract(*args, **kwargs):
        weights.write_bytes(b'changed-mid-query')
        return vector
    monkeypatch.setattr(ai, 'extract_embedding', extract)
    assert ai.recognize_cat_image(photo.read_bytes(), crop=False).status == 'unavailable'


def test_faiss_and_numpy_use_the_same_validated_mapping(bundle, monkeypatch):
    photo = bundle[6]
    indexed = ai.recognize_cat_image(photo.read_bytes(), crop=False)
    monkeypatch.setattr(ai, 'FaissIndex', None)
    plain = ai.recognize_cat_image(photo.read_bytes(), crop=False)
    assert indexed.model_dump() == plain.model_dump()


def test_source_cannot_escape_upload_root(bundle):
    db = bundle[0]
    db.get(models.CatImage, 1).image_path = '/uploads/../weights.pt'
    db.commit()
    with pytest.raises(ref.ReferenceUnavailable, match='outside'):
        load(bundle)


def test_legacy_builder_refuses_reset_without_creating_database(tmp_path):
    backend = Path(__file__).resolve().parents[1]
    path = tmp_path / 'must-not-exist.db'
    result = subprocess.run([sys.executable, 'scripts/build_reference_db.py', '--reset'], cwd=backend,
                            env={**os.environ, 'DATABASE_URL': f'sqlite:///{path.as_posix()}'},
                            capture_output=True, text=True)
    assert result.returncode != 0 and 'legacy builder is disabled' in result.stderr
    assert not path.exists()


def test_builder_refuses_uncommitted_changes_without_discarding_them(bundle):
    db, output, uploads, _, identity, *_ = bundle
    cat = db.get(models.Cat, 1)
    cat.name = 'uncommitted-name'
    with pytest.raises(ref.ReferenceUnavailable, match='dedicated read session'):
        ref.build_candidate(output.parent / 'dirty', db, uploads, crop=False, identity_provider=identity)
    assert cat in db.dirty and cat.name == 'uncommitted-name'
    db.rollback()
