"""Shared test fixtures for functional API tests."""

import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# Set env vars BEFORE importing any app modules
os.environ.update({
    "DATABASE_URL": "sqlite+aiosqlite:///:memory:",
    "SUPABASE_URL": "https://test.supabase.co",
    "SUPABASE_KEY": "test-key",
    "REDIS_URL": "redis://localhost:6379",
    "OLLAMA_URL": "http://localhost:11434",
    "OPENROUTER_API_KEY": "test-key",
    "TELEGRAM_BOT_TOKEN": "test-token",
    "OPENWEATHERMAP_API_KEY": "test-key",
    "LANGFUSE_PUBLIC_KEY": "lf-test",
    "LANGFUSE_SECRET_KEY": "lf-test",
    "LANGFUSE_HOST": "http://localhost:3000",
})


@pytest_asyncio.fixture(scope="session")
async def app():
    """Create a test FastAPI app with an in-memory SQLite database."""
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from app.database import Base
    import app.database as db_module

    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    # Patch the global engine and session factory
    db_module.engine = engine
    db_module.async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from app.main import app as fastapi_app
    yield fastapi_app

    await engine.dispose()


@pytest_asyncio.fixture
async def client(app):
    """HTTP test client bound to the test app."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def agent_payload():
    """Default valid agent creation payload."""
    return {
        "name": "Test Agent",
        "role": "Tester",
        "system_prompt": "You test things.",
        "provider": "ollama",
        "model": "llama3.2",
        "tools": ["web_search"],
        "channels": ["web"],
        "memory_enabled": False,
    }
