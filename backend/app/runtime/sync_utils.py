"""Utilities for reading async DB values from synchronous call sites.

Pattern copied from dispatcher._run_async_safely — submits to a fresh thread
when a loop is already running (e.g. inside uvicorn/FastAPI) so we never
block or re-enter the running event loop.
"""

import asyncio
import concurrent.futures
import logging

logger = logging.getLogger(__name__)


def _run_async(coro):
    """Run a coroutine synchronously from any context (sync or async)."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop is not None and loop.is_running():
        # We're inside an async context — offload to a fresh thread.
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            return pool.submit(asyncio.run, coro).result()
    else:
        return asyncio.run(coro)


async def _fetch_setting_async(key: str):
    from app.database import async_session
    from app.models import PlatformSetting

    try:
        async with async_session() as db:
            row = await db.get(PlatformSetting, key)
            return row.value if row and row.value else None
    except Exception as exc:
        logger.debug("Could not fetch platform setting %r from DB: %s", key, exc)
        return None


def get_platform_setting(key: str) -> str | None:
    """Read a platform setting from the DB.

    Safe to call from both sync and async contexts. Returns None if the
    setting is not configured or if the DB is unreachable.
    """
    return _run_async(_fetch_setting_async(key))
