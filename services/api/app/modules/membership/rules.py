"""Membership state rules (BRD §9.3, §9.6, FR-ADM-003, BR-014, BR-015) as plain functions.

Membership is its own state system: Pending, Active, Suspended, Inactive.
A verified identity does not make membership Active (BR-014); a person
holding members.activate decides, with a reason (BR-015).

How activation relates to identity, pending sponsor confirmation (OD-02):
only a member whose identity is confirmed can be activated, because the
card and staff rights that Active unlocks rest on a verified identity
(FR-REG-024, BR-065, BR-097). Automatic activation on approval, OD-02's
recommendation, is not built until OD-02 is decided.
"""

from typing import Literal

ACTIVATE = "members.activate"  # PRM-05
VIEW_PROFILE = "members.view_profile"  # PRM-02: non-sensitive fields

State = Literal["pending", "active", "suspended", "inactive"]
Action = Literal["activate", "suspend", "reinstate", "inactivate"]

# Which states each action starts from, and where it leads.
TRANSITIONS: dict[Action, tuple[frozenset[str], State]] = {
    "activate": (frozenset({"pending", "inactive"}), "active"),
    "suspend": (frozenset({"active"}), "suspended"),
    "reinstate": (frozenset({"suspended"}), "active"),
    "inactivate": (frozenset({"pending", "active", "suspended"}), "inactive"),
}

# BR-015 asks for a recorded reason; the BRD gives no list.
# [ASSUMPTION] These codes are proposed and need sponsor confirmation.
REASONS: dict[Action, tuple[str, ...]] = {
    "activate": ("identity_verified", "rejoined", "other"),
    "suspend": ("conduct_investigation", "security_concern", "member_request", "other"),
    "reinstate": ("investigation_closed", "appeal_upheld", "member_request", "other"),
    "inactivate": ("member_request", "deceased", "duplicate_account", "other"),
}


def check_change(
    action: Action, current: State, identity_verified: bool, reason_code: str, note: str | None
) -> list[str]:
    """Everything wrong with a proposed change; an empty list means it may be saved."""
    starts, _ = TRANSITIONS[action]
    problems = [] if current in starts else [f"not_allowed_from:{current}"]
    if action == "activate" and not identity_verified:
        problems.append("identity_not_verified")
    if reason_code not in REASONS[action]:
        problems.append("reason_required")
    elif reason_code == "other" and not (note and note.strip()):
        problems.append("note_required")
    return problems


def state_after(action: Action) -> State:
    return TRANSITIONS[action][1]


# --- Consent (ENT-05, BR-008, FR-AUTH-010, FR-REG-003) -------------------------------------

ConsentType = Literal["terms_and_privacy", "identity_review"]

# The notice version a member must have been shown. The privacy notices are not
# approved yet (POL-01), so these are draft versions; when a notice changes, its
# version changes and members are asked again.
NOTICE_VERSIONS: dict[ConsentType, str] = {
    "terms_and_privacy": "draft-2026-10",
    "identity_review": "draft-2026-10",
}
