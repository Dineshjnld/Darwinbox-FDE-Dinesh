from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel

from app.api.deps import service, store

router = APIRouter(prefix="/api", tags=["escalations"])


class ResolveRequest(BaseModel):
    action: str
    corrected_value: Any | None = None
    apply_to_similar: bool = False
    note: str | None = None


@router.get("/migrations/{migration_id}/escalations")
async def list_escalations(migration_id: str, request: Request) -> list[dict]:
    return jsonable_encoder(await store(request).find("escalations", {"migration_id": migration_id}, sort=[("status", 1), ("created_at", -1)]))


@router.get("/escalations")
async def list_all_escalations(request: Request) -> list[dict]:
    return jsonable_encoder(
        await store(request).find(
            "escalations",
            {"tenant_id": request.app.state.settings.default_tenant_id},
            sort=[("status", 1), ("created_at", -1)],
        )
    )


@router.post("/escalations/{escalation_id}/resolve")
async def resolve_escalation(escalation_id: str, payload: ResolveRequest, request: Request) -> dict:
    try:
        result = await service(request).resolve_escalation(escalation_id, payload.action, payload.corrected_value, payload.apply_to_similar, payload.note)
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc
    return jsonable_encoder(result)
