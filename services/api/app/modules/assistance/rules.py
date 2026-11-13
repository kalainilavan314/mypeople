"""Community Support rules (BRD FR-AST-001 to 013, BR-102 to 108) as plain functions.

Help never depends on membership, donations or political support (BR-102): nothing here reads
them. A case is seen only by its assigned caseworker and the people who decide (FR-AST-007);
intake staff see a case only while it waits for screening. Decisions cite the published criteria
version and a reason; one appeal or complaint per decision is decided by someone else within 15
working days [ASSUMPTION]. Public figures are counts with a minimum cell of 10 (FR-AST-012).
"""

import secrets
from typing import Literal

INTAKE = "assistance.intake"  # PRM-34
CASEWORK = "assistance.casework"  # PRM-35
DECIDE = "assistance.decide"  # PRM-36
PROGRAMMES = "assistance.programme.manage"  # PRM-37
STAFF_PERMISSIONS = (INTAKE, CASEWORK, DECIDE, PROGRAMMES)
APPEAL_WORKING_DAYS = 15
SMALL_GROUP = 10
REF_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

Category = Literal[
    "food", "low_income", "unemployment", "education", "disability_access", "elderly_care", "housing",
    "emergency_needs", "vocational_training", "livelihood",
]
CATEGORIES: tuple[Category, ...] = (
    "food", "low_income", "unemployment", "education", "disability_access", "elderly_care", "housing",
    "emergency_needs", "vocational_training", "livelihood",
)
Outcome = Literal["approved", "partly_approved", "not_eligible", "referred"]

# Official emergency numbers shown first on every request (FR-AST-003, BR-107).
EMERGENCY_CONTACTS: tuple[tuple[str, str, str], ...] = (
    ("119", "Police emergency", "பொலிஸ் அவசர சேவை"),
    ("1990", "Suwa Seriya ambulance", "சுவ செரிய அம்புலன்ஸ்"),
    ("117", "Disaster Management Centre", "அனர்த்த முகாமைத்துவ நிலையம்"),
    ("1929", "Child protection (NCPA)", "சிறுவர் பாதுகாப்பு (NCPA)"),
    ("1938", "Women's helpline", "பெண்கள் உதவி இலக்கம்"),
)


def new_case_ref() -> str:
    """Random, so it encodes no person, place, category or order (FR-AST-005)."""
    return "AS-" + "".join(secrets.choice(REF_ALPHABET) for _ in range(8))


def may_read(*, assigned: bool, decides: bool, intake_while_screening: bool) -> bool:
    return assigned or decides or intake_while_screening


def check_decision(*, state: str, reason_en: str, reason_ta: str) -> list[str]:
    problems = []
    if state not in ("screening", "assessment"):
        problems.append(f"not_allowed_from:{state}")
    if len(reason_en.strip()) < 10 or len(reason_ta.strip()) < 10:
        problems.append("reason_required")
    return problems


def check_appeal_decider(original_decider: object, decider: object) -> str | None:
    """FR-AST-011: decided by a different person."""
    return "original_decider" if original_decider == decider else None


def hide_small(count: int) -> int | None:
    return None if 0 < count < SMALL_GROUP else count
