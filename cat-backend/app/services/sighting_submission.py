"""Commit one submission and its reward together; retries preserve its identity."""
import hashlib
import json
import logging

from fastapi import HTTPException
from sqlalchemy import func, update
from sqlalchemy.exc import IntegrityError

from app import crud, models
from app.api import upload

logger = logging.getLogger(__name__)


def _rollback_and_cleanup(db, image_path, image_sha256, committed):
    try:
        db.rollback()
    except Exception:
        logger.warning('Could not roll back failed sighting submission; preserving its upload', exc_info=True)
        return False
    if image_path and not committed:
        try:
            # A commit can raise after reaching durable storage. Verify from the
            # rolled-back session before removing only this request's new file.
            referenced = db.query(models.Sighting.id).filter(models.Sighting.image_path == image_path).first()
            if referenced is None:
                upload.discard_created_upload(image_path, image_sha256)
        except Exception:
            # Uncertain database state or cleanup failure must not replace the
            # submission error, or put a possibly committed attachment at risk.
            logger.warning('Could not verify or remove new sighting upload %s; preserving it', image_path, exc_info=True)
    return True


def submit_sighting(db, user, payload, request_id=None, image=None, content_type=None):
    user_id, nickname = user.id, user.nickname
    image_sha256 = hashlib.sha256(image).hexdigest() if image is not None else None
    fingerprint = hashlib.sha256(json.dumps({
        'fields': payload.model_dump(),
        'image_sha256': image_sha256,
    }, sort_keys=True, ensure_ascii=False, allow_nan=False).encode()).hexdigest()

    def previous():
        row = db.query(models.Sighting).filter_by(user_id=user_id, client_request_id=request_id).first()
        if row is not None and row.request_sha256 != fingerprint:
            raise HTTPException(status_code=409, detail='这次提交的内容已改变，请重新提交')
        return row

    if request_id:
        existing = previous()
        if existing is not None:
            return existing
    image_path = None
    committed = False
    try:
        row = models.Sighting(**payload.model_dump(), user_id=user_id, spotted_by=nickname,
                              status='pending', client_request_id=request_id,
                              request_sha256=fingerprint if request_id else None)
        db.add(row)
        # The unique index arbitrates concurrent requests before either writes a photo.
        db.flush()
        if image is not None:
            image_path = upload.save_validated_upload(image, content_type, 'sightings')
            row.image_path = image_path
        db.execute(update(models.User).where(models.User.id == user_id)
                   .values(xp=func.coalesce(models.User.xp, 0) + 10))
        owner = db.get(models.User, user_id, populate_existing=True)
        owner.level = crud.compute_level(owner.xp)
        db.commit()
        committed = True
        db.refresh(row)
        return row
    except Exception as exc:
        rolled_back = _rollback_and_cleanup(db, image_path, image_sha256, committed)
        if isinstance(exc, IntegrityError) and request_id and rolled_back:
            try:
                existing = previous()
            except HTTPException:
                raise
            except Exception:
                logger.warning('Could not read the concurrent submission receipt', exc_info=True)
            else:
                if existing is not None:
                    return existing
        raise
