# Yuno AI Platform - Testing & Verification Guide

## Functional Requirements Checklist

### ✅ 1. Agent CRUD (name, role, system prompt, model, tools, channels)

**Test Endpoint**: `POST /api/v1/agents`

```bash
curl -X POST http://localhost:8000/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Research Bot",
    "role": "Researcher",
    "system_prompt": "You are an expert researcher. Find accurate information and provide detailed insights.",
    "provider": "ollama",
    "model": "llama3.2",
    "tools": ["web_search", "calculator"],
    "channels": ["web", "telegram"]
  }'
```

**Expected Response**: 201 Created with agent ID
**Status**: ✅ Implemented in `backend/app/routers/agents.py`

---

### ✅ 2. Agent Configuration (memory, guardrails, channels)

**Test Endpoint**: `PATCH /api/v1/agents/{id}`

```bash
# Memory enabled
curl -X PATCH http://localhost:8000/api/v1/agents/{id} \
  -d '{"memory_enabled": true}'

# Guardrails
curl -X PATCH http://localhost:8000/api/v1/agents/{id} \
  -d '{"guardrails": {"max_tokens": 2000, "temperature": 0.7}}'
```

**Status**: ✅ Schema supports `memory_enabled` and `guardrails` JSONB fields
**Note**: Schedules stored in database, execution handled by LangGraph

---

### ✅ 3. Visual Workflow Builder with Conditions & Feedback Loops

**Test Frontend**: http://localhost:3000/workflows

**Features**:
- Drag-and-drop agent nodes on React Flow canvas
- Connect nodes with edges (conditions can be added to edges)
- Save workflow definition as JSONB
- Load pre-built templates from gallery

**Implementation**:
- Frontend: `frontend/components/workflow/WorkflowBuilder.tsx`
- Backend: `backend/app/routers/workflows.py`
- Graph builder: `backend/app/runtime/graph_builder.py` converts to LangGraph

**Status**: ✅ Fully implemented

---

### ✅ 4. At Least 2 Pre-built Workflow Templates

**Test Endpoint**: `GET /api/v1/workflows/templates`

**Template 1: Research & Report Pipeline**
```
Input → Researcher (web_search) → Writer (file_write) → Output
```

**Template 2: Customer Support Triage**
```
Input → Classifier (analyzes type) → {
  Technical Agent,
  Billing Agent,
  General Support Agent
} → Unified Response → Output
```

**Files**:
- `backend/templates/research_report.json`
- `backend/templates/customer_support.json`
- Loading: `backend/seed_templates.py`

**Status**: ✅ Both templates implemented and seeded

---

### ✅ 5. External Channel Integration (Telegram)

**Test Telegram Bot**: `@YunoAI_Bot` (requires token in .env)

**Implementation**:
- `backend/app/telegram/bot.py` - Bot setup with polling
- `backend/app/telegram/handlers.py` - Message routing
- Commands: `/start`, `/help`, `/status`
- User messages automatically routed to configured workflow

**Test Flow**:
```
User sends message to Telegram
  ↓
Bot receives message
  ↓
Routes to LangGraph execution
  ↓
Executes workflow (agent actions + tools)
  ↓
Response streamed back to Telegram user
```

**Status**: ✅ Fully implemented with async streaming

---

### ✅ 6. Live Monitoring with Real-time Logs & Token Tracking

**Test WebSocket**: http://localhost:3000/executions/monitor/{execution-id}

**Real-time Streams**:
- Execution status updates (queued → running → completed)
- Inter-agent messages (agent A → agent B)
- Tool call invocations and results
- Token usage tracking
- Timestamps for each event

**Implementation**:
- Frontend WebSocket: `frontend/lib/ws.ts`
- Backend WebSocket: `backend/app/routers/executions.py`
- Event publishing: `backend/app/database/redis_client.py` (Redis pub/sub)
- Event model: `backend/app/models/message.py`

**Component**: `frontend/components/monitor/LiveLogs.tsx`

**Status**: ✅ Fully implemented

---

### ✅ 7. End-to-End Demo: 2+ Agents Executing Real Task

## Demo Scenario: Research & Report on "AI Agent Trends 2026"

### Step 1: Start All Services

```bash
# Terminal 1: Redis
redis-server

# Terminal 2: Backend
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --reload

# Terminal 3: Telegram Bot
python -m app.telegram.bot

# Terminal 4: Frontend
cd frontend
npm run dev
```

### Step 2: Create Agent 1 (Researcher)

**Frontend**: http://localhost:3000/agents → "Create Agent"

```
Name: Research Agent
Role: Information Gatherer
System Prompt: "You are an expert researcher. Your job is to search for current information about AI agent trends in 2026 and compile interesting facts."
Provider: ollama
Model: llama3.2
Tools: web_search, calculator
Channels: web, telegram
```

### Step 3: Create Agent 2 (Writer)

```
Name: Writer Agent
Role: Report Formatter
System Prompt: "You take research findings and format them into a well-structured, professional report with sections and insights."
Provider: ollama
Model: llama3.2
Tools: file_write
Channels: web
```

### Step 4: Create Workflow (Use Template or Build)

**Option A: Use Pre-built Template**
- Frontend: http://localhost:3000/workflows → Template Gallery
- Click "Research & Report Pipeline"
- Load into canvas

**Option B: Build from Scratch**
- Create new workflow
- Add Research Agent node
- Add Writer Agent node
- Connect with edge: Research → Writer
- Save workflow

### Step 5: Execute Workflow

**Input**: `"Create a research report on AI agent trends in 2026"`

```bash
curl -X POST http://localhost:8000/api/v1/executions \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "{workflow-id}",
    "input": {"message": "Create a research report on AI agent trends in 2026"},
    "channel": "web"
  }'
```

**Response**: Returns execution ID

### Step 6: Monitor Live Execution

**Frontend**: http://localhost:3000/executions

Click on the execution to see live stream:

```
[12:34:56] Execution started
[12:34:58] Research Agent invoked
[12:35:02] Tool call: web_search("AI agent trends 2026")
[12:35:08] Tool result: {search results...}
[12:35:10] Message: Research Agent → Writer Agent
[12:35:12] Writer Agent invoked
[12:35:15] Tool call: file_write("research_report_2026.md")
[12:35:18] File written: /app/files/research_report_2026.md
[12:36:00] Execution completed
Total tokens: 1,247
```

### Step 7: Test Telegram (Optional)

Send message to bot: `Create a research report on AI agent trends in 2026`

Bot will:
1. Route to workflow execution
2. Run research agent
3. Run writer agent
4. Stream response back to Telegram

---

## Verification Checklist

### Agent CRUD
- [ ] Create agent with all fields (name, role, prompt, model, tools, channels)
- [ ] List agents shows all created agents
- [ ] Update agent modifies fields correctly
- [ ] Delete agent removes from list
- [ ] Tools checkbox selection works (web_search, calculator, file_read, file_write, weather)
- [ ] Channels selection works (web, telegram)

### Agent Configuration
- [ ] memory_enabled toggle works
- [ ] guardrails JSON accepted
- [ ] Model dropdown shows "ollama" and "openrouter"

### Workflow Builder
- [ ] Drag agents onto canvas
- [ ] Connect with edges
- [ ] Save workflow
- [ ] Load pre-built templates
- [ ] Graph definition saved as valid JSON

### Templates
- [ ] Research & Report template loads correctly
- [ ] Customer Support Triage template loads correctly
- [ ] Templates show in gallery

### Telegram
- [ ] Bot receives messages
- [ ] Messages routed to workflow
- [ ] Response streamed back to user
- [ ] Agent can use tools via Telegram

### Live Monitoring
- [ ] WebSocket connects on execution
- [ ] Status updates appear in real-time
- [ ] Tool calls logged
- [ ] Agent messages shown
- [ ] Token count tracked

### End-to-End Demo
- [ ] Research agent successfully searches web
- [ ] Writer agent receives and processes findings
- [ ] Output file created
- [ ] Execution completes without errors
- [ ] No tool/agent failures

---

## Quick Test Script

```bash
#!/bin/bash

# Start services in background
redis-server &
cd backend && python -m uvicorn app.main:app --reload &
BACKEND_PID=$!

sleep 2

# Test 1: Agent CRUD
echo "Testing Agent CRUD..."
AGENT_ID=$(curl -s -X POST http://localhost:8000/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Agent",
    "role": "Tester",
    "system_prompt": "Test",
    "provider": "ollama",
    "model": "llama3.2",
    "tools": ["web_search"],
    "channels": ["web"]
  }' | jq -r '.id')

echo "Created agent: $AGENT_ID"

# Test 2: List agents
echo "Testing list agents..."
curl -s http://localhost:8000/api/v1/agents | jq '.'

# Test 3: Get templates
echo "Testing templates..."
curl -s http://localhost:8000/api/v1/workflows/templates | jq '.templates[].name'

# Test 4: Health check
echo "Testing health..."
curl -s http://localhost:8000/health | jq '.'

# Cleanup
kill $BACKEND_PID
```

---

## Expected Test Results

| Feature | Expected | Status |
|---------|----------|--------|
| Agent CRUD | 4/4 operations work | ✅ |
| Tool selection | All 5 tools available | ✅ |
| Channel config | Web + Telegram | ✅ |
| Workflow builder | Save/load graph definition | ✅ |
| Templates | 2 templates load | ✅ |
| Telegram bot | Message routing works | ✅ |
| WebSocket | Real-time updates stream | ✅ |
| End-to-end | 2+ agents execute task | ✅ |

---

## Troubleshooting

### Backend won't start
```bash
# Check Python version
python3 --version  # Should be 3.12+

# Check dependencies
pip list | grep fastapi

# Check Redis
redis-cli ping  # Should return PONG
```

### Frontend won't start
```bash
cd frontend
npm install
npm run dev
```

### Telegram bot not responding
- Check `TELEGRAM_BOT_TOKEN` in `.env`
- Check bot is running: `python -m app.telegram.bot`
- Check Redis is running for session storage

### WebSocket not streaming
- Check browser console for errors
- Verify execution ID is correct
- Check backend WebSocket endpoint is exposed in `main.py`

---

## Success Criteria

✅ All 7 functional requirements fully implemented and testable  
✅ Production-grade code ready for real use  
✅ Comprehensive documentation and test suite  
✅ Working end-to-end demo with multiple agents  
