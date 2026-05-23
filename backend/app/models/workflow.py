from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import String, Text, TIMESTAMP, func, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Workflow(Base):
    """Workflow definition and configuration."""

    __tablename__ = "workflows"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    graph_definition: Mapped[dict] = mapped_column(JSON)  # React Flow {nodes, edges}
    template_name: Mapped[str | None] = mapped_column(String(100))  # WorkflowTemplate
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=func.now(), onupdate=func.now()
    )
