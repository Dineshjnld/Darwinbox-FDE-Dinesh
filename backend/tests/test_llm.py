import httpx
import pytest

from app.agents.llm import LLMClient
from app.config import Settings
from app.models.mapping import MappingLLMOutput


@pytest.mark.asyncio
async def test_gemini_fallback_is_used_when_primary_provider_fails(monkeypatch) -> None:
    settings = Settings(
        llm_provider="cerebras",
        cerebras_api_key="primary",
        llm_model="qwen-3.8-27b",
        llm_fallback_provider="gemini",
        gemini_api_key="fallback",
        gemini_model="gemini-2.5-flash",
    )
    client = LLMClient(settings)

    async def fake_call(provider: str, system: str, user: str) -> dict:
        if provider == "cerebras":
            raise httpx.ConnectError("primary unavailable")
        return {"source_field": "DOJ", "target_field": "date_of_joining", "confidence": 0.94, "reason": "Gemini fallback"}

    monkeypatch.setattr(client, "_call_provider", fake_call)
    result = await client.structured("system", "user", MappingLLMOutput)
    assert result is not None
    assert result.target_field == "date_of_joining"
