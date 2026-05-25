"""ChannelRouter — finds which workflow to run for an incoming trigger event."""

import logging
from uuid import UUID

from sqlalchemy import select

from app.database import async_session
from app.models.trigger import WorkflowTrigger

logger = logging.getLogger(__name__)


async def route_telegram(chat_id: str | None = None) -> UUID | None:
    """Return the workflow_id of the first active Telegram trigger.

    If multiple workflows have Telegram triggers, the most recently created
    one wins (LIFO). In a multi-bot setup the bot_token_override field in
    config would be used to disambiguate — not yet implemented.
    """
    async with async_session() as db:
        stmt = (
            select(WorkflowTrigger)
            .where(
                WorkflowTrigger.trigger_type == "telegram",
                WorkflowTrigger.active.is_(True),
            )
            .order_by(WorkflowTrigger.created_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        trigger = result.scalar_one_or_none()
        if trigger:
            return trigger.workflow_id
    return None


async def route_web(description: str | None = None) -> UUID | None:
    """Return the first active web-trigger workflow (for future chatbot use)."""
    async with async_session() as db:
        stmt = (
            select(WorkflowTrigger)
            .where(
                WorkflowTrigger.trigger_type == "web",
                WorkflowTrigger.active.is_(True),
            )
            .order_by(WorkflowTrigger.created_at.desc())
            .limit(1)
        )
        result = await db.execute(stmt)
        trigger = result.scalar_one_or_none()
        if trigger:
            return trigger.workflow_id
    return None
