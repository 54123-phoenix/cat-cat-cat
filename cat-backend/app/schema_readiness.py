"""Read-only startup gate; schema changes belong to the Alembic command."""
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import inspect
from sqlalchemy.engine import Engine

from app.database import Base

MIGRATIONS = Path(__file__).resolve().parents[1] / "alembic"


def require_current_schema(engine: Engine) -> None:
    remedy = "Back up the database, then run `python -m alembic upgrade head` in cat-backend before starting the server."
    database = engine.url.database
    if engine.dialect.name == "sqlite" and database not in (None, "", ":memory:"):
        if not Path(database).is_file():
            raise RuntimeError(f"Database is not initialized. {remedy}")
    expected = set(ScriptDirectory(str(MIGRATIONS)).get_heads())
    with engine.connect() as connection:
        actual = set(MigrationContext.configure(connection).get_current_heads())
        if actual != expected:
            raise RuntimeError(
                f"Database migration mismatch: current={sorted(actual) or ['unversioned']}, "
                f"required={sorted(expected)}. {remedy}"
            )
        inspector = inspect(connection)
        missing = []
        missing_unique = []
        tables = set(inspector.get_table_names())
        for table in Base.metadata.sorted_tables:
            if table.name not in tables:
                missing.append(table.name)
                continue
            columns = {column['name'] for column in inspector.get_columns(table.name)}
            missing.extend(f"{table.name}.{name}" for name in set(table.columns.keys()) - columns)
            actual_unique = {
                tuple(index['column_names']) for index in inspector.get_indexes(table.name)
                if index['unique'] and index.get('dialect_options', {}).get('sqlite_where') is None
            }
            actual_unique.update(tuple(item['column_names']) for item in inspector.get_unique_constraints(table.name))
            for index in table.indexes:
                if index.unique and tuple(column.name for column in index.columns) not in actual_unique:
                    missing_unique.append(f"{table.name}.{index.name}")
        if missing:
            raise RuntimeError(
                f"Database schema drift: missing {', '.join(sorted(missing))}. "
                "The revision is current but the schema is incomplete; restore or repair it before startup."
            )
        if missing_unique:
            raise RuntimeError(
                f"Database schema drift: missing unique indexes {', '.join(sorted(missing_unique))}. "
                "Restore or repair constraints before startup."
            )
