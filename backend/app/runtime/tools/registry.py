"""Tool registry for all available agent tools."""

from typing import Callable

from langchain_core.tools import Tool

from app.enums import AgentTool
from app.runtime.tools.calculator import create_calculator_tool
from app.runtime.tools.file_ops import create_file_read_tool, create_file_write_tool
from app.runtime.tools.web_search import create_web_search_tool
from app.runtime.tools.weather import create_weather_tool

# Tool factory registry - maps AgentTool enum to tool creation functions
TOOL_FACTORY_REGISTRY: dict[AgentTool, Callable[[], Tool]] = {
    AgentTool.WEB_SEARCH: create_web_search_tool,
    AgentTool.CALCULATOR: create_calculator_tool,
    AgentTool.FILE_READ: create_file_read_tool,
    AgentTool.FILE_WRITE: create_file_write_tool,
    AgentTool.WEATHER: create_weather_tool,
}


def resolve_tools(tool_names: list[AgentTool] | list[str]) -> list[Tool]:
    """Resolve tool names to Tool instances.

    Args:
        tool_names: List of tool names as AgentTool enums or strings

    Returns:
        List of initialized Tool instances

    Raises:
        ValueError: If any tool name is not recognized
    """
    tools = []

    for tool_name in tool_names:
        # Convert string to enum if needed
        if isinstance(tool_name, str):
            try:
                tool_enum = AgentTool(tool_name)
            except ValueError:
                raise ValueError(f"Unknown tool: {tool_name}")
        else:
            tool_enum = tool_name

        # Get tool factory and create tool
        if tool_enum not in TOOL_FACTORY_REGISTRY:
            raise ValueError(f"Tool not implemented: {tool_enum}")

        tool_factory = TOOL_FACTORY_REGISTRY[tool_enum]
        tools.append(tool_factory())

    return tools


def get_available_tools() -> list[str]:
    """Get list of all available tool names.

    Returns:
        List of available tool names
    """
    return [tool.value for tool in AgentTool]
