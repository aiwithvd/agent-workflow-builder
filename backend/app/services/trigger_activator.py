"""WorkflowTriggerActivator — sync canvas trigger nodes → DB + scheduler/bot."""

import logging
from uuid import UUID

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.trigger import WorkflowTrigger

logger = logging.getLogger(__name__)

# Canvas node type → canonical trigger_type stored in DB
CANVAS_TO_TRIGGER_TYPE = {
    "telegram_trigger": "telegram",
    "schedule_trigger": "schedule",
    "web_trigger": "web",
}


async def activate_workflow_triggers(workflow_id: UUID, graph_definition: dict) -> None:
    """Read trigger nodes from a workflow's graph_definition and upsert DB rows.

    Also synchronises schedule triggers with APScheduler.
    Called after workflow create/update.
    """
    trigger_nodes = [
        n for n in graph_definition.get("nodes", [])
        if n.get("type") in CANVAS_TO_TRIGGER_TYPE
    ]

    async with async_session() as db:
        # Remove old triggers for this workflow then re-insert current ones.
        await db.execute(
            delete(WorkflowTrigger).where(WorkflowTrigger.workflow_id == workflow_id)
        )

        for node in trigger_nodes:
            ttype = CANVAS_TO_TRIGGER_TYPE[node["type"]]
            data = node.get("data", {})

            config: dict = {}
            if ttype == "schedule":
                config = {
                    "cron": data.get("cron", ""),
                    "input_message": data.get("inputMessage", "Run scheduled workflow."),
                }
            elif ttype == "telegram":
                config = {
                    "bot_token_override": data.get("botToken", ""),
                }
            elif ttype == "web":
                config = {"description": data.get("description", "")}

            db.add(WorkflowTrigger(
                workflow_id=workflow_id,
                node_id=node["id"],
                trigger_type=ttype,
                config=config,
                active=True,
            ))

        await db.commit()

    # Keep APScheduler in sync with schedule triggers
    await _sync_scheduler(workflow_id, trigger_nodes)


async def deactivate_workflow_triggers(workflow_id: UUID) -> None:
    """Remove all DB trigger rows for a deleted workflow and cancel jobs."""
    async with async_session() as db:
        await db.execute(
            delete(WorkflowTrigger).where(WorkflowTrigger.workflow_id == workflow_id)
        )
        await db.commit()

    # Cancel any APScheduler jobs for this workflow
    try:
        from app.scheduler import _shared_scheduler
        job_prefix = f"workflow-{workflow_id}-"
        for job in list(_shared_scheduler.get_jobs()):
            if job.id.startswith(job_prefix):
                job.remove()
    except Exception as e:
        logger.warning("Could not remove scheduler jobs for workflow %s: %s", workflow_id, e)


async def _sync_scheduler(workflow_id: UUID, trigger_nodes: list[dict]) -> None:
    """Delegate to the existing scheduler.sync_schedule_triggers helper."""
    try:
        from app.scheduler import sync_schedule_triggers
        schedule_nodes = [n for n in trigger_nodes if n.get("type") == "schedule_trigger"]
        sync_schedule_triggers(str(workflow_id), schedule_nodes)
    except Exception as e:
        logger.warning("Could not sync schedule triggers for workflow %s: %s", workflow_id, e)
