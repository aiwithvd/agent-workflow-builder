"""HTTP request tool for agents."""

import json
import httpx
from langchain_core.tools import Tool


def make_http_request(input_str: str) -> str:
    """Make an HTTP GET request to a URL and return the response.

    Args:
        input_str: URL to request, optionally followed by JSON headers.
                   Format: "https://example.com" or "https://example.com | {\"Accept\": \"application/json\"}"

    Returns:
        Response body (truncated to 2000 chars) or error message
    """
    parts = input_str.split("|", 1)
    url = parts[0].strip()
    headers = {}

    if len(parts) > 1:
        try:
            headers = json.loads(parts[1].strip())
        except json.JSONDecodeError:
            pass

    if not url.startswith(("http://", "https://")):
        return "Error: URL must start with http:// or https://"

    try:
        with httpx.Client(timeout=15.0, follow_redirects=True) as client:
            response = client.get(url, headers=headers)
            content_type = response.headers.get("content-type", "")

            if "json" in content_type:
                try:
                    body = json.dumps(response.json(), indent=2)
                except Exception:
                    body = response.text
            else:
                body = response.text

            truncated = body[:2000]
            suffix = "... (truncated)" if len(body) > 2000 else ""
            return f"Status: {response.status_code}\n\n{truncated}{suffix}"

    except httpx.TimeoutException:
        return "Error: Request timed out after 15 seconds."
    except httpx.RequestError as e:
        return f"Error: {type(e).__name__}: {e}"


def create_http_request_tool() -> Tool:
    """Create an HTTP GET request tool."""
    return Tool(
        name="http_request",
        description=(
            "Make an HTTP GET request to a URL and return the response body. "
            "Input: a URL (e.g., 'https://api.example.com/data'). "
            "Optionally append headers as JSON after a pipe: 'https://api.example.com | {\"Authorization\": \"Bearer token\"}'. "
            "Returns the response status and body (truncated to 2000 characters)."
        ),
        func=make_http_request,
    )
