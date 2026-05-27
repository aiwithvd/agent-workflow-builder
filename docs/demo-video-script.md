# Agent Orchestration Platform — Demo Video Script

> **Duration:** ~9 minutes
>
> **Audience:** Technical interviewers, Upwork clients, portfolio viewers
>
> **Prerequisites for recording:**
> - All services running: `docker compose up`
> - Ollama running locally with `llama3.2` pulled (or OpenRouter API key set in Settings)
> - No agents or workflows in the DB (clean slate) — or delete them before starting
> - Browser at http://localhost:4000
> - Terminal window ready with splits if possible: one for docker logs, one for API calls
> - Screen recording at 1920x1080, 60fps recommended

---

## Section 1: Hook & Architecture (0:00 – 1:30)

| Time | Screen | Narration |
|------|--------|-----------|
| 0:00 | Full-screen browser showing the Dashboard at localhost:4000. The page shows stat cards (0 Agents, 0 Workflows, 0 Executions, 0 Active) and the quick-action grid. Cursor moves naturally over the UI elements. | **"This is the Agent Orchestration Platform — a full-stack system for creating, configuring, and running multi-agent AI workflows. You build workflows visually, agents execute on a real LangGraph runtime, and everything runs locally with a single docker-compose command."** |
| 0:20 | Cut to the architecture diagram (`docs/architecture.svg`) displayed full-screen. Animate a pointer or overlay boxes as each layer is mentioned. | **"The platform has six layers. On the frontend, Next.js 14 with a React Flow drag-and-drop canvas lets you design workflows visually. The backend is FastAPI with Pydantic validation and SQLAlchemy 2.0 async. The agent runtime uses LangGraph StateGraph — the visual graph you draw becomes the actual execution graph. For storage we have PostgreSQL with Alembic migrations and Redis for session state. Langfuse provides self-hosted LLM observability — token counts, cost tracking, latency per step. And Telegram integration gives you an async messaging channel to trigger workflows from a bot."** |
| 1:00 | As the narrator speaks about the stack, overlay the docker-compose.yml services list (backend, frontend, langfuse, etc.) | **"The entire platform runs in seven Docker containers — backend API, frontend, Langfuse for observability, its own PostgreSQL database, a Telegram bot service, Redis, and an optional LangGraph Server for advanced checkpointing. All of it starts with one command."** |
| 1:15 | Fade back to the dashboard. | **"Let me show you how it works, from zero to a running multi-agent workflow in under two minutes."** |

---

## Section 2: One-Command Setup (1:30 – 2:30)

| Time | Screen | Narration |
|------|--------|-----------|
| 1:30 | Switch to terminal. Run `docker compose up` (already running or a fast cut shows the containers starting). Show the logs streaming in — highlight green "started" messages for backend, frontend, langfuse. | **"Everything starts with docker compose up. The backend, frontend, Langfuse, and database all spin up together. Migrations run automatically on startup."** |
| 1:45 | Run the API health checks from the README one by one: | **"Once the services are up, we can verify everything is healthy."** |
| 1:48 | `curl http://localhost:8000/health` → `{"status": "ok"}` | **"Backend health check passes."** |
| 1:52 | `curl http://localhost:4000` → `200` | **"Frontend is serving."** |
| 1:55 | `curl http://localhost:8000/api/v1/agents/presets` → shows presets list | **"Agent presets are loaded from JSON files — no database needed for these."** |
| 2:00 | `curl http://localhost:8000/api/v1/workflows/templates` → shows templates | **"Workflow templates are ready to use."** |
| 2:05 | `docker compose exec backend alembic current` → shows "(head)" | **"And database migrations are applied."** |
| 2:10 | Cut back to the browser at localhost:4000. | **"The platform is ready. Let's build something."** |

---

## Section 3: Research Report Pipeline — Agent Presets & First Demo (2:30 – 4:30)

| Time | Screen | Narration |
|------|--------|-----------|
| 2:30 | Navigate to **Agents** page (`/agents`). Scroll down to the "Start from a Preset" section. Pointer hovers over the preset cards. | **"The Agents page shows all your configured agents and a library of pre-built agent presets. These are fully configured role templates — you just pick one and it's ready to go."** |
| 2:42 | Click the **🔍 Researcher** preset card. The New Agent form opens pre-filled with name, role, system prompt, provider, model, and tools. Click **Create Agent**. | **"Let's create a Researcher. One click opens the form pre-filled with role, system prompt, provider, and tools. Just hit Create Agent."** |
| 2:55 | Click the **✍️ Writer** preset card. Click **Create Agent**. | **"Same for the Writer — one click."** |
| 3:02 | Navigate to **Workflows → New** (`/workflows/new`). Select **Research Report Pipeline** from the template gallery. Canvas populates with two agent nodes connected by an arrow. Both show amber ⚠ badges. | **"Now let's build a workflow. We select the Research Report Pipeline template — it comes with two nodes already placed and connected. The amber badges mean no agent is assigned yet."** |
| 3:18 | Click the first (Researcher) node. The Node Config Panel slides in from the right. Select the Researcher agent from the dropdown. Click **Assign Agent**. | **"Click a node, select which agent it should use from the dropdown, and assign it."** |
| 3:30 | Repeat for the Writer node. Assign the Writer agent. Both badges disappear. | **"Do the same for the Writer. Now both nodes are configured."** |
| 3:38 | Click **▶ Run** in the toolbar. A modal appears. Type: `"Research the latest advances in quantum computing and write a structured 500-word report"`. Click **▶ Run Workflow**. | **"Now we run it. Type any task — the Researcher will research, then pass findings to the Writer who produces the final report."** |
| 3:52 | Watch the canvas. The first (Researcher) node turns **blue** (running), then **green** (done). Then the Writer node does the same. A blue banner appears at the top saying "Workflow is running". | **"Watch the canvas — each agent node lights up in real time as it executes. Blue means running, green means complete. This is LangGraph streaming per-step events through our WebSocket."** |
| 4:08 | Click **"View live →"** in the blue banner. The execution detail page opens. Show the **Final Result** card at the top with the Writer's output. | **"Click View live to see the full execution detail. The final result is displayed prominently."** |
| 4:15 | Click the **Messages** tab. Show the inter-agent conversation — the human message, the Researcher's research, the Writer's draft. | **"The Messages tab shows every message exchanged between agents — fully persisted to PostgreSQL."** |
| 4:22 | Click the **Traces** tab. Show Langfuse trace data if available (or the setup guide if not configured). | **"The Traces tab fetches Langfuse observability data — token counts, latency, and cost per LLM call, all in one place without switching dashboards."** |

---

## Section 4: Customer Support Triage — Conditional Routing (4:30 – 6:30)

| Time | Screen | Narration |
|------|--------|-----------|
| 4:30 | Navigate to **Agents** (`/agents`). Scroll to the "Start from a Preset" section. | **"Now let me show the more advanced use case — conditional routing. This is where the platform really stands out."** |
| 4:38 | Click **🗂️ Classifier** → Create Agent. Click **🔧 Technical Support** → Create Agent. Click **💳 Billing Support** → Create Agent. Click **💬 General Support** → Create Agent. Do each quickly in sequence. | **"We need four agents for this. Let me create all four from presets quickly."** |
| 4:50 | Navigate to **Workflows → New**. Select **Customer Support Triage**. The canvas shows a Classifier node connected via three labeled edges (`technical`, `billing`, `general`) to three specialist nodes. Point to the edge labels. | **"The Customer Support Triage template is different — it has conditional routing. The Classifier node has three outgoing edges, each with a label: technical, billing, and general. These labels become LangGraph conditional routing rules."** |
| 5:08 | Click the Classifier node → assign the Classifier agent. Assign each specialist node to its matching agent. | **"Assign each node to its corresponding agent. The Classifier is a routing agent that outputs a JSON category."** |
| 5:22 | Click **▶ Run**. Enter: `"I was charged twice for my subscription this month"`. Click **▶ Run Workflow**. | **"Now let's test with a billing query. The classifier should route this to the Billing Support agent."** |
| 5:35 | Watch the canvas: only two nodes execute — Classifier turns blue then green, then Billing Support turns blue then green. The Technical and General nodes stay untouched. | **"Notice — only two of the four agents executed. The Classifier ran, determined this is a billing issue, and LangGraph's conditional edge router matched the 'billing' label. The other two agents were never invoked. That's live conditional branching, not a simulated path."** |
| 5:50 | Show the execution detail. Point to the Live Log events: `step_start` and `step_complete` for exactly two agents. | **"The Live Log confirms it — just the Classifier and Billing Support ran. This is real graph-based conditional routing, not a code-based workaround."** |
| 6:02 | Hover over the edge connecting Classifier → Billing Support on the canvas. | **"In CrewAI or AutoGen you'd need custom routing logic. Here, the visual edge label IS the routing rule — it maps directly to LangGraph's add_conditional_edges."** |
| 6:15 | Quick zoom-out on the canvas to show the full triage graph. | **"This is the key differentiator: the visual graph you draw is the execution graph. No translation layer, no config duplication."** |

---

## Section 5: Telegram & Schedule Triggers (6:30 – 8:00)

| Time | Screen | Narration |
|------|--------|-----------|
| 6:30 | Open the Research Report workflow again (navigate to it). Drag a **Telegram Trigger** node from the left palette onto the canvas. Connect its handle to the Researcher node. | **"Beyond manual runs, workflows can be triggered externally. Drag a Telegram Trigger node from the palette onto the canvas."** |
| 6:45 | Click the Telegram Trigger node. The config panel opens. Show the bot username and token fields. Enter bot username. Click **Save**. Click the main **Save** button on the toolbar. | **"Configure it with your bot's details. The token can be set globally in Settings or overridden per node. Save the workflow and the trigger is registered in the database."** |
| 7:00 | Switch to the **Settings** page (`/settings`). Show the telegram_bot_token field already filled (masked as `***`). | **"Credentials are stored in the database, not just environment variables. You can update them at runtime through the Settings page without restarting anything."** |
| 7:10 | Show a Telegram chat window (phone or web). Send a message to the bot: `"Research Python async patterns"`. | **"When a user sends a message to the bot, the ChannelRouter looks up which workflow has an active Telegram trigger and routes the message there."** |
| 7:25 | Cut back to the browser. Navigate to **Executions** — show the new execution appeared. Click into it and show the result. | **"A new execution appears automatically. The bot replies with the Writer's output. This uses LangGraph's thread_id feature — each Telegram user gets their own persistent conversation history via AsyncPostgresSaver."** |
| 7:40 | Go back to the workflow canvas. Drag a **Schedule Trigger** node. Connect it. Click it and enter cron: `0 9 * * *`. Enter an input message. Save. | **"You can also schedule workflows. Drag a Schedule Trigger, set a cron expression — for example, daily at 9 AM — and the task registers with APScheduler automatically."** |
| 7:55 | Show the terminal with an API call to verify: `curl -X POST http://localhost:8000/api/v1/executions` with a quick manual run. | **"Scheduled jobs, Telegram messages, and direct API calls all converge on the same execution engine."** |

---

## Section 6: Wrap-Up & Call to Action (8:00 – 9:00)

| Time | Screen | Narration |
|------|--------|-----------|
| 8:00 | Show the agent configuration form in full — scroll through all the fields: provider, model, temperature, top_p, tools, channels, memory, guardrails, schedule. Overlay a counter: "25+ configurable dimensions per agent". | **"Every agent has 25+ independently configurable dimensions — from the LLM provider and model to individual tool toggles, channel routing, memory persistence, guardrails, and cron scheduling."** |
| 8:15 | Briefly scroll through the README's competitive analysis table. Highlight the key rows: visual builder, conditional routing, self-hosted observability, 25+ dimensions. | **"Compared to alternatives like CrewAI, AutoGen, or n8n, this platform is the only one that combines a visual graph builder, per-step streaming observability, self-hosted token and cost tracking, and this level of agent configurability — all running locally with one command."** |
| 8:30 | Show the GitHub repo page (actual or mockup). Point to the Star button and the clone URL. | **"The full source is on GitHub. Star it, fork it, submit a PR — contributions are welcome. The extension guide in the README covers adding new tools, messaging channels, workflow templates, and agent presets."** |
| 8:45 | Fade to a summary card with key links: GitHub repo, docs URL, demo video link. | **"Thanks for watching. Links are in the description. If you have questions or want to discuss the architecture further, feel free to reach out."** |
| 9:00 | End screen. | |

---

## Appendix: Recording Notes

### Screen Setup
- **Resolution:** 1920x1080 minimum
- **Browser:** Chrome/Edge with dark mode disabled for clarity (the app has dark mode, but light mode records better)
- **Terminal:** Use a clean theme with good contrast (e.g., Solarized Light or a minimal dark theme)
- **Font size:** Terminal font 14-16pt, browser at 100% zoom

### Audio Tips
- Use a decent USB microphone or a headset
- Record narration separately from screen capture (record screen with no audio, then record voiceover)
- Speak at a measured pace — the script timing assumes normal conversational speed
- Pause 1-2 seconds between major transitions

### Editing Cuts
The script has natural cut points between sections. Consider recording each section as a separate take and stitching them together:
1. Architecture (can re-record freely since it's just diagram + voice)
2. Setup (terminal work — record in one take)
3. Research Report (UI interaction — best to record in one continuous take)
4. Support Triage (separate continuous take)
5. Telegram + Schedule (two short takes)
6. Wrap-up (single take over highlights)

### Post-Production Checklist
- [ ] Add subtle background music (low volume, royalty-free)
- [ ] Add text overlays for key numbers ("25+ dimensions", "7 tools", "48 tests")
- [ ] Add zoom/pan effects on the architecture diagram during Section 1
- [ ] Add a highlight ring or cursor emphasis during canvas interactions
- [ ] Blur or mask any personal API keys or tokens that accidentally appear on screen
- [ ] Add chapter markers in the YouTube description
- [ ] Thumbnail: dashboard screenshot with a "Build Multi-Agent Workflows" overlay
