from __future__ import annotations

from dataclasses import dataclass

from app.models.mapping import MappingEvidence


@dataclass(frozen=True)
class ConfidenceEngine:
    """Deterministic evidence combiner; the LLM is only one signal."""

    semantic_weight: float = 0.25
    name_weight: float = 0.25
    sample_weight: float = 0.18
    type_weight: float = 0.18
    history_weight: float = 0.07
    rules_weight: float = 0.07

    def score(self, *, semantic: float, name: float, sample: float, type_compatibility: float, historical: float = 0, business_rule: float = 0) -> MappingEvidence:
        values = [semantic, name, sample, type_compatibility, historical, business_rule]
        bounded = [max(0.0, min(1.0, float(value))) for value in values]
        weighted = sum(value * weight for value, weight in zip(bounded, (
            self.semantic_weight,
            self.name_weight,
            self.sample_weight,
            self.type_weight,
            self.history_weight,
            self.rules_weight,
        )))
        return MappingEvidence(
            semantic_similarity=bounded[0],
            name_similarity=bounded[1],
            sample_compatibility=bounded[2],
            type_compatibility=bounded[3],
            historical_evidence=bounded[4],
            business_rule=bounded[5],
            weighted_score=round(weighted, 4),
        )

    @staticmethod
    def autonomy(confidence: float, *, ambiguous: bool = False, unsafe: bool = False) -> str:
        if unsafe:
            return "BLOCK"
        if ambiguous or confidence < 0.72:
            return "REVIEW"
        return "AUTO" if confidence >= 0.82 else "REVIEW"

