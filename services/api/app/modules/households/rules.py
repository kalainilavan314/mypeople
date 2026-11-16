"""Pure business rules for the My Household module (MP-FEA-002 §4.1, BRD v1.1 FR-HH-001 to 010).

Key rules:
- BR-098: Voluntary. Never a condition for any party service or membership.
- M06: one household per identity-verified member; it carries the creator's District, DS and GN.
- BR-099 / M09 / OD-30: an adult joins only by accepting their own invitation, and sets their own
  age band and occupation category.
- M07 / OD-31: a child is a guardian-managed minimum record (first name, relationship, birth year,
  guardian), added by a verified confirmed adult; never an account, photo, ID number or phone.
- BR-101: household data is visible only to its confirmed adults and, with recorded consent, to a
  caseworker; it is never used for political, campaign or fundraising work.
"""

import uuid
from datetime import UTC, datetime

from app.modules.access.rules import AreaPath, contains
from app.modules.households.schemas import Role

MAX_MEMBERS_PER_HOUSEHOLD = 20
INVITATION_VALIDITY_DAYS = 14
ADULT_AGE = 18
PERMISSION_VIEW_FOR_CASE = "household.view_for_case"
# What a departed member's stored name becomes: the column must hold something, and the name is
# no longer needed once they are not in the household (M10 deletion).
ERASED_NAME = "-"


def household_code(household_id: uuid.UUID) -> str:
    """The short household ID shown to the household (M06)."""
    return "HH-" + household_id.hex[:8].upper()


def check_can_create_household(existing_active_membership_id: uuid.UUID | None, identity_verified: bool = True) -> str | None:
    if not identity_verified:
        return "identity_not_verified"
    if existing_active_membership_id is not None:
        return "already_in_household"
    return None


def check_can_invite_adult(
    caller_role: Role | None,
    active_member_count: int,
    inviter_member_id: uuid.UUID,
    invitee_member_id: uuid.UUID,
    invitee_has_pending_invitation: bool,
) -> str | None:
    """Whether the invitee is already in a household is deliberately not checked here: the answer
    would tell the inviter something about another member. Accepting refuses it instead."""
    if caller_role != "head":
        return "only_head_can_invite"
    if active_member_count >= MAX_MEMBERS_PER_HOUSEHOLD:
        return "household_size_limit_reached"
    if inviter_member_id == invitee_member_id:
        return "cannot_invite_self"
    if invitee_has_pending_invitation:
        return "invitation_already_pending"
    return None


def check_can_respond_invitation(
    invitee_member_id: uuid.UUID,
    caller_member_id: uuid.UUID,
    invitation_status: str,
    expires_at: datetime,
    caller_has_active_household: bool,
) -> str | None:
    if caller_member_id != invitee_member_id:
        return "not_your_invitation"
    if invitation_status != "pending":
        return f"invitation_{invitation_status}"
    if datetime.now(UTC) > expires_at:
        return "invitation_expired"
    if caller_has_active_household:
        return "already_in_household"
    return None


def check_can_revoke_invitation(
    caller_member_id: uuid.UUID,
    inviter_member_id: uuid.UUID,
    caller_role: Role | None,
    invitation_status: str,
) -> str | None:
    if caller_member_id != inviter_member_id and caller_role != "head":
        return "only_inviter_or_head_can_revoke"
    if invitation_status != "pending":
        return f"invitation_{invitation_status}"
    return None


def check_can_remove_member(
    caller_member_id: uuid.UUID,
    caller_role: Role | None,
    target_member_id: uuid.UUID | None,
    target_role: Role,
) -> str | None:
    # A member can always remove themselves (leave the household).
    if target_member_id == caller_member_id:
        return None
    if caller_role != "head":
        return "only_head_can_remove_members"
    return None


def check_dependant_birth_year(birth_year: int, current_year: int) -> str | None:
    """A child record is for someone under 18; an adult joins only by accepting an invitation."""
    if birth_year > current_year:
        return "invalid_birth_year"
    if current_year - birth_year >= ADULT_AGE:
        return "dependant_is_adult"
    return None


def check_can_manage_dependant(
    caller_member_id: uuid.UUID,
    caller_role: Role | None,
    guardian_member_id: uuid.UUID | None,
) -> str | None:
    """A child's record is corrected or deleted by its guardian, or by the head of the household."""
    if caller_role == "head" or (guardian_member_id is not None and guardian_member_id == caller_member_id):
        return None
    return "only_guardian_or_head"


def check_can_correct_relationship(caller_role: Role | None, target_role: Role) -> str | None:
    """M10: the head corrects an adult's relationship; the head's own relationship is always 'head'."""
    if caller_role != "head":
        return "only_head_can_correct"
    if target_role != "adult":
        return "not_an_adult_record"
    return None


def check_can_give_caseworker_consent(caller_role: Role | None) -> str | None:
    """Giving caseworker access needs the head; any confirmed adult may withdraw it."""
    if caller_role != "head":
        return "only_head_can_give_consent"
    return None


def log_actor(
    *, action: str, actor_id: uuid.UUID, viewer_id: uuid.UUID, actor_is_current_adult: bool
) -> str:
    """Who did something, as the household's log shows it: a caseworker is never named, and a
    person no longer in the household is shown only as a former member."""
    if action == "staff_view":
        return "caseworker"
    if actor_id == viewer_id:
        return "you"
    if actor_is_current_adult:
        return "household_member"
    return "former_member"


def staff_can_view_household(
    staff_assignments: list,
    target_member_area_path: AreaPath,
) -> bool:
    """PRM-33: household.view_for_case requires holding the permission over the area."""
    return any(
        PERMISSION_VIEW_FOR_CASE in a.permissions and contains(a.area, target_member_area_path)
        for a in staff_assignments
    )
