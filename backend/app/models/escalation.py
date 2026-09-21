from typing import Any

from pydantic import BaseModel, Field


class EscalationResolution(BaseModel):
    action: str
    corrected_value: Any | None = None
    apply_to_similar: bool = False
    note: str | None = None


class Escalation(BaseModel):
    id: str = Field(alias="_id")
    tenant_id: str
    migration_id: str
    type: str
    status: str = "open"
    title: str
    why: str
    source_value: Any | None = None
    target_field: str | None = None
    candidates: list[str] = Field(default_factory=list)
    confidence: float | None = None
    evidence: dict[str, Any] = Field(default_factory=dict)
    recommended_action: str | None = None
    impact: str | None = None
    source_file: str | None = None
    source_row: int | None = None
    record_id: str | None = None
    resolution: dict[str, Any] | None = None

