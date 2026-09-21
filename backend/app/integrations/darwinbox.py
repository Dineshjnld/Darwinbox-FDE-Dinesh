from __future__ import annotations

from typing import Any

import httpx

from app.integrations.mcp_client import MCPClient


class DarwinboxTargetAdapter:
    """MCP-first Darwinbox boundary with REST fallback.

    Darwinbox-specific payload and endpoint details remain here. The graph only
    consumes the TargetAdapter protocol.
    """

    def __init__(self, *, mcp_url: str = "", rest_url: str = "", api_key: str = "") -> None:
        self.mcp = MCPClient(mcp_url, api_key) if mcp_url else None
        self.rest_url = rest_url.rstrip("/")
        self.headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}

    async def _rest(self, method: str, path: str, **kwargs: Any) -> Any:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.request(method, f"{self.rest_url}{path}", headers=self.headers, **kwargs)
            response.raise_for_status()
            return response.json()

    async def discover_schema(self) -> dict[str, Any]:
        if self.mcp:
            return await self.mcp.call_tool("get_schema", {})
        return await self._rest("GET", "/schema")

    async def lookup(self, employee_id: str | None = None, email: str | None = None) -> dict[str, Any] | None:
        arguments = {key: value for key, value in {"employee_id": employee_id, "email": email}.items() if value}
        if self.mcp:
            return await self.mcp.call_tool("get_employee", arguments)
        result = await self._rest("GET", "/employees", params=arguments)
        return result[0] if result else None

    async def create(self, payload: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        if self.mcp:
            return await self.mcp.call_tool("create_employee", {"employee": payload, "idempotency_key": idempotency_key})
        return await self._rest("POST", "/employees", json=payload, headers={**self.headers, "Idempotency-Key": idempotency_key})

    async def update(self, target_id: str, payload: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        if self.mcp:
            return await self.mcp.call_tool("update_employee", {"id": target_id, "employee": payload, "idempotency_key": idempotency_key})
        return await self._rest("PUT", f"/employees/{target_id}", json=payload, headers={**self.headers, "Idempotency-Key": idempotency_key})

    async def verify(self, target_id: str) -> dict[str, Any]:
        if self.mcp:
            return await self.mcp.call_tool("verify_employee", {"id": target_id})
        return await self._rest("POST", f"/employees/{target_id}/verify")

    async def rollback(self, target_id: str, before: dict[str, Any] | None, operation: str) -> dict[str, Any]:
        if self.mcp:
            return await self.mcp.call_tool("rollback_employee", {"id": target_id, "before": before, "operation": operation})
        return await self._rest("POST", f"/employees/{target_id}/rollback", json={"before": before, "operation": operation})

