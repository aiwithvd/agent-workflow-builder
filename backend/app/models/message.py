from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import String, Text, TIMESTAMP, func, JSON, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Message(Base):
    """Inter-agent and user messages."""

    __tablename__ = "messages"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    execution_id: Mapped[UUID] = mapped_column(
        ForeignKey("executions.id"), index=True
    )
    from_agent: Mapped[str] = mapped_column(String(255), index=True)
    to_agent: Mapped[str | None] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    message_type: Mapped[str] = mapped_column(String(50))  # MessageType
    channel: Mapped[str] = mapped_column(String(50))  # MessageChannel
    tokens_used: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=func.now(), index=True
    )
