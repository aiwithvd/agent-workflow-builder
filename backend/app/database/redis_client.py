"""Redis client for real-time events and session management."""

import json
import logging
from typing import Any

import redis.asyncio as redis

from app.config import settings

logger = logging.getLogger(__name__)

# Global Redis client
_redis_client = None


async def get_redis() -> redis.Redis:
    """Get or create Redis client connection.

    Returns:
        Redis async client
    """
    global _redis_client

    if _redis_client is None:
        _redis_client = await redis.from_url(
            settings.redis_url, encoding="utf8", decode_responses=True
        )

    return _redis_client


async def publish_event(channel: str, data: dict) -> int:
    """Publish event to Redis channel.

    Args:
        channel: Channel name (e.g., "execution:123")
        data: Event data as dictionary

    Returns:
        Number of subscribers that received the message
    """
    try:
        client = await get_redis()
        message = json.dumps(data)
        count = await client.publish(channel, message)
        return count
    except Exception as e:
        logger.error(f"Error publishing event: {e}")
        return 0


async def set_session(session_id: str, data: dict, ttl: int = 3600) -> bool:
    """Store session data in Redis with TTL.

    Args:
        session_id: Session identifier
        data: Session data as dictionary
        ttl: Time to live in seconds (default 1 hour)

    Returns:
        Success status
    """
    try:
        client = await get_redis()
        await client.setex(
            f"session:{session_id}",
            ttl,
            json.dumps(data),
        )
        return True
    except Exception as e:
        logger.error(f"Error setting session: {e}")
        return False


async def get_session(session_id: str) -> dict | None:
    """Retrieve session data from Redis.

    Args:
        session_id: Session identifier

    Returns:
        Session data or None if not found
    """
    try:
        client = await get_redis()
        data = await client.get(f"session:{session_id}")
        if data:
            return json.loads(data)
        return None
    except Exception as e:
        logger.error(f"Error getting session: {e}")
        return None


async def delete_session(session_id: str) -> bool:
    """Delete session from Redis.

    Args:
        session_id: Session identifier

    Returns:
        Success status
    """
    try:
        client = await get_redis()
        await client.delete(f"session:{session_id}")
        return True
    except Exception as e:
        logger.error(f"Error deleting session: {e}")
        return False


async def close_redis():
    """Close Redis connection."""
    global _redis_client

    if _redis_client:
        await _redis_client.close()
        _redis_client = None
