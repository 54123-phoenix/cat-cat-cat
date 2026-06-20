"""add_lat_lon_indexes_on_sightings

Revision ID: a1b2c3d4e5f6
Revises: f55904ce2b93
Create Date: 2026-06-20 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f55904ce2b93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('sightings', schema=None) as batch_op:
        batch_op.create_index('ix_sightings_latitude', ['latitude'], unique=False)
        batch_op.create_index('ix_sightings_longitude', ['longitude'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('sightings', schema=None) as batch_op:
        batch_op.drop_index('ix_sightings_longitude')
        batch_op.drop_index('ix_sightings_latitude')
