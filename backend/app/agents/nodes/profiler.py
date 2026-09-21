from __future__ import annotations

from typing import Any

from app.agents.state import MigrationState
from app.tools.file_tools import inspect_file


async def profiler_node(state: MigrationState) -> dict[str, Any]:
    runtime = state["runtime"]
    migration_id, tenant_id = state["migration_id"], state["tenant_id"]
    files = await runtime.store.find("files", {"migration_id": migration_id, "tenant_id": tenant_id})
    for file_doc in files:
        inspect_file("profiler", file_doc, runtime.permissions)
        for row_number, row in enumerate(file_doc.get("rows", []), start=2):
            source_record_id = f"{file_doc['file_name']}:{row_number}"
            runtime.private_context.put(f"record:{source_record_id}", row)
            await runtime.store.insert("source_records", {"tenant_id": tenant_id, "migration_id": migration_id, "source_record_id": source_record_id, "source_file": file_doc["file_name"], "source_row": row_number, "data": row})
        await runtime.audit.record(tenant_id=tenant_id, migration_id=migration_id, event_type="file.ingested", agent="profiler", node="profiler", status="success", metadata={"file_name": file_doc["file_name"], "rows": len(file_doc.get("rows", [])), "headers": file_doc.get("profile", {}).get("headers", [])})
    await runtime.audit.record(tenant_id=tenant_id, migration_id=migration_id, event_type="schema.profiled", agent="profiler", node="profiler", status="success", message=f"Profiled {len(files)} source files")
    await runtime.set_node(migration_id, "profiler")
    await runtime.audit.handoff(tenant_id=tenant_id, migration_id=migration_id, from_agent="profiler", to_agent="mapper", message="Schema profile is ready. Mapper can consume headers and bounded samples through the workflow state contract.", metadata={"files": len(files)})
    return {"files": files, "current_node": "profiler"}
