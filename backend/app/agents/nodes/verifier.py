from __future__ import annotations

from typing import Any

from app.agents.state import MigrationState


async def verifier_node(state: MigrationState) -> dict[str, Any]:
    runtime = state["runtime"]
    executions = await runtime.store.find("execution_batches", {"migration_id": state["migration_id"]})
    for execution in executions:
        if execution.get("status") != "success" or not execution.get("target_id"):
            continue
        try:
            await runtime.adapter.verify(str(execution["target_id"]))
            await runtime.audit.record(tenant_id=state["tenant_id"], migration_id=state["migration_id"], event_type="record.verified", agent="verifier", node="verifier", operation=execution.get("operation"), record_id=execution.get("record_id"), status="success", metadata={"target_id": execution["target_id"]})
        except Exception as exc:  # noqa: BLE001
            await runtime.audit.record(tenant_id=state["tenant_id"], migration_id=state["migration_id"], event_type="verification.failed", agent="verifier", node="verifier", record_id=execution.get("record_id"), status="failed", message=str(exc))
    await runtime.set_node(state["migration_id"], "verifier")
    await runtime.audit.handoff(tenant_id=state["tenant_id"], migration_id=state["migration_id"], from_agent="verifier", to_agent="control_plane", message="Read-back verification is complete. Control plane can compute the terminal migration state.")
    return {"current_node": "verifier"}
