"""Attribute new discoveries and recognition audits; legacy owners stay NULL."""
from alembic import op
import sqlalchemy as sa

revision = 'g20261030'
down_revision = 'f20261030'
branch_labels = None
depends_on = None


def upgrade():
    from schema_support import columns, ensure_index, ensure_fk
    for table in ('discoveries', 'audit_logs'):
        if 'user_id' not in columns(table):
            op.add_column(table, sa.Column('user_id', sa.Integer(), nullable=True))
        ensure_fk(table, 'user_id', 'users', f'fk_{table}_user_id')
        ensure_index(table, f'ix_{table}_user_id', ['user_id'])


def downgrade():
    raise RuntimeError('Ownership data must be retained; restore a verified backup to roll back.')
