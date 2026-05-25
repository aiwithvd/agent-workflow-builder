"""Tests for the platform settings API."""

import pytest


@pytest.mark.asyncio
async def test_get_settings_returns_catalogue(client):
    """GET /api/v1/settings returns all known setting keys."""
    resp = await client.get("/api/v1/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    # All known keys should be present even if not configured
    keys = {s["key"] for s in data}
    assert "telegram_bot_token" in keys
    assert "openrouter_api_key" in keys
    assert "ollama_url" in keys


@pytest.mark.asyncio
async def test_get_settings_secrets_are_null_when_unset(client):
    """Unset settings have null value."""
    resp = await client.get("/api/v1/settings")
    data = {s["key"]: s for s in resp.json()}
    # Not yet set → value is None
    assert data["telegram_bot_token"]["value"] is None


@pytest.mark.asyncio
async def test_update_non_secret_setting(client):
    """PATCH /api/v1/settings saves and returns non-secret value."""
    resp = await client.patch(
        "/api/v1/settings",
        json={"settings": [{"key": "ollama_url", "value": "http://custom:11434"}]},
    )
    assert resp.status_code == 200
    data = {s["key"]: s for s in resp.json()}
    assert data["ollama_url"]["value"] == "http://custom:11434"


@pytest.mark.asyncio
async def test_update_secret_setting_masked_on_read(client):
    """PATCH saves a secret; GET returns '***' not the raw value."""
    resp = await client.patch(
        "/api/v1/settings",
        json={"settings": [{"key": "openrouter_api_key", "value": "sk-super-secret"}]},
    )
    assert resp.status_code == 200
    data = {s["key"]: s for s in resp.json()}
    # Secret should be masked
    assert data["openrouter_api_key"]["value"] == "***"
    assert data["openrouter_api_key"]["is_secret"] is True


@pytest.mark.asyncio
async def test_update_multiple_settings(client):
    """PATCH can update multiple settings in one call."""
    resp = await client.patch(
        "/api/v1/settings",
        json={
            "settings": [
                {"key": "langfuse_host", "value": "http://langfuse:3000"},
                {"key": "langfuse_public_key", "value": "lf-pk-abc"},
            ]
        },
    )
    assert resp.status_code == 200
    data = {s["key"]: s for s in resp.json()}
    assert data["langfuse_host"]["value"] == "http://langfuse:3000"
    assert data["langfuse_public_key"]["value"] == "lf-pk-abc"


@pytest.mark.asyncio
async def test_raw_setting_endpoint(client):
    """GET /api/v1/settings/{key}/raw returns plaintext for internal use."""
    # First set a value
    await client.patch(
        "/api/v1/settings",
        json={"settings": [{"key": "telegram_bot_token", "value": "bot-tok-123"}]},
    )
    resp = await client.get("/api/v1/settings/telegram_bot_token/raw")
    assert resp.status_code == 200
    body = resp.json()
    assert body["key"] == "telegram_bot_token"
    assert body["value"] == "bot-tok-123"  # raw endpoint returns plaintext
