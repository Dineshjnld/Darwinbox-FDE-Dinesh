from typing import Any

from pydantic import BaseModel, Field


class MappingEvidence(BaseModel):
    semantic_similarity: float = 0
    name_similarity: float = 0
    sample_compatibility: float = 0
    type_compatibility: float = 0
    historical_evidence: float = 0
    business_rule: float = 0
    weighted_score: float = 0


class MappingDecision(BaseModel):
    id: str | None = Field(default=None, alias="_id")
    tenant_id: str
    migration_id: str
    source_file: str
    source_field: str
    target_field: str | None
    confidence: float
    autonomy: str
    reason: str
    transformation: str | None = None
    candidates: list[str] = Field(default_factory=list)
    evidence: MappingEvidence
    status: str = "proposed"
    created_at: Any | None = None


class MappingLLMOutput(BaseModel):
    source_field: str
    target_field: str | None
    confidence: float = Field(ge=0, le=1)
    reason: str
    transformation: str | None = None

