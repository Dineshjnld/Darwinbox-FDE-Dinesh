from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

DEFAULT_SCHEMA: dict[str, Any] = {
    "entity": "employee",
    "fields": {
        "employee_id": {"type": "string", "required": True, "unique": True},
        "first_name": {"type": "string", "required": True},
        "last_name": {"type": "string", "required": True},
        "email": {"type": "email", "required": True},
        "date_of_birth": {"type": "date", "required": False},
        "date_of_joining": {"type": "date", "required": True},
        "department": {"type": "string", "required": False},
        "employment_status": {"type": "enum", "values": ["ACTIVE", "INACTIVE", "TERMINATED"], "required": False},
    },
}


def load_schema(path: str | None = None) -> dict[str, Any]:
    if path and Path(path).exists():
        with Path(path).open(encoding="utf-8") as handle:
            return yaml.safe_load(handle)
    return DEFAULT_SCHEMA


def validate_schema(schema: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not schema.get("entity"):
        errors.append("Schema entity is required")
    if not isinstance(schema.get("fields"), dict) or not schema["fields"]:
        errors.append("Schema must define fields")
    for field, spec in schema.get("fields", {}).items():
        if not spec.get("type"):
            errors.append(f"Field {field} has no type")
    return errors

