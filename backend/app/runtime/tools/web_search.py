"""DuckDuckGo web search tool for agents."""

from langchain_community.tools import DuckDuckGoSearchRun
from langchain_core.tools import Tool


def create_web_search_tool() -> Tool:
    """Create a DuckDuckGo web search tool.

    Returns:
        Configured web search tool for agents
    """
    search = DuckDuckGoSearchRun()

    # IMPORTANT: do NOT pass search.run directly as func.
    # DuckDuckGoSearchRun.run inherits BaseTool.run which has
    # `run_id: Optional[uuid.UUID]` in its signature.  LangGraph's ToolNode
    # calls get_type_hints() on the func, which tries to evaluate "uuid.UUID"
    # in *this* module's globals — where uuid is not imported — causing a
    # NameError.  Wrapping in a plain local function with only str types
    # eliminates the annotation entirely and avoids the error.
    def web_search(query: str) -> str:
        return search.run(query)

    return Tool(
        name="web_search",
        description="Search the web for information using DuckDuckGo. Input should be a search query.",
        func=web_search,
    )
