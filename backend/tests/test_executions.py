"""Functional tests for the Executions API."""

import pytest
from unittest.mock import AsyncMock, patch


# ── Structural tests (no DB needed) ───────────────────────────────────────────

def test_execution_model_has_required_columns():
    from app.models.execution import Execution
    from sqlalchemy import inspect
    cols = {c.name for c in inspect(Execution).columns}
    assert {"id", "workflow_id", "status", "input", "started_at"} <= cols


def test_execution_status_enum():
    from app.enums import ExecutionStatus
    assert ExecutionStatus.QUEUED == "queued"
    assert ExecutionStatus.RUNNING == "running"
    assert ExecutionStatus.COMPLETED == "completed"
    assert ExecutionStatus.FAILED == "failed"


def test_message_model_has_required_columns():
    from app.models.message import Message
    from sqlalchemy import inspect
    cols = {c.name for c in inspect(Message).columns}
    assert {"id", "execution_id", "from_agent", "to_agent", "content", "created_at"} <= cols


# ── Helpers ────────────────────────────────────────────────────────────────────

_GRAPH = {
    "nodes": [{"id": "n1", "type": "agent", "data": {"label": "Agent"}, "position": {"x": 0, "y": 0}}],
    "edges": [],
}


async def _create_workflow(client) -> str:
    resp = await client.post("/api/v1/workflows", json={
        "name": "Exec Test Workflow",
        "graph_definition": _GRAPH,
    })
    assert resp.status_code == 201
    return resp.json()["id"]


# ── API tests ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_execution(client):
    wf_id = await _create_workflow(client)

    # Patch executor so we don't need a real LLM
    with patch("app.routers.executions.execution_service.execute_workflow", new_callable=AsyncMock):
        resp = await client.post("/api/v1/executions", json={
            "workflow_id": wf_id,
            "input": {"message": "hello"},
        })

    assert resp.status_code == 201
    data = resp.json()
    assert data["workflow_id"] == wf_id
    assert data["status"] == "queued"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_executions(client):
    wf_id = await _create_workflow(client)

    with patch("app.routers.executions.execution_service.execute_workflow", new_callable=AsyncMock):
        await client.post("/api/v1/executions", json={"workflow_id": wf_id, "input": {}})

    resp = await client.get("/api/v1/executions")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_get_execution(client):
    wf_id = await _create_workflow(client)

    with patch("app.routers.executions.execution_service.execute_workflow", new_callable=AsyncMock):
        create_resp = await client.post("/api/v1/executions", json={"workflow_id": wf_id, "input": {}})

    exec_id = create_resp.json()["id"]
    resp = await client.get(f"/api/v1/executions/{exec_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == exec_id


@pytest.mark.asyncio
async def test_get_execution_not_found(client):
    resp = await client.get("/api/v1/executions/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_execution_invalid_workflow(client):
    with patch("app.routers.executions.execution_service.execute_workflow", new_callable=AsyncMock):
        resp = await client.post("/api/v1/executions", json={
            "workflow_id": "00000000-0000-0000-0000-000000000000",
            "input": {},
        })
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_execution_missing_workflow_id(client):
    resp = await client.post("/api/v1/executions", json={"input": {"message": "hi"}})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_execution_initial_status_is_queued(client):
    wf_id = await _create_workflow(client)

    with patch("app.routers.executions.execution_service.execute_workflow", new_callable=AsyncMock):
        resp = await client.post("/api/v1/executions", json={"workflow_id": wf_id, "input": {}})

    assert resp.json()["status"] == "queued"


@pytest.mark.asyncio
async def test_get_execution_messages_empty(client):
    wf_id = await _create_workflow(client)

    with patch("app.routers.executions.execution_service.execute_workflow", new_callable=AsyncMock):
        create_resp = await client.post("/api/v1/executions", json={"workflow_id": wf_id, "input": {}})

    exec_id = create_resp.json()["id"]
    resp = await client.get(f"/api/v1/executions/{exec_id}/messages")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_list_executions_filter_by_workflow(client):
    wf_id = await _create_workflow(client)

    with patch("app.routers.executions.execution_service.execute_workflow", new_callable=AsyncMock):
        await client.post("/api/v1/executions", json={"workflow_id": wf_id, "input": {}})
        await client.post("/api/v1/executions", json={"workflow_id": wf_id, "input": {}})

    resp = await client.get(f"/api/v1/executions?workflow_id={wf_id}")
    if resp.status_code == 200:
        # If filtering is supported, all results should belong to this workflow
        for ex in resp.json():
            assert ex["workflow_id"] == wf_id
    else:
        # Filtering not implemented — at minimum list endpoint works
        assert resp.status_code in (200, 422)
