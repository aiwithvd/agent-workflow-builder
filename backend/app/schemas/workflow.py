from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.enums import WorkflowTemplate


class WorkflowCreate(BaseModel):
    """Create workflow request."""
    name: str
    description: str = ""
    graph_definition: dict
    template_name: WorkflowTemplate | None = None


class WorkflowUpdate(BaseModel):
    """Update workflow request (partial)."""
    name: str | None = None
    description: str | None = None
    graph_definition: dict | None = None
    template_name: WorkflowTemplate | None = None


class WorkflowRead(BaseModel):
    """Workflow response."""
    id: UUID
    name: str
    description: str | None
    graph_definition: dict
    template_name: WorkflowTemplate | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
