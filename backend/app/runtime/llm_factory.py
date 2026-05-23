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

        case _:
            raise ValueError(f"Unsupported LLM provider: {provider}")
