from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, model_validator

from app.enums import WorkflowTemplate


class WorkflowCreate(BaseModel):
    """Create workflow request.

    Accepts either the canonical ``graph_definition`` dict or the React Flow
    convenience shape (flat ``nodes`` + ``edges`` fields). If both are present
    ``graph_definition`` takes priority.
    """
    name: str
    description: str = ""
    # Canonical storage format
    graph_definition: dict = {}
    # React Flow convenience fields (frontend sends these directly)
    nodes: list[Any] | None = None
    edges: list[Any] | None = None
    template_name: WorkflowTemplate | None = None

    @model_validator(mode="after")
    def build_graph_definition(self) -> "WorkflowCreate":
        """Merge flat nodes/edges into graph_definition if not already provided."""
        if not self.graph_definition and (self.nodes is not None or self.edges is not None):
            self.graph_definition = {
                "nodes": self.nodes or [],
                "edges": self.edges or [],
            }
        return self


class WorkflowUpdate(BaseModel):
    """Update workflow request (partial).

    Same dual-format support as WorkflowCreate.
    """
    name: str | None = None
    description: str | None = None
    graph_definition: dict | None = None
    nodes: list[Any] | None = None
    edges: list[Any] | None = None
    template_name: WorkflowTemplate | None = None

    @model_validator(mode="after")
    def build_graph_definition(self) -> "WorkflowUpdate":
        if self.graph_definition is None and (self.nodes is not None or self.edges is not None):
            self.graph_definition = {
                "nodes": self.nodes or [],
                "edges": self.edges or [],
            }
        return self


class WorkflowRead(BaseModel):
    """Workflow response.

    ``nodes`` and ``edges`` are unpacked from ``graph_definition`` for frontend
    convenience — no frontend code needs to drill into ``graph_definition``.
    """
    id: UUID
    name: str
    description: str | None
    graph_definition: dict
    template_name: WorkflowTemplate | None
    created_at: datetime
    updated_at: datetime

    # Convenience fields extracted from graph_definition
    nodes: list[Any] = []
    edges: list[Any] = []

    @model_validator(mode="after")
    def unpack_graph(self) -> "WorkflowRead":
        if self.graph_definition:
            self.nodes = self.graph_definition.get("nodes", [])
            self.edges = self.graph_definition.get("edges", [])
        return self

    model_config = ConfigDict(from_attributes=True)
