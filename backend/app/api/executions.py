from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.encoders import jsonable_encoder

from app.api.deps import service, store

router = APIRouter(prefix="/api/migrations/{migration_id}", tags=["executions"])


@router.get("/executions")
async def list_executions(migration_id: str, request: Request) -> list[dict]:
    return jsonable_encoder(await store(request).find("execution_batches", {"migration_id": migration_id}, sort=[("created_at", -1)]))


@router.post("/executions/retry")
async def retry_executions(migration_id: str, request: Request) -> dict:
    migration = await store(request).get("migrations", migration_id)
    if not migration:
        raise HTTPException(404, "Migration not found")
    await service(request).resume(migration_id, retry_only=True)
    return {"status": "retrying", "migration_id": migration_id}


@router.post("/rollback")
async def rollback(migration_id: str, request: Request) -> dict:
    try:
        return jsonable_encoder(await service(request).rollback(migration_id))
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc

