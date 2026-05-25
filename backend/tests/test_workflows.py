"""Functional tests for the Workflows API."""

import pytest


# ── Structural tests (no DB needed) ───────────────────────────────────────────

def test_workflow_model_has_required_columns():
    from app.models.workflow import Workflow
    from sqlalchemy import inspect
    cols = {c.name for c in inspect(Workflow).columns}
    assert {"id", "name", "description", "graph_definition", "created_at"} <= cols


def test_workflow_template_enum_defined():
    from app.enums import WorkflowTemplate
    assert WorkflowTemplate.RESEARCH_REPORT == "research_report"
    assert WorkflowTemplate.CUSTOMER_SUPPORT == "customer_support"


def test_workflow_schema_merges_nodes_edges():
    from app.schemas.workflow import WorkflowCreate
    payload = WorkflowCreate(
        name="Test",
        nodes=[{"id": "n1", "type": "agent", "data": {}, "position": {"x": 0, "y": 0}}],
        edges=[],
    )
    assert "nodes" in payload.graph_definition
    assert len(payload.graph_definition["nodes"]) == 1


# ── API tests ──────────────────────────────────────────────────────────────────

_GRAPH = {
    "nodes": [{"id": "n1", "type": "agent", "data": {"label": "Agent"}, "position": {"x": 0, "y": 0}}],
    "edges": [],
}


@pytest.fixture
async def workflow_payload():
    return {
        "name": "My Workflow",
        "description": "A test workflow",
        "graph_definition": _GRAPH,
    }


@pytest.mark.asyncio
async def test_create_workflow(client, workflow_payload):
    resp = await client.post("/api/v1/workflows", json=workflow_payload)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == workflow_payload["name"]
    assert data["description"] == workflow_payload["description"]
    assert "id" in data
    assert "nodes" in data
    assert len(data["nodes"]) == 1


@pytest.mark.asyncio
async def test_create_workflow_with_flat_nodes(client):
    resp = await client.post("/api/v1/workflows", json={
        "name": "Flat Nodes Workflow",
        "nodes": _GRAPH["nodes"],
        "edges": _GRAPH["edges"],
    })
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["nodes"]) == 1
    assert data["edges"] == []


@pytest.mark.asyncio
async def test_list_workflows(client, workflow_payload):
    await client.post("/api/v1/workflows", json=workflow_payload)
    resp = await client.get("/api/v1/workflows")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_get_workflow(client, workflow_payload):
    create_resp = await client.post("/api/v1/workflows", json=workflow_payload)
    wf_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/workflows/{wf_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == wf_id


@pytest.mark.asyncio
async def test_get_workflow_not_found(client):
    resp = await client.get("/api/v1/workflows/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_workflow(client, workflow_payload):
    create_resp = await client.post("/api/v1/workflows", json=workflow_payload)
    wf_id = create_resp.json()["id"]

    resp = await client.patch(f"/api/v1/workflows/{wf_id}", json={"name": "Renamed Workflow"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed Workflow"


@pytest.mark.asyncio
async def test_update_workflow_graph(client, workflow_payload):
    create_resp = await client.post("/api/v1/workflows", json=workflow_payload)
    wf_id = create_resp.json()["id"]

    new_graph = {
        "nodes": [
            {"id": "n1", "type": "agent", "data": {}, "position": {"x": 0, "y": 0}},
            {"id": "n2", "type": "agent", "data": {}, "position": {"x": 300, "y": 0}},
        ],
        "edges": [{"id": "e1", "source": "n1", "target": "n2"}],
    }
    resp = await client.patch(f"/api/v1/workflows/{wf_id}", json={"graph_definition": new_graph})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["nodes"]) == 2
    assert len(data["edges"]) == 1


@pytest.mark.asyncio
async def test_delete_workflow(client, workflow_payload):
    create_resp = await client.post("/api/v1/workflows", json=workflow_payload)
    wf_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/v1/workflows/{wf_id}")
    assert resp.status_code == 204

    get_resp = await client.get(f"/api/v1/workflows/{wf_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_create_workflow_missing_name(client):
    resp = await client.post("/api/v1/workflows", json={"description": "No name"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_templates(client):
    resp = await client.get("/api/v1/workflows/templates")
    assert resp.status_code == 200
    body = resp.json()
    # Accept both bare list and {templates: [...]} envelope
    templates = body if isinstance(body, list) else body.get("templates", body)
    assert isinstance(templates, list)
    # Each template must have name and graph_definition with nodes/edges
    for t in templates:
        assert "name" in t
        assert "graph_definition" in t
        assert "nodes" in t["graph_definition"]
        assert "edges" in t["graph_definition"]


@pytest.mark.asyncio
async def test_templates_have_known_names(client):
    resp = await client.get("/api/v1/workflows/templates")
    assert resp.status_code == 200
    body = resp.json()
    templates = body if isinstance(body, list) else body.get("templates", body)
    names = {t["name"] for t in templates}
    # At least one of the two pre-built templates must exist
    assert names & {"research_report", "customer_support"}, f"No known template in {names}"
