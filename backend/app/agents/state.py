from __future__ import annotations

from typing import Any, TypedDict


class MigrationState(TypedDict, total=False):
    migration_id: str
    tenant_id: str
    runtime: Any
    files: list[dict[str, Any]]
    schema: dict[str, Any]
    mappings: list[dict[str, Any]]
    normalized_records: list[dict[str, Any]]
    validation_errors: list[dict[str, Any]]
    open_escalations: list[dict[str, Any]]
    execution_ids: list[str]
    status: str
    current_node: str
    retry_only: bool
