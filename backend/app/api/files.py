from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.encoders import jsonable_encoder

from app.api.deps import service, store

router = APIRouter(prefix="/api/migrations/{migration_id}/files", tags=["files"])


@router.get("")
async def list_files(migration_id: str, request: Request) -> list[dict]:
    return jsonable_encoder(await store(request).find("files", {"migration_id": migration_id}))


@router.post("/sample")
async def load_sample(migration_id: str, request: Request) -> list[dict]:
    migration = await store(request).get("migrations", migration_id)
    if not migration:
        raise HTTPException(404, "Migration not found")
    try:
        files = await service(request).attach_samples(migration_id, migration["tenant_id"])
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(400, str(exc)) from exc
    return jsonable_encoder(files)


@router.post("")
async def upload_files(migration_id: str, request: Request, files: list[UploadFile] = File(...)) -> list[dict]:  # noqa: B008
    migration = await store(request).get("migrations", migration_id)
    if not migration:
        raise HTTPException(404, "Migration not found")
    results: list[dict] = []
    for upload in files:
        try:
            content = await upload.read()
            results.append(await service(request).upload(migration_id, migration["tenant_id"], upload.filename or "upload.csv", content))
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
    return jsonable_encoder(results)
