"""baseline_capture_current_schema

Revision ID: 4cf3161f45b4
Revises: 
Create Date: 2026-06-20 21:11:56.813025

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4cf3161f45b4'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from schema_support import ensure_snapshot
    ensure_snapshot()


def downgrade() -> None:
    raise RuntimeError("Baseline adoption is not destructive; restore a verified backup to roll back")
