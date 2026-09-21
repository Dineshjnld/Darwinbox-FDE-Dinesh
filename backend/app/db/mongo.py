from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

try:
    from motor.motor_asyncio import AsyncIOMotorClient
except ImportError:  # pragma: no cover - Docker installs motor from requirements
    AsyncIOMotorClient = None  # type: ignore[assignment,misc]

logger = logging.getLogger(__name__)


def now() -> datetime:
    return datetime.now(UTC)


class MemoryStore:
    """Small repository-compatible store used for offline demos and unit tests."""

    def __init__(self) -> None:
        self.collections: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)

    async def ping(self) -> bool:
        return True

    async def insert(self, collection: str, document: dict[str, Any]) -> dict[str, Any]:
        document = dict(document)
        document.setdefault("_id", str(uuid4()))
        document.setdefault("created_at", now())
        document.setdefault("updated_at", now())
        self.collections[collection][str(document["_id"])] = document
        return document

    async def save(self, collection: str, document: dict[str, Any]) -> dict[str, Any]:
        document = dict(document)
        document.setdefault("_id", str(uuid4()))
        document["updated_at"] = now()
        existing = self.collections[collection].get(str(document["_id"]), {})
        merged = {**existing, **document}
        self.collections[collection][str(document["_id"])] = merged
        return merged

    async def update_fields(self, collection: str, doc_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
        existing = self.collections[collection].get(str(doc_id))
        if not existing:
            return None
        existing.update(fields)
        existing["updated_at"] = now()
        return dict(existing)

    async def get(self, collection: str, doc_id: str) -> dict[str, Any] | None:
        return self.collections[collection].get(str(doc_id))

    async def find(self, collection: str, query: dict[str, Any] | None = None, sort: list[tuple[str, int]] | None = None) -> list[dict[str, Any]]:
        query = query or {}
        docs = [doc for doc in self.collections[collection].values() if all(doc.get(k) == v for k, v in query.items())]
        for key, direction in reversed(sort or []):
            docs.sort(key=lambda item: item.get(key) or "", reverse=direction < 0)
        return [dict(doc) for doc in docs]

    async def find_one(self, collection: str, query: dict[str, Any]) -> dict[str, Any] | None:
        docs = await self.find(collection, query)
        return docs[0] if docs else None

    async def count(self, collection: str, query: dict[str, Any] | None = None) -> int:
        return len(await self.find(collection, query))


class MongoStore:
    def __init__(self, uri: str, database: str, server_selection_timeout_ms: int = 10000) -> None:
        self.client = AsyncIOMotorClient(
            uri,
            serverSelectionTimeoutMS=server_selection_timeout_ms,
            connectTimeoutMS=server_selection_timeout_ms,
            socketTimeoutMS=20000,
            retryReads=True,
            retryWrites=True,
        )
        self.db = self.client[database]

    async def ping(self) -> bool:
        await self.client.admin.command("ping")
        return True

    async def insert(self, collection: str, document: dict[str, Any]) -> dict[str, Any]:
        document = dict(document)
        document.setdefault("_id", str(uuid4()))
        document.setdefault("created_at", now())
        document.setdefault("updated_at", now())
        await self.db[collection].insert_one(document)
        return document

    async def save(self, collection: str, document: dict[str, Any]) -> dict[str, Any]:
        document = dict(document)
        document.setdefault("_id", str(uuid4()))
        document["updated_at"] = now()
        await self.db[collection].replace_one({"_id": document["_id"]}, document, upsert=True)
        return document

    async def update_fields(self, collection: str, doc_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
        update = {**fields, "updated_at": now()}
        result = await self.db[collection].update_one({"_id": doc_id}, {"$set": update})
        if not result.matched_count:
            return None
        return await self.get(collection, doc_id)

    async def get(self, collection: str, doc_id: str) -> dict[str, Any] | None:
        return await self.db[collection].find_one({"_id": doc_id})

    async def find(self, collection: str, query: dict[str, Any] | None = None, sort: list[tuple[str, int]] | None = None) -> list[dict[str, Any]]:
        cursor = self.db[collection].find(query or {})
        if sort:
            cursor = cursor.sort(sort)
        return await cursor.to_list(length=5000)

    async def find_one(self, collection: str, query: dict[str, Any]) -> dict[str, Any] | None:
        return await self.db[collection].find_one(query)

    async def count(self, collection: str, query: dict[str, Any] | None = None) -> int:
        return await self.db[collection].count_documents(query or {})

    async def close(self) -> None:
        self.client.close()


async def create_store(uri: str, database: str, required: bool = False, server_selection_timeout_ms: int = 10000) -> MemoryStore | MongoStore:
    if required and (not uri or "<db_" in uri or "<db_password>" in uri):
        raise RuntimeError("MONGODB_URI must contain the real encoded MongoDB credentials")
    if not uri or AsyncIOMotorClient is None:
        if required:
            raise RuntimeError("MongoDB driver or MONGODB_URI is unavailable")
        return MemoryStore()
    last_error: Exception | None = None
    for attempt in range(3):
        store = MongoStore(uri, database, server_selection_timeout_ms)
        try:
            await store.ping()
            return store
        except Exception as exc:  # noqa: BLE001 - retry any driver/connectivity startup failure
            last_error = exc
            await store.close()
            if attempt < 2:
                await asyncio.sleep(2**attempt)
    if required:
        raise RuntimeError("MongoDB connection failed; refusing to start without the configured cloud database") from last_error
    logger.warning("MongoDB unavailable; using memory repository: %s", last_error)
    return MemoryStore()


async def ensure_indexes(store: MemoryStore | MongoStore) -> None:
    if isinstance(store, MemoryStore):
        return
    definitions = {
        "migrations": [("status", 1), ("created_at", -1)],
        "source_records": [("migration_id", 1), ("source_record_id", 1)],
        "mapping_decisions": [("migration_id", 1)],
        "escalations": [("migration_id", 1), ("status", 1)],
        "audit_events": [("migration_id", 1), ("timestamp", -1)],
        "agent_events": [("migration_id", 1), ("timestamp", -1)],
    }
    for collection, indexes in definitions.items():
        await store.db[collection].create_index(indexes)
