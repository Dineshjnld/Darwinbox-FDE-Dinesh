from typing import Any

from app.control_plane.permissions import PermissionEngine


def inspect_file(agent: str, file_doc: dict[str, Any], permissions: PermissionEngine) -> dict[str, Any]:
    permissions.assert_allowed(agent, "inspect_file")
    return file_doc.get("profile", {})


def profile_column(agent: str, column: str, profile: dict[str, Any], permissions: PermissionEngine) -> dict[str, Any]:
    permissions.assert_allowed(agent, "profile_column")
    return profile.get("columns", {}).get(column, {})

