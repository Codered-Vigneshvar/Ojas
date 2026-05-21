"""v0.3 strip AI: drop AI columns from artifacts, drop artifact_facts and embeddings tables

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-21

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Drop AI tables
    op.drop_table("embeddings")
    op.drop_table("artifact_facts")

    # Drop AI columns from artifacts
    op.drop_column("artifacts", "extraction_status")
    op.drop_column("artifacts", "processing_error")
    op.drop_column("artifacts", "processing_status")
    op.drop_column("artifacts", "extracted_text")
    op.drop_column("artifacts", "structured_note")
    op.drop_column("artifacts", "summary_ai")
    op.drop_column("artifacts", "category")
    op.drop_column("artifacts", "label")


def downgrade() -> None:
    # Re-add AI columns to artifacts
    op.add_column("artifacts", sa.Column("label", sa.String(500), nullable=True))
    op.add_column("artifacts", sa.Column("category", sa.String(100), nullable=True))
    op.add_column("artifacts", sa.Column("summary_ai", sa.String(1000), nullable=True))
    op.add_column("artifacts", sa.Column("structured_note", sa.Text(), nullable=True))
    op.add_column("artifacts", sa.Column("extracted_text", sa.Text(), nullable=True))
    op.add_column(
        "artifacts",
        sa.Column("processing_status", sa.String(20), nullable=False, server_default="pending"),
    )
    op.add_column("artifacts", sa.Column("processing_error", sa.Text(), nullable=True))
    op.add_column(
        "artifacts",
        sa.Column("extraction_status", sa.String(20), nullable=False, server_default="pending"),
    )

    # Re-create artifact_facts
    op.create_table(
        "artifact_facts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("artifact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("artifacts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("value", sa.String(500), nullable=True),
        sa.Column("unit", sa.String(100), nullable=True),
        sa.Column("recorded_at", sa.Date(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Re-create embeddings (with text placeholder — full vector setup needs manual DDL)
    op.create_table(
        "embeddings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("artifact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("artifacts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("vector", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
