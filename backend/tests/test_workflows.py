"""Tests for workflow creation and management."""

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


def test_workflow_model_structure():
    """Test that Workflow model structure is correct."""
    from app.models.workflow import Workflow
    from sqlalchemy import inspect

    mapper = inspect(Workflow)
    columns = {col.name for col in mapper.columns}

    required_columns = {"id", "name", "description", "graph_definition", "created_at"}
    assert required_columns.issubset(columns), f"Missing columns: {required_columns - columns}"


def test_workflow_graph_definition_format():
    """Test that workflow graph definition follows React Flow format."""
    sample_graph = {
        "nodes": [
            {
                "id": "node1",
                "type": "agent",
                "data": {"label": "Agent 1"},
                "position": {"x": 0, "y": 0},
            }
        ],
        "edges": [],
    }

    # Verify structure
    assert "nodes" in sample_graph
    assert "edges" in sample_graph
    assert len(sample_graph["nodes"]) > 0
    assert sample_graph["nodes"][0]["id"] == "node1"


def test_templates_enum_defined():
    """Test that WorkflowTemplate enum is defined."""
    from app.enums import WorkflowTemplate

    assert hasattr(WorkflowTemplate, "RESEARCH_REPORT")
    assert hasattr(WorkflowTemplate, "CUSTOMER_SUPPORT")


def test_execution_model_structure():
    """Test that Execution model structure is correct."""
    from app.models.execution import Execution
    from sqlalchemy import inspect

    mapper = inspect(Execution)
    columns = {col.name for col in mapper.columns}

    required_columns = {"id", "workflow_id", "status", "started_at"}
    assert required_columns.issubset(columns), f"Missing columns: {required_columns - columns}"


def test_message_model_structure():
    """Test that Message model structure is correct."""
    from app.models.message import Message
    from sqlalchemy import inspect

    mapper = inspect(Message)
    columns = {col.name for col in mapper.columns}

    required_columns = {"id", "execution_id", "from_agent", "to_agent", "content", "created_at"}
    assert required_columns.issubset(columns), f"Missing columns: {required_columns - columns}"
