from typing import Any

from pydantic import BaseModel, Field


class Execution(BaseModel):
    id: str = Field(alias="_id")
    tenant_id: str
    migration_id: str
    record_id: str
    operation: str
    status: str
    latency_ms: int = 0
    error: str | None = None
    target_id: str | None = None
    idempotency_key: str
    before: dict[str, Any] | None = None
    after: dict[str, Any] | None = None
    retry_count: int = 0

