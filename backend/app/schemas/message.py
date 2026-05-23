from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.enums import MessageType, MessageChannel


class MessageRead(BaseModel):
    """Message response."""
    id: UUID
    execution_id: UUID
    from_agent: str
    to_agent: str | None
    content: str
    message_type: MessageType
    channel: MessageChannel
    tokens_used: int | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
