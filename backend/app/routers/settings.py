"""Platform settings CRUD — GET all, PATCH individual keys."""

import logging
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.settings import PlatformSetting

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

# ─── Known settings catalogue ─────────────────────────────────────────────────
# key → (is_secret, description)
KNOWN_SETTINGS: dict[str, tuple[bool, str]] = {
    "telegram_bot_token": (True, "Telegram bot token (from @BotFather)"),
    "openrouter_api_key": (True, "OpenRouter API key"),
    "ollama_url": (False, "Ollama server URL (e.g. http://localhost:11434)"),
    "openweather_api_key": (True, "OpenWeatherMap API key for weather tool"),
    "langfuse_public_key": (False, "Langfuse public key for tracing"),
    "langfuse_secret_key": (True, "Langfuse secret key for tracing"),
    "langfuse_host": (False, "Langfuse host URL"),
}


# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class SettingRead(BaseModel):
    key: str
    value: str | None  # None or "***" if secret
    is_secret: bool
    description: str | None


class SettingWrite(BaseModel):
    key: str
    value: str


class SettingsBatch(BaseModel):
    settings: list[SettingWrite]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _mask(setting: PlatformSetting) -> SettingRead:
    """Return masked value for secrets."""
    masked = "***" if setting.is_secret and setting.value else setting.value
    return SettingRead(
        key=setting.key,
        value=masked,
        is_secret=setting.is_secret,
        description=setting.description,
    )


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("", response_model=list[SettingRead])
async def get_settings(db: AsyncSession = Depends(get_db)):
    """Return all settings. Secret values are masked as '***'."""
    result = await db.execute(select(PlatformSetting))
    rows = result.scalars().all()

    # Build map of existing DB rows
    db_map = {r.key: r for r in rows}

    # Merge with known catalogue so UI always shows all expected fields
    output: list[SettingRead] = []
    for key, (is_secret, desc) in KNOWN_SETTINGS.items():
        if key in db_map:
            output.append(_mask(db_map[key]))
        else:
            # Placeholder — not set yet
            output.append(SettingRead(key=key, value=None, is_secret=is_secret, description=desc))

    return output


@router.patch("", response_model=list[SettingRead])
async def update_settings(body: SettingsBatch, db: AsyncSession = Depends(get_db)):
    """Upsert one or more settings. Pass empty string value to clear."""
    for item in body.settings:
        is_secret, desc = KNOWN_SETTINGS.get(item.key, (False, None))
        existing = await db.get(PlatformSetting, item.key)
        if existing:
            existing.value = item.value or None
        else:
            db.add(PlatformSetting(
                key=item.key,
                value=item.value or None,
                is_secret=is_secret,
                description=desc,
            ))
    await db.commit()
    return await get_settings(db)


@router.get("/{key}/raw", include_in_schema=False)
async def get_raw_setting(key: str, db: AsyncSession = Depends(get_db)) -> Any:
    """Internal endpoint: return plaintext value for a known key (no mask).

    Used by other backend services (Telegram bot, executor) to read credentials.
    Not exposed in Swagger.
    """
    setting = await db.get(PlatformSetting, key)
    return {"key": key, "value": setting.value if setting else None}
