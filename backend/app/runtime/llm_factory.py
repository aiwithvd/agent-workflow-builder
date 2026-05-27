"""LLM factory for creating language models based on provider."""

import logging

from langchain_core.language_models import BaseChatModel
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

from app.config import settings
from app.enums import LLMProvider
from app.runtime.sync_utils import get_platform_setting

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

    API keys are resolved from the platform_settings DB table first (values
    saved via the Settings UI), then fall back to environment variables.

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
            ollama_url = get_platform_setting("ollama_url") or settings.ollama_url
            ollama_extra: dict = {}
            if top_p is not None:
                ollama_extra["top_p"] = top_p
            return ChatOllama(
                model=model,
                base_url=ollama_url,
                temperature=temp,
                **ollama_extra,
            )

        case LLMProvider.OPENROUTER:
            api_key = get_platform_setting("openrouter_api_key") or settings.openrouter_api_key
            if not api_key:
                raise ValueError(
                    "OpenRouter API key not set. Configure it in Settings or set OPENROUTER_API_KEY env var."
                )
            return ChatOpenAI(
                model=model,
                base_url="https://openrouter.ai/api/v1",
                api_key=api_key,
                temperature=temp,
                **openai_extra,
            )

        case LLMProvider.OPENAI:
            api_key = get_platform_setting("openai_api_key") or settings.openai_api_key
            if not api_key:
                raise ValueError(
                    "OpenAI API key not set. Configure it in Settings or set OPENAI_API_KEY env var."
                )
            return ChatOpenAI(
                model=model,
                api_key=api_key,
                temperature=temp,
                **openai_extra,
            )

        case LLMProvider.ANTHROPIC:
            api_key = get_platform_setting("anthropic_api_key") or settings.anthropic_api_key
            if not api_key:
                raise ValueError(
                    "Anthropic API key not set. Configure it in Settings or set ANTHROPIC_API_KEY env var."
                )
            try:
                from langchain_anthropic import ChatAnthropic
            except ImportError:
                raise ImportError(
                    "langchain-anthropic package required. Install with: pip install langchain-anthropic"
                )
            anthropic_extra: dict = {}
            if top_p is not None:
                anthropic_extra["top_p"] = top_p
            return ChatAnthropic(
                model=model,
                api_key=api_key,
                temperature=temp,
                **anthropic_extra,
            )

        case LLMProvider.GOOGLE:
            api_key = get_platform_setting("google_api_key") or settings.google_api_key
            if not api_key:
                raise ValueError(
                    "Google API key not set. Configure it in Settings or set GOOGLE_API_KEY env var."
                )
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
            except ImportError:
                raise ImportError(
                    "langchain-google-genai package required. Install with: pip install langchain-google-genai"
                )
            return ChatGoogleGenerativeAI(
                model=model,
                google_api_key=api_key,
                temperature=temp,
            )

        case LLMProvider.GLM51:
            api_key = get_platform_setting("z_ai_api_key") or settings.z_ai_api_key
            base_url = get_platform_setting("z_ai_base_url") or settings.z_ai_base_url
            if not api_key:
                raise ValueError(
                    "Z.ai API key not set. Configure it in Settings or set Z_AI_API_KEY env var. "
                    "Get it from https://z.ai"
                )
            logger.info(
                "Creating GLM-5.1 LLM: base_url=%s model=%s "
                "(will call %s/chat/completions)",
                base_url, model, base_url,
            )
            return ChatOpenAI(
                model=model,
                base_url=base_url,
                api_key=api_key,
                temperature=temp,
                **openai_extra,
            )

        case LLMProvider.GLM51_LOCAL:
            local_url = get_platform_setting("glm51_local_url") or settings.glm51_local_url
            if not local_url:
                raise ValueError(
                    "GLM-5.1 local endpoint URL not set. Set GLM51_LOCAL_URL environment variable "
                    "to point to your vLLM or llama.cpp server (e.g., http://localhost:8000/v1)"
                )
            return ChatOpenAI(
                model=model,
                base_url=local_url,
                api_key="not-needed",  # Local inference doesn't require API key
                temperature=temp,
                **openai_extra,
            )

        case _:
            raise ValueError(f"Unsupported LLM provider: {provider}")
