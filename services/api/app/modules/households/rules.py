"""Pure business rules for the My Household module (BRD v1.1 FR-HH-001 to 010, BR-098 to 101).

Key rules:
- BR-098: Voluntary household module. Never a compulsory requirement for any party service or membership.
- BR-099: Adult members require explicit mutual consent; an invitation must be explicitly accepted.
- BR-100: A member can belong to at most one active household at any time.
- BR-101: Purpose separation: household data is collected solely for family/community coordination
  and is strictly protected with Row-Level Security. It is never used for political profiling.
"""

import uuid
from datetime import UTC, datetime, timedelta

from app.modules.access.rules import AreaPath, contains
from app.modules.households.schemas import Role

MAX_MEMBERS_PER_HOUSEHOLD = 20
INVITATION_VALIDITY_DAYS = 14


def check_can_create_household(existing_active_membership_id: uuid.UUID | None) -> str | None:
    if existing_active_membership_id is not None:
        return "already_in_household"
    return None


def check_can_invite_adult(
    caller_role: Role | None,
    active_member_count: int,
    inviter_member_id: uuid.UUID,
    invitee_member_id: uuid.UUID,
    invitee_has_active_household: bool,
    invitee_has_pending_invitation: bool,
) -> str | None:
    if caller_role != "head":
        return "only_head_can_invite"
    if active_member_count >= MAX_MEMBERS_PER_HOUSEHOLD:
        return "household_size_limit_reached"
    if inviter_member_id == invitee_member_id:
        return "cannot_invite_self"
    if invitee_has_active_household:
        return "invitee_already_in_household"
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
    # A member can always remove themselves (leave household)
    if target_member_id == caller_member_id:
        return None
    # Only head can remove other members
    if caller_role != "head":
        return "only_head_can_remove_members"
    return None


def staff_can_view_household(
    staff_assignments: list,
    target_member_area_path: AreaPath,
) -> bool:
    """PRM-33: household.view_for_case requires holding the permission over the target member's area."""
    return any(
        "household.view_for_case" in a.permissions and contains(a.area, target_member_area_path)
        for a in staff_assignments
    )
