"""Meta-graph dispatcher for LangGraph Server.

LangGraph Server needs a static graph factory registered in langgraph.json.
But our graphs are built dynamically from React Flow JSON at runtime.

Solution: register ``make_graph`` as the factory — it accepts a RunnableConfig,
reads ``workflow_id`` from the config's ``configurable`` dict, fetches the
workflow definition from the DB, and returns a compiled graph with an
``AsyncPostgresSaver`` checkpointer attached for persistent conversation memory.

An LRU cache stores the *uncompiled* StateGraph objects so we avoid repeated
DB queries and LLM-agent construction for the same workflow.  The checkpointer
is attached at compile time (inside ``make_graph``) so each run gets its own
thread-scoped memory.

Cache invalidation: pass ``workflow_version`` (an integer) in the configurable
dict.  The cache key is ``(workflow_id, version)``.  Bumping the version forces
a full rebuild, e.g. when a workflow definition is saved.
"""
from __future__ import annotations

import asyncio
import concurrent.futures
import logging
from functools import lru_cache
from typing import Any

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph as CompiledGraph

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# DB helpers — only async_session is available in this project
# ---------------------------------------------------------------------------

async def _fetch_workflow_data(workflow_id: str) -> tuple[dict, dict]:
    """Fetch workflow graph_definition and resolved agent configs from the DB.

    Returns:
        (graph_definition, agents_config) where agents_config maps
        node_id -> agent attribute dict (same shape used by graph_builder).
    """
    from app.database import async_session
    from app.models.agent import Agent

    # Import Workflow lazily to avoid circular imports at module load time.
    # The models package re-exports everything from individual modules.
    from app.models.execution import Execution  # noqa: F401 — ensure models loaded
    try:
        from app.models.workflow import Workflow  # preferred direct import
    except ImportError:
        from app.models import Workflow  # fallback via __init__

    async with async_session() as db:
        workflow = await db.get(Workflow, workflow_id)
        if not workflow:
            raise ValueError(f"Workflow '{workflow_id}' not found")

        graph_def: dict = workflow.graph_definition or {}
        agents_config: dict[str, dict] = {}

        for node in graph_def.get("nodes", []):
            node_id = node.get("id")
            agent_id = node.get("data", {}).get("agentId")
            if node_id and agent_id:
                agent = await db.get(Agent, agent_id)
                if agent:
                    agents_config[node_id] = {
                        "id": str(agent.id),
                        "role": agent.role,
                        "system_prompt": agent.system_prompt,
                        "provider": agent.provider,
                        "model": agent.model,
                        "tools": agent.tools or [],
                    }

        return graph_def, agents_config


def _run_async_safely(coro) -> Any:
    """Run an async coroutine from a potentially-sync context.

    * If no event loop is running: use asyncio.run().
    * If an event loop IS running (e.g. inside uvicorn): submit to a fresh
      thread so we don't block the running loop.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop is not None and loop.is_running():
        # We're inside an async context — offload to a thread pool executor
        # so we can call asyncio.run() there without conflict.
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(asyncio.run, coro)
            return future.result()
    else:
        return asyncio.run(coro)


# ---------------------------------------------------------------------------
# Uncompiled graph cache
# ---------------------------------------------------------------------------

@lru_cache(maxsize=64)
def _cached_uncompiled_graph(workflow_id: str, version: int = 0) -> StateGraph:
    """Build and cache an *uncompiled* StateGraph for the given workflow.

    The cache key is ``(workflow_id, version)`` so callers can force a
    rebuild by incrementing ``version``.

    We cache the *uncompiled* StateGraph rather than the CompiledGraph so
    that ``make_graph`` can attach a checkpointer at compile time.
    """
    from app.runtime.graph_builder import (
        SKIP_NODE_TYPES,
        _topo_entry_exit,
    )
    from app.runtime.llm_factory import create_llm
    from app.runtime.supervisor import create_specialist_agent
    from app.enums import LLMProvider

    graph_def, agents_config = _run_async_safely(_fetch_workflow_data(workflow_id))

    nodes = graph_def.get("nodes", [])
    edges = graph_def.get("edges", [])

    if not nodes:
        raise ValueError("Workflow has no nodes")

    # Validate at least one agent node has an assigned agentId
    agent_node_ids = [
        n["id"] for n in nodes
        if n.get("type", "agent") not in SKIP_NODE_TYPES
        and n.get("data", {}).get("agentId")
    ]
    if not agent_node_ids:
        raise ValueError(
            "No agents configured in this workflow. "
            "Assign an agent to each node before running."
        )

    agent_nodes = [n for n in nodes if n.get("type", "agent") not in SKIP_NODE_TYPES]
    if not agent_nodes:
        raise ValueError("Workflow has no agent nodes")

    agent_ids = {n["id"] for n in agent_nodes}
    agent_edges = [
        e for e in edges
        if e.get("source") in agent_ids and e.get("target") in agent_ids
    ]

    entry_node, exit_nodes = _topo_entry_exit(agent_nodes, agent_edges)

    graph = StateGraph(dict)
    built_agents: dict[str, Any] = {}

    for node in agent_nodes:
        node_id = node["id"]
        agent_cfg = agents_config.get(node_id)
        if not agent_cfg:
            logger.warning("No agent config for node %s — skipping", node_id)
            continue

        try:
            llm = create_llm(
                agent_cfg.get("provider", LLMProvider.OLLAMA),
                agent_cfg.get("model", "llama3.2"),
            )
        except Exception as exc:
            raise ValueError(f"Cannot create LLM for node '{node_id}': {exc}") from exc

        agent = create_specialist_agent(
            llm=llm,
            role=agent_cfg.get("role", "Assistant"),
            system_prompt=agent_cfg.get("system_prompt", "You are a helpful assistant."),
            tools=agent_cfg.get("tools", []),
        )
        built_agents[node_id] = agent

        def make_node_fn(nid: str):
            def process_node(state: dict) -> dict:
                ag = built_agents[nid]
                messages = state.get("messages", [])
                try:
                    result = ag.invoke({"messages": messages})
                    state["messages"] = result.get("messages", messages)
                    state["current_agent"] = nid
                    state["last_output"] = result.get("output", "")
                except Exception as e:
                    logger.error("Node %s failed: %s", nid, e)
                    state["error"] = str(e)
                    state["current_agent"] = nid
                return state
            return process_node

        graph.add_node(node_id, make_node_fn(node_id))

    if not built_agents:
        raise ValueError("No agents could be built — check agent configurations and LLM providers")

    # Wire edges
    edges_by_source: dict[str, list[dict]] = {}
    for e in agent_edges:
        edges_by_source.setdefault(e["source"], []).append(e)

    for source, out_edges in edges_by_source.items():
        if source not in built_agents:
            continue
        labeled = [e for e in out_edges if e.get("label")]

        if len(out_edges) == 1:
            target = out_edges[0]["target"]
            if target in built_agents:
                graph.add_edge(source, target)

        elif labeled and len(labeled) == len(out_edges):
            route_map = {e["label"]: e["target"] for e in labeled if e["target"] in built_agents}

            def make_router(rm: dict, fallback: str):
                def router(state: dict) -> str:
                    last = str(state.get("last_output", "")).lower()
                    for label, tgt in rm.items():
                        if label.lower() in last:
                            return tgt
                    return fallback
                return router

            default_target = next(iter(route_map.values()))
            graph.add_conditional_edges(source, make_router(route_map, default_target), route_map)

        else:
            for e in out_edges:
                target = e["target"]
                if target in built_agents:
                    graph.add_edge(source, target)

    # Entry / exit
    if entry_node and entry_node in built_agents:
        graph.set_entry_point(entry_node)
    else:
        first = next(iter(built_agents))
        graph.set_entry_point(first)

    for exit_node in exit_nodes:
        if exit_node in built_agents:
            graph.add_edge(exit_node, END)

    logger.info(
        "Built uncompiled StateGraph for workflow %s (version %s, %d agents)",
        workflow_id, version, len(built_agents),
    )
    return graph


# ---------------------------------------------------------------------------
# Public factory — called by LangGraph Server once per run
# ---------------------------------------------------------------------------

async def make_graph(config: dict) -> CompiledGraph:
    """Per-run graph factory called by LangGraph Server.

    LangGraph Server calls this once per run.  The ``config`` dict contains:

    * ``config["configurable"]["workflow_id"]`` — UUID of the workflow to run
    * ``config["configurable"]["thread_id"]`` — thread ID for checkpointing
    * ``config["configurable"].get("workflow_version", 0)`` — cache-busting int

    Returns a compiled ``StateGraph`` with ``AsyncPostgresSaver`` attached so
    that conversation state is persisted across runs on the same ``thread_id``.

    Falls back to a plain compiled graph (no checkpointing) if Postgres is
    unavailable, rather than crashing the run entirely.
    """
    cfg = (config or {}).get("configurable", {})
    workflow_id = cfg.get("workflow_id")
    version = int(cfg.get("workflow_version", 0))

    if not workflow_id:
        raise ValueError(
            "config.configurable.workflow_id is required. "
            "Pass it when creating a LangGraph Server run."
        )

    # Retrieve the uncompiled StateGraph (LRU-cached by workflow_id + version)
    uncompiled: StateGraph = _cached_uncompiled_graph(str(workflow_id), version)

    # --- Attempt to attach AsyncPostgresSaver for persistent memory ----------
    checkpointer = None
    try:
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
        from app.config import settings

        # psycopg3 needs "postgresql://..." not SQLAlchemy's "postgresql+asyncpg://..."
        pg_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
        # Add timeout options so Supabase/Postgres statement_timeout doesn't kill DDL
        separator = "&" if "?" in pg_url else "?"
        pg_url = f"{pg_url}{separator}options=-c%20statement_timeout%3D300000&connect_timeout=10"
        checkpointer = AsyncPostgresSaver.from_conn_string(pg_url)
        await checkpointer.setup()
        logger.info(
            "AsyncPostgresSaver attached for workflow %s thread %s",
            workflow_id, cfg.get("thread_id", "<none>"),
        )
    except Exception as exc:
        logger.error(
            "Checkpointer unavailable for workflow %s — proceeding without "
            "persistent memory: %s",
            workflow_id, exc,
        )
        checkpointer = None

    # Compile with (or without) the checkpointer
    compiled: CompiledGraph = uncompiled.compile(checkpointer=checkpointer)
    return compiled
