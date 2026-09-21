from __future__ import annotations

from typing import Any

from app.agents.state import MigrationState


async def decision_node(state: MigrationState) -> dict[str, Any]:
    runtime = state["runtime"]
    open_items = await runtime.store.find("escalations", {"migration_id": state["migration_id"], "status": "open"})
    await runtime.set_node(state["migration_id"], "decision_gate")
    await runtime.audit.record(tenant_id=state["tenant_id"], migration_id=state["migration_id"], event_type="decision.completed", agent="decision_gate", node="decision_gate", status="review" if open_items else "auto", metadata={"open_escalations": len(open_items)})
    await runtime.audit.handoff(tenant_id=state["tenant_id"], migration_id=state["migration_id"], from_agent="decision_gate", to_agent="consultant" if open_items else "executor", message="Human review is required before mutation." if open_items else "No open escalations remain. Executor is authorized to evaluate the mutation policy.", status="review" if open_items else "success", metadata={"open_escalations": len(open_items)})
    return {"open_escalations": open_items, "status": "review" if open_items else "executing", "current_node": "decision_gate"}


async def review_pause_node(state: MigrationState) -> dict[str, Any]:
    runtime = state["runtime"]
    await runtime.set_migration_status(state["migration_id"], "review")
    return {"status": "review", "current_node": "review"}
