# Yuno AI Agent Orchestration Platform

A production-ready full-stack platform for creating, configuring, and orchestrating AI agents into collaborative workflows. Agents run on a real LangGraph runtime, execute real tools, and communicate asynchronously to complete complex tasks.

**Status**: ✅ MVP Complete (Phases 1-6)
- Backend: FastAPI + LangGraph + Supabase + Redis
- Frontend: Next.js + React Flow + Tailwind CSS  
- Telegram Integration: Real-time agent communication
- LLM Support: Ollama (local) + OpenRouter (cloud) + GLM-5.1 (cloud/local)
- Demo Ready: Pre-built workflows + sample agents

## 🎯 Key Features

- **Agent Management**: Create and configure AI agents with custom personalities, tools, and communication channels
- **Visual Workflow Builder**: Drag-and-drop interface using React Flow to design multi-agent workflows
- **Real-time Execution**: LangGraph-powered supervisor pattern for reliable agent-to-agent communication
- **Telegram Integration**: Chat with agents directly via Telegram
- **Live Monitoring**: Real-time logs, inter-agent messages, and token tracking via WebSocket
- **Pre-built Templates**: Research & Report Pipeline and Customer Support Triage workflows

## 📋 Tech Stack

### Backend
- **Framework**: FastAPI with async/await
- **Agent Runtime**: LangGraph (supervisor pattern)
- **LLM**: Ollama (local) + OpenRouter (cloud) + GLM-5.1 (Z.ai cloud or local inference)
- **Database**: Supabase PostgreSQL with Alembic migrations
- **Real-time**: Redis pub/sub for event streaming
- **Messaging**: python-telegram-bot for Telegram integration

### Frontend
- **Framework**: Next.js 14 with TypeScript
- **Workflow Builder**: React Flow for visual node-graph UI
- **Styling**: Tailwind CSS + shadcn/ui components
- **State**: Zustand for workflow state management
- **Data Fetching**: SWR for REST API calls

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Redis (local: `redis-server` or `brew install redis`)
- Node.js 20+ (for local frontend development)
- Python 3.12+ (for local backend development)

### Setup

```bash
# Clone and navigate to project
cd yuno-ai-platform

# Copy environment template and fill in credentials
cp .env.example .env

# Edit .env with:
# - Supabase PostgreSQL URL and key
# - Telegram bot token (get from @BotFather)
# - OpenRouter API key (optional, for cloud LLMs)
# - OpenWeatherMap API key (optional, for weather tool)
```

### Running Locally (Quickstart)

**Option 1: Docker Compose (Recommended)**

```bash
# Start Redis
redis-server

# Copy and configure environment
cp .env.example .env
# Edit .env with your Supabase credentials and bot token

# Start all services
docker-compose up
```

**Option 2: Local Development**

```bash
# Terminal 1: Backend API
cd backend
pip install -r requirements.txt
alembic upgrade head
python seed_templates.py
python -m uvicorn app.main:app --reload

# Terminal 2: Telegram Bot
cd backend
python -m app.telegram.bot

# Terminal 3: Frontend
cd frontend
npm install
npm run dev

# Terminal 4: Redis (if not already running)
redis-server
```

Access the application at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## 📦 API Endpoints

### Agents
```bash
GET    /api/v1/agents              # List agents
POST   /api/v1/agents              # Create agent
GET    /api/v1/agents/{id}         # Get agent
PATCH  /api/v1/agents/{id}         # Update agent
DELETE /api/v1/agents/{id}         # Delete agent
```

### Workflows
```bash
GET    /api/v1/workflows           # List workflows
POST   /api/v1/workflows           # Create workflow
GET    /api/v1/workflows/templates # Available templates
GET    /api/v1/workflows/{id}      # Get workflow
PATCH  /api/v1/workflows/{id}      # Update workflow
DELETE /api/v1/workflows/{id}      # Delete workflow
```

### Executions
```bash
POST   /api/v1/executions          # Start workflow
GET    /api/v1/executions          # List executions
GET    /api/v1/executions/{id}     # Get execution
WS     /api/v1/executions/ws/monitor/{id}  # Live monitoring
```

## 🔧 Configuration

### Agent Tools Available
- **web_search**: DuckDuckGo search (no API key required)
- **calculator**: Math expressions via numexpr
- **file_read**: Read files from sandboxed directory
- **file_write**: Write files to sandboxed directory
- **weather**: OpenWeatherMap weather data

### LLM Providers

#### Cloud Providers
- **openrouter**: Any model via unified API (requires OpenRouter API key)
- **glm51**: GLM-5.1 via Z.ai cloud API (requires Z.ai API key, OpenAI-compatible)

#### Local Providers
- **ollama**: Local Llama 3.2 or Mistral (free, private, localhost:11434)
- **glm51-local**: Local GLM-5.1 inference via vLLM or llama.cpp (requires local server)

**GLM-5.1 Benefits**: Open-source model (#1 on SWE-Bench Pro), 8-hour autonomous execution loops, excellent for agentic tasks and coding

### Pre-built Workflow Templates

#### 1. Research & Report Pipeline
Gathers information from multiple sources and compiles a structured report.
- **Agents**: Researcher (web search) → Writer (formatting) → Output
- **Tools**: Web search, calculator, file read/write
- **Use case**: Competitive analysis, market research, news summaries

#### 2. Customer Support Triage
Routes support requests to appropriate specialist agents.
- **Agents**: Classifier → Technical/Billing/General agents → Response
- **Tools**: Web search, knowledge base lookup
- **Use case**: Multi-department support routing, ticket classification

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│              Next.js Frontend (Port 3000)           │
│  ┌────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ Dashboard  │  │ React Flow   │  │ Live       │  │
│  │ & CRUD     │  │ Builder      │  │ Monitor    │  │
│  └────────────┘  └──────────────┘  └────────────┘  │
└──────────────────┬──────────────────────────────────┘
                   │ REST + WebSocket
┌──────────────────────────────────────────────────────┐
│          FastAPI Backend (Port 8000)                 │
│  ┌────────────┐  ┌──────────────┐  ┌────────────┐   │
│  │ Agent CRUD │  │ Workflow API │  │ Execution  │   │
│  │ + Schemas  │  │ + Templates  │  │ Runner     │   │
│  └────────────┘  └──────────────┘  └────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │        LangGraph Supervisor Pattern          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐   │   │
│  │  │Research  │ │Classifier│ │Specialist  │   │   │
│  │  │Agent     │ │Agent     │ │Agents      │   │   │
│  │  └──────────┘ └──────────┘ └────────────┘   │   │
│  │  Tools: DuckDuckGo, Calculator, File I/O     │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │        Telegram Bot (Polling Mode)           │   │
│  └──────────────────────────────────────────────┘   │
└────────┬─────────────────────────────┬────────────┬─┘
         │                             │            │
    ┌────▼──────┐          ┌──────────▼─┐  ┌──────▼────┐
    │ Supabase  │          │   Redis    │  │ Telegram  │
    │PostgreSQL │          │  (local)   │  │   Bot     │
    │           │          │            │  │           │
    │agents     │          │ pub/sub    │  │@YunoAI    │
    │workflows  │          │ real-time  │  │           │
    │executions │          │ events     │  │ /start    │
    │messages   │          │            │  │ /status   │
    └───────────┘          └────────────┘  └───────────┘
```

## 🧪 Testing

```bash
# Run tests
cd backend
pytest tests/

# Test specific endpoints
curl http://localhost:8000/health
curl http://localhost:8000/api/v1/agents

# WebSocket monitor
wscat -c ws://localhost:8000/api/v1/executions/ws/monitor/<execution-id>
```

## 📝 Database Migrations

Migrations are managed via Alembic and run automatically on container startup.

```bash
# Generate a new migration after model changes
alembic revision --autogenerate -m "description"

# Apply pending migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

## 🔑 Environment Variables

See `.env.example` for all required and optional variables:

```
SUPABASE_URL=              # PostgreSQL host
SUPABASE_KEY=              # Supabase API key
DATABASE_URL=              # PostgreSQL connection string
REDIS_URL=                 # Redis connection (default: localhost:6379)
OLLAMA_URL=                # Ollama local endpoint
OPENROUTER_API_KEY=        # Cloud LLM provider key
TELEGRAM_BOT_TOKEN=        # Telegram bot token
OPENWEATHERMAP_API_KEY=    # Weather API key
DEBUG=                     # Enable debug mode
ENVIRONMENT=               # development/production
```

## 🎨 Extending the Platform

### Add a New Tool

1. Create tool implementation in `backend/app/runtime/tools/`
2. Add `AgentTool` enum value
3. Register in `TOOL_REGISTRY` in `tools/registry.py`
4. Tools are automatically available to all agents

### Add a New Workflow Template

1. Design workflow graph in React Flow frontend
2. Export graph definition as JSON
3. Create template record in database with `template_name`
4. Display in template gallery on workflows page

### Add a New Messaging Channel

1. Implement handler in `backend/app/telegram/` or new directory
2. Add `MessageChannel` enum value
3. Update execution handlers to support new channel
4. Add WebSocket subscription for real-time updates

## 📚 Documentation

- **Architecture**: See plan file for detailed technical decisions
- **API Reference**: Swagger docs at http://localhost:8000/docs
- **LangGraph Docs**: https://langchain-ai.github.io/langgraph/
- **React Flow Docs**: https://reactflow.dev/


## 🚀 Deployment

The platform is designed to run fully locally with Docker Compose. For production:

1. Use managed PostgreSQL (Supabase supports this)
2. Run Redis on a separate container or managed service
3. Deploy frontend to Vercel or similar
4. Deploy backend to cloud platform (GCP Cloud Run, AWS ECS, etc.)
5. Update environment variables for production endpoints

---
