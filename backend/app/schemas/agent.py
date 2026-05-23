from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.enums import LLMProvider, AgentTool, MessageChannel


class GuardrailConfig(BaseModel):
    """Agent guardrails configuration."""
    max_tokens: int | None = None
    rate_limit: int | None = None


class AgentCreate(BaseModel):
    """Create agent request."""
    name: str
    role: str
    system_prompt: str
    provider: LLMProvider
    model: str
    tools: list[AgentTool] = []
    channels: list[MessageChannel] = []
    memory_enabled: bool = False
    guardrails: GuardrailConfig | None = None


class AgentUpdate(BaseModel):
    """Update agent request (partial)."""
    name: str | None = None
    role: str | None = None
    system_prompt: str | None = None
    provider: LLMProvider | None = None
    model: str | None = None
    tools: list[AgentTool] | None = None
    channels: list[MessageChannel] | None = None
    memory_enabled: bool | None = None
    guardrails: GuardrailConfig | None = None


class AgentRead(BaseModel):
    """Agent response."""
    id: UUID
    name: str
    role: str | None
    system_prompt: str | None
    provider: LLMProvider
    model: str | None
    tools: list[AgentTool]
    channels: list[MessageChannel]
    memory_enabled: bool
    guardrails: GuardrailConfig | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
