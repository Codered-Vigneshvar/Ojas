"""v0.5 add AI columns to artifacts

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("artifacts", sa.Column("raw_transcript", sa.Text(), nullable=True))
    op.add_column(
        "artifacts",
        sa.Column(
            "structured_note",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "artifacts",
        sa.Column(
            "tags",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "artifacts", sa.Column("prescription_ocr_text", sa.Text(), nullable=True)
    )
    op.add_column(
        "artifacts",
        sa.Column(
            "prescription_summary",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.add_column(
        "artifacts",
        sa.Column(
            "doctor_confirmed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("artifacts", "doctor_confirmed_at")
    op.drop_column("artifacts", "prescription_summary")
    op.drop_column("artifacts", "prescription_ocr_text")
    op.drop_column("artifacts", "tags")
    op.drop_column("artifacts", "structured_note")
    op.drop_column("artifacts", "raw_transcript")
