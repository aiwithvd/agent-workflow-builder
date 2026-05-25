# Agent Orchestration Platform

A production-ready full-stack platform for creating, configuring, and orchestrating AI agents into collaborative multi-agent workflows. Agents execute on a real **LangGraph** runtime, communicate via tool calls and messages, and are monitored in real-time with Langfuse-backed observability.

---

## Architecture

```mermaid
flowchart TD
    subgraph Frontend["Next.js Frontend :4000"]
        CANVAS["React Flow Canvas\n(drag-drop builder)"]
        CRUD["Agent / Workflow CRUD"]
        MONITOR["Execution Monitor\n(WS + polling fallback)"]
        SETTINGS["Settings Page\n(credentials store)"]
    end

    subgraph Backend["FastAPI Backend :8000"]
        ROUTER_A["Agents Router"]
        ROUTER_W["Workflows Router\n+ TriggerActivator"]
        ROUTER_E["Executions Router\n(WebSocket + REST)"]
        ROUTER_S["Settings Router"]
        EXECUTOR["ExecutionService\n(LangGraph astream_events)"]
        EVENT_BUS["Event Bus\n(asyncio.Queue pub/sub)"]
        SCHEDULER["APScheduler\n(Cron triggers)"]
        TG_BOT["Telegram Bot\n(python-telegram-bot)"]
        CH_ROUTER["ChannelRouter\n(DB-backed routing)"]
    end

    subgraph Storage["Storage"]
        PG[("PostgreSQL\nagents · workflows\nexecutions · messages\nplatform_settings\nworkflow_triggers")]
        REDIS[("Redis\n(session state)")]
    end

    subgraph Observability["Observability :3000"]
        LANGFUSE["Langfuse v2\n(self-hosted)"]
    end

    subgraph LGServer["LangGraph Server :8123 (optional)"]
        DISPATCHER["meta-graph dispatcher\n(dynamic_workflow)"]
        CHECKPOINT["AsyncPostgresSaver\n(thread checkpointing)"]
    end

    CANVAS -- REST --> ROUTER_W
    CRUD -- REST --> ROUTER_A & ROUTER_W
    MONITOR -- WebSocket / polling --> ROUTER_E
    SETTINGS -- REST --> ROUTER_S
    ROUTER_W -- activate_triggers --> PG
    ROUTER_E -- BackgroundTask --> EXECUTOR
    EXECUTOR -- step_start/complete events --> EVENT_BUS
    EXECUTOR -- CallbackHandler --> LANGFUSE
    EVENT_BUS -- stream --> ROUTER_E
    ROUTER_E -- GET /traces /metrics --> LANGFUSE
    SCHEDULER -- cron job --> EXECUTOR
    TG_BOT -- message --> CH_ROUTER --> EXECUTOR
    EXECUTOR -- optional --> DISPATCHER
    DISPATCHER -- compile --> CHECKPOINT
    EXECUTOR & ROUTER_A & ROUTER_W -- SQLAlchemy --> PG
    TG_BOT -- session --> REDIS
```

### Why LangGraph?

| Concern | LangGraph | Alternative |
|---|---|---|
| **Graph-first** | Native `StateGraph` — edges, conditions, loops are first-class | CrewAI/AutoGen: flat agent list |
| **Async-native** | `graph.ainvoke()` integrates cleanly with FastAPI | LangChain Agents: sync-first |
| **Per-step streaming** | `astream_events(version="v2")` emits `on_chain_start/end` per node | Custom event emission needed elsewhere |
| **Conditional routing** | `add_conditional_edges()` + router function | Requires custom state machines |
| **Checkpointing** | `langgraph-checkpoint-postgres` for persistent, resumable state | Not available in CrewAI/AutoGen |
| **Observability** | LangChain callback system → Langfuse `CallbackHandler` | Custom wiring needed |

---

## Features

### Canvas & Workflow Builder
- **Visual drag-and-drop canvas** — React Flow with 7 node types: Agent, Supervisor, Swarm, Telegram Trigger, Schedule Trigger, Web Chat Trigger, Input, Output
- **Conditional edges** — draw labeled edges between agents; the graph builder creates `add_conditional_edges()` routing based on labels
- **Canvas execution overlay** — nodes turn blue (running) → green (done) → red (error) in real time during a workflow run
- **2 pre-built templates** — Research Report Pipeline, Customer Support Triage
- **Stale canvas fix** — New Workflow always starts from a clean blank canvas

### Node Types
| Node | Purpose |
|---|---|
| **Agent** | Standard LLM agent with tools; indigo border |
| **Supervisor** | Routes to sub-agents; amber badge + crown icon |
| **Swarm** | Peer-to-peer handoff; teal badge + hexagon icon |
| **Telegram Trigger** | Fires workflow on incoming bot message |
| **Schedule Trigger** | APScheduler cron job trigger |
| **Web Chat Trigger** | Manual run entry point |
| **Input** | Shows default message; configurable pre-fill |
| **Output** | Configures result delivery (Display + Telegram + Webhook) |

### Execution Engine
- **LangGraph `StateGraph`** runtime — WYSIWYG: edges drawn on canvas become LangGraph edges
- **Per-step streaming** via `graph.astream_events(version="v2")` — `step_start` / `step_complete` events per agent node
- **Output delivery** — Output node config drives post-execution Telegram reply and/or webhook POST
- **LangGraph Server** (optional, `--profile langgraph`) — Docker service at `:8123` with `dispatcher.py` meta-graph factory, `AsyncPostgresSaver` checkpointing, 30+ REST endpoints

### Monitoring & Observability
- **Live Log tab** — WebSocket event stream with 3s polling fallback
- **Traces tab** — Langfuse LLM call browser (tokens, cost, latency per call)
- **Messages tab** — Full inter-agent conversation history with timestamps
- **Final Result card** — Readable prose output shown prominently above tabs
- **Metrics bar** — Total tokens, prompt tokens, completion tokens, estimated cost

### Trigger System
- **DB-backed trigger registry** — `workflow_triggers` table; persists across restarts
- **ChannelRouter** — routes Telegram messages to the correct workflow by looking up active Telegram triggers
- **APScheduler sync** — schedule trigger nodes register/unregister cron jobs on canvas save
- **Startup sync** — all workflow trigger nodes re-synced to DB on backend boot

### Settings & Credentials
- **Settings page** (`/settings`) — Telegram bot token, OpenRouter API key, Ollama URL, OpenWeatherMap key, Langfuse credentials
- **Secret masking** — sensitive values stored in `platform_settings` table, returned as `***` via API
- **DB-backed credential lookup** — Telegram delivery and bot read bot token from DB settings at runtime

### Agent Configuration
- **Full inline editing** — click any canvas agent node → edit name, role, system prompt, provider, model, tools, memory
- **Save Changes** persists to DB via `PATCH /api/v1/agents/{id}`
- **Delete Node** button removes node from canvas

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | FastAPI + Uvicorn |
| Agent runtime | LangGraph 0.2+ (`StateGraph`, `create_react_agent`) |
| LLM providers | Ollama (local), OpenRouter (cloud), GLM-5.1 |
| Database ORM | SQLAlchemy 2.0 async + asyncpg |
| Database | PostgreSQL (Supabase or self-hosted) |
| Migrations | Alembic (4 migration files) |
| Observability | Langfuse v2 (self-hosted Docker) |
| Scheduling | APScheduler `AsyncIOScheduler` |
| Session cache | Redis |
| Messaging | python-telegram-bot 20+ |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Workflow UI | `@xyflow/react` (React Flow v12) |
| State management | Zustand |
| Optional execution plane | LangGraph Server (`langchain/langgraph-api`) |

---

## Quick Start

### Prerequisites

- Docker & Docker Compose v2
- A PostgreSQL database (Supabase free tier or local Postgres)

### 1. Configure environment

```bash
cp .env.example .env
```

Key variables:

```dotenv
# PostgreSQL — asyncpg format for SQLAlchemy
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname

# Langfuse — standard libpq format (no driver prefix)
LANGFUSE_DATABASE_URL=postgresql://user:pass@host:5432/dbname

LANGFUSE_NEXTAUTH_SECRET=<any 32+ char random string>
LANGFUSE_SALT=<any 32+ char random string>

REDIS_URL=redis://redis:6379
OLLAMA_URL=http://host.docker.internal:11434   # if Ollama runs on host

# Optional — can be set in the UI Settings page instead
TELEGRAM_BOT_TOKEN=
OPENROUTER_API_KEY=
OPENWEATHERMAP_API_KEY=
```

### 2. Start services

```bash
# Core services (frontend, backend, Langfuse, Redis)
docker compose up

# With LangGraph Server execution plane (optional)
docker compose --profile langgraph up
```

| Service | URL |
|---|---|
| **Frontend** | http://localhost:4000 |
| **Backend API** | http://localhost:8000 |
| **API Docs** | http://localhost:8000/docs |
| **Langfuse** | http://localhost:3000 |
| **LangGraph Server** (optional) | http://localhost:8123 |

### 3. Apply database migrations

Migrations run automatically on container start. To run manually:

```bash
docker compose exec backend alembic upgrade head
```

---

## Demo Flow

### End-to-end walkthrough

**1. Configure credentials** (optional — Ollama works out-of-the-box)

Go to **Settings** → enter your Telegram bot token, OpenRouter API key.

**2. Create agents**

Navigate to **Agents → New Agent**:
- `Researcher` — provider: Ollama, model: llama3.2, tools: `web_search`, `calculator`
- `Writer` — provider: Ollama, model: llama3.2, tools: `file_write`

**3. Load the Research Report template**

Go to **Workflows → New** → pick **Research Report Pipeline**. Canvas pre-populates with `Researcher → Writer` nodes.

**4. Assign agents to template nodes**

Click the ⚠ amber Researcher node → select your `Researcher` agent. Repeat for Writer.

**5. Run the workflow**

Click **▶ Run** → type a task (e.g. *"Research the latest advances in quantum computing and write a structured report"*) → click **▶ Run Workflow**.

Watch the canvas: Researcher node turns **blue** (running) → **green** (done), then Writer does the same.

**6. View the execution**

Click "View live →" in the blue banner. On the Execution page:
- **Final Result** card shows clean prose output
- **Live Log** tab shows `step_start` / `step_complete` events per agent
- **Traces** tab shows Langfuse LLM calls with token counts once Langfuse ingests them
- **Messages** tab shows the full inter-agent conversation

**7. Configure Output delivery**

Click the Output node on the canvas → toggle **Telegram** → save. Next run sends the result to your Telegram chat.

**8. Add a Telegram trigger**

Drag a **Telegram Trigger** node from the palette → connect it to the Researcher node → save. Now sending a message to your bot runs this workflow automatically.

**9. Add a Schedule trigger**

Drag a **Schedule Trigger** → click it → set cron `0 9 * * *` → save. The workflow runs daily at 9am UTC.

---

## API Reference

### Agents
```
GET    /api/v1/agents
POST   /api/v1/agents
GET    /api/v1/agents/{id}
PATCH  /api/v1/agents/{id}
DELETE /api/v1/agents/{id}
```

### Workflows
```
GET    /api/v1/workflows
POST   /api/v1/workflows
GET    /api/v1/workflows/templates
GET    /api/v1/workflows/{id}
PATCH  /api/v1/workflows/{id}
DELETE /api/v1/workflows/{id}
```

### Executions
```
POST   /api/v1/executions
GET    /api/v1/executions
GET    /api/v1/executions/{id}
GET    /api/v1/executions/{id}/messages
GET    /api/v1/executions/{id}/traces
GET    /api/v1/executions/{id}/metrics
WS     /api/v1/executions/ws/monitor/{id}
```

### Settings
```
GET    /api/v1/settings
PATCH  /api/v1/settings
GET    /api/v1/settings/{key}/raw    (internal, not in Swagger)
```

---

## Testing

```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

| Test file | Coverage |
|---|---|
| `test_agents.py` | Model columns, tool registry, full Agent CRUD |
| `test_workflows.py` | Workflow CRUD, template listing, schema validation |
| `test_executions.py` | Execution create/status/messages, 404 handling |
| `test_settings.py` | GET catalogue, secret masking, PATCH multi-key, raw endpoint |
| `test_triggers.py` | Telegram trigger activation, update replaces old triggers, delete cascade, ChannelRouter |

All 48 tests use an in-memory SQLite database — no external services required.

---

## Database Migrations

```bash
# Generate a migration after model changes
docker compose exec backend alembic revision --autogenerate -m "describe_change"

# Apply all pending migrations
docker compose exec backend alembic upgrade head

# Roll back one step
docker compose exec backend alembic downgrade -1
```

Current migrations:

| File | Change |
|---|---|
| `001_perf_and_security.py` | Indexes, performance, security constraints |
| `002_add_agent_schedule.py` | Agent schedule/memory/guardrails columns |
| `003_add_platform_settings.py` | `platform_settings` table |
| `004_add_workflow_triggers.py` | `workflow_triggers` table |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | `postgresql+asyncpg://...` for backend ORM |
| `LANGFUSE_DATABASE_URL` | Yes | `postgresql://...` for Langfuse (no driver prefix) |
| `LANGFUSE_NEXTAUTH_SECRET` | Yes | NextAuth secret for Langfuse UI |
| `LANGFUSE_SALT` | Yes | Salt for Langfuse password hashing |
| `REDIS_URL` | Yes | Redis connection URL |
| `OLLAMA_URL` | No | Local Ollama endpoint (default: `http://localhost:11434`) |
| `OPENROUTER_API_KEY` | No | OpenRouter API key (can set via Settings page) |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token (can set via Settings page) |
| `OPENWEATHERMAP_API_KEY` | No | Weather tool API key (can set via Settings page) |

---

## Adding New Templates

1. Design the workflow on the canvas and export the React Flow JSON.
2. Create `backend/templates/<slug>.json`:
   ```json
   {
     "name": "my_template",
     "description": "What it does",
     "graph_definition": { "nodes": [...], "edges": [...] }
   }
   ```
3. Add the slug to `_TEMPLATE_FILES` dict in `backend/app/routers/workflows.py`.
4. The `GET /workflows/templates` endpoint auto-discovers all registered files.

## Adding New Messaging Channels

1. Add the channel to `MessageChannel` enum in `backend/app/enums.py`.
2. Create a handler module following `backend/app/telegram/handlers.py`:
   - Parse incoming event → create `Execution` + `Message` records → call `execution_service.execute_workflow()`.
   - Persist the agent response as a `Message` record.
3. Add a canvas node type for the new channel's trigger (follow `TelegramTriggerNode.tsx`).
4. Extend `ChannelRouter` in `backend/app/services/channel_router.py` with a `route_<channel>()` function.
5. Register the router/bot in `backend/app/main.py`.
