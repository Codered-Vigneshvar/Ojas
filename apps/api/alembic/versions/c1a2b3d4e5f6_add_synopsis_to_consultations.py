"""Add synopsis to consultations

Revision ID: c1a2b3d4e5f6
Revises: b3ccf3b475bd
Create Date: 2026-06-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c1a2b3d4e5f6'
down_revision: Union[str, None] = 'b3ccf3b475bd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('consultations', sa.Column('synopsis', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('consultations', 'synopsis')
