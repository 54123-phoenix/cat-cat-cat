"""Frozen SQLite schema adoption helpers for the repaired legacy migrations."""
import json
from pathlib import Path

from alembic import op
import sqlalchemy as sa


def columns(table):
    return {c['name'] for c in sa.inspect(op.get_bind()).get_columns(table)}


def ensure_index(table, name, names):
    if name not in {i['name'] for i in sa.inspect(op.get_bind()).get_indexes(table)}:
        op.create_index(name, table, names)


def ensure_fk(table, column, target, name):
    if not any(fk['constrained_columns'] == [column] for fk in sa.inspect(op.get_bind()).get_foreign_keys(table)):
        with op.batch_alter_table(table) as batch:
            batch.create_foreign_key(name, target, [column], ['id'])


def ensure_snapshot():
    if op.get_bind().dialect.name != 'sqlite':
        raise RuntimeError('Legacy schema adoption currently supports SQLite only')
    snapshot = json.loads((Path(__file__).parent/'schema_20261030.json').read_text(encoding='utf-8'))
    existing = set(sa.inspect(op.get_bind()).get_table_names())
    for name, ddl in snapshot['tables'].items():
        if name not in existing:
            op.execute(ddl)
    for index in snapshot['indexes']:
        if set(index['columns']) <= columns(index['table']):
            ensure_index(index['table'], index['name'], index['columns'])
