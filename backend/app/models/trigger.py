"""WorkflowTrigger — persists active canvas trigger nodes across restarts."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import String, Boolean, JSON, ForeignKey, TIMESTAMP, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WorkflowTrigger(Base):
    """One row per active trigger node on any canvas.

    Each trigger_type (telegram | schedule | web) is identified by its node_id
    and linked to a specific workflow. The config JSON stores type-specific
    settings (cron expression, bot_token override, input_message, etc.).
    """

    __tablename__ = "workflow_triggers"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workflow_id: Mapped[UUID] = mapped_column(ForeignKey("workflows.id", ondelete="CASCADE"), index=True)
    node_id: Mapped[str] = mapped_column(String(128))       # React Flow node id
    trigger_type: Mapped[str] = mapped_column(String(32))   # "telegram" | "schedule" | "web"
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=func.now(), onupdate=func.now()
    )
