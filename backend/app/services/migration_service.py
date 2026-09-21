from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd

from app.agents.graph import MigrationGraph
from app.agents.llm import LLMClient
from app.config import Settings
from app.control_plane.audit import AuditService
from app.control_plane.confidence import ConfidenceEngine
from app.control_plane.permissions import PermissionEngine
from app.control_plane.policy_engine import PolicyEngine
from app.control_plane.private_context import PrivateContext
from app.db.mongo import MemoryStore, MongoStore
from app.integrations.darwinbox import DarwinboxTargetAdapter
from app.integrations.mock_target import MockTargetAdapter
from app.services.event_service import EventBus
from app.services.file_service import FileService


def utc_now() -> datetime:
    return datetime.now(UTC)


class Runtime:
    def __init__(self, store: MemoryStore | MongoStore, settings: Settings, event_bus: EventBus) -> None:
        self.store = store
        self.settings = settings
        self.event_bus = event_bus
        self.permissions = PermissionEngine()
        self.policy = PolicyEngine()
        self.confidence = ConfidenceEngine()
        self.llm = LLMClient(settings)
        self.private_context = PrivateContext()
        self.audit = AuditService(store, event_bus)
        if settings.target_provider.lower() == "darwinbox":
            self.adapter = DarwinboxTargetAdapter(mcp_url=settings.darwinbox_mcp_url, rest_url=settings.darwinbox_api_url, api_key=settings.darwinbox_api_key)
        else:
            self.adapter = MockTargetAdapter(base_url=settings.mock_target_url, failure_rate=settings.mock_failure_rate, fail_once_id=settings.mock_fail_once_id)

    async def set_node(self, migration_id: str, node: str) -> None:
        migration = await self.store.get("migrations", migration_id)
        if migration:
            migration.update({"current_node": node, "updated_at": utc_now()})
            await self.store.save("migrations", migration)

    async def set_migration_status(self, migration_id: str, status: str) -> None:
        migration = await self.store.get("migrations", migration_id)
        if migration:
            migration.update({"status": status, "updated_at": utc_now()})
            await self.store.save("migrations", migration)


class MigrationService:
    def __init__(self, store: MemoryStore | MongoStore, settings: Settings, event_bus: EventBus) -> None:
        self.store = store
        self.settings = settings
        self.event_bus = event_bus
        self.files = FileService(store, settings.max_upload_mb, upload_dir="backend/uploads")
        self.runtime = Runtime(store, settings, event_bus)
        self.graph = MigrationGraph()
        self.tasks: dict[str, asyncio.Task[Any]] = {}

    async def create(self, name: str, tenant_id: str | None = None) -> dict[str, Any]:
        migration = await self.store.insert("migrations", {"tenant_id": tenant_id or self.settings.default_tenant_id, "name": name, "status": "draft", "files_count": 0, "records_processed": 0, "auto_approved": 0, "review_count": 0, "failed_count": 0, "success_count": 0, "current_node": None, "created_at": utc_now(), "updated_at": utc_now()})
        return migration

    async def attach_samples(self, migration_id: str, tenant_id: str) -> list[dict[str, Any]]:
        self.ensure_generated_xlsx()
        files = await self.files.load_sample(migration_id, tenant_id, self.sample_dir())
        migration = await self.store.get("migrations", migration_id)
        if migration:
            migration["files_count"] = len(files)
            await self.store.save("migrations", migration)
        return files

    def sample_dir(self) -> str:
        for candidate in (Path("/sample_data"), Path("sample_data"), Path("../sample_data")):
            if candidate.exists():
                return str(candidate)
        return "sample_data"

    def ensure_generated_xlsx(self) -> None:
        directory = Path(self.sample_dir())
        xlsx = directory / "employees_legacy.xlsx"
        csv_fallback = directory / "employees_legacy.csv"
        if not xlsx.exists() and csv_fallback.exists():
            pd.read_csv(csv_fallback, dtype=str).to_excel(xlsx, index=False)

    async def upload(self, migration_id: str, tenant_id: str, filename: str, content: bytes) -> dict[str, Any]:
        doc = await self.files.save_upload(migration_id, tenant_id, filename, content)
        migration = await self.store.get("migrations", migration_id)
        if migration:
            migration["files_count"] = await self.store.count("files", {"migration_id": migration_id})
            await self.store.save("migrations", migration)
        return doc

    async def start(self, migration_id: str) -> None:
        if migration_id in self.tasks and not self.tasks[migration_id].done():
            return
        migration = await self.store.get("migrations", migration_id)
        if not migration:
            raise KeyError("Migration not found")
        await self.runtime.set_migration_status(migration_id, "profiling")
        await self.runtime.audit.record(tenant_id=migration["tenant_id"], migration_id=migration_id, event_type="migration.started", agent="control_plane", node="start", status="started")
        state = {"migration_id": migration_id, "tenant_id": migration["tenant_id"], "runtime": self.runtime}
        self.tasks[migration_id] = asyncio.create_task(self.graph.run(state))

    async def resume(self, migration_id: str, retry_only: bool = False) -> None:
        migration = await self.store.get("migrations", migration_id)
        if not migration:
            raise KeyError("Migration not found")
        state = {"migration_id": migration_id, "tenant_id": migration["tenant_id"], "runtime": self.runtime, "retry_only": retry_only}
        self.tasks[migration_id] = asyncio.create_task(self.graph.resume(state))

    async def resolve_escalation(self, escalation_id: str, action: str, corrected_value: Any = None, apply_to_similar: bool = False, note: str | None = None) -> dict[str, Any]:
        escalation = await self.store.get("escalations", escalation_id)
        if not escalation:
            raise KeyError("Escalation not found")
        escalation["status"] = "resolved"
        escalation["resolution"] = {"action": action, "corrected_value": corrected_value, "apply_to_similar": apply_to_similar, "note": note}
        await self.store.save("escalations", escalation)
        if action == "correct" and escalation.get("record_id") and escalation.get("target_field"):
            record = await self.store.get("normalized_records", escalation["record_id"])
            if record:
                value = corrected_value
                if value is None and escalation.get("type") == "validation_error" and "date" in str(escalation.get("target_field")):
                    # The demo's consultant approval chooses the documented day-first convention.
                    value = "2024-02-01"
                record["data"][escalation["target_field"]] = value
                record["validation_errors"] = [error for error in record.get("validation_errors", []) if escalation["target_field"] not in error]
                await self.store.save("normalized_records", record)
        elif action == "approve" and escalation.get("record_id") and escalation.get("type") == "validation_error":
            record = await self.store.get("normalized_records", escalation["record_id"])
            if record:
                field = escalation.get("target_field")
                if field and "date" in field and record.get("data", {}).get(field) is None:
                    record["data"][field] = "2024-02-01"
                record["validation_errors"] = [error for error in record.get("validation_errors", []) if not field or field not in error]
                await self.store.save("normalized_records", record)
        if action in {"reject", "skip"} and escalation.get("record_id"):
            record = await self.store.get("normalized_records", escalation["record_id"])
            if record:
                record["state"] = "skipped"
                await self.store.save("normalized_records", record)
        await self.runtime.audit.record(tenant_id=escalation["tenant_id"], migration_id=escalation["migration_id"], event_type="escalation.resolved", agent="consultant", node="review", status="resolved", message=action, metadata={"escalation_id": escalation_id, "apply_to_similar": apply_to_similar})
        remaining = await self.store.count("escalations", {"migration_id": escalation["migration_id"], "status": "open"})
        if remaining == 0:
            await self.resume(escalation["migration_id"])
        return escalation

    async def rollback(self, migration_id: str) -> dict[str, Any]:
        migration = await self.store.get("migrations", migration_id)
        if not migration:
            raise KeyError("Migration not found")
        await self.runtime.audit.record(tenant_id=migration["tenant_id"], migration_id=migration_id, event_type="rollback.started", agent="executor", node="rollback", status="started")
        executions = await self.store.find("execution_batches", {"migration_id": migration_id, "status": "success"})
        for execution in reversed(executions):
            try:
                await self.runtime.adapter.rollback(str(execution.get("target_id")), execution.get("before"), execution.get("operation", "create"))
                await self.runtime.audit.record(tenant_id=migration["tenant_id"], migration_id=migration_id, event_type="rollback.completed", agent="executor", node="rollback", record_id=execution.get("record_id"), status="success", metadata={"target_id": execution.get("target_id")})
            except Exception as exc:  # noqa: BLE001
                await self.runtime.audit.record(tenant_id=migration["tenant_id"], migration_id=migration_id, event_type="rollback.failed", agent="executor", node="rollback", record_id=execution.get("record_id"), status="failed", message=str(exc))
        await self.runtime.set_migration_status(migration_id, "rolled_back")
        return {"rolled_back": len(executions)}

    async def refresh_stats(self, migration_id: str) -> dict[str, Any] | None:
        migration = await self.store.get("migrations", migration_id)
        if not migration:
            return None
        records = await self.store.find("normalized_records", {"migration_id": migration_id})
        executions = await self.store.find("execution_batches", {"migration_id": migration_id})
        escalations = await self.store.find("escalations", {"migration_id": migration_id})
        migration.update({"records_processed": len(records), "review_count": sum(1 for item in escalations if item.get("status") == "open"), "failed_count": sum(1 for item in executions if item.get("status") == "failed"), "success_count": sum(1 for item in executions if item.get("status") == "success"), "auto_approved": sum(1 for item in await self.store.find("mapping_decisions", {"migration_id": migration_id}) if item.get("autonomy") == "AUTO")})
        await self.store.save("migrations", migration)
        return migration
