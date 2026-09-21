from datetime import datetime, timezone
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class MigrationStatus(StrEnum):
    DRAFT = "draft"
    PROFILING = "profiling"
    MAPPING = "mapping"
    REVIEW = "review"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


class MigrationCreate(BaseModel):
    name: str = "Employee migration"
    tenant_id: str | None = None


class Migration(BaseModel):
    id: str = Field(alias="_id")
    tenant_id: str
    name: str
    status: MigrationStatus = MigrationStatus.DRAFT
    files_count: int = 0
    records_processed: int = 0
    auto_approved: int = 0
    review_count: int = 0
    failed_count: int = 0
    success_count: int = 0
    current_node: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    metadata: dict[str, Any] = Field(default_factory=dict)

