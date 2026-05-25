"""APScheduler integration for agent cron scheduling and workflow schedule triggers."""

import logging
from uuid import UUID

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from app.database import async_session
from app.enums import MessageChannel
from app.models import Agent

logger = logging.getLogger(__name__)

# ─── Workflow schedule-trigger jobs ───────────────────────────────────────────

# Shared scheduler instance used by both agent and workflow scheduling
_shared_scheduler = AsyncIOScheduler(timezone="UTC")


async def _run_scheduled_workflow(workflow_id: str, input_message: str = "Run scheduled workflow.") -> None:
    """Job function: create an execution for a scheduled workflow."""
    try:
        from app.models import Execution, Workflow
        from app.enums import ExecutionStatus
        from app.runtime.executor import execution_service
        import uuid as _uuid

        async with async_session() as db:
            workflow = await db.get(Workflow, _uuid.UUID(workflow_id))
            if not workflow:
                logger.warning("Scheduled workflow %s not found", workflow_id)
                return

            execution = Execution(
                workflow_id=_uuid.UUID(workflow_id),
                status=ExecutionStatus.QUEUED,
                input={"message": input_message},
            )
            db.add(execution)
            await db.commit()
            await db.refresh(execution)

        await execution_service.execute_workflow(
            execution_id=execution.id,
            workflow_id=_uuid.UUID(workflow_id),
            input_data={"message": input_message},
            channel=MessageChannel.WEB,
        )
    except Exception as e:
        logger.error("Scheduled workflow %s run failed: %s", workflow_id, e)


def sync_schedule_triggers(workflow_id: str, trigger_nodes: list[dict]) -> None:
    """Add/update APScheduler jobs for schedule_trigger nodes in a workflow.

    Called when a workflow is created or updated. Removes old jobs for this
    workflow and adds new ones based on the current schedule_trigger nodes.
    """
    prefix = f"workflow_{workflow_id}_"

    # Remove existing jobs for this workflow
    for job in _shared_scheduler.get_jobs():
        if job.id.startswith(prefix):
            job.remove()
            logger.info("Removed schedule job: %s", job.id)

    # Add new jobs for each configured schedule_trigger node
    for node in trigger_nodes:
        cron = (node.get("data") or {}).get("cron", "").strip()
        input_msg = (node.get("data") or {}).get("inputMessage", "Run scheduled workflow.")
        node_id = node.get("id", "unknown")

        if not cron:
            continue  # skip unconfigured nodes

        job_id = f"{prefix}{node_id}"
        try:
            _shared_scheduler.add_job(
                _run_scheduled_workflow,
                trigger=CronTrigger.from_crontab(cron, timezone="UTC"),
                id=job_id,
                args=[workflow_id, input_msg],
                replace_existing=True,
                misfire_grace_time=300,
            )
            logger.info("Scheduled workflow job %s with cron: %s", job_id, cron)
        except Exception as e:
            logger.warning(
                "Invalid cron expression '%s' for workflow %s node %s: %s",
                cron, workflow_id, node_id, e,
            )


async def load_all_schedules() -> None:
    """On startup: load all workflows with schedule_trigger nodes and register jobs."""
    from app.models import Workflow

    async with async_session() as db:
        result = await db.execute(select(Workflow))
        workflows = result.scalars().all()

    count = 0
    for workflow in workflows:
        graph_def = workflow.graph_definition or {}
        schedule_nodes = [
            n for n in graph_def.get("nodes", [])
            if n.get("type") == "schedule_trigger"
        ]
        if schedule_nodes:
            sync_schedule_triggers(str(workflow.id), schedule_nodes)
            count += len(schedule_nodes)

    logger.info("Loaded %d workflow schedule trigger(s) on startup", count)


async def _run_scheduled_agent(agent_id: str) -> None:
    """Create an execution for a scheduled agent run."""
    try:
        from app.models import Execution, Workflow
        from app.enums import ExecutionStatus
        from app.runtime.executor import execution_service

        async with async_session() as db:
            agent = await db.get(Agent, UUID(agent_id))
            if not agent:
                logger.warning("Scheduled agent %s not found", agent_id)
                return

            # Find a workflow that uses this agent (simple heuristic — first match)
            from sqlalchemy import text
            result = await db.execute(
                text("SELECT id FROM workflows WHERE graph_definition::text LIKE :pattern LIMIT 1"),
                {"pattern": f"%{agent_id}%"},
            )
            row = result.fetchone()
            if not row:
                logger.info("No workflow found for scheduled agent %s — skipping", agent_id)
                return

            workflow_id = row[0]
            execution = Execution(
                workflow_id=workflow_id,
                status=ExecutionStatus.QUEUED,
                input={"message": f"Scheduled run for agent: {agent.name}"},
            )
            db.add(execution)
            await db.commit()
            await db.refresh(execution)

        await execution_service.execute_workflow(
            execution_id=execution.id,
            workflow_id=UUID(str(workflow_id)),
            input_data={"message": f"Scheduled run for agent: {agent.name}"},
            channel=MessageChannel.WEB,
        )
    except Exception as e:
        logger.error("Scheduled agent %s run failed: %s", agent_id, e)


class AgentScheduler:
    """Manages APScheduler jobs for agents with cron schedules.

    Uses the shared _shared_scheduler instance so agent jobs and workflow
    schedule-trigger jobs all live in the same scheduler process.
    """

    def __init__(self) -> None:
        self._scheduler = _shared_scheduler

    async def start(self) -> None:
        """Start the scheduler and register all agents that have a schedule."""
        try:
            async with async_session() as db:
                result = await db.execute(
                    select(Agent).where(Agent.schedule.isnot(None))
                )
                for agent in result.scalars().all():
                    self._add_job(str(agent.id), agent.schedule)

            if not self._scheduler.running:
                self._scheduler.start()
            logger.info("APScheduler started")
        except Exception as e:
            logger.warning("APScheduler start failed (non-fatal): %s", e)

    async def stop(self) -> None:
        try:
            if self._scheduler.running:
                self._scheduler.shutdown(wait=False)
        except Exception:
            pass

    def _add_job(self, agent_id: str, cron_expression: str) -> None:
        try:
            self._scheduler.add_job(
                _run_scheduled_agent,
                trigger=CronTrigger.from_crontab(cron_expression),
                args=[agent_id],
                id=f"agent-{agent_id}",
                replace_existing=True,
            )
            logger.info("Scheduled agent %s with cron '%s'", agent_id, cron_expression)
        except Exception as e:
            logger.warning("Could not schedule agent %s: %s", agent_id, e)

    def register(self, agent_id: str, cron_expression: str | None) -> None:
        """Add or update a scheduler job for an agent (called on create/update)."""
        job_id = f"agent-{agent_id}"
        if self._scheduler.get_job(job_id):
            self._scheduler.remove_job(job_id)
        if cron_expression:
            self._add_job(agent_id, cron_expression)

    def unregister(self, agent_id: str) -> None:
        """Remove the scheduler job for an agent (called on delete)."""
        job_id = f"agent-{agent_id}"
        if self._scheduler.get_job(job_id):
            self._scheduler.remove_job(job_id)


# Global singleton
agent_scheduler = AgentScheduler()
