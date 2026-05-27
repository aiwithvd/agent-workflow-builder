import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.routers import agents, workflows, executions
from app.routers import settings as settings_router
from app.database import engine, Base
from app.scheduler import agent_scheduler, load_all_schedules
from app.services.trigger_activator import activate_workflow_triggers

logger = logging.getLogger(__name__)

# Paths that bypass the secret check (public health + docs)
_OPEN_PATHS = {"/health", "/", "/docs", "/openapi.json", "/redoc"}


class InternalSecretMiddleware(BaseHTTPMiddleware):
    """Reject requests that don't carry the correct X-Internal-Secret header.

    Only active when ``settings.internal_api_secret`` is non-empty so that
    local development works out of the box without any configuration.
    """

    async def dispatch(self, request: Request, call_next):
        secret = settings.internal_api_secret
        if secret and request.url.path not in _OPEN_PATHS:
            if request.headers.get("X-Internal-Secret") != secret:
                return JSONResponse({"detail": "Unauthorized"}, status_code=401)
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add standard security response headers to every reply."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


async def _sync_all_workflow_triggers() -> None:
    """Re-sync all workflow trigger nodes → DB on startup."""
    try:
        from app.database import async_session
        from app.models import Workflow
        from sqlalchemy import select

        async with async_session() as db:
            result = await db.execute(select(Workflow))
            workflows = result.scalars().all()

        for wf in workflows:
            await activate_workflow_triggers(wf.id, wf.graph_definition or {})

        logger.info("Synced triggers for %d workflow(s) on startup", len(workflows))
    except Exception as e:
        logger.warning("Could not sync workflow triggers on startup: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for app startup/shutdown."""
    # Startup: create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Start APScheduler, register agents with schedules, and load workflow triggers
    await agent_scheduler.start()
    await load_all_schedules()
    await _sync_all_workflow_triggers()

    yield

    # Shutdown
    await agent_scheduler.stop()
    await engine.dispose()


# Create FastAPI app
app = FastAPI(
    title="Agent Orchestration Platform",
    description="Build, configure, and orchestrate AI agents",
    version="0.1.0",
    lifespan=lifespan,
)

# Security middlewares (outermost first — security headers wrap everything)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(InternalSecretMiddleware)

# CORS — restrict to known origins; wildcard + credentials is invalid per spec
_cors_origins = ["http://localhost:4000", "http://localhost:3001", "http://localhost:3000"]
if settings.frontend_url:
    _cors_origins.append(settings.frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(agents.router)
app.include_router(workflows.router)
app.include_router(executions.router)
app.include_router(settings_router.router)


@app.get("/health")
async def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok", "environment": settings.environment}


@app.get("/")
async def root() -> dict:
    """Root endpoint."""
    return {
        "name": "Agent Orchestration Platform",
        "version": "0.1.0",
        "docs_url": "/docs",
    }
