from typing import Any

from app.control_plane.permissions import PermissionEngine


def mutation_payload(agent: str, record: dict[str, Any], permissions: PermissionEngine, operation: str) -> dict[str, Any]:
    permissions.assert_allowed(agent, "create_record" if operation == "create" else "update_record")
    return {key: value for key, value in record.items() if not key.startswith("_")}

