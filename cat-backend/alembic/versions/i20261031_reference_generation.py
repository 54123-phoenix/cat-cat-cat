"""Track reference catalog mutations in the same SQLite transaction."""
from alembic import op
import sqlalchemy as sa

revision = 'i20261031'
down_revision = 'h20261030'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name != 'sqlite':
        raise RuntimeError('Reference lifecycle currently supports SQLite on a local filesystem')
    if 'generation' not in {c['name'] for c in sa.inspect(bind).get_columns('reference_catalog')}:
        op.add_column('reference_catalog', sa.Column('generation', sa.Integer(), nullable=False, server_default='0'))
    op.execute('DROP TRIGGER IF EXISTS reference_catalog_immutable')
    op.execute("""CREATE TRIGGER reference_catalog_immutable
                  BEFORE UPDATE OF id,database_id ON reference_catalog
                  WHEN NEW.id != OLD.id OR NEW.database_id != OLD.database_id
                  BEGIN SELECT RAISE(ABORT, 'database reference identity is immutable'); END""")
    op.execute("""CREATE TRIGGER IF NOT EXISTS reference_generation_monotonic
                  BEFORE UPDATE OF generation ON reference_catalog
                  WHEN NEW.generation <= OLD.generation
                  BEGIN SELECT RAISE(ABORT, 'reference generation must increase'); END""")
    for table in ('cats', 'cat_images'):
        for action in ('INSERT', 'DELETE'):
            op.execute(f"""CREATE TRIGGER IF NOT EXISTS reference_{table}_{action.lower()}
                           AFTER {action} ON {table}
                           BEGIN UPDATE reference_catalog SET generation=generation+1 WHERE id=1; END""")
    for table, fields in (('cats', ('id', 'reference_id')), ('cat_images', ('id', 'cat_id', 'image_path'))):
        changed = ' OR '.join(f'NEW.{field} IS NOT OLD.{field}' for field in fields)
        op.execute(f"""CREATE TRIGGER IF NOT EXISTS reference_{table}_update
                       AFTER UPDATE OF {','.join(fields)} ON {table} WHEN {changed}
                       BEGIN UPDATE reference_catalog SET generation=generation+1 WHERE id=1; END""")


def downgrade():
    raise RuntimeError('Reference generations must be retained; restore a verified backup for rollback.')
