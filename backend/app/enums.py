from enum import StrEnum


class LLMProvider(StrEnum):
    """LLM provider options."""
    OLLAMA = "ollama"
    OPENROUTER = "openrouter"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    GLM51 = "glm51"  # Z.ai cloud API
    GLM51_LOCAL = "glm51-local"  # Local inference (vLLM/llama.cpp)


class AgentTool(StrEnum):
    """Available tools for agents."""
    WEB_SEARCH = "web_search"
    CALCULATOR = "calculator"
    FILE_READ = "file_read"
    FILE_WRITE = "file_write"
    WEATHER = "weather"
    CODE_EXECUTOR = "code_executor"
    HTTP_REQUEST = "http_request"


class MessageChannel(StrEnum):
    """Communication channels for agents."""
    WEB = "web"
    TELEGRAM = "telegram"
    API = "api"


class MessageType(StrEnum):
    """Types of messages in the system."""
    USER_INPUT = "user_input"
    AGENT_RESPONSE = "agent_response"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    SYSTEM = "system"


class ExecutionStatus(StrEnum):
    """Workflow execution status."""
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class WorkflowTemplate(StrEnum):
    """Pre-built workflow templates."""
    RESEARCH_REPORT = "research_report"
    CUSTOMER_SUPPORT = "customer_support"
