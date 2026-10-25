"""Appeal rules (BRD FR-IDV-013, PRM-29, M04, D05) as plain functions.

How an overturned appeal is applied, pending sponsor confirmation: the
review goes back to the queue for a fresh decision by someone other than
the original reviewer. The appeal decider does not approve identity
themselves, because only a holder of members.verify, after the checklist
and the evidence, approves (BR-012, FR-WEB-007).
"""

from typing import Literal

APPEAL_DECIDE = "idv.appeal.decide"  # PRM-29

Outcome = Literal["uphold", "overturn"]
AppealState = Literal["submitted", "in_review", "upheld", "overturned"]

STATE_AFTER: dict[Outcome, AppealState] = {"uphold": "upheld", "overturn": "overturned"}

# Review states that follow an adverse decision: Request an update, Unable to verify.
APPEALABLE_REVIEW_STATES = ("needs_update", "unable_to_verify")


def check_appeal(review_state: str | None, already_appealed: bool) -> list[str]:
    """M04: one appeal per adverse decision, against the member's latest decision."""
    if review_state not in APPEALABLE_REVIEW_STATES:
        return ["nothing_to_appeal"]
    if already_appealed:
        return ["appeal_used"]
    return []


def check_claim(
    state: AppealState,
    claimed_by: object | None,
    actor_id: object,
    original_reviewer_id: object,
    claimant_still_authorised: bool,
) -> str | None:
    """D05: one decider at a time, never the person who made the decision under appeal (PRM-29).
    None means the actor may claim it."""
    if state not in ("submitted", "in_review"):
        return "not_open"
    if actor_id == original_reviewer_id:
        return "original_reviewer"
    if claimed_by is None or claimed_by == actor_id or not claimant_still_authorised:
        return None
    return "claimed_by_another"
