"""Persist unique vote reward receipts without guessing historical XP."""
from alembic import op
import sqlalchemy as sa

revision = 'f20261030'
down_revision = 'e20261030'
branch_labels = None
depends_on = None


def upgrade():
    if 'sighting_vote_rewards' not in sa.inspect(op.get_bind()).get_table_names():
        op.create_table('sighting_vote_rewards',
            sa.Column('sighting_id', sa.Integer(), sa.ForeignKey('sightings.id'), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), primary_key=True),
            sa.Column('cat_id', sa.Integer(), sa.ForeignKey('cats.id'), nullable=False),
            sa.Column('amount', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False))


def downgrade():
    raise RuntimeError('Reward receipts must be retained to prevent duplicate XP; restore a verified backup to roll back.')
