"""Tests for workflow trigger nodes and the channel router."""

import pytest


# ─── Helpers ──────────────────────────────────────────────────────────────────

GRAPH_WITH_TELEGRAM = {
    "nodes": [
        {"id": "tg-1", "type": "telegram_trigger", "data": {"label": "Telegram Trigger"}},
        {"id": "agent-1", "type": "agent", "data": {"agentId": "some-id", "name": "Bot", "role": "Helper"}},
    ],
    "edges": [{"id": "e1", "source": "tg-1", "target": "agent-1"}],
}

GRAPH_WITH_SCHEDULE = {
    "nodes": [
        {
            "id": "sched-1",
            "type": "schedule_trigger",
            "data": {"label": "Daily", "cron": "0 9 * * *", "inputMessage": "Run daily report"},
        },
        {"id": "agent-1", "type": "agent", "data": {"agentId": "some-id", "name": "Reporter", "role": "Writer"}},
    ],
    "edges": [{"id": "e1", "source": "sched-1", "target": "agent-1"}],
}

GRAPH_NO_TRIGGERS = {
    "nodes": [
        {"id": "input-1", "type": "input", "data": {}},
        {"id": "agent-1", "type": "agent", "data": {"agentId": "some-id", "name": "Worker", "role": "Worker"}},
        {"id": "output-1", "type": "output", "data": {}},
    ],
    "edges": [
        {"id": "e1", "source": "input-1", "target": "agent-1"},
        {"id": "e2", "source": "agent-1", "target": "output-1"},
    ],
}


# ─── Tests ────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_workflow_with_telegram_trigger(client, agent_payload):
    """Creating a workflow with a Telegram trigger node activates it in the DB."""
    resp = await client.post(
        "/api/v1/workflows",
        json={
            "name": "Telegram Bot Workflow",
            "description": "Handles Telegram messages",
            "graph_definition": GRAPH_WITH_TELEGRAM,
        },
    )
    assert resp.status_code == 201
    wf = resp.json()
    assert wf["id"]

    # The channel router should now find this workflow for Telegram triggers
    from app.services.channel_router import route_telegram
    import uuid
    routed_id = await route_telegram()
    assert routed_id is not None
    assert str(routed_id) == wf["id"]


@pytest.mark.asyncio
async def test_update_workflow_removes_old_triggers(client):
    """Updating a workflow replaces its triggers — old ones are removed."""
    # Create with Telegram trigger
    resp = await client.post(
        "/api/v1/workflows",
        json={"name": "Trigger Test", "graph_definition": GRAPH_WITH_TELEGRAM},
    )
    wf_id = resp.json()["id"]

    # Update to remove the Telegram trigger
    await client.patch(
        f"/api/v1/workflows/{wf_id}",
        json={"graph_definition": GRAPH_NO_TRIGGERS},
    )

    # ChannelRouter should no longer find a trigger pointing at this workflow
    from app.services.channel_router import route_telegram
    from app.database import async_session
    from app.models.trigger import WorkflowTrigger
    from sqlalchemy import select
    import uuid

    async with async_session() as db:
        result = await db.execute(
            select(WorkflowTrigger).where(
                WorkflowTrigger.workflow_id == uuid.UUID(wf_id),
                WorkflowTrigger.trigger_type == "telegram",
            )
        )
        triggers = result.scalars().all()

    assert len(triggers) == 0, "Old Telegram triggers should be removed after update"


@pytest.mark.asyncio
async def test_delete_workflow_removes_triggers(client):
    """Deleting a workflow removes its trigger rows from the DB."""
    resp = await client.post(
        "/api/v1/workflows",
        json={"name": "Delete Trigger Test", "graph_definition": GRAPH_WITH_TELEGRAM},
    )
    wf_id = resp.json()["id"]

    # Delete workflow
    del_resp = await client.delete(f"/api/v1/workflows/{wf_id}")
    assert del_resp.status_code == 204

    # Trigger rows should be gone (CASCADE or explicit delete)
    from app.database import async_session
    from app.models.trigger import WorkflowTrigger
    from sqlalchemy import select
    import uuid

    async with async_session() as db:
        result = await db.execute(
            select(WorkflowTrigger).where(
                WorkflowTrigger.workflow_id == uuid.UUID(wf_id)
            )
        )
        assert result.scalars().first() is None


@pytest.mark.asyncio
async def test_no_trigger_workflow_has_no_trigger_rows(client):
    """A workflow without trigger nodes creates no WorkflowTrigger rows."""
    from app.database import async_session
    from app.models.trigger import WorkflowTrigger
    from sqlalchemy import select
    import uuid

    resp = await client.post(
        "/api/v1/workflows",
        json={"name": "Plain Workflow", "graph_definition": GRAPH_NO_TRIGGERS},
    )
    wf_id = resp.json()["id"]

    async with async_session() as db:
        result = await db.execute(
            select(WorkflowTrigger).where(
                WorkflowTrigger.workflow_id == uuid.UUID(wf_id)
            )
        )
        triggers = result.scalars().all()

    assert len(triggers) == 0
