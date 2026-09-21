from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

router = APIRouter(prefix="/api/migrations/{migration_id}", tags=["events"])


@router.get("/events")
async def events(migration_id: str, request: Request) -> StreamingResponse:
    event_bus = request.app.state.event_bus
    queue = event_bus.subscribe(migration_id)

    async def stream():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"data: {json.dumps(event.get('data', {}), default=str)}\n\n"
                except TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            event_bus.unsubscribe(migration_id, queue)

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "Connection": "keep-alive"})


@router.get("/audit")
async def audit(migration_id: str, request: Request) -> list[dict]:
    from app.api.deps import store

    return await store(request).find("audit_events", {"migration_id": migration_id}, sort=[("timestamp", -1)])
