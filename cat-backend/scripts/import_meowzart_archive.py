"""Import a reviewed, already downloaded Meowzart avatar archive, entirely offline.

Explicit SQLite/upload paths prevent accidentally importing into a second database.
No guessed profile fields, name-based identity matching, training or network I/O.
"""
import argparse
from collections import defaultdict
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import sys
import uuid
import warnings

from PIL import Image
from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app import models
from app.schema_readiness import require_current_schema

PROVIDER = 'meowzart:society:1'
KNOWN_SPECIES_CONFLICTS = {'12284', '12283', '12282', '12281'}
KNOWN_COLLAGES = {'10097', '10098'}


class ImportRejected(RuntimeError):
    pass


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def read_json(path):
    with Path(path).open(encoding='utf-8') as stream:
        return json.load(stream)


def write_json(path, value):
    # Run directories are unique; never replace a previous receipt.
    with Path(path).open('x', encoding='utf-8') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write('\n')
        stream.flush()
        os.fsync(stream.fileno())


@dataclass(frozen=True)
class Photo:
    pet_id: str
    name: str
    url: str
    source: Path
    sha256: str
    size: int
    use: str
    reason: str

    @property
    def reference_id(self):
        return uuid.uuid5(uuid.NAMESPACE_URL, f'{PROVIDER}:pet:{self.pet_id}').hex

    @property
    def resource(self):
        return f'/uploads/cats/meowzart/{self.pet_id}-{self.source.name}'


def load_plan(archive: Path, review_path: Path):
    archive = archive.resolve(strict=True)
    image_root = (archive / 'images').resolve(strict=True)
    if not image_root.is_relative_to(archive):
        raise ImportRejected('Archive images escape the archive directory')
    hashes = {name: digest(archive / name) for name in ('catalog.json', 'image-manifest.json')}
    review = read_json(review_path)
    if review.get('provider') != PROVIDER or review.get('archive_sha256') != hashes:
        raise ImportRejected('Review does not match this provider/catalog/image manifest')
    decisions = {}
    for decision in review['decisions']:
        key = (decision['source_pet_id'], decision['sha256'])
        if (key in decisions or decision['use'] not in ('reference', 'avatar_only')
                or not isinstance(decision.get('reason'), str) or not decision['reason'].strip()):
            raise ImportRejected('Invalid or duplicate review decision')
        decisions[key] = decision
    catalog, manifest = (read_json(archive / name) for name in hashes)
    if not isinstance(catalog, list) or not isinstance(manifest, list) or not manifest:
        raise ImportRejected('Expected a catalog and a nonempty downloaded-image manifest')
    owners, seen_ids = defaultdict(list), set()
    for cat in catalog:
        pet_id = cat.get('source_pet_id')
        if not isinstance(pet_id, str) or not re.fullmatch(r'[1-9][0-9]*', pet_id) or pet_id in seen_ids:
            raise ImportRejected('Invalid or duplicate source pet ID')
        seen_ids.add(pet_id)
        for photo in cat['photos']:
            owners[photo['url']].append(cat)
    result, seen_urls, selected_ids, used_decisions = [], set(), set(), set()
    for item in manifest:
        url, sha256, filename = item['url'], item['sha256'], item['file']
        if url in seen_urls or len(owners[url]) != 1:
            raise ImportRejected('Downloaded URL is duplicate, missing or ambiguously owned')
        seen_urls.add(url)
        cat = owners[url][0]
        pet_id, name = cat['source_pet_id'], cat['source_name']
        if (cat.get('society_id') != 1 or cat.get('category') != 'cat'
                or pet_id in KNOWN_SPECIES_CONFLICTS):
            raise ImportRejected(f'Source scope or species conflict: {pet_id}')
        if (pet_id in selected_ids or not isinstance(name, str)
                or not name.strip() or len(name) > 50):
            raise ImportRejected('Expected one reviewed avatar per source ID and a valid name')
        selected_ids.add(pet_id)
        if (not isinstance(sha256, str) or not re.fullmatch(r'[0-9a-f]{64}', sha256)
                or filename not in (f'{sha256}.jpg', f'{sha256}.png')):
            raise ImportRejected('Image filename must be its SHA256 plus .jpg or .png')
        source = (image_root / filename).resolve(strict=True)
        if not source.is_relative_to(image_root) or not source.is_file():
            raise ImportRejected('Image path escapes archive images')
        if source.stat().st_size != item['bytes'] or digest(source) != sha256:
            raise ImportRejected(f'Image size/SHA256 mismatch: {pet_id}')
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(source) as image:
                expected_format = 'JPEG' if filename.endswith('.jpg') else 'PNG'
                if (image.format != expected_format or image.format != item['format']
                        or image.size != (item['width'], item['height'])
                        or getattr(image, 'n_frames', 1) != 1):
                    raise ImportRejected(f'Image metadata or frame mismatch: {pet_id}')
                image.load()
        key = (pet_id, sha256)
        decision = decisions.get(key)
        if decision is None:
            raise ImportRejected(f'Missing visual review decision: {pet_id}')
        if pet_id in KNOWN_COLLAGES and decision['use'] != 'avatar_only':
            raise ImportRejected(f'Known collage must remain avatar-only: {pet_id}')
        used_decisions.add(key)
        result.append(Photo(pet_id, name, url, source, sha256, item['bytes'],
                            decision['use'], decision['reason']))
    if used_decisions != set(decisions):
        raise ImportRejected('Review contains images outside this downloaded archive')
    return sorted(result, key=lambda photo: int(photo.pet_id)), hashes


def destination(uploads: Path, photo: Photo):
    path = uploads / photo.resource.removeprefix('/uploads/')
    if not path.resolve().is_relative_to(uploads):
        raise ImportRejected('Upload destination escapes the configured root')
    if path.exists() and (not path.is_file() or digest(path) != photo.sha256):
        raise ImportRejected(f'Existing upload has different content: {photo.pet_id}')
    return path


def stage_photo(uploads: Path, photo: Photo, storage: str):
    target = destination(uploads, photo)
    if target.exists():
        return 'reused'
    target.parent.mkdir(parents=True, exist_ok=True)
    # Recheck after directory creation, including junction/symlink resolution.
    target = destination(uploads, photo)
    if storage == 'hardlink':
        os.link(photo.source, target)
    else:
        with photo.source.open('rb') as source, target.open('xb') as output:
            shutil.copyfileobj(source, output)
            output.flush()
            os.fsync(output.fileno())
    if digest(target) != photo.sha256:
        raise ImportRejected(f'Image changed while staging: {photo.pet_id}')
    return 'linked' if storage == 'hardlink' else 'copied'


def snapshot(database: Path, target: Path):
    # SQLite backup includes committed WAL. A separate read connection works while
    # the import connection holds BEGIN IMMEDIATE, before its first write.
    with closing(sqlite3.connect(database.as_uri() + '?mode=ro', uri=True)) as source:
        with closing(sqlite3.connect(target)) as saved:
            source.backup(saved)
            if saved.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise ImportRejected('Pre-import database backup failed integrity check')


def import_archive(archive, review, database, uploads, *, apply=False, storage='hardlink'):
    photos, input_hashes = load_plan(Path(archive), Path(review))
    if storage not in ('hardlink', 'copy'):
        raise ImportRejected('Storage must be hardlink or copy')
    database, uploads = Path(database).resolve(), Path(uploads).resolve()
    if not database.is_file():
        raise ImportRejected('Database is missing; initialize it with Alembic first')
    for photo in photos:
        destination(uploads, photo)
    engine = create_engine(f'sqlite:///{database.as_posix()}', connect_args={'timeout': 30})
    report = {'provider': PROVIDER, 'apply': apply, 'archive_sha256': input_hashes,
              'review_sha256': digest(review), 'network_requests': 0, 'training_performed': False,
              'identity_independently_verified': False, 'capture_sessions_verified': False,
              'photos': len(photos), 'reference_photos': sum(p.use == 'reference' for p in photos),
              'avatar_only_photos': sum(p.use == 'avatar_only' for p in photos),
              'image_bytes': sum(p.size for p in photos), 'cats_created': 0, 'images_created': 0,
              'same_name_records_not_merged': [], 'storage': {'linked': 0, 'copied': 0, 'reused': 0},
              'mappings': []}
    run_dir = None
    try:
        require_current_schema(engine)
        with Session(engine, expire_on_commit=False) as db:
            if apply:
                db.execute(text('PRAGMA foreign_keys=ON'))
                db.execute(text('BEGIN IMMEDIATE'))
            state = db.get(models.ReferenceCatalog, 1)
            report['database_id'] = state.database_id
            report['generation_before'] = state.generation
            planned = []
            for photo in photos:
                cat = db.scalar(select(models.Cat).where(models.Cat.reference_id == photo.reference_id))
                images = list(db.scalars(select(models.CatImage).where(
                    models.CatImage.image_path == photo.resource)))
                if (len(images) > 1 or (images and (cat is None or images[0].cat_id != cat.id))
                        or (images and photo.use == 'avatar_only')):
                    raise ImportRejected(f'Existing photo ownership/use conflicts: {photo.pet_id}')
                if cat is None:
                    matches = list(db.scalars(select(models.Cat.id).where(models.Cat.name == photo.name)))
                    if matches:
                        report['same_name_records_not_merged'].append(
                            {'source_pet_id': photo.pet_id, 'existing_cat_ids': matches})
                    report['cats_created'] += 1
                if photo.use == 'reference' and not images:
                    report['images_created'] += 1
                planned.append((photo, cat, images[0] if images else None))
            if not apply:
                return report
            run_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8]
            run_dir = database.parent / 'imports' / run_id
            run_dir.mkdir(parents=True, exist_ok=False)
            report['run_id'] = run_id
            report['database'] = str(database)
            report['uploads'] = str(uploads)
            if report['cats_created'] or report['images_created']:
                backup = run_dir / 'before.db'
                snapshot(database, backup)
                report['backup'] = {'path': str(backup), 'sha256': digest(backup)}
            write_json(run_dir / 'plan.json', report)
            for photo, cat, image in planned:
                report['storage'][stage_photo(uploads, photo, storage)] += 1
                if cat is None:
                    cat = models.Cat(reference_id=photo.reference_id, name=photo.name, avatar=photo.resource)
                    db.add(cat)
                    db.flush()
                # Existing profile fields (including edited names/avatars) are preserved.
                if photo.use == 'reference' and image is None:
                    image = models.CatImage(cat_id=cat.id, image_path=photo.resource)
                    db.add(image)
                    db.flush()
                report['mappings'].append({'source_pet_id': photo.pet_id, 'source_name': photo.name,
                    'source_url': photo.url, 'cat_id': cat.id, 'reference_id': cat.reference_id,
                    'current_name': cat.name, 'current_avatar': cat.avatar,
                    'image_id': image.id if image else None, 'image_path': photo.resource,
                    'sha256': photo.sha256, 'use': photo.use, 'reason': photo.reason})
            db.refresh(state)
            report['generation_after'] = state.generation
            db.commit()
        report['committed_at'] = datetime.now(timezone.utc).isoformat()
        report['receipt'] = str(run_dir / 'receipt.json')
        try:
            write_json(run_dir / 'receipt.json', report)
        except OSError as exc:
            raise RuntimeError('Database committed, but receipt could not be saved; rerun to recover the receipt') from exc
        return report
    finally:
        engine.dispose()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--review', type=Path, required=True)
    parser.add_argument('--database', type=Path, required=True)
    parser.add_argument('--uploads', type=Path, required=True)
    parser.add_argument('--storage', choices=('hardlink', 'copy'), default='hardlink')
    parser.add_argument('--apply', action='store_true', help='Default is a read-only preview')
    args = parser.parse_args()
    try:
        result = import_archive(args.archive, args.review, args.database, args.uploads,
                                apply=args.apply, storage=args.storage)
        print(json.dumps({k: v for k, v in result.items() if k != 'mappings'}, ensure_ascii=False, indent=2))
        return 0
    except (RuntimeError, OSError, ValueError, KeyError, TypeError, SQLAlchemyError) as exc:
        print(f'Import failed: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
