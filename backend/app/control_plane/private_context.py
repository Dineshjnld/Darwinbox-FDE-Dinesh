from __future__ import annotations

from typing import Any


class PrivateContext:
    """Keeps raw records behind references; prompts receive refs and safe samples only."""

    def __init__(self) -> None:
        self._values: dict[str, Any] = {}

    def put(self, reference: str, value: Any) -> str:
        self._values[reference] = value
        return reference

    def get(self, reference: str) -> Any:
        return self._values.get(reference)

    def public_ref(self, record_id: str, migration_id: str) -> dict[str, str]:
        return {"record_ref": f"record:{record_id}", "migration_id": migration_id}

