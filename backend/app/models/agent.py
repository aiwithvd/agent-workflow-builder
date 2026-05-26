from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import String, Text, TIMESTAMP, Float, Integer, func, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Agent(Base):
    """AI agent configuration."""

    __tablename__ = "agents"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    role: Mapped[str | None] = mapped_column(String(255))
    system_prompt: Mapped[str | None] = mapped_column(Text)
    provider: Mapped[str] = mapped_column(String(50), default="ollama")  # LLMProvider
    model: Mapped[str | None] = mapped_column(String(100))  # e.g., "llama3.2"
    tools: Mapped[list] = mapped_column(JSON, default=list)  # [AgentTool, ...]
    channels: Mapped[list] = mapped_column(JSON, default=list)  # [MessageChannel, ...]
    memory_enabled: Mapped[bool] = mapped_column(default=False)
    guardrails: Mapped[dict | None] = mapped_column(JSON)  # {max_tokens, rate_limit}
    schedule: Mapped[str | None] = mapped_column(String(100))  # cron expression e.g. "0 9 * * *"

    # LLM generation parameters — used by llm_factory when creating the chat model
    temperature: Mapped[float | None] = mapped_column(Float)       # 0.0–2.0; None → provider default
    top_p: Mapped[float | None] = mapped_column(Float)             # 0.0–1.0 nucleus sampling
    presence_penalty: Mapped[float | None] = mapped_column(Float)  # -2.0–2.0 (OpenAI-compatible)
    frequency_penalty: Mapped[float | None] = mapped_column(Float) # -2.0–2.0 (OpenAI-compatible)
    max_iterations: Mapped[int | None] = mapped_column(Integer)    # ReAct loop iteration cap

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=func.now(), onupdate=func.now()
    )
