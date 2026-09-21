from __future__ import annotations

from difflib import SequenceMatcher

from app.tools.normalization_tools import normalize_email, normalize_text


def identity_key(record: dict) -> str | None:
    employee_id = normalize_text(record.get("employee_id"))
    if employee_id:
        return f"id:{employee_id.upper()}"
    email = normalize_email(record.get("email"))
    if email:
        return f"email:{email}"
    return None


def strong_duplicate_match(left: dict, right: dict) -> tuple[bool, str]:
    left_id, right_id = normalize_text(left.get("employee_id")), normalize_text(right.get("employee_id"))
    if left_id and right_id and left_id.upper() == right_id.upper():
        return True, "matching employee_id"
    left_email, right_email = normalize_email(left.get("email")), normalize_email(right.get("email"))
    if left_email and right_email and left_email == right_email:
        return True, "matching normalized email"
    if left.get("first_name") and left.get("last_name") and left.get("email") and right.get("first_name") and right.get("last_name") and right.get("email"):
        name_similarity = SequenceMatcher(None, f"{left['first_name']} {left['last_name']}".lower(), f"{right['first_name']} {right['last_name']}".lower()).ratio()
        same_domain = normalize_email(left["email"]).split("@")[-1] == normalize_email(right["email"]).split("@")[-1]
        if name_similarity > 0.92 and same_domain:
            return True, "strong name and email-domain evidence"
    return False, "insufficient evidence"

