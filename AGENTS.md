# AGENTS.md — Agent Orchestration Platform

## Stack

- **Frontend:** Next.js 14, React Flow v12, Zustand, SWR, Tailwind CSS
- **Backend:** FastAPI, Pydantic v2, SQLAlchemy 2.0 async (asyncpg)
- **Agent Runtime:** LangGraph StateGraph, `create_react_agent`
- **Storage:** PostgreSQL, Redis
- **Observability:** Langfuse v2 (self-hosted)
- **Messaging:** python-telegram-bot 20+, APScheduler

## Architecture

- Monorepo with two packages: `frontend/` and `backend/`
- React Flow canvas JSON `{nodes, edges}` stored in PostgreSQL JSONB column — the visual graph *is* the execution graph
- Runtime layer (`backend/app/runtime/`) has zero HTTP imports; routers (`backend/app/routers/`) have zero LangGraph imports
- API keys stored in both `.env` and `platform_settings` DB table (runtime-updatable via Settings UI)
- Workflow templates in `backend/templates/*.json`; agent presets auto-discovered from `backend/agent_presets/*.json`
- Entrypoints: `backend/app/main.py:app` (FastAPI), `frontend/app/page.tsx` (Next.js)
- Backend package boundaries: `models/` (SQLAlchemy), `schemas/` (Pydantic), `routers/` (FastAPI), `services/` (business logic), `runtime/` (LangGraph)

## Developer Commands

```bash
# Start everything
docker compose up

# With LangGraph Server execution plane
docker compose --profile langgraph up

# Run backend tests (in-memory SQLite, no external services needed)
docker compose exec backend pytest tests/ -v

# Or from backend/ directory (needs venv)
cd backend && source venv/bin/activate && pytest tests/ -v

# Run a single test file
pytest tests/test_agents.py -v

# Database migrations
docker compose exec backend alembic upgrade head
docker compose exec backend alembic revision --autogenerate -m "describe_change"
docker compose exec backend alembic downgrade -1
```

## Service URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:4000 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Langfuse | http://localhost:3000 |
| LangGraph Server (optional) | http://localhost:8123 |

## Testing Patterns

- Tests use `httpx.AsyncClient` with `ASGITransport` — no HTTP server needed
- `conftest.py` patches env vars before any app import, replaces DB with `sqlite+aiosqlite:///:memory:`
- `pytest.ini` sets `asyncio_mode = auto` — test functions are auto-async
- Execution tests mock `execution_service.execute_workflow` with `AsyncMock` to avoid needing a real LLM
- 48 tests across 5 files: `test_agents.py`, `test_workflows.py`, `test_executions.py`, `test_settings.py`, `test_triggers.py`

## Quirks & Gotchas

- Frontend served on **port 4000**, not the Next.js default 3000 (Langfuse uses 3000)
- Backend Docker command runs `alembic upgrade head` then `uvicorn --reload` — migrations auto-apply on container start
- `dependabot.yml` and CI workflows are NOT set up — no `.github/workflows/` exists
- `OTEL_SDK_DISABLED=true` set in docker-compose to suppress OpenTelemetry
- PostgreSQL needs `asyncpg` URL format (`postgresql+asyncpg://`); Langfuse DB uses standard `postgresql://` (no driver prefix)
- Tests must mock LLM-dependent services — no real model calls in test suite
- `ENV PYTHONPATH=/app` set in Dockerfile so Alembic finds the `app` module
- Agent presets auto-register — just drop `.json` files in `backend/agent_presets/`, no code changes needed
