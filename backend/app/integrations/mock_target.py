from __future__ import annotations

import random
import time
from typing import Any

import httpx


class MockTargetError(RuntimeError):
    pass


class MockTargetAdapter:
    """HTTP adapter with a local fallback, idempotency, and deterministic fail-once support."""

    def __init__(self, *, base_url: str = "", failure_rate: float = 0, fail_once_id: str = "EMP005") -> None:
        self.base_url = base_url.rstrip("/")
        self.failure_rate = failure_rate
        self.fail_once_id = fail_once_id
        self.failed_once: set[str] = set()
        self.records: dict[str, dict[str, Any]] = {}
        self.idempotent: dict[str, dict[str, Any]] = {}

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict[str, Any] | list[Any]:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.request(method, f"{self.base_url}{path}", **kwargs)
            if response.status_code >= 400:
                raise MockTargetError(response.text or f"Target returned {response.status_code}")
            return response.json()

    def _should_fail(self, payload: dict[str, Any]) -> bool:
        key = str(payload.get("employee_id", ""))
        if key == self.fail_once_id and key not in self.failed_once:
            self.failed_once.add(key)
            return True
        return random.random() < self.failure_rate

    async def discover_schema(self) -> dict[str, Any]:
        if self.base_url:
            return await self._request("GET", "/schema")
        return {"entity": "employee", "provider": "mock"}

    async def lookup(self, employee_id: str | None = None, email: str | None = None) -> dict[str, Any] | None:
        if self.base_url:
            params = {key: value for key, value in {"employee_id": employee_id, "email": email}.items() if value}
            result = await self._request("GET", "/employees", params=params)
            return result[0] if result else None
        for record in self.records.values():
            if employee_id and record.get("employee_id") == employee_id:
                return dict(record)
            if email and record.get("email") == email:
                return dict(record)
        return None

    async def create(self, payload: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        if idempotency_key in self.idempotent:
            return self.idempotent[idempotency_key]
        if self.base_url:
            result = await self._request("POST", "/employees", json=payload, headers={"Idempotency-Key": idempotency_key})
        else:
            if self._should_fail(payload):
                raise MockTargetError(f"Simulated transient failure for {payload.get('employee_id')}")
            target_id = str(payload.get("employee_id"))
            result = {"id": target_id, **payload, "updated_at": time.time()}
            self.records[target_id] = result
        self.idempotent[idempotency_key] = result
        return result

    async def update(self, target_id: str, payload: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
        if idempotency_key in self.idempotent:
            return self.idempotent[idempotency_key]
        if self.base_url:
            result = await self._request("PUT", f"/employees/{target_id}", json=payload, headers={"Idempotency-Key": idempotency_key})
        else:
            if self._should_fail(payload):
                raise MockTargetError(f"Simulated transient failure for {payload.get('employee_id')}")
            before = self.records.get(target_id, {})
            result = {"id": target_id, **before, **payload, "updated_at": time.time()}
            self.records[target_id] = result
        self.idempotent[idempotency_key] = result
        return result

    async def verify(self, target_id: str) -> dict[str, Any]:
        if self.base_url:
            return await self._request("POST", f"/employees/{target_id}/verify")
        record = self.records.get(target_id)
        if not record:
            raise MockTargetError("Target record not found during verification")
        return {"verified": True, "id": target_id, "record": record}

    async def rollback(self, target_id: str, before: dict[str, Any] | None, operation: str) -> dict[str, Any]:
        if self.base_url:
            return await self._request("POST", f"/employees/{target_id}/rollback", json={"before": before, "operation": operation})
        if operation == "create":
            self.records.pop(target_id, None)
            return {"rolled_back": True, "operation": "delete", "id": target_id}
        if before is not None:
            self.records[target_id] = before
        return {"rolled_back": True, "operation": "restore", "id": target_id}

