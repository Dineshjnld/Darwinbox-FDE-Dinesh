from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any


class EventBus:
    def __init__(self) -> None:
        self._subscribers: dict[str, set[asyncio.Queue[dict[str, Any]]]] = defaultdict(set)

    async def publish(self, migration_id: str, event: dict[str, Any]) -> None:
        for queue in list(self._subscribers.get(migration_id, set())):
            await queue.put(event)

    def subscribe(self, migration_id: str) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._subscribers[migration_id].add(queue)
        return queue

    def unsubscribe(self, migration_id: str, queue: asyncio.Queue[dict[str, Any]]) -> None:
        self._subscribers[migration_id].discard(queue)


class EventService:
    def __init__(self, store: Any, audit: Any) -> None:
        self.store = store
        self.audit = audit

    async def emit(self, **kwargs: Any) -> dict[str, Any]:
        return await self.audit.record(**kwargs)

