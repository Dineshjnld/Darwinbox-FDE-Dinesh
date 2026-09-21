from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any

from app.agents.state import MigrationState
from app.models.mapping import MappingDecision, MappingLLMOutput
from app.tools.schema_tools import load_schema

ALIASES: dict[str, set[str]] = {
    "employee_id": {"employee_id", "emp_id", "employee_number", "employee_no", "id"},
    "first_name": {"first_name", "fname", "given_name", "forename"},
    "last_name": {"last_name", "surname", "family_name"},
    "email": {"email", "email_address", "work_email", "official_email"},
    "date_of_birth": {"dob", "date_of_birth", "birth_date"},
    "date_of_joining": {"doj", "date_of_joining", "joining_date", "date_joined"},
    "department": {"dept", "department", "business_unit", "businessunit"},
    "employment_status": {"employment_status", "employee_status", "status", "worker_status"},
}


def canonical(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def name_score(source: str, target: str) -> float:
    source_c, target_c = canonical(source), canonical(target)
    if source_c == target_c:
        return 1.0
    if source_c in {canonical(alias) for alias in ALIASES.get(target, set())}:
        return 0.97
    return SequenceMatcher(None, source_c, canonical(target)).ratio()


def sample_compatibility(target: str, values: list[Any], spec: dict[str, Any]) -> float:
    if not values:
        return 0.5
    target_type = spec.get("type", "string")
    if target_type == "email":
        return sum("@" in str(value) for value in values) / len(values)
    if target_type == "enum":
        allowed = {str(value).upper() for value in spec.get("values", [])}
        return sum(str(value).strip().upper() in allowed or str(value).strip().upper() in {"ACTIVE", "INACTIVE", "TERMINATED"} for value in values) / len(values)
    if target_type == "date" or "date" in target:
        return sum(any(token in str(value) for token in ("/", "-")) for value in values) / len(values)
    return 0.85


async def mapper_node(state: MigrationState) -> dict[str, Any]:
    runtime = state["runtime"]
    migration_id, tenant_id = state["migration_id"], state["tenant_id"]
    schema = load_schema(runtime.settings.schema_path)
    target_fields = schema["fields"]
    decisions: list[dict[str, Any]] = []
    for file_doc in state.get("files", []):
        for source_field in file_doc.get("profile", {}).get("headers", []):
            values = [row.get(source_field) for row in file_doc.get("rows", [])[:5]]
            if source_field.lower() == "employee_name":
                # This source compound field is intentionally expanded by the reconciler.
                decision = MappingDecision(
                    tenant_id=tenant_id,
                    migration_id=migration_id,
                    source_file=file_doc["file_name"],
                    source_field=source_field,
                    target_field="first_name",
                    confidence=0.9,
                    autonomy="AUTO",
                    reason="Compound employee name is deterministically split into first_name and last_name during reconciliation.",
                    transformation="split_name",
                    candidates=["first_name", "last_name"],
                    evidence=runtime.confidence.score(semantic=0.9, name=0.88, sample=0.95, type_compatibility=1, historical=0.3, business_rule=0.95),
                ).model_dump(by_alias=True, exclude_none=True)
                saved = await runtime.store.insert("mapping_decisions", decision)
                decision["_id"] = saved["_id"]
                decisions.append(decision)
                await runtime.audit.record(tenant_id=tenant_id, migration_id=migration_id, event_type="mapping.created", agent="mapper", node="mapper", status="auto", confidence=decision["confidence"], risk="LOW", metadata={"source_field": source_field, "target_field": "first_name", "source_file": file_doc["file_name"]})
                continue
            scored: list[tuple[str, float, dict[str, Any]]] = []
            for target_field, spec in target_fields.items():
                n_score = name_score(source_field, target_field)
                alias_hit = n_score >= 0.96
                semantic = 0.92 if alias_hit else n_score
                sample = sample_compatibility(target_field, values, spec)
                type_score = 1.0 if alias_hit else (0.85 if sample > 0.6 else 0.35)
                evidence = runtime.confidence.score(semantic=semantic, name=n_score, sample=sample, type_compatibility=type_score, historical=0.35 if alias_hit else 0, business_rule=0.9 if alias_hit else 0.25)
                scored.append((target_field, evidence.weighted_score, evidence.model_dump()))
            scored.sort(key=lambda item: item[1], reverse=True)
            winner, confidence, evidence_data = scored[0]
            second = scored[1] if len(scored) > 1 else None
            ambiguous = source_field.lower() == "status" or (second and confidence - second[1] < 0.08)
            if ambiguous:
                candidates = [item[0] for item in scored[:3]]
                winner = "employment_status" if source_field.lower() == "status" else winner
                confidence = min(confidence, 0.68)
                reason = "Source field has multiple plausible business meanings; consultant review is required."
                autonomy = "REVIEW"
            else:
                candidates = [winner]
                reason = f"Matched {source_field} to {winner} using alias, name, sample, and type evidence."
                autonomy = runtime.confidence.autonomy(confidence)
            llm_result: MappingLLMOutput | None = await runtime.llm.structured(
                "Map one source field to a target employee schema. Return JSON only.",
                f"source_field={source_field}; target_fields={list(target_fields)}; samples={values}",
                MappingLLMOutput,
            )
            # A model may enrich the explanation, but deterministic evidence and the ambiguity gate win.
            if llm_result and not ambiguous and llm_result.target_field in target_fields:
                reason = llm_result.reason
            transformation = "parse_date" if "date" in winner else "normalize_email" if winner == "email" else "normalize_enum" if target_fields[winner].get("type") == "enum" else "trim"
            decision = MappingDecision(
                tenant_id=tenant_id,
                migration_id=migration_id,
                source_file=file_doc["file_name"],
                source_field=source_field,
                target_field=winner,
                confidence=round(confidence, 4),
                autonomy=autonomy,
                reason=reason,
                transformation=transformation,
                candidates=candidates,
                evidence=evidence_data,
            ).model_dump(by_alias=True, exclude_none=True)
            saved = await runtime.store.insert("mapping_decisions", decision)
            decision["_id"] = saved["_id"]
            decisions.append(decision)
            await runtime.audit.record(tenant_id=tenant_id, migration_id=migration_id, event_type="mapping.created", agent="mapper", node="mapper", status=autonomy.lower(), confidence=confidence, risk="MEDIUM" if autonomy == "REVIEW" else "LOW", metadata={"source_field": source_field, "target_field": winner, "source_file": file_doc["file_name"], "evidence": evidence_data})
    await runtime.set_node(migration_id, "mapper")
    await runtime.audit.handoff(tenant_id=tenant_id, migration_id=migration_id, from_agent="mapper", to_agent="reconciler", message=f"Mapping evidence is complete. {len(decisions)} field decisions are available for deterministic reconciliation.", metadata={"mapping_count": len(decisions)})
    return {"schema": schema, "mappings": decisions, "current_node": "mapper"}
