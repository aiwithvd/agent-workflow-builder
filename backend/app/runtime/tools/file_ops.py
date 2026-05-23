"""File operations tools for agents with path sandboxing."""

import json
from pathlib import Path

from langchain_core.tools import Tool

# Sandboxed directory for file operations
FILES_DIR = Path(__file__).parent.parent.parent.parent / "files"
FILES_DIR.mkdir(exist_ok=True)


def read_file(path: str) -> str:
    """Read a file from the sandboxed directory.

    Args:
        path: Relative path within the files directory

    Returns:
        File contents as string
    """
    try:
        full_path = (FILES_DIR / path).resolve()

        # Security: Ensure path is within FILES_DIR
        if not str(full_path).startswith(str(FILES_DIR)):
            return "Error: Path is outside allowed directory"

        if not full_path.exists():
            return f"Error: File not found: {path}"

        with open(full_path, "r") as f:
            return f.read()

    except Exception as e:
        return f"Error reading file: {str(e)}"


def write_file(path: str, content: str) -> str:
    """Write content to a file in the sandboxed directory.

    Args:
        path: Relative path within the files directory
        content: Content to write

    Returns:
        Success or error message
    """
    try:
        full_path = (FILES_DIR / path).resolve()

        # Security: Ensure path is within FILES_DIR
        if not str(full_path).startswith(str(FILES_DIR)):
            return "Error: Path is outside allowed directory"

        # Create parent directories if needed
        full_path.parent.mkdir(parents=True, exist_ok=True)

        with open(full_path, "w") as f:
            f.write(content)

        return f"Successfully wrote to {path}"

    except Exception as e:
        return f"Error writing file: {str(e)}"


def write_file_from_json(input_str: str) -> str:
    """Parse JSON input and write to file.

    Args:
        input_str: JSON string with 'path' and 'content' keys

    Returns:
        Success or error message
    """
    try:
        data = json.loads(input_str)
        return write_file(data["path"], data["content"])
    except json.JSONDecodeError:
        return "Error: Invalid JSON input"
    except KeyError:
        return "Error: Input must have 'path' and 'content' keys"


def create_file_read_tool() -> Tool:
    """Create a file read tool for agents.

    Returns:
        Configured file read tool
    """
    return Tool(
        name="file_read",
        description="Read a text file from the sandboxed directory. Input should be the relative file path.",
        func=read_file,
    )


def create_file_write_tool() -> Tool:
    """Create a file write tool for agents.

    Returns:
        Configured file write tool
    """
    return Tool(
        name="file_write",
        description='Write content to a file in the sandboxed directory. Input should be JSON with "path" and "content" keys.',
        func=write_file_from_json,
    )
