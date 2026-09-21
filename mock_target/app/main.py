from __future__ import annotations

import os
import random
import time
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Query
from pydantic import BaseModel

app = FastAPI(title="Mock Darwinbox Target API", version="0.1.0")
records: dict[str, dict[str, Any]] = {}
idempotency: dict[str, dict[str, Any]] = {}
failed_once: set[str] = set()
failure_rate = float(os.getenv("MOCK_FAILURE_RATE", "0"))
fail_once_id = os.getenv("MOCK_FAIL_ONCE_ID", "EMP005")


class Employee(BaseModel):
    employee_id: str
    first_name: str
    last_name: str
    email: str
    date_of_joining: str
    department: str | None = None
    employment_status: str | None = None
    date_of_birth: str | None = None


class RollbackRequest(BaseModel):
    before: dict[str, Any] | None = None
    operation: str = "create"


def maybe_fail(employee_id: str) -> None:
    if employee_id == fail_once_id and employee_id not in failed_once:
        failed_once.add(employee_id)
        raise HTTPException(503, f"Simulated transient failure for {employee_id}")
    if random.random() < failure_rate:
        raise HTTPException(503, "Simulated target outage")


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"status": "ok", "employees": len(records)}


@app.get("/schema")
async def schema() -> dict[str, Any]:
    return {"entity": "employee", "provider": "mock", "capabilities": ["create", "update", "verify", "rollback"]}


@app.get("/employees")
async def list_employees(employee_id: str | None = Query(default=None), email: str | None = Query(default=None)) -> list[dict[str, Any]]:
    values = list(records.values())
    if employee_id:
        values = [record for record in values if record.get("employee_id") == employee_id]
    if email:
        values = [record for record in values if record.get("email") == email]
    return values


@app.get("/employees/{employee_id}")
async def get_employee(employee_id: str) -> dict[str, Any]:
    if employee_id not in records:
        raise HTTPException(404, "Employee not found")
    return records[employee_id]


@app.post("/employees")
async def create_employee(employee: Employee, idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")) -> dict[str, Any]:
    if idempotency_key and idempotency_key in idempotency:
        return idempotency[idempotency_key]
    maybe_fail(employee.employee_id)
    result = {"id": employee.employee_id, **employee.model_dump(), "updated_at": time.time()}
    records[employee.employee_id] = result
    if idempotency_key:
        idempotency[idempotency_key] = result
    return result


@app.put("/employees/{employee_id}")
async def update_employee(employee_id: str, employee: Employee, idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")) -> dict[str, Any]:
    if idempotency_key and idempotency_key in idempotency:
        return idempotency[idempotency_key]
    maybe_fail(employee.employee_id)
    result = {"id": employee_id, **employee.model_dump(), "updated_at": time.time()}
    records[employee_id] = result
    if idempotency_key:
        idempotency[idempotency_key] = result
    return result


@app.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str) -> dict[str, Any]:
    records.pop(employee_id, None)
    return {"deleted": True, "id": employee_id}


@app.post("/employees/{employee_id}/verify")
async def verify_employee(employee_id: str) -> dict[str, Any]:
    if employee_id not in records:
        raise HTTPException(404, "Employee not found")
    return {"verified": True, "id": employee_id}


@app.post("/employees/{employee_id}/rollback")
async def rollback_employee(employee_id: str, request: RollbackRequest) -> dict[str, Any]:
    if request.operation == "create":
        records.pop(employee_id, None)
    elif request.before is not None:
        records[employee_id] = request.before
    return {"rolled_back": True, "id": employee_id, "operation": request.operation}
