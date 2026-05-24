"""Telegram bot implementation for agent interaction."""

import asyncio
import logging

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

from app.config import settings
from app.telegram.handlers import (
    start,
    help_command,
    status,
    handle_workflow_message,
)
from app.database.redis_client import close_redis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle user messages and route to workflows."""
    await handle_workflow_message(update, context)


async def post_init(app: Application):
    """Initialize app on startup."""
    logger.info("Telegram bot initialized")


async def post_stop(app: Application):
    """Cleanup on shutdown."""
    await close_redis()
    logger.info("Telegram bot stopped")


def main():
    """Start the bot."""
    if not settings.telegram_bot_token:
        logger.error("TELEGRAM_BOT_TOKEN not set in environment")
        return

    # Create application
    application = (
        Application.builder()
        .token(settings.telegram_bot_token)
        .post_init(post_init)
        .post_stop(post_stop)
        .build()
    )

    # Register handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("status", status))
    application.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message)
    )

    # Start polling
    logger.info("🤖 Telegram bot starting...")
    application.run_polling()


if __name__ == "__main__":
    main()
