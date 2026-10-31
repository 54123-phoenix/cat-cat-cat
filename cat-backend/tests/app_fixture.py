"""Isolate legacy API fixtures without adding a production schema bypass."""
from contextlib import contextmanager

import pytest
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.schema_readiness import MIGRATIONS


@contextmanager
def isolated_client(engine, session_factory):
    import app.database as database
    import app.main as main

    Base.metadata.create_all(engine)
    # Only these disposable API fixtures are stamped. Migration tests use real upgrades.
    with engine.begin() as connection:
        MigrationContext.configure(connection).stamp(ScriptDirectory(str(MIGRATIONS)), "heads")

    def get_test_db():
        with session_factory() as session:
            yield session

    overrides = main.app.dependency_overrides.copy()
    try:
        with pytest.MonkeyPatch.context() as patch:
            patch.setattr(database, "engine", engine)
            patch.setattr(database, "SessionLocal", session_factory)
            patch.setattr(main, "engine", engine)
            patch.setattr(main, "SessionLocal", session_factory)
            main.app.dependency_overrides[get_db] = get_test_db
            with TestClient(main.app) as client:
                yield client
    finally:
        main.app.dependency_overrides.clear()
        main.app.dependency_overrides.update(overrides)
