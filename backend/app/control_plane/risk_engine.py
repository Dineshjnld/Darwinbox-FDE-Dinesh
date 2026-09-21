from enum import StrEnum


class Risk(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RiskEngine:
    def classify(self, operation: str, *, has_identity: bool = True, destructive: bool = False, confidence: float | None = None) -> Risk:
        if destructive or operation in {"delete", "rollback_delete"}:
            return Risk.CRITICAL
        if not has_identity:
            return Risk.HIGH
        if confidence is not None and confidence < 0.72:
            return Risk.MEDIUM
        if operation in {"create", "update"}:
            return Risk.LOW
        return Risk.LOW

