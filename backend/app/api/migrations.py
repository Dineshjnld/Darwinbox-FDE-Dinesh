from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.encoders import jsonable_encoder

from app.api.deps import service, store
from app.models.migration import MigrationCreate

router = APIRouter(prefix="/api/migrations", tags=["migrations"])


@router.get("")
async def list_migrations(request: Request) -> list[dict]:
    docs = await store(request).find("migrations", {"tenant_id": request.app.state.settings.default_tenant_id}, sort=[("created_at", -1)])
    for doc in docs:
        await service(request).refresh_stats(doc["_id"])
    docs = await store(request).find("migrations", {"tenant_id": request.app.state.settings.default_tenant_id}, sort=[("created_at", -1)])
    return jsonable_encoder(docs)


@router.post("")
async def create_migration(payload: MigrationCreate, request: Request) -> dict:
    return jsonable_encoder(await service(request).create(payload.name, payload.tenant_id))


@router.get("/{migration_id}")
async def get_migration(migration_id: str, request: Request) -> dict:
    result = await service(request).refresh_stats(migration_id)
    if not result:
        raise HTTPException(404, "Migration not found")
    return jsonable_encoder(result)


@router.get("/{migration_id}/mappings")
async def list_mappings(migration_id: str, request: Request) -> list[dict]:
    return jsonable_encoder(await store(request).find("mapping_decisions", {"migration_id": migration_id}, sort=[("source_file", 1), ("source_field", 1)]))


@router.post("/{migration_id}/start")
async def start_migration(migration_id: str, request: Request) -> dict:
    try:
        await service(request).start(migration_id)
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc
    return {"status": "started", "migration_id": migration_id}


@router.post("/{migration_id}/resume")
async def resume_migration(migration_id: str, request: Request) -> dict:
    try:
        await service(request).resume(migration_id)
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc
    return {"status": "resuming", "migration_id": migration_id}
