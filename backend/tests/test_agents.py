"""Tests for agent creation, retrieval, and management."""

import os
import pytest


@pytest.fixture(scope="session", autouse=True)
def setup_test_env():
    """Set up test environment variables before any imports."""
    os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/test_db")
    os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
    os.environ.setdefault("SUPABASE_KEY", "test-key")
    os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
    os.environ.setdefault("OLLAMA_URL", "http://localhost:11434")
    os.environ.setdefault("OPENROUTER_API_KEY", "test-key")
    os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test-token")
    os.environ.setdefault("OPENWEATHERMAP_API_KEY", "test-key")


def test_agent_model_structure():
    """Test that Agent model structure is correct."""
    from app.models.agent import Agent
    from sqlalchemy import inspect

    mapper = inspect(Agent)
    columns = {col.name for col in mapper.columns}

    required_columns = {"id", "name", "role", "system_prompt", "model", "tools", "channels", "created_at"}
    assert required_columns.issubset(columns), f"Missing columns: {required_columns - columns}"


def test_agent_enums_defined():
    """Test that required enums are defined."""
    from app.enums import LLMProvider, AgentTool, MessageChannel, MessageType, ExecutionStatus

    # Test LLMProvider
    assert hasattr(LLMProvider, "OLLAMA")
    assert hasattr(LLMProvider, "OPENROUTER")

    # Test AgentTool
    assert hasattr(AgentTool, "WEB_SEARCH")
    assert hasattr(AgentTool, "CALCULATOR")
    assert hasattr(AgentTool, "FILE_READ")
    assert hasattr(AgentTool, "FILE_WRITE")
    assert hasattr(AgentTool, "WEATHER")

    # Test MessageChannel
    assert hasattr(MessageChannel, "WEB")
    assert hasattr(MessageChannel, "TELEGRAM")


def test_tools_registry():
    """Test that tool registry is properly configured."""
    from app.runtime.tools.registry import TOOL_FACTORY_REGISTRY
    from app.enums import AgentTool

    # Check that all tools are registered
    for tool in AgentTool:
        assert tool in TOOL_FACTORY_REGISTRY, f"Tool {tool} not registered"


def test_llm_factory_implementation():
    """Test that LLM factory can be imported and has required functions."""
    from app.runtime.llm_factory import create_llm
    from app.enums import LLMProvider

    # Verify factory function exists and is callable
    assert callable(create_llm)


def test_database_models_importable():
    """Test that all database models can be imported."""
    from app.models.agent import Agent
    from app.models.workflow import Workflow
    from app.models.execution import Execution
    from app.models.message import Message
    from app.database import Base

    # Verify all models are subclasses of Base
    assert issubclass(Agent, Base)
    assert issubclass(Workflow, Base)
    assert issubclass(Execution, Base)
    assert issubclass(Message, Base)
