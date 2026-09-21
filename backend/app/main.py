from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import escalations, events, executions, files, health, migrations
from app.config import get_settings
from app.db.mongo import create_store, ensure_indexes
from app.services.event_service import EventBus
from app.services.migration_service import MigrationService

settings = get_settings()


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps({"timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"), "level": record.levelname, "logger": record.name, "message": record.getMessage()})


handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO), handlers=[handler])


@asynccontextmanager
async def lifespan(app: FastAPI):
    store = await create_store(settings.mongodb_uri, settings.mongodb_database, settings.require_mongodb, settings.mongodb_server_selection_timeout_ms)
    await ensure_indexes(store)
    app.state.settings = settings
    app.state.store = store
    app.state.event_bus = EventBus()
    app.state.migration_service = MigrationService(store, settings, app.state.event_bus)
    yield
    if hasattr(store, "close"):
        await store.close()


app = FastAPI(title="Darwinbox Migration Copilot API", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(health.router)
app.include_router(migrations.router)
app.include_router(files.router)
app.include_router(escalations.router)
app.include_router(executions.router)
app.include_router(events.router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"name": "Darwinbox Migration Copilot", "docs": "/docs"}
