# Tools module

from langchain_core.tools import Tool

from app.runtime.tools.registry import TOOL_FACTORY_REGISTRY


def get_tools() -> list[Tool]:
    """Return all available tool instances.

    Returns:
        List of all initialized Tool instances
    """
    tools = []
    for tool_factory in TOOL_FACTORY_REGISTRY.values():
        try:
            tools.append(tool_factory())
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Failed to create tool: %s", e)
    return tools
