"""DuckDuckGo web search tool for agents."""

from langchain_community.tools import DuckDuckGoSearchRun
from langchain_core.tools import Tool


def create_web_search_tool() -> Tool:
    """Create a DuckDuckGo web search tool.

    Returns:
        Configured web search tool for agents
    """
    search = DuckDuckGoSearchRun()

    return Tool(
        name="web_search",
        description="Search the web for information using DuckDuckGo. Input should be a search query.",
        func=search.run,
    )
