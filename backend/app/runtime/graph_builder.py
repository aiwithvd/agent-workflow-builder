"""Graph builder — converts React Flow workflow definitions into LangGraph StateGraphs."""

import logging
from typing import Any

from langgraph.graph import END, START, StateGraph

from app.enums import LLMProvider
from app.runtime.llm_factory import create_llm
from app.runtime.supervisor import create_specialist_agent

logger = logging.getLogger(__name__)

# Node types that are NOT agent nodes — they are pass-throughs or triggers.
# These are skipped when building the agent graph.
SKIP_NODE_TYPES = {"input", "output", "telegram_trigger", "schedule_trigger", "web_trigger"}

# Orchestration node types — treated as agent nodes but receive an enhanced
# system prompt that instructs the LLM to act as a router/coordinator.
ORCHESTRATION_TYPES = {"supervisor", "swarm"}

SUPERVISOR_SYSTEM_PROMPT = (
    "You are a supervisor agent. Your job is to read the user's request, "
    "reason about which specialist agent should handle it, then produce a "
    "clear task description for that agent. Be concise and directive."
)

SWARM_SYSTEM_PROMPT = (
    "You are a peer agent in a swarm. Read the conversation so far and "
    "either complete the task yourself or hand off to the most appropriate "
    "next agent. Always explain your handoff decision briefly."
)


def _topo_entry_exit(nodes: list[dict], edges: list[dict]) -> tuple[str | None, list[str]]:
    """Return (entry_node_id, [exit_node_ids]) by graph topology.

    Entry: nodes with no incoming edges.
    Exit: nodes with no outgoing edges (excluding 'output'-type pass-throughs).
    """
    all_ids = {n["id"] for n in nodes}
    has_incoming = {e["target"] for e in edges if e.get("target") in all_ids}
    has_outgoing = {e["source"] for e in edges if e.get("source") in all_ids}

    entry_candidates = [n["id"] for n in nodes if n["id"] not in has_incoming]
    exit_candidates = [n["id"] for n in nodes if n["id"] not in has_outgoing]

    # Prefer the first topological entry; fall back to first node
    entry = entry_candidates[0] if entry_candidates else (nodes[0]["id"] if nodes else None)
    exits = exit_candidates if exit_candidates else ([nodes[-1]["id"]] if nodes else [])

    return entry, exits


def build_graph_from_definition(
    workflow_definition: dict,
    agents_config: dict,
    checkpointer: Any = None,
) -> Any:
    """Build a compiled LangGraph from a React Flow workflow definition.

    Args:
        workflow_definition: React Flow graph {nodes, edges}
        agents_config: Mapping of node_id → agent config dict
        checkpointer: Optional LangGraph checkpointer (e.g. AsyncPostgresSaver)
                      for persistent conversation memory across runs.

    Returns:
        Compiled LangGraph ready for async invocation
    """
    nodes = workflow_definition.get("nodes", [])
    edges = workflow_definition.get("edges", [])

    if not nodes:
        raise ValueError("Workflow has no nodes")

    # Validate that at least one agent node with an assigned agentId exists.
    # This catches graphs made up only of trigger/input/output nodes.
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

    # Filter to agent nodes only (skip input/output/trigger pass-through nodes)
    agent_nodes = [n for n in nodes if n.get("type", "agent") not in SKIP_NODE_TYPES]
    if not agent_nodes:
        raise ValueError("Workflow has no agent nodes — add at least one agent to the canvas")

    # Rebuild edges filtered to agent nodes only; skip edges where either
    # endpoint is a non-agent (skip-type) node to avoid lookup crashes.
    agent_ids = {n["id"] for n in agent_nodes}
    agent_edges = [
        e for e in edges
        if e.get("source") in agent_ids and e.get("target") in agent_ids
        # Edges where source or target is a skip-type node are silently dropped.
        # This means input→agent or agent→output edges are not wired in the
        # StateGraph; the entry/exit points handle those boundaries instead.
    ]

    # Determine entry and exit points from topology
    entry_node, exit_nodes = _topo_entry_exit(agent_nodes, agent_edges)

    graph = StateGraph(dict)

    # Build agents and add graph nodes
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
        except Exception as e:
            raise ValueError(f"Cannot create LLM for node '{node_id}': {e}") from e

        # Orchestration nodes get an enhanced prompt if none is explicitly set
        node_type = node.get("type", "agent")
        if node_type == "supervisor" and not agent_cfg.get("system_prompt"):
            effective_prompt = SUPERVISOR_SYSTEM_PROMPT
        elif node_type == "swarm" and not agent_cfg.get("system_prompt"):
            effective_prompt = SWARM_SYSTEM_PROMPT
        else:
            effective_prompt = agent_cfg.get("system_prompt", "You are a helpful assistant.")

        agent = create_specialist_agent(
            llm=llm,
            role=agent_cfg.get("role", "Orchestrator" if node_type in ORCHESTRATION_TYPES else "Assistant"),
            system_prompt=effective_prompt,
            tools=agent_cfg.get("tools", []),
        )
        built_agents[node_id] = agent

        # Closure captures node_id correctly
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

    # ── Add edges ─────────────────────────────────────────────────────────────

    # Group edges by source to detect conditional branching
    edges_by_source: dict[str, list[dict]] = {}
    for e in agent_edges:
        src = e["source"]
        edges_by_source.setdefault(src, []).append(e)

    for source, out_edges in edges_by_source.items():
        if source not in built_agents:
            continue

        labeled = [e for e in out_edges if e.get("label")]

        if len(out_edges) == 1:
            # Simple sequential edge
            target = out_edges[0]["target"]
            if target in built_agents:
                graph.add_edge(source, target)

        elif labeled and len(labeled) == len(out_edges):
            # All edges have labels → conditional routing based on last_output
            route_map = {e["label"]: e["target"] for e in labeled if e["target"] in built_agents}

            def make_router(rm: dict, fallback: str):
                def router(state: dict) -> str:
                    last = str(state.get("last_output", "")).lower()
                    for label, target in rm.items():
                        if label.lower() in last:
                            return target
                    return fallback
                return router

            default_target = next(iter(route_map.values()))
            graph.add_conditional_edges(source, make_router(route_map, default_target), route_map)

        else:
            # Mixed or unlabeled multi-edges — add all as sequential (first wins)
            for e in out_edges:
                target = e["target"]
                if target in built_agents:
                    graph.add_edge(source, target)

    # ── Entry and exit points ─────────────────────────────────────────────────

    if entry_node and entry_node in built_agents:
        graph.set_entry_point(entry_node)
    else:
        # Fallback: use first built agent
        first = next(iter(built_agents))
        graph.set_entry_point(first)

    for exit_node in exit_nodes:
        if exit_node in built_agents:
            graph.add_edge(exit_node, END)

    return graph.compile(checkpointer=checkpointer)
