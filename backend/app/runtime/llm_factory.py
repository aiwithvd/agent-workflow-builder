"""LLM factory for creating language models based on provider."""

from langchain_core.language_models import BaseChatModel
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

from app.config import settings
from app.enums import LLMProvider


def create_llm(provider: LLMProvider | str, model: str) -> BaseChatModel:
    """Create an LLM instance based on provider and model name.

    Args:
        provider: LLMProvider enum or string ("ollama" or "openrouter")
        model: Model identifier (e.g., "llama3.2", "gpt-4o")

    Returns:
        Initialized LLM instance ready for use
    """
    provider = LLMProvider(provider) if isinstance(provider, str) else provider

    match provider:
        case LLMProvider.OLLAMA:
            return ChatOllama(
                model=model,
                base_url=settings.ollama_url,
                temperature=0.7,
            )

        case LLMProvider.OPENROUTER:
            if not settings.openrouter_api_key:
                raise ValueError("OpenRouter API key not set in environment")

            return ChatOpenAI(
                model=model,
                openai_api_base="https://openrouter.ai/api/v1",
                openai_api_key=settings.openrouter_api_key,
                temperature=0.7,
            )

        case LLMProvider.GLM51:
            if not settings.z_ai_api_key:
                raise ValueError(
                    "Z.ai API key not set. Set Z_AI_API_KEY environment variable "
                    "to use GLM-5.1 cloud API. Get it from https://z.ai"
                )

            return ChatOpenAI(
                model=model,
                base_url=settings.z_ai_base_url,
                api_key=settings.z_ai_api_key,
                temperature=0.7,
            )

        case LLMProvider.GLM51_LOCAL:
            if not settings.glm51_local_url:
                raise ValueError(
                    "GLM-5.1 local endpoint URL not set. Set GLM51_LOCAL_URL environment variable "
                    "to point to your vLLM or llama.cpp server (e.g., http://localhost:8000/v1)"
                )

            return ChatOpenAI(
                model=model,
                base_url=settings.glm51_local_url,
                api_key="not-needed",  # Local inference doesn't require API key
                temperature=0.7,
            )

        case _:
            raise ValueError(f"Unsupported LLM provider: {provider}")
