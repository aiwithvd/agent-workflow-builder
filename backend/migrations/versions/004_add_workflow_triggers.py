"""Add workflow_triggers table.

Revision ID: 004_add_workflow_triggers
Revises: 003_add_platform_settings
Create Date: 2026-05-25
"""

from alembic import op
import sqlalchemy as sa

revision = "004_add_workflow_triggers"
down_revision = "003_add_platform_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workflow_triggers",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "workflow_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workflows.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("node_id", sa.String(128), nullable=False),
        sa.Column("trigger_type", sa.String(32), nullable=False),
        sa.Column("config", sa.JSON, nullable=True),
        sa.Column("active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
            onupdate=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_workflow_triggers_type_active",
        "workflow_triggers",
        ["trigger_type", "active"],
    )


def downgrade() -> None:
    op.drop_index("ix_workflow_triggers_type_active", table_name="workflow_triggers")
    op.drop_table("workflow_triggers")
