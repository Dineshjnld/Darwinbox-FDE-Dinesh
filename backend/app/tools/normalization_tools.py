from __future__ import annotations

import re
from datetime import UTC, date, datetime
from typing import Any


def normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def normalize_email(value: Any) -> str | None:
    text = normalize_text(value)
    return text.lower() if text and "@" in text else text


def normalize_phone(value: Any) -> str | None:
    text = normalize_text(value)
    if not text:
        return None
    digits = re.sub(r"\D", "", text)
    return digits or None


def parse_date(value: Any) -> tuple[str | None, bool]:
    """Return ISO date and whether interpretation was ambiguous."""
    text = normalize_text(value)
    if not text:
        return None, False
    if isinstance(value, (datetime, date)):
        return value.strftime("%Y-%m-%d"), False
    # When both parts can be months, do not silently choose day-first or month-first.
    if re.fullmatch(r"\d{1,2}/\d{1,2}/\d{4}", text):
        first, second, year = [int(part) for part in text.split("/")]
        if first <= 12 and second <= 12 and first != second:
            return None, True
        try:
            return datetime(year, second, first, tzinfo=UTC).strftime("%Y-%m-%d"), False
        except ValueError:
            return None, False
    formats = ["%Y-%m-%d", "%d-%b-%Y", "%b %d %Y", "%d/%m/%Y"]
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=UTC).strftime("%Y-%m-%d"), False
        except ValueError:
            continue
    try:
        parsed = datetime.fromisoformat(text)
        return parsed.strftime("%Y-%m-%d"), False
    except ValueError:
        return None, False


def normalize_enum(value: Any, allowed: list[str]) -> str | None:
    text = normalize_text(value)
    if not text:
        return None
    upper = text.upper()
    aliases = {"ACTIVE": "ACTIVE", "ENABLED": "ACTIVE", "INACTIVE": "INACTIVE", "DISABLED": "INACTIVE", "TERMINATED": "TERMINATED", "LEFT": "TERMINATED"}
    normalized = aliases.get(upper, upper)
    return normalized if normalized in allowed else None


def transform_value(target_field: str, value: Any, target_spec: dict[str, Any]) -> tuple[Any, list[str]]:
    issues: list[str] = []
    if value in (None, ""):
        return None, issues
    field_type = target_spec.get("type", "string")
    if target_field == "email" or field_type == "email":
        return normalize_email(value), issues
    if "date" in target_field or field_type == "date":
        normalized, ambiguous = parse_date(value)
        if ambiguous:
            issues.append(f"Ambiguous date interpretation: {value}")
        elif normalized is None:
            issues.append(f"Invalid date: {value}")
        return normalized, issues
    if field_type == "enum":
        normalized = normalize_enum(value, target_spec.get("values", []))
        if normalized is None:
            issues.append(f"Value '{value}' is not in the target enum")
        return normalized, issues
    if "phone" in target_field:
        return normalize_phone(value), issues
    return normalize_text(value), issues
