"""Offline import boundaries, real SQLite transactions, and source identity."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys

from PIL import Image
import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / 'scripts'))
import import_meowzart_archive as importer


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')


@pytest.fixture(scope='module')
def migrated(tmp_path_factory):
    path = tmp_path_factory.mktemp('meowzart-schema') / 'template.db'
    result = subprocess.run([sys.executable, '-m', 'alembic', 'upgrade', 'head'], cwd=BACKEND,
        env={**os.environ, 'DATABASE_URL': f'sqlite:///{path.as_posix()}'},
        capture_output=True, text=True, timeout=45)
    assert result.returncode == 0, result.stderr
    return path


@pytest.fixture
def data(tmp_path, migrated):
    database = tmp_path / 'data' / 'cats.db'
    database.parent.mkdir()
    shutil.copyfile(migrated, database)
    archive = tmp_path / 'archive'
    images = archive / 'images'
    images.mkdir(parents=True)
    catalog, manifest, decisions = [], [], []
    for index, (pet_id, name) in enumerate([('11', '同名'), ('12', '同名'), ('10097', '豆腐')]):
        temporary = images / 'new.png'
        Image.new('RGB', (16, 12), (index * 50, 120, 20)).save(temporary)
        sha = hashlib.sha256(temporary.read_bytes()).hexdigest()
        photo = images / f'{sha}.png'
        temporary.rename(photo)
        url = f'https://static.nordri.co/rms/{pet_id}.png'
        catalog.append({'source_pet_id': pet_id, 'source_name': name,
            'society_id': 1, 'category': 'cat', 'photos': [{'url': url}]})
        manifest.append({'url': url, 'sha256': sha, 'file': photo.name,
            'bytes': photo.stat().st_size, 'width': 16, 'height': 12, 'format': 'PNG'})
        decisions.append({'source_pet_id': pet_id, 'sha256': sha,
            'use': 'avatar_only' if pet_id == '10097' else 'reference',
            'reason': 'Fixture review: collage' if pet_id == '10097' else 'Fixture single cat'})
    write_json(archive / 'catalog.json', catalog)
    write_json(archive / 'image-manifest.json', manifest)
    review = tmp_path / 'review.json'
    write_json(review, {'provider': importer.PROVIDER, 'archive_sha256': {
        name: importer.digest(archive / name) for name in ('catalog.json', 'image-manifest.json')},
        'decisions': decisions})
    return dict(archive=archive, review=review, database=database, uploads=tmp_path / 'uploads')


def refresh_review(data):
    review = importer.read_json(data['review'])
    review['archive_sha256'] = {name: importer.digest(data['archive'] / name)
                               for name in ('catalog.json', 'image-manifest.json')}
    write_json(data['review'], review)


def counts(database):
    with sqlite3.connect(database) as db:
        return (db.execute('SELECT count(*) FROM cats').fetchone()[0],
                db.execute('SELECT count(*) FROM cat_images').fetchone()[0],
                db.execute('SELECT generation FROM reference_catalog').fetchone()[0])


def test_preview_is_read_only(data):
    before = counts(data['database'])
    report = importer.import_archive(**data)
    assert (report['cats_created'], report['images_created']) == (3, 2)
    assert counts(data['database']) == before
    assert not data['uploads'].exists()
    assert not (data['database'].parent / 'imports').exists()


@pytest.mark.parametrize('storage', ['hardlink', 'copy'])
def test_import_preserves_source_ids_blank_fields_and_avatar_only(data, storage):
    report = importer.import_archive(**data, apply=True, storage=storage)
    assert counts(data['database']) == (3, 2, 5)
    assert len({row['reference_id'] for row in report['mappings']}) == 3
    assert report['storage']['linked' if storage == 'hardlink' else 'copied'] == 3
    with sqlite3.connect(data['database']) as db:
        assert db.execute('SELECT count(*) FROM cats WHERE name=?', ('同名',)).fetchone()[0] == 2
        assert db.execute('SELECT count(*) FROM cats WHERE gender IS NOT NULL OR age_estimate IS NOT NULL '
                          'OR location IS NOT NULL OR personality IS NOT NULL OR story IS NOT NULL').fetchone()[0] == 0
    collage = next(row for row in report['mappings'] if row['source_pet_id'] == '10097')
    assert collage['image_id'] is None
    for row in report['mappings']:
        target = data['uploads'] / row['image_path'].removeprefix('/uploads/')
        source = data['archive'] / 'images' / f"{row['sha256']}.png"
        assert importer.digest(target) == row['sha256']
        assert os.path.samefile(source, target) is (storage == 'hardlink')
    assert importer.read_json(Path(report['receipt']))['mappings'] == report['mappings']
    assert counts(report['backup']['path']) == (0, 0, 0)


def test_repeated_import_preserves_manual_edits_and_generation(data):
    first = importer.import_archive(**data, apply=True)
    cat_id = first['mappings'][0]['cat_id']
    with sqlite3.connect(data['database']) as db:
        db.execute('UPDATE cats SET name=?, story=?, avatar=? WHERE id=?',
                   ('人工修订', '真实记录', '/uploads/cats/manual.png', cat_id))
    before = counts(data['database'])
    second = importer.import_archive(**data, apply=True)
    assert counts(data['database']) == before
    assert (second['cats_created'], second['images_created']) == (0, 0)
    assert second['storage'] == {'linked': 0, 'copied': 0, 'reused': 3}
    assert second['mappings'][0]['current_name'] == '人工修订'
    assert second['mappings'][0]['current_avatar'] == '/uploads/cats/manual.png'
    assert [row['cat_id'] for row in first['mappings']] == [row['cat_id'] for row in second['mappings']]
    assert 'backup' not in second
    with sqlite3.connect(data['database']) as db:
        assert db.execute('SELECT story FROM cats WHERE id=?', (cat_id,)).fetchone()[0] == '真实记录'


def test_existing_same_name_is_never_reassigned_or_overwritten(data):
    with sqlite3.connect(data['database']) as db:
        db.execute("INSERT INTO cats(id, reference_id, name, story) VALUES (99, ?, '同名', '已有档案')", ('a' * 32,))
    report = importer.import_archive(**data, apply=True)
    assert counts(data['database'])[:2] == (4, 2)
    assert all(row['cat_id'] != 99 for row in report['mappings'])
    assert all(row['existing_cat_ids'] == [99] for row in report['same_name_records_not_merged'])
    with sqlite3.connect(data['database']) as db:
        assert db.execute('SELECT reference_id, story FROM cats WHERE id=99').fetchone() == ('a' * 32, '已有档案')


def test_corrupted_image_aborts_before_database_or_file_writes(data):
    manifest = importer.read_json(data['archive'] / 'image-manifest.json')
    (data['archive'] / 'images' / manifest[-1]['file']).write_bytes(b'broken')
    with pytest.raises(importer.ImportRejected, match='size/SHA256'):
        importer.import_archive(**data, apply=True)
    assert counts(data['database']) == (0, 0, 0)
    assert not data['uploads'].exists()
    assert not (data['database'].parent / 'imports').exists()


@pytest.mark.parametrize('bad_file', ['../outside.png', '..\\outside.png', 'C:\\outside.png'])
def test_manifest_path_traversal_is_rejected(data, bad_file):
    manifest = importer.read_json(data['archive'] / 'image-manifest.json')
    manifest[0]['file'] = bad_file
    write_json(data['archive'] / 'image-manifest.json', manifest)
    refresh_review(data)
    with pytest.raises(importer.ImportRejected, match='filename'):
        importer.import_archive(**data, apply=True)
    assert counts(data['database']) == (0, 0, 0)


@pytest.mark.parametrize('problem', ['duplicate_id', 'ambiguous_url', 'species_conflict'])
def test_invalid_source_mapping_is_rejected(data, problem):
    catalog = importer.read_json(data['archive'] / 'catalog.json')
    if problem == 'duplicate_id':
        catalog[1]['source_pet_id'] = catalog[0]['source_pet_id']
    elif problem == 'ambiguous_url':
        catalog[1]['photos'] = catalog[0]['photos']
    else:
        catalog[0]['source_pet_id'] = '12281'
    write_json(data['archive'] / 'catalog.json', catalog)
    refresh_review(data)
    with pytest.raises(importer.ImportRejected):
        importer.import_archive(**data, apply=True)
    assert counts(data['database']) == (0, 0, 0)


@pytest.mark.parametrize('problem', ['missing_decision', 'changed_manifest', 'collage_reference'])
def test_review_must_cover_exact_images_and_exclude_collages(data, problem):
    review = importer.read_json(data['review'])
    if problem == 'missing_decision':
        review['decisions'].pop()
    elif problem == 'changed_manifest':
        review['archive_sha256']['image-manifest.json'] = '0' * 64
    else:
        review['decisions'][-1]['use'] = 'reference'
    write_json(data['review'], review)
    with pytest.raises(importer.ImportRejected):
        importer.import_archive(**data, apply=True)
    assert counts(data['database']) == (0, 0, 0)


def test_existing_different_file_is_not_overwritten(data):
    photos, _ = importer.load_plan(data['archive'], data['review'])
    target = data['uploads'] / photos[0].resource.removeprefix('/uploads/')
    target.parent.mkdir(parents=True)
    target.write_bytes(b'preexisting')
    with pytest.raises(importer.ImportRejected, match='different content'):
        importer.import_archive(**data, apply=True)
    assert target.read_bytes() == b'preexisting'
    assert counts(data['database']) == (0, 0, 0)


def test_conflicting_photo_owner_is_not_reassigned(data):
    photos, _ = importer.load_plan(data['archive'], data['review'])
    with sqlite3.connect(data['database']) as db:
        db.execute("INSERT INTO cats(id, reference_id, name) VALUES (99, ?, '原档案')", ('a' * 32,))
        db.execute('INSERT INTO cat_images(cat_id, image_path) VALUES (99, ?)', (photos[0].resource,))
    before = counts(data['database'])
    with pytest.raises(importer.ImportRejected, match='ownership'):
        importer.import_archive(**data, apply=True)
    assert counts(data['database']) == before


def test_mid_transaction_failure_rolls_back_all_rows_and_generation(data):
    photos, _ = importer.load_plan(data['archive'], data['review'])
    with sqlite3.connect(data['database']) as db:
        # Fail the second image after the first cat+image have actually been inserted.
        db.execute(f"CREATE TRIGGER fail_second BEFORE INSERT ON cat_images "
                   f"WHEN NEW.image_path = '{photos[1].resource}' "
                   "BEGIN SELECT RAISE(ABORT, 'intentional fixture failure'); END")
    with pytest.raises(Exception, match='intentional fixture failure'):
        importer.import_archive(**data, apply=True)
    assert counts(data['database']) == (0, 0, 0)
    backup = next((data['database'].parent / 'imports').glob('*/before.db'))
    assert counts(backup) == (0, 0, 0)
    with sqlite3.connect(data['database']) as db:
        db.execute('DROP TRIGGER fail_second')
    # Unreferenced staged files are safe to reuse after a database rollback.
    report = importer.import_archive(**data, apply=True)
    assert counts(data['database']) == (3, 2, 5)
    assert report['storage']['reused'] == 2


def test_missing_database_is_not_implicitly_created(data):
    data['database'] = data['database'].with_name('missing.db')
    with pytest.raises(importer.ImportRejected, match='Alembic'):
        importer.import_archive(**data, apply=True)
    assert not data['database'].exists()
