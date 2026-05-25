"""Add schedule column to agents table.

Revision ID: 002_add_agent_schedule
Revises: 001_perf_and_security
Create Date: 2026-05-24
"""
from alembic import op
import sqlalchemy as sa

revision = "002_add_agent_schedule"
down_revision = "001_perf_and_security"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "agents",
        sa.Column("schedule", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("agents", "schedule")
