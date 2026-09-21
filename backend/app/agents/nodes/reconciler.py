from __future__ import annotations

from typing import Any

from app.agents.state import MigrationState
from app.tools.duplicate_tools import identity_key
from app.tools.normalization_tools import transform_value


def _split_name(value: str | None) -> tuple[str | None, str | None]:
    if not value:
        return None, None
    parts = value.strip().split()
    return (parts[0], " ".join(parts[1:])) if len(parts) > 1 else (parts[0], None)


async def reconciler_node(state: MigrationState) -> dict[str, Any]:
    runtime = state["runtime"]
    migration_id, tenant_id = state["migration_id"], state["tenant_id"]
    schema = state["schema"]
    by_key: dict[str, dict[str, Any]] = {}
    open_escalations: list[dict[str, Any]] = []
    mappings_by_file: dict[str, list[dict[str, Any]]] = {}
    for mapping in state["mappings"]:
        mappings_by_file.setdefault(mapping["source_file"], []).append(mapping)
    for file_doc in state["files"]:
        file_mappings = mappings_by_file.get(file_doc["file_name"], [])
        for row_number, row in enumerate(file_doc.get("rows", []), start=2):
            record: dict[str, Any] = {}
            lineage: list[dict[str, Any]] = []
            issues: list[str] = []
            for mapping in file_mappings:
                source_field, target_field = mapping["source_field"], mapping["target_field"]
                if not target_field or source_field not in row:
                    continue
                value = row.get(source_field)
                if target_field == "first_name" and source_field == "employee_name":
                    first, last = _split_name(value)
                    record["first_name"], record["last_name"] = first, last
                    continue
                if target_field == "first_name" and source_field == "employee_name":
                    continue
                transformed, transform_issues = transform_value(target_field, value, schema["fields"].get(target_field, {}))
                record[target_field] = transformed
                issues.extend(transform_issues)
                lineage.append({"source_file": file_doc["file_name"], "source_row": row_number, "source_field": source_field, "source_value": value, "target_field": target_field})
            source_id = f"{file_doc['file_name']}:{row_number}"
            if row.get("employee_name") and (not record.get("first_name") or not record.get("last_name")):
                first, last = _split_name(row.get("employee_name"))
                record["first_name"], record["last_name"] = first, last
            key = identity_key(record) or f"source:{source_id}"
            if key not in by_key:
                by_key[key] = {"_id": f"{migration_id}:{len(by_key) + 1}", "tenant_id": tenant_id, "migration_id": migration_id, "source_record_ids": [source_id], "data": record, "lineage": lineage, "validation_errors": issues, "state": "ready"}
                continue
            existing = by_key[key]
            existing["source_record_ids"].append(source_id)
            existing["lineage"].extend(lineage)
            for field, value in record.items():
                if value in (None, ""):
                    continue
                old = existing["data"].get(field)
                if old in (None, ""):
                    existing["data"][field] = value
                elif old != value and field not in {"date_of_joining", "employment_status"}:
                    escalation = {
                        "tenant_id": tenant_id,
                        "migration_id": migration_id,
                        "status": "open",
                        "type": "conflicting_source",
                        "title": f"Conflicting {field} for {existing['data'].get('employee_id', key)}",
                        "why": "Two source systems provided different values for the same strongly matched employee.",
                        "source_value": {"existing": old, "incoming": value},
                        "target_field": field,
                        "candidates": [str(old), str(value)],
                        "confidence": 0.61,
                        "evidence": {"matching_key": key, "existing_source_ids": existing["source_record_ids"]},
                        "recommended_action": f"Choose the authoritative {field} value.",
                        "impact": "The selected value will be sent to the target employee record.",
                        "source_file": file_doc["file_name"],
                        "source_row": row_number,
                        "record_id": existing["_id"],
                    }
                    saved = await runtime.store.insert("escalations", escalation)
                    escalation["_id"] = saved["_id"]
                    open_escalations.append(escalation)
            existing["validation_errors"].extend(issues)
    records = list(by_key.values())
    for record in records:
        await runtime.store.save("normalized_records", record)
        await runtime.audit.record(tenant_id=tenant_id, migration_id=migration_id, event_type="record.normalized", agent="reconciler", node="reconciler", record_id=record["_id"], status="success", metadata={"source_record_ids": record["source_record_ids"], "field_count": len(record["data"])})
    # Ambiguous `status` always produces exactly one review item per migration, not one per source row.
    for mapping in state["mappings"]:
        if mapping["source_field"].lower() == "status" and mapping["autonomy"] == "REVIEW":
            escalation = {
                "tenant_id": tenant_id,
                "migration_id": migration_id,
                "status": "open",
                "type": "ambiguous_mapping",
                "title": "Clarify source field 'status'",
                "why": "The source uses a generic status label. It could represent employment status, account status, or another customer-specific concept.",
                "source_value": "active / inactive",
                "target_field": "employment_status",
                "candidates": ["employment_status", "employee_status", "account_status"],
                "confidence": mapping["confidence"],
                "evidence": mapping["evidence"],
                "recommended_action": "Approve mapping to employment_status if the source status means worker lifecycle.",
                "impact": "This decision controls the status sent for HR employees.",
                "source_file": mapping["source_file"],
                "source_row": 2,
                "record_id": records[0]["_id"] if records else None,
            }
            saved = await runtime.store.insert("escalations", escalation)
            escalation["_id"] = saved["_id"]
            open_escalations.append(escalation)
            break
    for escalation in open_escalations:
        await runtime.audit.record(tenant_id=tenant_id, migration_id=migration_id, event_type="escalation.created", agent="decision_gate", node="reconciler", status="open", confidence=escalation.get("confidence"), risk="MEDIUM", message=escalation["title"], metadata={"type": escalation["type"], "record_id": escalation.get("record_id")})
    await runtime.set_node(migration_id, "reconciler")
    await runtime.audit.handoff(tenant_id=tenant_id, migration_id=migration_id, from_agent="reconciler", to_agent="validator", message=f"Reconciliation produced {len(records)} normalized records. Validator can apply the target schema and hold unsafe records.", metadata={"record_count": len(records), "open_escalations": len(open_escalations)})
    return {"normalized_records": records, "open_escalations": open_escalations, "current_node": "reconciler"}
