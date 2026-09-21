from typing import ClassVar


class PermissionError(Exception):
    pass


class PermissionEngine:
    ALLOWLISTS: ClassVar[dict[str, set[str]]] = {
        "profiler": {"inspect_file", "profile_column"},
        "mapper": {"inspect_schema", "inspect_samples"},
        "reconciler": {"normalize_record", "detect_duplicate"},
        "validator": {"validate_record", "detect_duplicate"},
        "executor": {"create_record", "update_record", "verify_record", "rollback_record"},
    }

    def assert_allowed(self, agent: str, tool: str) -> None:
        if tool not in self.ALLOWLISTS.get(agent, set()):
            raise PermissionError(f"Tool '{tool}' is not allowed for agent '{agent}'")

    def allowed_tools(self, agent: str) -> set[str]:
        return set(self.ALLOWLISTS.get(agent, set()))
