"""Keep retried sighting submissions unique within each authenticated account."""
from alembic import op
import sqlalchemy as sa

revision = 'k20261108'
down_revision = 'j20261031'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    columns = {column['name'] for column in sa.inspect(bind).get_columns('sightings')}
    # Support adoption of an unversioned create_all database as well as j20261031.
    for name, length in [('client_request_id', 36), ('request_sha256', 64)]:
        if name not in columns:
            op.add_column('sightings', sa.Column(name, sa.String(length), nullable=True))
    if 'uq_sightings_user_request' not in {index['name'] for index in sa.inspect(bind).get_indexes('sightings')}:
        op.create_index('uq_sightings_user_request', 'sightings', ['user_id', 'client_request_id'], unique=True)


def downgrade():
    raise RuntimeError('Refusing to discard submission receipts; restore a consistent backup instead')
