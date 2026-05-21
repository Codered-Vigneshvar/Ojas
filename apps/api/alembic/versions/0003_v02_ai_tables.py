"""v0.2 AI tables: add AI columns to artifacts, artifact_facts, embeddings

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-20

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Add AI columns to artifacts
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

    # artifact_facts table
    op.create_table(
        "artifact_facts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "artifact_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("artifacts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "patient_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("patients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(50), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("value", sa.String(500), nullable=True),
        sa.Column("unit", sa.String(100), nullable=True),
        sa.Column("recorded_at", sa.Date(), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_fact_patient_kind", "artifact_facts", ["patient_id", "kind"])
    op.create_index("ix_fact_artifact", "artifact_facts", ["artifact_id"])

    # embeddings table (pgvector)
    op.create_table(
        "embeddings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "artifact_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("artifacts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "patient_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("patients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("vector", sa.Text(), nullable=False),  # placeholder type for DDL
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    # Replace text column with actual vector type
    op.execute("ALTER TABLE embeddings ALTER COLUMN vector TYPE vector(1024) USING NULL")
    op.execute(
        "ALTER TABLE embeddings ALTER COLUMN vector SET NOT NULL"
    )
    op.create_index("ix_embedding_patient", "embeddings", ["patient_id"])
    # HNSW index for fast ANN search scoped by patient
    op.execute(
        "CREATE INDEX ix_embedding_vector_hnsw ON embeddings "
        "USING hnsw (vector vector_cosine_ops)"
    )


def downgrade() -> None:
    op.drop_table("embeddings")
    op.drop_table("artifact_facts")
    op.drop_column("artifacts", "extraction_status")
    op.drop_column("artifacts", "processing_error")
    op.drop_column("artifacts", "processing_status")
    op.drop_column("artifacts", "extracted_text")
    op.drop_column("artifacts", "structured_note")
    op.drop_column("artifacts", "summary_ai")
    op.drop_column("artifacts", "category")
    op.drop_column("artifacts", "label")
