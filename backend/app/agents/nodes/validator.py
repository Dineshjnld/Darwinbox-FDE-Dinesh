from __future__ import annotations

from typing import Any

from app.agents.state import MigrationState
from app.tools.validation_tools import validate_record


async def validator_node(state: MigrationState) -> dict[str, Any]:
    runtime = state["runtime"]
    errors: list[dict[str, Any]] = []
    for record in state.get("normalized_records", []):
        found = validate_record(record["data"], state["schema"])
        record["validation_errors"] = list(dict.fromkeys(record.get("validation_errors", []) + found))
        if found:
            record["state"] = "needs_review"
            errors.append({"record_id": record["_id"], "errors": found})
        await runtime.store.save("normalized_records", record)
        await runtime.audit.record(tenant_id=state["tenant_id"], migration_id=state["migration_id"], event_type="validation.completed", agent="validator", node="validator", record_id=record["_id"], status="review" if found else "success", metadata={"errors": found})
    for item in errors:
        escalation = {"tenant_id": state["tenant_id"], "migration_id": state["migration_id"], "status": "open", "type": "validation_error", "title": "Record needs validation review", "why": "Safe normalization did not resolve all required target fields.", "target_field": item["errors"][0].split(": ")[-1] if item["errors"] else None, "candidates": [], "confidence": 0.55, "evidence": {"errors": item["errors"]}, "recommended_action": "Correct the source or skip this record.", "impact": "This employee will not be sent until required fields are resolved.", "record_id": item["record_id"]}
        saved = await runtime.store.insert("escalations", escalation)
        escalation["_id"] = saved["_id"]
        state.setdefault("open_escalations", []).append(escalation)
        await runtime.audit.record(tenant_id=state["tenant_id"], migration_id=state["migration_id"], event_type="escalation.created", agent="validator", node="validator", status="open", risk="HIGH", message=escalation["title"], metadata={"record_id": item["record_id"]})
    await runtime.set_node(state["migration_id"], "validator")
    await runtime.audit.handoff(tenant_id=state["tenant_id"], migration_id=state["migration_id"], from_agent="validator", to_agent="decision_gate", message=f"Validation completed for {len(state.get('normalized_records', []))} records. Decision gate can route {len(errors)} validation issues and existing escalations.", metadata={"validation_errors": len(errors)})
    return {"validation_errors": errors, "open_escalations": state.get("open_escalations", []), "current_node": "validator"}
