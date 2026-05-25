"""In-memory pub/sub event bus for streaming execution events to WebSocket clients."""

import asyncio
import json
from datetime import datetime, timezone

# execution_id (str) -> list of subscriber queues
_subscribers: dict[str, list[asyncio.Queue]] = {}


def subscribe(execution_id: str) -> asyncio.Queue:
    """Subscribe to events for an execution. Returns a queue that receives events."""
    q: asyncio.Queue = asyncio.Queue()
    _subscribers.setdefault(execution_id, []).append(q)
    return q


def unsubscribe(execution_id: str, q: asyncio.Queue) -> None:
    """Remove a subscriber queue for an execution."""
    subs = _subscribers.get(execution_id, [])
    if q in subs:
        subs.remove(q)
    if not subs:
        _subscribers.pop(execution_id, None)


async def publish(execution_id: str, event: dict) -> None:
    """Publish an event to all subscribers of an execution."""
    if "timestamp" not in event:
        event["timestamp"] = datetime.now(timezone.utc).isoformat()
    for q in list(_subscribers.get(execution_id, [])):
        await q.put(event)


def make_event(event_type: str, **kwargs) -> dict:
    """Build a structured event dict."""
    return {
        "type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **kwargs,
    }
