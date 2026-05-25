"""Code execution tool for agents."""

import io
import contextlib
from langchain_core.tools import Tool


def execute_code(code: str) -> str:
    """Execute Python code and return the output.

    Args:
        code: Python code to execute

    Returns:
        stdout output from the code, or an error message
    """
    try:
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            exec(code, {"__builtins__": __builtins__})  # noqa: S102
        return buf.getvalue().strip() or "Code executed (no output)"
    except Exception as e:
        return f"Code execution error: {e}"


def create_code_executor_tool() -> Tool:
    """Create a Python code execution tool."""
    return Tool(
        name="code_executor",
        description=(
            "Execute Python code and return the output. "
            "Input should be valid Python code. "
            "Examples: 'print(2 ** 10)', 'for i in range(5): print(i)'. "
            "Returns stdout output or an error message."
        ),
        func=execute_code,
    )
