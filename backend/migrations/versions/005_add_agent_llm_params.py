"""Add LLM generation parameters to agents table.

Revision ID: 005_add_agent_llm_params
Revises: 004_add_workflow_triggers
Create Date: 2026-05-26

Adds five new nullable columns to the agents table that control how the
LangGraph create_react_agent / ChatModel is instantiated:

  temperature      float  0.0–2.0   (creative vs deterministic)
  top_p            float  0.0–1.0   nucleus sampling
  presence_penalty float  -2.0–2.0  penalise tokens already present
  frequency_penalty float -2.0–2.0  penalise frequent tokens
  max_iterations   int    1–50      ReAct loop cap (LangGraph agent_executor)

All columns are nullable; NULL means "use the provider/model default".
"""

from alembic import op
import sqlalchemy as sa

revision = "005_add_agent_llm_params"
down_revision = "004_add_workflow_triggers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("agents", sa.Column("temperature", sa.Float(), nullable=True))
    op.add_column("agents", sa.Column("top_p", sa.Float(), nullable=True))
    op.add_column("agents", sa.Column("presence_penalty", sa.Float(), nullable=True))
    op.add_column("agents", sa.Column("frequency_penalty", sa.Float(), nullable=True))
    op.add_column("agents", sa.Column("max_iterations", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("agents", "max_iterations")
    op.drop_column("agents", "frequency_penalty")
    op.drop_column("agents", "presence_penalty")
    op.drop_column("agents", "top_p")
    op.drop_column("agents", "temperature")
