from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class FileProfile(BaseModel):
    file_name: str
    file_type: str
    row_count: int
    headers: list[str]
    columns: dict[str, dict[str, Any]] = Field(default_factory=dict)
    entity_key_candidates: list[str] = Field(default_factory=list)


class NormalizedRecord(BaseModel):
    id: str = Field(alias="_id")
    tenant_id: str
    migration_id: str
    source_record_ids: list[str] = Field(default_factory=list)
    data: dict[str, Any]
    lineage: list[dict[str, Any]] = Field(default_factory=list)
    validation_errors: list[str] = Field(default_factory=list)
    state: str = "ready"
    created_at: datetime | None = None
    updated_at: datetime | None = None

