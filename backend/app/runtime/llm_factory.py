"""LLM factory for creating language models based on provider."""

import logging

from langchain_core.language_models import BaseChatModel
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

from app.config import settings
from app.enums import LLMProvider

logger = logging.getLogger(__name__)

_DEFAULT_TEMPERATURE = 0.7


def create_llm(
    provider: LLMProvider | str,
    model: str,
    *,
    temperature: float | None = None,
    top_p: float | None = None,
    presence_penalty: float | None = None,
    frequency_penalty: float | None = None,
) -> BaseChatModel:
    """Create an LLM instance based on provider and model name.

    Args:
        provider: LLMProvider enum or string ("ollama", "openrouter", etc.)
        model: Model identifier (e.g., "llama3.2", "gpt-4o")
        temperature: Sampling temperature 0.0–2.0 (None → default 0.7)
        top_p: Nucleus sampling threshold 0.0–1.0
        presence_penalty: Presence penalty -2.0–2.0 (OpenAI-compatible only)
        frequency_penalty: Frequency penalty -2.0–2.0 (OpenAI-compatible only)

    Returns:
        Initialized LLM instance ready for use
    """
    provider = LLMProvider(provider) if isinstance(provider, str) else provider
    temp = temperature if temperature is not None else _DEFAULT_TEMPERATURE

    # OpenAI-compatible extra kwargs (only pass if explicitly set)
    openai_extra: dict = {}
    if top_p is not None:
        openai_extra["top_p"] = top_p
    if presence_penalty is not None:
        openai_extra["presence_penalty"] = presence_penalty
    if frequency_penalty is not None:
        openai_extra["frequency_penalty"] = frequency_penalty

    match provider:
        case LLMProvider.OLLAMA:
            ollama_extra: dict = {}
            if top_p is not None:
                ollama_extra["top_p"] = top_p
            return ChatOllama(
                model=model,
                base_url=settings.ollama_url,
                temperature=temp,
                **ollama_extra,
            )

        case LLMProvider.OPENROUTER:
            if not settings.openrouter_api_key:
                raise ValueError("OpenRouter API key not set in environment")

            return ChatOpenAI(
                model=model,
                base_url="https://openrouter.ai/api/v1",
                api_key=settings.openrouter_api_key,
                temperature=temp,
                **openai_extra,
            )

        case LLMProvider.GLM51:
            if not settings.z_ai_api_key:
                raise ValueError(
                    "Z.ai API key not set. Set Z_AI_API_KEY environment variable "
                    "to use GLM-5.1 cloud API. Get it from https://z.ai"
                )

            logger.info(
                "Creating GLM-5.1 LLM: base_url=%s model=%s "
                "(will call %s/chat/completions)",
                settings.z_ai_base_url, model, settings.z_ai_base_url,
            )
            return ChatOpenAI(
                model=model,
                base_url=settings.z_ai_base_url,
                api_key=settings.z_ai_api_key,
                temperature=temp,
                **openai_extra,
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
                temperature=temp,
                **openai_extra,
            )

        case _:
            raise ValueError(f"Unsupported LLM provider: {provider}")
