"""Add platform_settings table.

Revision ID: 003_add_platform_settings
Revises: 002_add_agent_schedule
Create Date: 2026-05-25
"""

from alembic import op
import sqlalchemy as sa

revision = "003_add_platform_settings"
down_revision = "002_add_agent_schedule"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "platform_settings",
        sa.Column("key", sa.String(128), primary_key=True),
        sa.Column("value", sa.Text, nullable=True),
        sa.Column("is_secret", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "updated_at",
            sa.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
            onupdate=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_table("platform_settings")
