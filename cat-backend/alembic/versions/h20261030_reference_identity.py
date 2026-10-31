"""Persistent database and cat identities; numeric API IDs remain unchanged."""
import uuid

from alembic import op
import sqlalchemy as sa

revision = 'h20261030'
down_revision = 'g20261030'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name != 'sqlite':
        raise RuntimeError('Reference identity migration currently supports SQLite only')
    inspector = sa.inspect(bind)
    if 'reference_catalog' not in inspector.get_table_names():
        op.create_table('reference_catalog',
                        sa.Column('id', sa.Integer(), primary_key=True),
                        sa.Column('database_id', sa.String(32), nullable=False, unique=True),
                        sa.CheckConstraint('id = 1', name='ck_reference_catalog_singleton'))
    if not bind.execute(sa.text('SELECT id FROM reference_catalog')).first():
        bind.execute(sa.text('INSERT INTO reference_catalog (id,database_id) VALUES (1,:identity)'),
                     {'identity': uuid.uuid4().hex})
    if 'reference_id' not in {c['name'] for c in inspector.get_columns('cats')}:
        op.add_column('cats', sa.Column('reference_id', sa.String(32), nullable=True))
    for row in bind.execute(sa.text('SELECT id FROM cats WHERE reference_id IS NULL')).all():
        bind.execute(sa.text('UPDATE cats SET reference_id=:identity WHERE id=:id'),
                     {'identity': uuid.uuid4().hex, 'id': row.id})
    # Recreate only when adopting an old schema; foreign keys/data remain in place.
    column = next(c for c in sa.inspect(bind).get_columns('cats') if c['name'] == 'reference_id')
    unique = any(c['column_names'] == ['reference_id'] for c in sa.inspect(bind).get_unique_constraints('cats'))
    if column['nullable'] or not unique:
        with op.batch_alter_table('cats') as batch:
            batch.alter_column('reference_id', existing_type=sa.String(32), nullable=False,
                               server_default=sa.text('(lower(hex(randomblob(16))))'))
            if not unique:
                batch.create_unique_constraint('uq_cats_reference_id', ['reference_id'])
    op.execute("""CREATE TRIGGER IF NOT EXISTS cats_reference_id_immutable
                  BEFORE UPDATE OF reference_id ON cats
                  WHEN NEW.reference_id != OLD.reference_id
                  BEGIN SELECT RAISE(ABORT, 'cat reference identity is immutable'); END""")
    op.execute("""CREATE TRIGGER IF NOT EXISTS reference_catalog_immutable
                  BEFORE UPDATE ON reference_catalog
                  BEGIN SELECT RAISE(ABORT, 'database reference identity is immutable'); END""")
    op.execute("""CREATE TRIGGER IF NOT EXISTS reference_catalog_no_delete
                  BEFORE DELETE ON reference_catalog
                  BEGIN SELECT RAISE(ABORT, 'database reference identity cannot be deleted'); END""")


def downgrade():
    raise RuntimeError('Reference identities must be retained; restore a verified backup to roll back.')
