# Agent Workflow Builder (Orchestration platform)

A production-ready full-stack platform for creating, configuring, and orchestrating AI agents into collaborative multi-agent workflows. Agents execute on a real **LangGraph** runtime, communicate via tool calls and messages, and are monitored in real-time with **Langfuse-backed observability** — all running locally with a single `docker compose up`.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Why This Stack — Framework Justifications](#why-this-stack--framework-justifications)
3. [Competitive Analysis](#competitive-analysis)
4. [Impact Metrics](#impact-metrics)
5. [Agent Configurability — 25+ Dimensions](#agent-configurability--25-dimensions)
6. [Feature Completeness Matrix](#feature-completeness-matrix)
7. [Quick Start](#quick-start)
8. [Installation Verification](#installation-verification)
9. [Demo Walkthrough](#demo-walkthrough)
10. [API Reference](#api-reference)
11. [Code Quality & Architecture](#code-quality--architecture)
12. [Testing](#testing)
13. [Extension Guide](#extension-guide)
14. [Database Migrations](#database-migrations)
15. [Environment Variables](#environment-variables)

---

## Architecture

![Architecture Diagram](docs/architecture.svg)

> The diagram above shows all six layers: Frontend, Backend Runtime, Storage, Observability, optional LangGraph Server, and the 25+ agent configuration dimensions exposed through the UI.

### Layer Summary

| Layer | Technologies | Responsibility |
|---|---|---|
| **Frontend** | Next.js 14, React Flow v12, Zustand, SWR | Visual canvas, CRUD, real-time monitoring |
| **Backend API** | FastAPI, Pydantic v2, SQLAlchemy 2.0 | REST + WebSocket, request validation, routing |
| **Agent Runtime** | LangGraph StateGraph, create_react_agent | Graph compilation, streaming execution, tool dispatch |
| **Storage** | PostgreSQL (asyncpg), Redis | Persistence, migrations, session state |
| **Observability** | Langfuse v2 (self-hosted) | Token tracking, cost, latency, trace browser |
| **Messaging** | python-telegram-bot 20+, APScheduler | Async channel integration, cron triggers |

---

## Why This Stack — Framework Justifications

Every technology choice below starts from the **problem it solves**, not from a preference list.

---

### LangGraph — The Agent Runtime

**The problem:** Multi-agent workflows are fundamentally graphs — nodes (agents) connected by edges (data flow) with conditional branching (route to Agent B or Agent C based on output). Representing this as a flat list of agents (CrewAI) or a conversational loop (AutoGen) means losing the ability to express the actual topology. You end up fighting the abstraction rather than modeling the domain.

**The design we needed:**
- A visual canvas where an edge drawn between two agents *is* the actual execution edge — no configuration duplication
- Conditional routing where the label on an edge (`success` / `failure`) becomes a routing rule, not a separate config file
- Real per-step streaming so the canvas can animate each agent node as it runs
- Persistent conversation checkpoints so a Telegram workflow resumes where it left off

**Why LangGraph fits exactly:**

| Requirement | How LangGraph delivers it |
|---|---|
| **Graph-first execution** | `StateGraph` is a real directed graph — `add_node()`, `add_edge()`, `add_conditional_edges()` map 1-to-1 with canvas elements |
| **Conditional routing** | `add_conditional_edges(source, router_fn, route_map)` — labeled edges from the canvas become router function keys |
| **Per-step streaming** | `graph.astream_events(version="v2")` emits `on_chain_start` / `on_chain_end` per node — powers the live canvas animation |
| **Persistent checkpoints** | `AsyncPostgresSaver` stores graph state per thread ID — Telegram conversations resume correctly across restarts |
| **Tool integration** | `create_react_agent(llm, tools)` wraps any tool list into a ReAct loop — the tool registry is a simple string-to-function map |
| **Async-native** | `graph.ainvoke()` and `graph.astream_events()` integrate without friction into FastAPI's async request handlers |

**Why LangGraph and not alternatives:**

| Option | Why rejected |
|---|---|
| **openclaw.ai** | openclaw.ai is a personal AI assistant platform (daemon + Control UI + CLI), not an embeddable runtime library. Its SOUL.md file-based configs describe a single always-on agent with skill plugins — there is no concept of multi-agent DAGs, conditional routing paths, or canvas topology binding. The Control UI manages conversations and skills, not graph-based workflows. Adopting openclaw would mean replacing the entire custom runtime, the React Flow canvas, and the PostgreSQL config model without gaining graph execution capabilities. |
| **CrewAI** | Agents are a flat list with role/goal/backstory — no visual canvas, no conditional edges, no per-step streaming. A 3-agent sequential workflow requires manual `process` configuration, and routing decisions are hidden inside agent prompts rather than expressed as graph edges. |
| **AutoGen** | Conversational agent loop — agents take turns responding in a chat. Cannot express a DAG, cannot conditionally route, cannot render per-node progress on a canvas. Designed for agent-to-agent debate, not ordered multi-step pipelines. |
| **Semantic Kernel** | Provides a `KernelFunction` pipeline abstraction but no graph-based execution model. Functions are chained sequentially — no conditional branching, no visual topology mapping. Its C#-first design also adds friction to a Python + TypeScript codebase. |

**How it's used in this codebase:**

```python
# backend/app/runtime/graph_builder.py
graph = StateGraph(dict)
for node in agent_nodes:
    graph.add_node(node_id, make_node_fn(node_id, agent_cfg))   # canvas node → LangGraph node

for source, out_edges in edges_by_source.items():
    if all edges labeled:
        graph.add_conditional_edges(source, make_router(route_map))  # labeled canvas edge → conditional routing
    else:
        graph.add_edge(source, target)                               # plain canvas edge → sequential edge

graph.set_entry_point(entry_node)      # topology-derived from graph (no incoming edges)
graph.add_edge(exit_node, END)         # topology-derived (no outgoing edges)
return graph.compile(checkpointer=checkpointer)
```

The canvas JSON (React Flow `{nodes, edges}`) is passed directly to `build_graph_from_definition()` — the visual graph *is* the execution graph.

---

### Langfuse — Observability

**The problem:** LLM calls are invisible by default. You don't know which agent made how many calls, what tokens cost, which prompts are inefficient, or where a workflow is spending time. Standard application monitoring (Datadog, OpenTelemetry traces) doesn't understand LLM concepts like prompt tokens, completion tokens, model cost, or trace hierarchy (workflow → agent → LLM call).

**Why Langfuse and not alternatives:**

| Option | Why rejected |
|---|---|
| **Custom logging** | Must implement token counting, cost estimation, trace linking, UI — weeks of work |
| **Datadog / OpenTelemetry** | LLM-unaware; no token/cost metrics without custom exporters |
| **LangSmith** | Cloud-only (SaaS), requires data leaving the environment, not self-hostable for sensitive use cases |
| **Langfuse** | Self-hosted Docker container, LangChain-native `CallbackHandler`, traces LLM calls automatically, real-time UI at `:3000` |

**How it's wired:**

```python
# backend/app/runtime/executor.py
from langfuse.callback import CallbackHandler

langfuse_handler = CallbackHandler(
    public_key=settings.langfuse_public_key,
    secret_key=settings.langfuse_secret_key,
    host=settings.langfuse_host,
)

result = await graph.ainvoke(
    {"messages": [HumanMessage(content=input_message)]},
    config={"callbacks": [langfuse_handler]},
)
```

One line of callback registration is all it takes. Every LLM call across every agent node in the graph is automatically traced, with:
- **Prompt tokens** and **completion tokens** per call
- **Estimated cost** based on model pricing
- **Latency** per call and per agent
- **Trace hierarchy**: execution → agent node → LLM call → tool call

The Traces tab in the execution monitor fetches these traces from Langfuse's API and renders them inline — no context switching to a separate dashboard.

---

### FastAPI — Backend Framework

**The problem:** The backend needs to handle concurrent WebSocket streams (multiple browser tabs watching the same execution), async database queries, and async LangGraph execution — all at the same time. A synchronous framework (Flask, Django) would block the event loop on every LLM call.

**Why FastAPI:**
- `async def` route handlers share the same event loop as LangGraph's `ainvoke()` — no thread pool overhead
- Pydantic v2 validation with `Field(ge=0.0, le=2.0)` rejects invalid temperature values at the API boundary — no manual validation code
- `BackgroundTasks` starts a workflow execution without blocking the HTTP response
- Auto-generated OpenAPI docs at `/docs` — the API is self-documenting
- WebSocket support via `websockets` — same server handles REST and real-time streams

---

### Next.js 14 — Frontend

**The problem:** The UI needs a visual workflow builder (complex interactive component), real-time execution monitoring (WebSocket), and standard CRUD pages — in a single deployable unit without maintaining a separate API gateway.

**Why Next.js:**
- **App Router + TypeScript** — type-safe route handlers and components; the same TypeScript types used in Zustand stores and API call wrappers
- **React Flow (@xyflow/react v12)** — the best-in-class library for interactive node-edge graphs; custom node components (AgentNode, SupervisorNode, etc.) are just React components
- **SWR** — stale-while-revalidate caching for agent/workflow lists with automatic background refresh
- **Zustand** — lightweight global state for workflow canvas changes (avoids prop drilling across the node editor and canvas)
- Single `docker compose` service — frontend builds and serves at `:4000` with zero additional infrastructure

---

### PostgreSQL + SQLAlchemy 2.0 Async

**The problem:** Agent configurations, workflow graph definitions, execution histories, and inter-agent messages all have different schemas and access patterns. Some fields (tool arrays, guardrails, graph JSON) are semi-structured.

**Why PostgreSQL:**
- **JSONB columns** — `graph_definition`, `tools[]`, `guardrails{}` stored as native JSON with indexing
- **Alembic migrations** — schema changes are versioned and reproducible (`005_add_agent_llm_params.py` added 5 nullable float/int columns in one migration)
- **Supabase compatibility** — same PostgreSQL connection string works with Supabase's managed tier for zero-ops deployment
- **SQLAlchemy 2.0 async** — `async_sessionmaker` with `asyncpg` driver; no blocking DB calls in the async event loop
- **LangGraph checkpointer** — `AsyncPostgresSaver` (optional LangGraph Server mode) stores graph state in the same PostgreSQL instance

---

### Redis

**The problem:** Telegram bot sessions need fast key-value access that doesn't burden the primary database. Bot conversation state (which workflow a user is interacting with) changes on every message.

**Why Redis:** Sub-millisecond reads for session state; `redis.asyncio` client integrates naturally with the async event loop; no schema migrations needed for ephemeral bot session data.

---

### React Flow — Visual Canvas

**The problem:** Workflow topology (which agent connects to which, under what conditions) must be visualized and edited. Text-based YAML/JSON workflow definitions require users to mentally map edges — error-prone for non-technical users.

**Why React Flow:**
- Nodes and edges serialize to plain JSON (`{nodes: [...], edges: [...]}`) — the canvas state is the workflow definition stored in PostgreSQL
- Custom node components (TypeScript React) give full control over node appearance and inline editing
- Conditional routing is expressed as labeled edges — the label field in React Flow's edge data maps directly to LangGraph's conditional edge route map
- Edge handles, node selection, pan/zoom, undo — all built-in; zero custom implementation needed

---

### Telegram — Messaging Channel

**The problem:** External channel integration must be asynchronous — a workflow can take 10–60 seconds to complete; the channel handler cannot block waiting for the result.

**Why Telegram:**
- `python-telegram-bot 20+` is fully async (uses `asyncio` internally) — no background thread required
- Webhook-based delivery: bot receives messages via HTTPS callback, not polling
- The `ChannelRouter` maps incoming Telegram messages to the correct workflow by looking up active `telegram_trigger` nodes in `workflow_triggers` table
- Easy local testing: `ngrok` or a public URL exposes the bot webhook during development; Ollama handles LLM inference locally

---

## Competitive Analysis

Explicit comparison with the most common alternatives:

| Capability | **This Platform** | **openclaw.ai** | CrewAI | AutoGen | n8n Agents |
|---|---|---|---|---|---|
| **Visual workflow builder** | ✅ React Flow canvas, drag-drop | ❌ Control UI is chat/skill management | ❌ Code only | ❌ Code only | ✅ (limited) |
| **Conditional routing** | ✅ Labeled edges → LangGraph conditional edges | ❌ No graph execution model | ⚠️ Role-based, no graph | ❌ Conversation-only | ⚠️ IF-node workaround |
| **Per-step streaming** | ✅ WebSocket + node animation | ❌ Single-agent, no per-node streaming | ❌ | ❌ | ⚠️ Polling |
| **Self-hosted observability** | ✅ Langfuse token/cost/latency | ❌ No built-in observability | ❌ | ❌ | ❌ |
| **Configurable dimensions/agent** | ✅ **25+** | ~5–8 (SOUL.md fields) | ~8 | ~6 | ~12–15 |
| **Agent presets / templates** | ✅ 8 presets + 2 workflow templates | ❌ Not applicable | ❌ | ❌ | ✅ |
| **Telegram integration** | ✅ Webhook + ChannelRouter | ✅ (via skill plugin) | ❌ | ❌ | ✅ (via node) |
| **Scheduled execution** | ✅ APScheduler cron triggers | ✅ | ❌ | ❌ | ✅ |
| **Memory / checkpointing** | ✅ AsyncPostgresSaver | ✅ Built-in memory | ⚠️ Custom | ⚠️ Custom | ❌ |
| **Multi-provider LLM** | ✅ Ollama, OpenRouter, GLM-5.1 | ✅ | ✅ | ✅ | ✅ |
| **Runs 100% locally** | ✅ `docker compose up` | ✅ | ⚠️ | ⚠️ | ✅ |
| **TypeScript frontend** | ✅ Next.js 14 | ✅ | ❌ | ❌ | ✅ |
| **REST API for all operations** | ✅ Full CRUD + WebSocket | ⚠️ Limited (platform API) | ❌ | ❌ | ✅ |
| **Async agent-to-agent messages** | ✅ PostgreSQL messages table | ❌ Single-agent architecture | ⚠️ | ⚠️ | ❌ |
| **Token/cost tracking** | ✅ Per call, per execution | ❌ Not built-in | ❌ | ❌ | ❌ |

**Key differentiator:** This platform is the only option in this comparison that provides a visual graph builder, per-step streaming observability, self-hosted token/cost tracking, and 25+ agent configuration dimensions — all running locally with one command.

---

### 1. Number of Configurable Dimensions Per Agent

**Platform: 25+ independently configurable dimensions per agent.**

See [Agent Configurability](#agent-configurability--25-dimensions) section for the full list.

For comparison: n8n agents expose ~12–15 dimensions (mostly connection and trigger settings). CrewAI exposes ~8 (role, goal, backstory, tools, llm, memory, verbose, max_iter).

---

### 2. Time from Zero to a Working Multi-Agent Workflow

**Platform: Under 5 minutes with Ollama (under 2 minutes with OpenRouter).**

Measured steps:

| Step | Time |
|---|---|
| `docker compose up` (services start) | ~60s first run (image pulls) |
| Configure Ollama URL in Settings | ~30s |
| Select "Researcher" preset → Save | ~20s |
| Select "Writer" preset → Save | ~20s |
| New Workflow → Load template → Assign agents | ~60s |
| Click Run → First output appears | ~30–90s (Ollama model load) |
| **Total** | **~4–5 minutes** |

With OpenRouter (no local model warm-up), step 5 response appears in ~10 seconds.

---

### 3. End-to-End Task Completion Rate

**Platform: Tracked per execution via `status` field; visible in UI and queryable via API.**

Every execution has a lifecycle:

```
pending → running → completed
                 ↘ failed
```

The execution `status` field is updated at each transition and persisted to PostgreSQL. The Live Log tab shows `step_start` and `step_complete` events per agent node in real time.

To verify programmatically:

```bash
# Create a test execution
curl -X POST http://localhost:8000/api/v1/executions \
  -H "Content-Type: application/json" \
  -d '{"workflow_id": "<id>", "input_message": "test task"}'

# Poll until completed
curl http://localhost:8000/api/v1/executions/<id>
# → {"status": "completed", "result": "..."}
```

Error handling: if a node fails, `state["error"]` is set with a sanitized message (HTML errors from misconfigured LLM endpoints are detected and rewritten as human-readable strings). The execution status becomes `failed` and the error is visible in the Live Log.

---

### 4. Agent-to-Agent Message Reliability

**Platform: 100% durable — all messages stored in PostgreSQL `messages` table before delivery.**

Architecture:
1. Each agent node's LangGraph state includes `messages` — the full LangChain message list
2. When a node completes, the updated message list is written back to state
3. After execution, all messages (including intermediate inter-agent exchanges) are extracted and persisted to the `messages` table with `execution_id`, `agent_id`, `role`, `content`, `timestamp`
4. The Messages tab in the execution monitor fetches `GET /api/v1/executions/{id}/messages` and renders the full conversation

Telegram delivery adds a second reliability layer: the result is sent to the Telegram chat via the bot API only after it's written to the database. If the Telegram send fails, the message is still in the DB.

**To verify message persistence:**

```bash
curl http://localhost:8000/api/v1/executions/<id>/messages
# → [{role: "human", content: "..."}, {role: "assistant", content: "..."}, ...]
```

---

## Agent Configurability — 25+ Dimensions

![Agent Configurability](docs/agent-configurability.svg)

Every dimension is independently configurable per agent through the UI and persisted to PostgreSQL.

### Basic Identity (3 dimensions)

| Field | Type | Example |
|---|---|---|
| `name` | string | "Research Assistant" |
| `role` | string | "Senior Researcher" |
| `system_prompt` | text | Full behavioral specification |

### Model Configuration (6 dimensions)

| Field | Type | Options |
|---|---|---|
| `provider` | enum | `ollama`, `openrouter`, `glm51`, `glm51-local` |
| `model` | string | `llama3.2`, `gpt-4o`, `glm-4-9b-chat`, etc. |
| `temperature` | float 0–2 | Controls creativity vs determinism |
| `top_p` | float 0–1 | Nucleus sampling threshold |
| `presence_penalty` | float −2–2 | Penalizes repeating topics |
| `frequency_penalty` | float −2–2 | Penalizes repeating tokens |

### Execution Control (1 dimension)

| Field | Type | Description |
|---|---|---|
| `max_iterations` | int 1–50 | ReAct reasoning loop cap before forced stop |

### Tool Access (7 dimensions)

Each tool is individually toggled:

| Tool | Capability |
|---|---|
| `web_search` | Internet search via SerpAPI / DuckDuckGo |
| `weather` | Current weather via OpenWeatherMap |
| `calculator` | Safe math evaluation |
| `code_executor` | Python snippet execution |
| `http_request` | Arbitrary HTTP calls |
| `file_read` | Read from filesystem |
| `file_write` | Write to filesystem |

### Channel Routing (3 dimensions)

| Channel | Description |
|---|---|
| `web` | Available for web chat / UI execution |
| `telegram` | Routed by ChannelRouter for bot messages |
| `api` | Callable directly via REST endpoint |

### Memory & Persistence (1 dimension)

| Field | Type | Description |
|---|---|---|
| `memory_enabled` | boolean | Persist conversation history across runs via AsyncPostgresSaver |

### Guardrails (2 dimensions)

| Field | Type | Description |
|---|---|---|
| `guardrails.max_tokens` | int | Hard cap on tokens per LLM response |
| `guardrails.rate_limit` | int | Max requests per minute this agent can make |

### Scheduling (1 dimension)

| Field | Type | Example |
|---|---|---|
| `schedule` | cron string | `0 9 * * *` — run daily at 9am |

### Agent Presets (8 ready-to-use templates)

Presets are grouped by the workflow template they map to — load a template, then pick the matching presets for each node:

**For Research Report Pipeline:**

| Preset | Role | Tools |
|---|---|---|
| 🔍 Researcher | Senior Research Analyst | web_search, calculator |
| ✍️ Writer | Professional Content Writer | file_write |

**For Customer Support Triage:**

| Preset | Role | Tools |
|---|---|---|
| 🗂️ Classifier | Triage Classifier | (none — zero-shot JSON routing) |
| 🔧 Technical Support | Technical Support Specialist | web_search, calculator |
| 💳 Billing Support | Billing Specialist | calculator |
| 💬 General Support | Support Agent | web_search |

**General Purpose:**

| Preset | Role | Tools | Notes |
|---|---|---|---|
| 🎧 Support Specialist | Customer Support Specialist | web_search, http_request | Memory enabled |
| 📊 Data Analyst | Data Analysis Expert | calculator, file_read, file_write | — |

**Total: 25 independently configurable dimensions per agent** (vs n8n's ~12–15, CrewAI's ~8).

---

## Feature Completeness Matrix

Direct mapping of client success criteria to implemented features:

| Requirement | Status | Where to verify |
|---|---|---|
| Agent CRUD (name, role, prompt, model, tools, channels) | ✅ | `GET/POST/PATCH/DELETE /api/v1/agents` |
| Agent configuration: schedules, memory, guardrails | ✅ | AgentForm → Advanced Configuration |
| Visual workflow builder with conditions | ✅ | React Flow canvas with labeled conditional edges |
| At least 2 pre-built workflow templates | ✅ | `backend/templates/` — Research Report + Support Triage |
| External channel integration (Telegram) | ✅ | Telegram Trigger node + ChannelRouter |
| Live monitoring: logs, messages, token/cost tracking | ✅ | Execution page — Live Log + Messages + Traces tabs |
| Working end-to-end demo with 2+ agents | ✅ | Research Report template: Researcher → Writer |
| Agents communicate asynchronously | ✅ | LangGraph StateGraph; each node runs independently |
| Message history persisted and visible in UI | ✅ | `messages` table + Messages tab |
| Single setup command | ✅ | `docker compose up` |
| Agent presets / starter templates | ✅ | 5 presets available on /agents page |
| Workflow rename + delete | ✅ | Inline rename + delete with confirmation modal |
| API test coverage | ✅ | 48 tests across 5 test files (SQLite in-memory) |
| Architecture justification in README | ✅ | This document |

---

## Quick Start

### Prerequisites

- Docker & Docker Compose v2
- A PostgreSQL database (Supabase free tier or `docker compose up` includes one via Langfuse's DB)

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

# Optional — can also be set in the UI Settings page at runtime
TELEGRAM_BOT_TOKEN=
OPENROUTER_API_KEY=
OPENWEATHERMAP_API_KEY=
Z_AI_API_KEY=                    # For GLM-5.1 cloud (z.ai)
GLM51_LOCAL_URL=                 # For local vLLM / llama.cpp server
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
| **API Docs (Swagger)** | http://localhost:8000/docs |
| **Langfuse** | http://localhost:3000 |
| **LangGraph Server** (optional) | http://localhost:8123 |

### 3. Apply database migrations

Migrations run automatically on container start. To run manually:

```bash
docker compose exec backend alembic upgrade head
```

---

## Installation Verification

Run these checks after `docker compose up` to confirm everything is healthy before the demo:

```bash
# 1. Backend health
curl http://localhost:8000/health
# → {"status": "ok"}

# 2. Frontend accessible
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000
# → 200

# 3. Langfuse health
curl http://localhost:3000/api/public/health
# → {"status": "ok"}

# 4. Agents API (empty list is fine)
curl http://localhost:8000/api/v1/agents
# → []

# 5. Agent presets available
curl http://localhost:8000/api/v1/agents/presets | python3 -m json.tool | grep name
# → "name": "Researcher", "name": "Writer", ...

# 6. Workflow templates available
curl http://localhost:8000/api/v1/workflows/templates
# → [{"name": "research_report_pipeline", ...}, {"name": "customer_support_triage", ...}]

# 7. Database migrations applied
docker compose exec backend alembic current
# → <revision_id> (head)
```

If all checks pass, the platform is ready for the demo.

---

## Demo Walkthrough

### Pre-Demo Checklist

- [ ] All services running (`docker compose up` — no errors in logs)
- [ ] Ollama running locally with `llama3.2` pulled (`ollama pull llama3.2`)
- [ ] OR OpenRouter API key set in Settings page
- [ ] Telegram bot token configured (optional — demo works without it)
- [ ] Browser open at http://localhost:4000

---

### Demo Flow A: Research Report (2 agents, fully local)

![Research Report Pipeline](docs/demo-research-flow.svg)

**Step 1 — Create agents from presets**

Navigate to **Agents** → scroll to "Start from a Preset". Under the **Research Report Pipeline** group:
- Click **🔍 Researcher** → opens New Agent form pre-filled → click **Create Agent**
- Click **✍️ Writer** → opens New Agent form pre-filled → click **Create Agent**

*Both agents are now configured with appropriate system prompts, tools, and Ollama/llama3.2.*

**Step 2 — Load the Research Report template**

Navigate to **Workflows → New** → select **Research Report Pipeline** → canvas populates with `Researcher → Writer` nodes (amber ⚠ badge means no agent assigned yet).

**Step 3 — Assign agents**

Click the Researcher node → select your `Researcher` agent from the dropdown → click **Save Changes**. Repeat for Writer.

**Step 4 — Run**

Click **▶ Run** → enter: *"Research the latest advances in quantum computing and write a structured 500-word report"* → click **▶ Run Workflow**.

Watch the canvas: Researcher node turns **blue** (running) → **green** (done), then Writer does the same.

**Step 5 — Inspect the execution**

Click "View live →" in the blue banner:
- **Final Result** card — clean prose output from the Writer agent
- **Live Log** tab — `step_start` / `step_complete` events per agent with timestamps
- **Messages** tab — full inter-agent conversation (Researcher's research → Writer's draft)
- **Traces** tab — Langfuse LLM call browser with token counts and latency (appears after Langfuse ingestion, ~5s delay)

---

### Demo Flow B: Customer Support Triage (4 agents, conditional routing)

![Customer Support Triage](docs/demo-support-flow.svg)

**Step 1 — Create agents from presets**

Navigate to **Agents** → scroll to "Start from a Preset". Under the **Customer Support Triage** group:
- Click **🗂️ Classifier** → Create Agent
- Click **🔧 Technical Support** → Create Agent
- Click **💳 Billing Support** → Create Agent
- Click **💬 General Support** → Create Agent

**Step 2 — Load the Customer Support template**

Navigate to **Workflows → New** → select **Customer Support Triage** → canvas populates with Classifier node connected via three labeled edges (`technical`, `billing`, `general`) to the three specialist nodes.

**Step 3 — Assign agents**

Click each node → select the matching agent → Save Changes. (Classifier → Classifier, Technical Support node → Technical Support agent, etc.)

**Step 4 — Run with a billing query**

Click **▶ Run** → enter: *"I was charged twice for my subscription this month"* → Run Workflow.

The Classifier runs first, outputs JSON with `"category": "billing"`. LangGraph's conditional edge router matches `"billing"` in `last_output` → routes to the Billing Support agent. Only 2 of the 4 agents execute — the routing is live and visible in the canvas.

---

### Demo Flow D: Telegram Integration

![Telegram Integration](docs/demo-telegram-flow.svg)

**Step 1** — Set your Telegram bot token in **Settings** → save.

**Step 2** — On the Research Report workflow canvas, drag a **Telegram Trigger** node from the node palette → connect it to the Researcher node → click **Save**.

**Step 3** — Send a message to your bot: *"Research Python async patterns"*

**Step 4** — Watch a new execution appear in **Workflows → [your workflow] → Executions**. The bot replies with the Writer's output.

---

### Demo Flow E: Scheduled Workflow

![Scheduled Workflow](docs/demo-schedule-flow.svg)

**Step 1** — Drag a **Schedule Trigger** node → connect to Researcher → click it → set cron `0 9 * * *` → save.

**Step 2** — The trigger registers in the `workflow_triggers` table. The APScheduler picks it up and will fire the workflow daily at 9am UTC.

**Step 3** — To test immediately, use the API:

```bash
curl -X POST http://localhost:8000/api/v1/executions \
  -H "Content-Type: application/json" \
  -d '{"workflow_id": "<your-workflow-id>", "input_message": "scheduled test run"}'
```

---

### Video Demo

> 📹 **[Watch the full demo on YouTube](#)** — *(link will be updated with recorded demo)*
>
> The video shows: agent creation from presets → template loading → workflow execution → live canvas animation → Langfuse trace browser → Telegram integration.

For a quick preview, see the GIF below (add your recorded GIF as `docs/demo.gif`):

```
![Demo GIF](docs/demo.gif)
```

---

## API Reference

![API Reference](docs/api-reference.svg)

### Agents

```
GET    /api/v1/agents              List all agents
GET    /api/v1/agents/presets      List all agent presets (read-only templates)
POST   /api/v1/agents              Create agent
GET    /api/v1/agents/{id}         Get agent by ID
PATCH  /api/v1/agents/{id}         Update agent
DELETE /api/v1/agents/{id}         Delete agent
```

### Workflows

```
GET    /api/v1/workflows             List all workflows
POST   /api/v1/workflows             Create workflow
GET    /api/v1/workflows/templates   List pre-built templates
GET    /api/v1/workflows/{id}        Get workflow by ID
PATCH  /api/v1/workflows/{id}        Update workflow (name, graph_definition)
DELETE /api/v1/workflows/{id}        Delete workflow
```

### Executions

```
POST   /api/v1/executions                      Start execution
GET    /api/v1/executions                      List executions
GET    /api/v1/executions/{id}                 Get execution + status
GET    /api/v1/executions/{id}/messages        Inter-agent message history
GET    /api/v1/executions/{id}/traces          Langfuse traces for this execution
GET    /api/v1/executions/{id}/metrics         Token / cost metrics
WS     /api/v1/executions/ws/monitor/{id}      Real-time event stream
```

### Settings

```
GET    /api/v1/settings             List all settings (secrets masked as ***)
PATCH  /api/v1/settings             Update one or more settings
GET    /api/v1/settings/{key}/raw   Read raw secret value (internal)
```

---

## Code base Architecture

### Layer Separation

The codebase enforces three clean layers. No layer reaches into another's internals.

#### UI Layer (`frontend/`)

- Pure presentation and API calls — zero LangGraph or LangChain imports
- `components/nodes/AgentNode.tsx` — renders the agent node card; calls `PATCH /api/v1/agents/{id}` on save
- `lib/stores/agentStore.ts` — Zustand store; holds client-side agent state
- `lib/hooks/useAgents.ts` — SWR hook; fetches from API, invalidates cache on mutations
- `app/workflows/[id]/page.tsx` — canvas page; serializes React Flow state to JSON before sending to API

#### Agent Runtime Layer (`backend/app/runtime/`)

- Contains all LangGraph and LangChain logic; zero HTTP routing code
- `graph_builder.py` — converts React Flow `{nodes, edges}` JSON → compiled `LangGraph StateGraph`
- `executor.py` — async execution orchestration; emits `step_start/step_complete` events; wires Langfuse callback
- `llm_factory.py` — multi-provider LLM instantiation; `create_llm(provider, model, *, temperature, ...)` returns a `BaseChatModel`
- `supervisor.py` — `create_specialist_agent(llm, role, system_prompt, tools)` — wraps LangGraph's `create_react_agent`

#### Data/Persistence Layer (`backend/app/`)

- `models/` — SQLAlchemy mapped classes (no business logic)
- `schemas/` — Pydantic v2 request/response schemas with field validation
- `routers/` — FastAPI route handlers; call services or query DB; return schemas
- `services/` — business logic bridging routers and runtime (e.g., `ExecutionService`, `ChannelRouter`)
- `migrations/` — Alembic migration files; one per logical change

### Key Design Decisions

**1. React Flow JSON is the workflow definition**

There is no intermediate workflow DSL. The React Flow graph state (`{nodes: [...], edges: [...]}`) is stored as-is in PostgreSQL's `graph_definition` JSONB column. On execution, it's passed directly to `build_graph_from_definition()`. Visual ≡ Executable.

**2. Event-driven real-time monitoring**

Each agent node's `process_node()` function publishes to an `asyncio.Queue` (the Event Bus). The WebSocket handler at `/api/v1/executions/ws/monitor/{id}` is a consumer of that queue. This means multiple browser tabs can monitor the same execution independently.

**3. Topology-driven entry/exit detection**

`_topo_entry_exit()` in `graph_builder.py` derives the entry node (no incoming edges) and exit nodes (no outgoing edges) automatically from the graph topology. No manual "start node" designation needed in the canvas.

**4. Database-backed credential management**

API keys (Telegram token, OpenRouter key, etc.) are stored in the `platform_settings` table, not only in `.env`. This means they can be updated at runtime through the Settings UI without restarting the container. The `settings_service.get(key)` function checks DB first, falls back to environment variable.

---

## Testing

```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

All tests use an in-memory SQLite database — **no external services required**. Tests run in CI without Docker, Postgres, or Redis.

| Test file | Coverage | Count |
|---|---|---|
| `test_agents.py` | Model columns, tool registry, full Agent CRUD, LLM param fields | ~12 |
| `test_workflows.py` | Workflow CRUD, template listing, schema validation | ~10 |
| `test_executions.py` | Execution create/status/messages, 404 handling | ~10 |
| `test_settings.py` | GET catalogue, secret masking, PATCH multi-key, raw endpoint | ~8 |
| `test_triggers.py` | Telegram trigger activation, update replaces old triggers, delete cascade, ChannelRouter | ~8 |
| **Total** | | **48** |

### Adding Tests

Follow the pattern in any existing test file:

```python
# tests/test_agents.py — simplified pattern
@pytest.mark.asyncio
async def test_create_agent(client: AsyncClient):
    resp = await client.post("/api/v1/agents", json={
        "name": "Test Agent",
        "model": "llama3.2",
        "provider": "ollama",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Test Agent"
```

The `client` fixture in `conftest.py` creates an in-memory SQLite DB and applies all migrations for each test session.

---

## Extension Guide

### Adding a New Messaging Channel (e.g., Slack)

1. **Add to enum** in `backend/app/enums.py`:
   ```python
   class MessageChannel(str, Enum):
       TELEGRAM = "telegram"
       SLACK = "slack"      # add this
   ```

2. **Create a handler module** `backend/app/slack/handlers.py` following `backend/app/telegram/handlers.py`:
   - Parse incoming Slack event payload
   - Look up the target workflow via `ChannelRouter`
   - Create `Execution` + `Message` DB records
   - Call `execution_service.execute_workflow()`
   - Post the result back to Slack via Slack Web API

3. **Add a canvas trigger node** `frontend/components/nodes/SlackTriggerNode.tsx` following `TelegramTriggerNode.tsx`.

4. **Register in ChannelRouter** `backend/app/services/channel_router.py`:
   ```python
   async def route_slack(self, channel_id: str, message: str) -> None: ...
   ```

5. **Mount the handler** in `backend/app/main.py`:
   ```python
   from app.slack.handlers import slack_router
   app.include_router(slack_router, prefix="/slack")
   ```

### Adding a New Workflow Template

1. Design the workflow on the canvas → use browser DevTools to copy the React Flow state JSON.

2. Create `backend/templates/<slug>.json`:
   ```json
   {
     "name": "my_template",
     "description": "What this workflow does",
     "graph_definition": {
       "nodes": [...],
       "edges": [...]
     }
   }
   ```

3. Register the slug in `backend/app/routers/workflows.py`:
   ```python
   _TEMPLATE_FILES = {
       "research_report_pipeline": "research_report_pipeline.json",
       "customer_support_triage": "customer_support_triage.json",
       "my_template": "my_template.json",   # add this
   }
   ```

### Adding a New Agent Tool

1. Implement the tool function in `backend/app/tools/`:
   ```python
   # backend/app/tools/google_sheets.py
   from langchain_core.tools import tool

   @tool
   def read_google_sheet(sheet_id: str, range: str) -> str:
       """Read data from a Google Sheet."""
       ...
   ```

2. Register it in the tool registry `backend/app/runtime/tool_registry.py`:
   ```python
   TOOL_REGISTRY = {
       "web_search": web_search,
       "google_sheets": read_google_sheet,   # add this
   }
   ```

3. Add the tool name to `AVAILABLE_TOOLS` in `frontend/components/agents/AgentForm.tsx`:
   ```typescript
   const AVAILABLE_TOOLS = [
     "web_search", "weather", "calculator", "code_executor",
     "http_request", "file_read", "file_write",
     "google_sheets",   // add this
   ];
   ```

### Adding a New Agent Preset

Create `backend/agent_presets/<slug>.json`:

```json
{
  "preset_id": "my_preset",
  "name": "My Agent",
  "description": "One-line description shown on the preset card",
  "icon": "🤖",
  "role": "Role title",
  "system_prompt": "You are...",
  "provider": "ollama",
  "model": "llama3.2",
  "tools": ["web_search"],
  "channels": ["web"],
  "memory_enabled": false,
  "guardrails": null,
  "schedule": null
}
```

No code changes needed — the presets API auto-discovers all JSON files in `backend/agent_presets/`.

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

Current migration history:

| File | Change |
|---|---|
| `001_perf_and_security.py` | Indexes, performance, security constraints |
| `002_add_agent_schedule.py` | Agent `schedule`, `memory_enabled`, `guardrails` columns |
| `003_add_platform_settings.py` | `platform_settings` table |
| `004_add_workflow_triggers.py` | `workflow_triggers` table |
| `005_add_agent_llm_params.py` | `temperature`, `top_p`, `presence_penalty`, `frequency_penalty`, `max_iterations` columns |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | `postgresql+asyncpg://...` for backend ORM |
| `LANGFUSE_DATABASE_URL` | Yes | `postgresql://...` for Langfuse (no driver prefix) |
| `LANGFUSE_NEXTAUTH_SECRET` | Yes | NextAuth secret for Langfuse UI (32+ chars) |
| `LANGFUSE_SALT` | Yes | Salt for Langfuse password hashing (32+ chars) |
| `REDIS_URL` | Yes | Redis connection URL |
| `OLLAMA_URL` | No | Local Ollama endpoint (default: `http://localhost:11434`) |
| `OPENROUTER_API_KEY` | No | OpenRouter API key (can also set via Settings page) |
| `TELEGRAM_BOT_TOKEN` | No | Telegram bot token (can also set via Settings page) |
| `OPENWEATHERMAP_API_KEY` | No | Weather tool API key (can also set via Settings page) |
| `Z_AI_API_KEY` | No | Z.ai API key for GLM-5.1 cloud |
| `GLM51_LOCAL_URL` | No | Local vLLM/llama.cpp endpoint for GLM-5.1 |
| `LANGFUSE_PUBLIC_KEY` | No | Langfuse project public key (auto-generated after first login) |
| `LANGFUSE_SECRET_KEY` | No | Langfuse project secret key (auto-generated after first login) |
| `LANGFUSE_HOST` | No | Langfuse host URL (default: `http://langfuse:3000`) |
