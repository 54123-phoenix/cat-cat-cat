"""Adopt missing tables and normalize known legacy data without guessing timestamps."""
from alembic import op

revision = 'e20261030'
down_revision = 'd0313e2b50e6'
branch_labels = None
depends_on = None


def upgrade():
    from schema_support import ensure_snapshot
    ensure_snapshot()
    op.execute("UPDATE sightings SET status='rejected' WHERE status='rejectd'")
    op.execute("UPDATE users SET token_version=1 WHERE token_version IS NULL")


def downgrade():
    # Keep corrected statuses and additive tables; do not reintroduce invalid data.
    pass
