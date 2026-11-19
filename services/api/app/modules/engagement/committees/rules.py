"""Wings and committees rules (BRD v1.1 FR-COM-001 to 009, BR-132, RB-08, RB-09, OS-17) as plain functions.

A wing or committee is proposed by an administrator (roles.assign over its area, the W09 role
administrator of FR-COM-003) and exists for members only after a Tier 5 approves it (FR-COM-001).
Members apply; a coordinator of that committee approves or declines (FR-COM-002) and gives each
member a role: coordinator, secretary or member (FR-COM-003). Holding the coordinator role is the
explicit, committee-scoped grant of committee.manage (PRM-50, scope C): it opens that committee's
tools only, and nothing about any other committee (RB-09, FR-COM-009).

Committee access is approved membership plus the committee's own scope: being in the area alone
never opens a committee space (RB-08), and staff who administer committees see the roster and
activity counts, never the committee's content. There are no direct messages between members and
no open social feed (OS-17): discussion happens only in moderated threads inside one committee.
"""

from datetime import date
from typing import Literal

ADMINISTER = "roles.assign"  # PRM-06: proposes wings and committees and assigns committee roles (FR-COM-003, W09)
APPROVE = "system.configure"  # PRM-26: held only by Tier 5, who approves each wing and committee (FR-COM-001)
MANAGE = "committee.manage"  # PRM-50: committee-scoped, held through the coordinator role

Kind = Literal["wing", "committee"]
WingType = Literal["youth", "women", "farmers", "fishers", "professional", "diaspora"]
WING_TYPES: tuple[WingType, ...] = ("youth", "women", "farmers", "fishers", "professional", "diaspora")
CommitteeState = Literal["proposed", "active", "rejected", "closed"]
Role = Literal["coordinator", "secretary", "member"]
ROLES: tuple[Role, ...] = ("coordinator", "secretary", "member")
MembershipState = Literal["applied", "approved", "declined", "withdrawn", "left", "removed"]
ItemType = Literal["announcement", "meeting", "minutes", "task", "volunteer", "document", "thread"]
ItemState = Literal["published", "awaiting_approval", "returned", "hidden"]
PostState = Literal["published", "awaiting_approval", "returned", "hidden"]

# OD-15 [ASSUMPTION, BRD recommendation]: the youth wing is for members aged 18 and over unless a
# separate safeguarding policy is approved; none is, and there are no child accounts (OD-31).
YOUTH_WING_MINIMUM_AGE = 18

# MOD-01 [ASSUMPTION]: a thread or reply by an ordinary member is shown to the committee only after
# a coordinator or secretary approves it, as member feedback is elsewhere in the app.
PRE_MODERATED_ROLES: frozenset[str] = frozenset({"member"})

# What each role may post or record. Minutes always wait for a coordinator's approval (FR-COM-005);
# tasks, volunteer opportunities and documents are the coordinator's (FR-COM-006, 007, RB-09).
POSTS_BY_ROLE: dict[str, frozenset[str]] = {
    "coordinator": frozenset({"announcement", "meeting", "minutes", "task", "volunteer", "document", "thread"}),
    "secretary": frozenset({"announcement", "meeting", "minutes", "thread"}),
    "member": frozenset({"thread"}),
}

# [ASSUMPTION] Only coordinators and secretaries see the roster with names; other members see
# how many people belong, so the space never becomes a directory of members (OS-17, RB-09).
ROSTER_ROLES: frozenset[str] = frozenset({"coordinator", "secretary"})

# Who may moderate threads and replies inside the committee (FR-COM-008).
MODERATOR_ROLES: frozenset[str] = frozenset({"coordinator", "secretary"})

# A diaspora committee is where overseas supporters network (FR-DSP-005). [ASSUMPTION] A
# registered overseas supporter may apply to one without a Verified identity; every other wing
# needs a Verified identity and an Active membership, as taking part does elsewhere (FR-HOME-007).
DIASPORA_WING: WingType = "diaspora"

OPEN_APPLICATION = frozenset({"applied"})
CAN_REAPPLY = frozenset({"declined", "withdrawn", "left"})


def age_on(birth: date, today: date) -> int:
    return today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))


def check_proposal(*, kind: str, wing_state: str | None, wing_type_matches: bool) -> list[str]:
    """A committee belongs to an approved wing of the same type; a wing stands on its own."""
    problems = []
    if kind == "committee":
        if wing_state is None:
            problems.append("wing_required")
        elif wing_state != "active":
            problems.append("wing_not_active")
        elif not wing_type_matches:
            problems.append("wing_type_mismatch")
    return problems


def check_application(
    *,
    committee_state: str,
    committee_kind: str,
    wing_type: str,
    in_scope: bool,
    identity_verified: bool,
    membership_active: bool,
    diaspora_registered: bool,
    birth_date: date | None,
    today: date,
    existing_state: str | None,
) -> str | None:
    """FR-COM-002, FR-DSP-005, OD-15: why the member may not apply, or None."""
    if committee_state != "active" or committee_kind != "committee":
        return "committee_not_open"
    if existing_state in OPEN_APPLICATION:
        return "already_applied"
    if existing_state == "approved":
        return "already_member"
    if existing_state == "removed":
        return "removed_by_coordinator"
    overseas = wing_type == DIASPORA_WING and diaspora_registered
    if not overseas:
        if not identity_verified:
            return "identity_not_verified"
        if not membership_active:
            return "membership_not_active"
        if not in_scope:
            return "outside_committee_area"
    if wing_type == "youth":
        if birth_date is None:
            return "age_not_confirmed"
        if age_on(birth_date, today) < YOUTH_WING_MINIMUM_AGE:
            return "below_minimum_age"
    return None


def can_post(role: str | None, item_type: str) -> bool:
    return role is not None and item_type in POSTS_BY_ROLE.get(role, frozenset())


def initial_state(role: str, item_type: str) -> ItemState:
    """Minutes wait for approval; a member's thread waits for moderation; the rest publish at once."""
    if item_type == "minutes" or (item_type == "thread" and role in PRE_MODERATED_ROLES):
        return "awaiting_approval"
    return "published"


def check_item(
    *,
    item_type: str,
    starts_at_given: bool,
    ends_before_start: bool,
    meeting_given: bool,
    due_on: date | None,
    today: date,
    assignee_given: bool,
    places: int | None,
    access_roles: list[str],
) -> list[str]:
    """What each kind of committee item needs (FR-COM-004 to 007)."""
    problems = []
    if item_type == "meeting" and not starts_at_given:
        problems.append("meeting_time_required")
    if ends_before_start:
        problems.append("ends_before_start")
    if item_type == "minutes" and not meeting_given:
        problems.append("meeting_required")
    if item_type in ("task", "volunteer"):
        if due_on is None:
            problems.append("due_date_required")
        elif due_on < today:
            problems.append("due_date_past")
    if item_type == "task" and not assignee_given:
        problems.append("assignee_required")
    if item_type == "volunteer" and places is None:
        problems.append("places_required")
    if item_type == "document" and "coordinator" not in access_roles:
        problems.append("coordinator_must_have_access")
    return problems


def can_open_document(role: str | None, access_roles: list[str]) -> bool:
    """FR-COM-007: only the named roles open a restricted document."""
    return role is not None and role in access_roles


def check_minutes_decision(*, author: object, approver: object, approver_role: str | None) -> str | None:
    """FR-COM-005: a coordinator approves minutes, and never their own."""
    if approver_role != "coordinator":
        return "coordinator_only"
    if author == approver:
        return "own_minutes"
    return None


def check_role_change(*, new_role: str, current_role: str | None, coordinators: int) -> str | None:
    """A committee always keeps at least one coordinator."""
    if current_role == "coordinator" and new_role != "coordinator" and coordinators <= 1:
        return "last_coordinator"
    return None


def check_removal(*, current_role: str | None, coordinators: int) -> str | None:
    if current_role == "coordinator" and coordinators <= 1:
        return "last_coordinator"
    return None


def task_overdue(due_on: date | None, done: bool, today: date) -> bool:
    return due_on is not None and not done and due_on < today
