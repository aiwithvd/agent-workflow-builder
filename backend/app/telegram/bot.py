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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command."""
    await update.message.reply_text(
        "Welcome to Yuno AI! 🤖\n\n"
        "I can help you with various tasks. Just send me a message!\n\n"
        "/help - Show available commands\n"
        "/status - Check system status"
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /help command."""
    await update.message.reply_text(
        "Available commands:\n"
        "/start - Welcome message\n"
        "/help - This help message\n"
        "/status - System status\n\n"
        "Or just send me a message and I'll help!"
    )


async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /status command."""
    await update.message.reply_text(
        "🟢 System Status:\n"
        "API: Online\n"
        "Database: Connected\n"
        "Ready to process requests!"
    )


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle user messages."""
    user_message = update.message.text
    chat_id = update.message.chat_id

    # TODO: Route to LangGraph execution engine
    # For now, send a placeholder response
    await update.message.reply_text(
        f"Received: {user_message}\n\n"
        "Note: Full agent execution integration coming in Phase 3"
    )


async def main():
    """Start the bot."""
    if not settings.telegram_bot_token:
        logger.error("TELEGRAM_BOT_TOKEN not set in environment")
        return

    # Create application
    application = Application.builder().token(settings.telegram_bot_token).build()

    # Register handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("status", status))
    application.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message)
    )

    # Start polling
    logger.info("Telegram bot starting...")
    await application.run_polling()


if __name__ == "__main__":
    asyncio.run(main())
