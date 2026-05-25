"""Telegram message handlers for workflow execution."""

import asyncio
import json
import logging
from uuid import uuid4

from telegram import Update
from telegram.ext import ContextTypes
from sqlalchemy import select

from app.database import async_session
from app.database.redis_client import set_session, get_session
from app.models import Workflow, Execution, Agent, Message
from app.enums import MessageChannel, ExecutionStatus, MessageType
from app.runtime.executor import execution_service
from app.services.channel_router import route_telegram

logger = logging.getLogger(__name__)


async def handle_workflow_message(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    workflow_id: str | None = None,
):
    """Handle user message and route to workflow execution.

    Args:
        update: Telegram update object
        context: Handler context
        workflow_id: Optional specific workflow to use
    """
    chat_id = str(update.message.chat_id)
    user_message = update.message.text
    message_id = update.message.message_id

    try:
        # Resolve workflow: explicit ID → ChannelRouter telegram trigger → most recent
        async with async_session() as db:
            if workflow_id:
                workflow = await db.get(Workflow, workflow_id)
            else:
                # Try ChannelRouter first (DB-backed trigger registry)
                routed_id = await route_telegram(chat_id=chat_id)
                if routed_id:
                    workflow = await db.get(Workflow, routed_id)
                else:
                    # Fallback: use most recent workflow
                    stmt = select(Workflow).order_by(Workflow.created_at.desc()).limit(1)
                    result = await db.execute(stmt)
                    workflow = result.scalar_one_or_none()

            if not workflow:
                await update.message.reply_text(
                    "❌ No workflow found. Please create a workflow first."
                )
                return

            # Create execution
            execution_id = uuid4()
            execution = Execution(
                id=execution_id,
                workflow_id=workflow.id,
                status=ExecutionStatus.QUEUED,
                input={"message": user_message, "chat_id": chat_id},
            )
            db.add(execution)

            # Persist the incoming user message
            user_msg = Message(
                execution_id=execution_id,
                from_agent="user",
                to_agent="workflow",
                message_type=MessageType.USER_INPUT,
                channel=MessageChannel.TELEGRAM,
                content=user_message,
            )
            db.add(user_msg)
            await db.commit()

        # Store session
        session_data = {
            "chat_id": chat_id,
            "workflow_id": str(workflow.id),
            "execution_id": str(execution_id),
            "message_id": message_id,
        }
        await set_session(f"tg:{chat_id}", session_data)

        # Send processing message
        processing_msg = await update.message.reply_text("⏳ Processing your request...")

        # Run execution in background
        asyncio.create_task(
            _execute_and_respond(
                execution_id,
                workflow.id,
                user_message,
                update,
                processing_msg,
            )
        )

    except Exception as e:
        logger.error(f"Error handling message: {e}")
        await update.message.reply_text(f"❌ Error: {str(e)[:100]}")


async def _execute_and_respond(
    execution_id,
    workflow_id,
    user_message: str,
    update: Update,
    processing_msg,
):
    """Execute workflow and send response back to Telegram.

    Args:
        execution_id: Execution ID
        workflow_id: Workflow ID
        user_message: User input
        update: Telegram update
        processing_msg: Processing message to edit
    """
    chat_id = str(update.message.chat_id)
    try:
        # Each Telegram user gets a persistent thread so agents remember prior messages.
        # thread_id "telegram-{chat_id}" maps to the same LangGraph checkpoint across runs.
        result = await execution_service.execute_workflow(
            execution_id,
            workflow_id,
            {"message": user_message, "chat_id": chat_id},
            channel=MessageChannel.TELEGRAM,
            thread_id=f"telegram-{chat_id}",
        )

        # Extract the final AI response cleanly
        final_text = execution_service._extract_final_text(result) if isinstance(result, dict) else str(result)
        response_text = f"✅ Done!\n\n{final_text[:3800]}" if final_text else "✅ Execution completed (no output)."

        # Persist agent response message
        async with async_session() as db:
            agent_msg = Message(
                execution_id=execution_id,
                from_agent="workflow",
                to_agent="user",
                message_type=MessageType.AGENT_RESPONSE,
                channel=MessageChannel.TELEGRAM,
                content=response_text,
            )
            db.add(agent_msg)
            await db.commit()

        # Edit processing message with result
        await processing_msg.edit_text(response_text)

    except Exception as e:
        logger.error(f"Execution error: {e}")
        await processing_msg.edit_text(f"❌ Execution failed: {str(e)[:200]}")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command."""
    await update.message.reply_text(
        "🤖 Welcome to Agent Orchestration Platform!\n\n"
        "I can help you execute multi-agent workflows.\n\n"
        "Commands:\n"
        "/start - Show this message\n"
        "/help - Get help\n"
        "/status - Check system status\n"
        "/workflow - Select a workflow\n\n"
        "Or just send a message to execute the default workflow!"
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /help command."""
    await update.message.reply_text(
        "📚 Help\n\n"
        "This bot connects to AI agents that can:\n"
        "• Search the web\n"
        "• Perform calculations\n"
        "• Read and write files\n"
        "• Get weather information\n\n"
        "Available commands:\n"
        "/start - Welcome\n"
        "/help - This message\n"
        "/status - System status\n"
        "/workflow - Choose workflow\n\n"
        "Simply send any message to start a workflow!"
    )


async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /status command."""
    try:
        async with async_session() as db:
            # Count agents and workflows
            agents_result = await db.execute(select(Agent))
            workflows_result = await db.execute(select(Workflow))

            agent_count = len(agents_result.scalars().all())
            workflow_count = len(workflows_result.scalars().all())

            status_text = (
                "🟢 System Status\n\n"
                f"Agents: {agent_count}\n"
                f"Workflows: {workflow_count}\n"
                "API: Online\n"
                "Database: Connected\n"
                "Ready to process requests!"
            )

            await update.message.reply_text(status_text)

    except Exception as e:
        await update.message.reply_text(f"⚠️ Status: {str(e)[:100]}")
