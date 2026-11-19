"""Certificate rules (BRD M34, D25, INT-22, FR-RNW-004 to 008, BR-137) as plain functions.

Three kinds: a membership certificate for an Active member, an event-participation certificate
from recorded attendance, and a volunteer-service certificate from completed assignments. Each
carries a revocable token in its QR; only the token's hash is stored. A revoked certificate
verifies as Revoked and a reissued one as Superseded. The public check shows only the type, the
holder's name, the issue date and the status, and never an NIC or passport number.
"""

from typing import Literal

ISSUE_REVOKE = "certificate.issue_revoke"  # PRM-52

Kind = Literal["membership", "event_participation", "volunteer_service"]
KINDS: tuple[Kind, ...] = ("membership", "event_participation", "volunteer_service")
Status = Literal["valid", "revoked", "superseded"]

# [ASSUMPTION] FR-RNW-006's example lists three completed assignments; one is enough to have
# something true to certify, and the certificate lists every one.
MIN_VOLUNTEER_ASSIGNMENTS = 1
# Most assignments a certificate lists; older ones are counted but not named.
LISTED_ASSIGNMENTS = 20

# [ASSUMPTION] INT-22 asks for a rate limit without a figure: 30 checks an hour from one address
# is far beyond a person scanning certificates and stops a script guessing tokens.
CHECKS_PER_HOUR = 30
CHECK_WINDOW = "1 hour"

REASON_MIN = 3
REASON_MAX = 500


def check_issue(
    kind: Kind,
    *,
    identity_verified: bool,
    membership_active: bool,
    attended_event: bool,
    completed_assignments: int,
) -> list[str]:
    """Everything that stops a certificate of this kind being issued now; empty means it may be."""
    if kind == "membership":
        problems = []
        if not identity_verified:
            problems.append("identity_not_verified")
        if not membership_active:
            problems.append("membership_not_active")
        return problems
    if kind == "event_participation":
        return [] if attended_event else ["no_attendance_recorded"]
    return [] if completed_assignments >= MIN_VOLUNTEER_ASSIGNMENTS else ["no_completed_assignments"]


def check_status_change(current: str, reason: str | None) -> list[str]:
    """FR-RNW-008: only a valid certificate is revoked or reissued, always with a reason."""
    problems = [] if current == "valid" else [f"not_allowed_from:{current}"]
    if reason is None or not REASON_MIN <= len(reason.strip()) <= REASON_MAX:
        problems.append("reason_required")
    return problems


def check_rate(recent_checks: int) -> str | None:
    return "too_many_requests" if recent_checks >= CHECKS_PER_HOUR else None
