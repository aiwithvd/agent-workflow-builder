"""LangGraph Supervisor agent for orchestrating multi-agent workflows."""

from typing import Any

from langchain_core.language_model import BaseLLM
from langchain_core.messages import BaseMessage, HumanMessage
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import create_react_agent

from app.runtime.tools.registry import resolve_tools
from app.enums import AgentTool


def create_supervisor_agent(
    llm: BaseLLM,
    agent_names: list[str],
    tools: list[AgentTool] | list[str] | None = None,
) -> Any:
    """Create a supervisor agent that coordinates other agents.

    Args:
        llm: Language model to use
        agent_names: Names of agents that this supervisor can route to
        tools: Optional tools available to supervisor

    Returns:
        Configured supervisor agent
    """
    tool_list = []
    if tools:
        tool_list = resolve_tools(tools)

    system_prompt = f"""You are a helpful supervisor agent that coordinates work between multiple specialist agents.

You have access to the following agents:
{', '.join(agent_names)}

When a user provides a task, analyze it and decide which agent(s) should handle it.
You can use multiple agents in sequence if needed. After receiving responses from agents,
synthesize the results into a clear, helpful response for the user.

Always explain your reasoning for routing tasks to specific agents."""

    return create_react_agent(
        llm,
        tools=tool_list,
        system_prompt=system_prompt,
    )


def create_specialist_agent(
    llm: BaseLLM,
    role: str,
    system_prompt: str,
    tools: list[AgentTool] | list[str] | None = None,
) -> Any:
    """Create a specialist agent for a specific role.

    Args:
        llm: Language model to use
        role: Role/title of the specialist
        system_prompt: Custom system prompt for this agent
        tools: Tools available to this agent

    Returns:
        Configured specialist agent
    """
    tool_list = []
    if tools:
        tool_list = resolve_tools(tools)

    # Enhance system prompt with role information
    enhanced_prompt = f"""You are a {role}.

{system_prompt}

Be concise, professional, and focused on your specific expertise.
If asked about something outside your domain, be honest about the limitation."""

    return create_react_agent(
        llm,
        tools=tool_list,
        system_prompt=enhanced_prompt,
    )
