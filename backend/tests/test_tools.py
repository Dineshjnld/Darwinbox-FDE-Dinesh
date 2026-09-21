from app.control_plane.confidence import ConfidenceEngine
from app.control_plane.policy_engine import PolicyEngine
from app.tools.duplicate_tools import strong_duplicate_match
from app.tools.normalization_tools import normalize_email, normalize_phone, parse_date


def test_safe_normalization() -> None:
    assert normalize_email(" JOHN@EXAMPLE.COM ") == "john@example.com"
    assert normalize_phone("+91 (987) 654-3210") == "919876543210"
    assert parse_date("20-Jan-2024") == ("2024-01-20", False)


def test_ambiguous_date_is_not_guessed() -> None:
    assert parse_date("01/02/2024") == (None, True)


def test_duplicate_matching_requires_strong_evidence() -> None:
    same = ({"first_name": "John", "last_name": "Smith", "email": " JOHN.SMITH@COMPANY.COM "}, {"first_name": "John  ", "last_name": "Smith", "email": "john.smith@company.com"})
    assert strong_duplicate_match(*same)[0]
    different_domains = ({"first_name": "John", "last_name": "Smith", "email": "john.smith@gmail.com"}, {"first_name": "John", "last_name": "Smith", "email": "john.smith@company.com"})
    assert not strong_duplicate_match(*different_domains)[0]


def test_confidence_and_policy_thresholds() -> None:
    evidence = ConfidenceEngine().score(semantic=0.9, name=0.95, sample=0.95, type_compatibility=1, historical=0.35, business_rule=0.9)
    assert evidence.weighted_score > 0.7
    assert ConfidenceEngine.autonomy(evidence.weighted_score) == "AUTO"
    policy = PolicyEngine()
    assert policy.decide("delete").autonomy == "BLOCK"
    assert policy.decide("create", confidence=0.5).autonomy == "REVIEW"
