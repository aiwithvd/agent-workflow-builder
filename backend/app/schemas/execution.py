from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator

from app.enums import ExecutionStatus, MessageChannel


class ExecutionCreate(BaseModel):
    """Create execution request."""
    workflow_id: UUID
    input: dict = {}
    channel: MessageChannel = MessageChannel.WEB


class ExecutionRead(BaseModel):
    """Execution response.

    Field aliases provide frontend-compatible names:
      started_at  → also exposed as created_at
      completed_at → also exposed as updated_at
    """
    id: UUID
    workflow_id: UUID
    workflow_name: str | None = None   # populated via JOIN in router
    status: ExecutionStatus
    input: dict
    output: dict | None = None
    error: str | None = None
    total_tokens: int

    # Original DB column names
    started_at: datetime
    completed_at: datetime | None = None

    # Frontend-compatible aliases (set by validator below)
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @model_validator(mode="after")
    def set_frontend_aliases(self) -> "ExecutionRead":
        """Expose started_at / completed_at under the names the frontend expects."""
        if self.created_at is None:
            self.created_at = self.started_at
        if self.updated_at is None:
            self.updated_at = self.completed_at or self.started_at
        return self

    model_config = ConfigDict(from_attributes=True)
