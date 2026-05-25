"""Functional tests for the Agents API."""

import pytest


# ── Structural tests (no DB needed) ───────────────────────────────────────────

def test_agent_model_has_required_columns():
    from app.models.agent import Agent
    from sqlalchemy import inspect
    cols = {c.name for c in inspect(Agent).columns}
    assert {"id", "name", "role", "system_prompt", "model", "tools",
            "channels", "memory_enabled", "guardrails", "schedule", "created_at"} <= cols


def test_all_enums_defined():
    from app.enums import LLMProvider, AgentTool, MessageChannel, ExecutionStatus
    assert LLMProvider.OLLAMA == "ollama"
    assert LLMProvider.GLM51 == "glm51"
    assert AgentTool.CODE_EXECUTOR == "code_executor"
    assert AgentTool.HTTP_REQUEST == "http_request"
    assert MessageChannel.TELEGRAM == "telegram"
    assert ExecutionStatus.FAILED == "failed"


def test_all_tools_registered():
    from app.runtime.tools.registry import TOOL_FACTORY_REGISTRY
    from app.enums import AgentTool
    for tool in AgentTool:
        assert tool in TOOL_FACTORY_REGISTRY, f"Tool {tool.value!r} missing from registry"


# ── API tests ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_agent(client, agent_payload):
    resp = await client.post("/api/v1/agents", json=agent_payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == agent_payload["name"]
    assert data["provider"] == "ollama"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_agents(client, agent_payload):
    await client.post("/api/v1/agents", json=agent_payload)
    resp = await client.get("/api/v1/agents")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_get_agent(client, agent_payload):
    create_resp = await client.post("/api/v1/agents", json=agent_payload)
    agent_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/agents/{agent_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == agent_id


@pytest.mark.asyncio
async def test_get_agent_not_found(client):
    resp = await client.get("/api/v1/agents/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_agent(client, agent_payload):
    create_resp = await client.post("/api/v1/agents", json=agent_payload)
    agent_id = create_resp.json()["id"]

    resp = await client.patch(f"/api/v1/agents/{agent_id}", json={"name": "Updated Name"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Name"


@pytest.mark.asyncio
async def test_update_agent_memory_and_guardrails(client, agent_payload):
    create_resp = await client.post("/api/v1/agents", json=agent_payload)
    agent_id = create_resp.json()["id"]

    resp = await client.patch(f"/api/v1/agents/{agent_id}", json={
        "memory_enabled": True,
        "guardrails": {"max_tokens": 2000, "rate_limit": 10},
        "schedule": "0 9 * * *",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["memory_enabled"] is True
    assert data["guardrails"]["max_tokens"] == 2000
    assert data["schedule"] == "0 9 * * *"


@pytest.mark.asyncio
async def test_delete_agent(client, agent_payload):
    create_resp = await client.post("/api/v1/agents", json=agent_payload)
    agent_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/v1/agents/{agent_id}")
    assert resp.status_code == 204

    # Verify it's gone
    get_resp = await client.get(f"/api/v1/agents/{agent_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_create_agent_missing_name(client):
    resp = await client.post("/api/v1/agents", json={"model": "llama3", "provider": "ollama"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_agent_invalid_provider(client, agent_payload):
    payload = {**agent_payload, "provider": "nonexistent_provider"}
    resp = await client.post("/api/v1/agents", json=payload)
    assert resp.status_code == 422
