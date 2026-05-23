"""Graph builder for constructing LangGraph from workflow definitions."""

from typing import Any

from langgraph.graph import StateGraph, END

from app.runtime.llm_factory import create_llm
from app.runtime.supervisor import create_specialist_agent, create_supervisor_agent
from app.enums import LLMProvider


def build_graph_from_definition(
    workflow_definition: dict,
    agents_config: dict,
) -> Any:
    """Build a LangGraph StateGraph from workflow definition.

    Args:
        workflow_definition: React Flow graph {nodes, edges}
        agents_config: Dict mapping agent names to their configs

    Returns:
        Compiled LangGraph ready for execution
    """
    nodes = workflow_definition.get("nodes", [])
    edges = workflow_definition.get("edges", [])

    # For now, create a simple sequential graph
    # In production, this would analyze the full graph structure

    graph = StateGraph(dict)

    # Add nodes for each agent
    agents = {}
    for node in nodes:
        node_id = node.get("id")
        agent_config = agents_config.get(node_id)

        if not agent_config:
            continue

        # Create LLM
        provider = agent_config.get("provider", LLMProvider.OLLAMA)
        model = agent_config.get("model", "llama3.2")
        llm = create_llm(provider, model)

        # Create agent
        role = agent_config.get("role", "Assistant")
        system_prompt = agent_config.get("system_prompt", "You are a helpful assistant.")
        tools = agent_config.get("tools", [])

        agent = create_specialist_agent(
            llm=llm,
            role=role,
            system_prompt=system_prompt,
            tools=tools,
        )

        agents[node_id] = agent

        # Add node to graph
        async def process_node(state: dict, agent_key=node_id) -> dict:
            """Process a node with its agent."""
            agent = agents[agent_key]
            messages = state.get("messages", [])

            # Invoke agent
            result = agent.invoke({"messages": messages})

            # Update state with result
            state["messages"] = result.get("messages", messages)
            state["current_agent"] = agent_key

            return state

        graph.add_node(node_id, process_node)

    # Add edges
    for edge in edges:
        source = edge.get("source")
        target = edge.get("target")
        if source and target:
            graph.add_edge(source, target)

    # Set entry and exit points
    first_node = nodes[0]["id"] if nodes else None
    if first_node:
        graph.set_entry_point(first_node)

    last_node = nodes[-1]["id"] if nodes else None
    if last_node:
        graph.add_edge(last_node, END)

    # Compile and return
    return graph.compile()
