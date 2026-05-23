"""Calculator tool for mathematical expressions."""

import numexpr
from langchain_core.tools import Tool


def evaluate_expression(expression: str) -> str:
    """Evaluate a mathematical expression safely using numexpr.

    Args:
        expression: Math expression to evaluate (e.g., "2 + 2 * 3")

    Returns:
        Result of the calculation as a string
    """
    try:
        # Only allow safe mathematical operations
        result = numexpr.evaluate(expression)
        return str(result)
    except Exception as e:
        return f"Error evaluating expression: {str(e)}"


def create_calculator_tool() -> Tool:
    """Create a calculator tool for mathematical expressions.

    Returns:
        Configured calculator tool for agents
    """
    return Tool(
        name="calculator",
        description="Perform mathematical calculations. Input should be a math expression (e.g., '2 + 2 * 3').",
        func=evaluate_expression,
    )
