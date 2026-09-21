from dataclasses import dataclass

from app.control_plane.risk_engine import Risk, RiskEngine


@dataclass(frozen=True)
class PolicyDecision:
    allowed: bool
    autonomy: str
    risk: Risk
    reason: str


class PolicyEngine:
    def __init__(self) -> None:
        self.risk_engine = RiskEngine()

    def decide(self, operation: str, *, has_identity: bool = True, confidence: float | None = None) -> PolicyDecision:
        risk = self.risk_engine.classify(operation, has_identity=has_identity, confidence=confidence)
        if operation in {"delete", "rollback_delete"}:
            return PolicyDecision(False, "BLOCK", risk, "Destructive operations require an explicit rollback path")
        if not has_identity:
            return PolicyDecision(False, "BLOCK", risk, "Mutation has no stable employee identity")
        if confidence is not None and confidence < 0.72:
            return PolicyDecision(True, "REVIEW", risk, "Confidence is below the autonomous execution threshold")
        return PolicyDecision(True, "AUTO", risk, "Operation is allowed by the migration policy")

