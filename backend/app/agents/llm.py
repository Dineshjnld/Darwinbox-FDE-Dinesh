from __future__ import annotations

import json
import logging
from typing import TypeVar

import httpx
from pydantic import BaseModel

from app.config import Settings

ModelT = TypeVar("ModelT", bound=BaseModel)
logger = logging.getLogger(__name__)


class LLMClient:
    """Optional structured-output client with an ordered provider fallback.

    It is intentionally non-critical: deterministic mapper evidence remains the
    source of truth when credentials or a model are unavailable.
    """

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @property
    def enabled(self) -> bool:
        return any(
            (
                provider == "cerebras"
                and self.settings.cerebras_api_key
                and self.settings.llm_model
            )
            or (
                provider == "gemini"
                and self.settings.gemini_api_key
                and self.settings.gemini_model
            )
            for provider in {self.settings.llm_provider, self.settings.llm_fallback_provider}
        )

    async def structured(self, system: str, user: str, output_model: type[ModelT]) -> ModelT | None:
        providers = [self.settings.llm_provider]
        if self.settings.llm_fallback_provider and self.settings.llm_fallback_provider not in providers:
            providers.append(self.settings.llm_fallback_provider)
        for provider in providers:
            try:
                result = await self._call_provider(provider, system, user)
                if result is not None:
                    return output_model.model_validate(result)
            except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
                logger.warning("llm_provider_failed provider=%s error=%s", provider, type(exc).__name__)
        return None

    async def _call_provider(self, provider: str, system: str, user: str) -> dict | None:
        if provider == "cerebras":
            if not self.settings.cerebras_api_key or not self.settings.llm_model:
                return None
            payload = {
                "model": self.settings.llm_model,
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            }
            headers = {"Authorization": f"Bearer {self.settings.cerebras_api_key}"}
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(f"{self.settings.cerebras_base_url.rstrip('/')}/chat/completions", json=payload, headers=headers)
                response.raise_for_status()
                return json.loads(response.json()["choices"][0]["message"]["content"])
        if provider == "gemini":
            if not self.settings.gemini_api_key or not self.settings.gemini_model:
                return None
            payload = {
                "systemInstruction": {"parts": [{"text": system}]},
                "contents": [{"role": "user", "parts": [{"text": user}]}],
                "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
            }
            url = f"{self.settings.gemini_base_url.rstrip('/')}/models/{self.settings.gemini_model}:generateContent"
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.post(url, params={"key": self.settings.gemini_api_key}, json=payload)
                response.raise_for_status()
                content = response.json()["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(content)
        return None
