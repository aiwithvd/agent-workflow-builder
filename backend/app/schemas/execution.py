from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.enums import ExecutionStatus, MessageChannel


class ExecutionCreate(BaseModel):
    """Create execution request."""
    workflow_id: UUID
    input: dict = {}
    channel: MessageChannel = MessageChannel.WEB


class ExecutionRead(BaseModel):
    """Execution response."""
    id: UUID
    workflow_id: UUID
    status: ExecutionStatus
    input: dict
    output: dict | None
    total_tokens: int
    started_at: datetime
    completed_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
