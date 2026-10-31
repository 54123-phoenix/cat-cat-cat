"""Idempotent initial rows shared by independently starting API workers."""
from sqlalchemy.exc import IntegrityError


def ensure_row(db, model, lookup, factory):
    if db.query(model).filter_by(**lookup).first() is not None:
        return
    db.add(factory())
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Another worker may have committed the same natural key. Do not hide
        # unrelated constraint failures or alter an existing account's password.
        if db.query(model).filter_by(**lookup).first() is None:
            raise
