import logging
import time
from typing import Any

from app.db.mongo import MemoryStore, MongoStore, now

logger = logging.getLogger(__name__)


class AuditService:
    def __init__(self, store: MemoryStore | MongoStore, event_bus: Any) -> None:
        self.store = store
        self.event_bus = event_bus

    async def record(self, *, tenant_id: str, migration_id: str, event_type: str, agent: str | None = None, node: str | None = None, operation: str | None = None, record_id: str | None = None, status: str | None = None, latency_ms: int | None = None, confidence: float | None = None, risk: str | None = None, message: str | None = None, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        event = {
            "timestamp": now(),
            "tenant_id": tenant_id,
            "migration_id": migration_id,
            "event_type": event_type,
            "agent": agent,
            "node": node,
            "operation": operation,
            "record_id": record_id,
            "status": status,
            "latency_ms": latency_ms,
            "confidence": confidence,
            "risk": risk,
            "message": message,
            "metadata": metadata or {},
        }
        saved = await self.store.insert("audit_events", event)
        await self.store.insert("agent_events", {**event, "_id": f"{saved['_id']}:agent"})
        await self.event_bus.publish(migration_id, {"type": event_type, "data": {k: v for k, v in event.items() if v is not None}})
        logger.info("migration_event=%s migration_id=%s agent=%s node=%s status=%s", event_type, migration_id, agent, node, status)
        return saved

    async def handoff(self, *, tenant_id: str, migration_id: str, from_agent: str, to_agent: str, message: str, status: str = "success", metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        return await self.record(
            tenant_id=tenant_id,
            migration_id=migration_id,
            event_type="agent.message",
            agent=from_agent,
            node=from_agent,
            status=status,
            message=message,
            metadata={"from_agent": from_agent, "to_agent": to_agent, **(metadata or {})},
        )

    def timer(self) -> float:
        return time.perf_counter()

    @staticmethod
    def elapsed_ms(start: float) -> int:
        return int((time.perf_counter() - start) * 1000)
