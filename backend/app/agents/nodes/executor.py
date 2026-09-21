from __future__ import annotations

import time
from typing import Any

from app.agents.state import MigrationState
from app.tools.target_tools import mutation_payload


async def executor_node(state: MigrationState) -> dict[str, Any]:
    runtime = state["runtime"]
    migration_id, tenant_id = state["migration_id"], state["tenant_id"]
    records = state.get("normalized_records") or await runtime.store.find("normalized_records", {"migration_id": migration_id})
    open_items = await runtime.store.find("escalations", {"migration_id": migration_id, "status": "open"})
    if open_items and not state.get("retry_only"):
        await runtime.set_migration_status(migration_id, "review")
        await runtime.audit.record(tenant_id=tenant_id, migration_id=migration_id, event_type="execution.paused", agent="executor", node="executor", status="review", message="Open human review items prevent mutation")
        await runtime.audit.handoff(tenant_id=tenant_id, migration_id=migration_id, from_agent="executor", to_agent="consultant", message="Mutation is paused until all open review items are resolved.", status="review", metadata={"open_escalations": len(open_items)})
        return {"execution_ids": [], "current_node": "executor", "status": "review"}
    if state.get("retry_only"):
        failed = await runtime.store.find("execution_batches", {"migration_id": migration_id, "status": "failed"})
        failed_record_ids = {item.get("record_id") for item in failed}
        records = [record for record in records if record.get("_id") in failed_record_ids]
    await runtime.set_migration_status(migration_id, "executing")
    await runtime.audit.record(tenant_id=tenant_id, migration_id=migration_id, event_type="execution.started", agent="executor", node="executor", status="started", metadata={"records": len(records)})
    execution_ids: list[str] = []
    for record in records:
        if record.get("state") == "skipped" or record.get("validation_errors"):
            continue
        data = record["data"]
        employee_id = data.get("employee_id")
        policy = runtime.policy.decide("create", has_identity=bool(employee_id), confidence=0.9)
        if not policy.allowed:
            await runtime.audit.record(tenant_id=tenant_id, migration_id=migration_id, event_type="execution.blocked", agent="executor", node="executor", record_id=record["_id"], status="blocked", risk=policy.risk, message=policy.reason)
            continue
        operation_id = f"{migration_id}:{record['_id']}"
        idempotency_key = f"{migration_id}:{record['source_record_ids'][0]}:{operation_id}"
        existing = await runtime.adapter.lookup(employee_id=employee_id, email=data.get("email"))
        operation = "update" if existing else "create"
        target_id = existing.get("id") if existing else employee_id
        before = existing
        start = time.perf_counter()
        execution = {"tenant_id": tenant_id, "migration_id": migration_id, "record_id": record["_id"], "operation": operation, "status": "running", "idempotency_key": idempotency_key, "target_id": target_id, "before": before, "retry_count": 0}
        saved = await runtime.store.insert("execution_batches", execution)
        try:
            payload = mutation_payload("executor", data, runtime.permissions, operation)
            after = await runtime.adapter.create(payload, idempotency_key) if operation == "create" else await runtime.adapter.update(str(target_id), payload, idempotency_key)
            execution.update({"status": "success", "after": after, "latency_ms": int((time.perf_counter() - start) * 1000)})
            if state.get("retry_only"):
                prior = await runtime.store.find_one("execution_batches", {"migration_id": migration_id, "record_id": record["_id"], "status": "failed"})
                if prior:
                    prior.update({"status": "retried", "resolved_by": saved["_id"], "resolved_at": time.time()})
                    await runtime.store.save("execution_batches", prior)
            record["state"] = "executed"
            await runtime.store.save("normalized_records", record)
            await runtime.store.save("target_records", {"_id": f"{migration_id}:{target_id}", "tenant_id": tenant_id, "migration_id": migration_id, "data": after, "source_record_id": record["_id"]})
            await runtime.audit.record(tenant_id=tenant_id, migration_id=migration_id, event_type="execution.success", agent="executor", node="executor", operation=operation, record_id=record["_id"], status="success", latency_ms=execution["latency_ms"], risk=str(policy.risk), metadata={"target_id": target_id, "idempotency_key": idempotency_key})
        except Exception as exc:  # noqa: BLE001 - external adapter errors are part of the UI flow
            execution.update({"status": "failed", "error": str(exc), "latency_ms": int((time.perf_counter() - start) * 1000)})
            await runtime.audit.record(tenant_id=tenant_id, migration_id=migration_id, event_type="execution.failed", agent="executor", node="executor", operation=operation, record_id=record["_id"], status="failed", latency_ms=execution["latency_ms"], risk=str(policy.risk), message=str(exc), metadata={"target_id": target_id, "retryable": True})
        await runtime.store.save("execution_batches", {**saved, **execution})
        execution_ids.append(saved["_id"])
    await runtime.set_node(migration_id, "executor")
    await runtime.audit.handoff(tenant_id=tenant_id, migration_id=migration_id, from_agent="executor", to_agent="verifier", message=f"Mutation batch finished with {len(execution_ids)} execution records. Verifier can read back successful target writes.", metadata={"execution_count": len(execution_ids)})
    return {"execution_ids": execution_ids, "current_node": "executor"}
