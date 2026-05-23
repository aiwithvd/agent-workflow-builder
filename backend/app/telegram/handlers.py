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
from app.models import Workflow, Execution, Agent
from app.enums import MessageChannel, ExecutionStatus
from app.runtime.executor import execution_service

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
        # Get or find workflow
        async with async_session() as db:
            if workflow_id:
                workflow = await db.get(Workflow, workflow_id)
            else:
                # Use most recent workflow or first template
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
    try:
        # Execute workflow
        result = await execution_service.execute_workflow(
            execution_id,
            workflow_id,
            {"message": user_message},
            channel=MessageChannel.TELEGRAM,
        )

        # Extract response from result
        response_text = "✅ Execution completed!\n\n"

        if isinstance(result, dict):
            if "messages" in result and result["messages"]:
                last_message = result["messages"][-1]
                if isinstance(last_message, dict):
                    response_text += last_message.get("content", str(result))
                else:
                    response_text += str(last_message)
            else:
                response_text += json.dumps(result, indent=2)[:1000]
        else:
            response_text += str(result)[:1000]

        # Edit processing message with result
        await processing_msg.edit_text(response_text)

    except Exception as e:
        logger.error(f"Execution error: {e}")
        await processing_msg.edit_text(f"❌ Execution failed: {str(e)[:200]}")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command."""
    await update.message.reply_text(
        "🤖 Welcome to Yuno AI Agent Orchestration!\n\n"
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
