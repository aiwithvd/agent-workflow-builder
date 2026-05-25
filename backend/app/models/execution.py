from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import String, Text, TIMESTAMP, func, JSON, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Execution(Base):
    """Workflow execution record."""

    __tablename__ = "executions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    workflow_id: Mapped[UUID] = mapped_column(ForeignKey("workflows.id"), index=True)
    status: Mapped[str] = mapped_column(String(50), default="queued")  # ExecutionStatus
    input: Mapped[dict] = mapped_column(JSON, default=dict)
    output: Mapped[dict | None] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=func.now(), index=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))

    # Relationship for eager loading workflow name
    workflow: Mapped["Workflow"] = relationship("Workflow", lazy="select")
