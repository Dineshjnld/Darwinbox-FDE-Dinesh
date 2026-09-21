from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AuditEvent(BaseModel):
    id: str = Field(alias="_id")
    timestamp: datetime
    tenant_id: str
    migration_id: str
    event_type: str
    agent: str | None = None
    node: str | None = None
    operation: str | None = None
    record_id: str | None = None
    status: str | None = None
    latency_ms: int | None = None
    confidence: float | None = None
    risk: str | None = None
    message: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

