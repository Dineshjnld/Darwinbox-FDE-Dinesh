from fastapi import APIRouter, Request

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(request: Request) -> dict:
    ok = await request.app.state.store.ping()
    return {"status": "ok", "mongo": ok, "target_provider": request.app.state.settings.target_provider}

