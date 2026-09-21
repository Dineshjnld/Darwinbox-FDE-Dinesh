
import pytest
from app.config import Settings
from app.db.mongo import MemoryStore
from app.services.event_service import EventBus
from app.services.migration_service import MigrationService


@pytest.mark.asyncio
async def test_demo_workflow_escalates_resumes_and_retries() -> None:
    settings = Settings(mongodb_uri="", target_provider="mock", mock_target_url="", mock_fail_once_id="EMP005", cerebras_api_key="", llm_model="", gemini_api_key="")
    store = MemoryStore()
    service = MigrationService(store, settings, EventBus())
    migration = await service.create("Test migration")
    await service.attach_samples(migration["_id"], migration["tenant_id"])
    await service.start(migration["_id"])
    await service.tasks[migration["_id"]]

    open_items = await store.find("escalations", {"migration_id": migration["_id"], "status": "open"})
    assert open_items
    for item in open_items:
        await service.resolve_escalation(item["_id"], "approve", apply_to_similar=True)
        task = service.tasks.get(migration["_id"])
        if task:
            await task

    executions = await store.find("execution_batches", {"migration_id": migration["_id"]})
    assert executions
    assert any(item["status"] == "failed" for item in executions)
    await service.resume(migration["_id"], retry_only=True)
    await service.tasks[migration["_id"]]
    refreshed = await service.refresh_stats(migration["_id"])
    assert refreshed["status"] == "completed"
    assert refreshed["failed_count"] == 0
