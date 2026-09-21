from typing import Any


def validate_record(record: dict[str, Any], schema: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    for field, spec in schema.get("fields", {}).items():
        value = record.get(field)
        if spec.get("required") and value in (None, ""):
            errors.append(f"Missing required field: {field}")
        if value not in (None, "") and spec.get("type") == "email" and ("@" not in str(value) or "." not in str(value).split("@")[-1]):
            errors.append(f"Invalid email: {field}")
        if value not in (None, "") and spec.get("type") == "enum" and value not in spec.get("values", []):
            errors.append(f"Invalid enum value for {field}: {value}")
    return errors

