"""Wings and committees (BRD v1.1 M31, M32, S18, D23; FR-COM-001 to 009, FR-DSP-005, BR-132, RB-08, RB-09).

Three kinds of people act here, each checked on the server:
- members (M31, M32) see the active committees for their area, apply, and inside a committee they
  belong to read its announcements, meetings, approved minutes, tasks, volunteer opportunities,
  the documents their role may open, and its moderated threads;
- a committee's coordinators and secretary (S18) act on that committee only, through their role,
  which is the committee-scoped committee.manage grant (PRM-50);
- administrators (D23) propose wings and committees and assign roles over their area
  (roles.assign), and a Tier 5 approves each one (system.configure). They see the roster and
  activity counts, never the committee's content (RB-08, RB-09).
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import rules as access_rules
from app.modules.access.rules import Area, AreaPath, area_from_key
from app.modules.access.service import AccessRefused, Staff, refuse, visible_areas
from app.modules.audit import service as audit
from app.modules.community.issues.rules import LOCAL_ZONE
from app.modules.engagement.committees import repository, rules
from app.modules.engagement.committees.repository import Committee, Item, Membership, Post
from app.modules.messaging.notifications import service as notifications

REPORT_WINDOW = timedelta(days=90)  # [ASSUMPTION] RPT-23 is weekly; the report shows the last 90 days


class CommitteeRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class CommitteeNotFound(Exception):
    pass


def _today(now: datetime | None = None) -> date:
    return (now or datetime.now(UTC)).astimezone(LOCAL_ZONE).date()


def _path(committee: Committee) -> AreaPath:
    return tuple(area_from_key(key) for key in committee.area_path)


def _member_area_keys(db: Session, member_id: uuid.UUID) -> list[str]:
    return [area.key for area in access_repository.member_area_path(db, member_id)]


def _diaspora_registered(db: Session, member_id: uuid.UUID) -> bool:
    return bool(db.scalar(text("SELECT EXISTS (SELECT 1 FROM diaspora.supporter WHERE member_id = :id)"), {"id": member_id}))


def _holders(db: Session, permission: str, area_path: list[str]) -> list[uuid.UUID]:
    return list(db.scalars(
        text(
            """
            SELECT DISTINCT a.member_id FROM access.staff_assignment a
            JOIN membership.membership ms ON ms.member_id = a.member_id AND ms.state = 'active'
            WHERE a.state = 'active' AND :permission = ANY(a.permissions)
              AND (a.review_due_at IS NULL OR a.review_due_at > now())
              AND (a.area_level = 'platform' OR (a.area_level || ':' || a.area_code) = ANY(:path))
            """
        ),
        {"permission": permission, "path": area_path},
    ))


# --- Members (M31, M32) -----------------------------------------------------------------------------------


@dataclass(frozen=True)
class CommitteeCard:
    committee: Committee
    membership: Membership | None
    apply_problem: str | None  # why the member cannot apply now, or None


def _apply_problem(db: Session, member_id: uuid.UUID, committee: Committee, membership: Membership | None,
                   area_keys: list[str]) -> str | None:
    status = access_repository.find_member_status(db, member_id)
    if status is None:
        return "membership_not_active"
    return rules.check_application(
        committee_state=committee.state,
        committee_kind=committee.kind,
        wing_type=committee.wing_type,
        in_scope=committee.area_key == "platform" or committee.area_key in area_keys,
        identity_verified=status.identity_verified,
        membership_active=status.membership_active,
        diaspora_registered=_diaspora_registered(db, member_id),
        birth_date=repository.birth_date(db, member_id),
        today=_today(),
        existing_state=membership.state if membership else None,
    )


def member_committees(db: Session, member_id: uuid.UUID, wing_type: str | None) -> list[CommitteeCard]:
    """M31: approved wings and committees for the member's area, and their own."""
    keys = _member_area_keys(db, member_id)
    mine = repository.memberships_of(db, member_id)
    cards = []
    overseas = _diaspora_registered(db, member_id)
    for committee in repository.active_for_member(db, keys, member_id, wing_type, overseas=overseas):
        membership = mine.get(committee.id)
        if committee.state != "active" and (membership is None or membership.state != "approved"):
            continue  # a closed committee stays listed only for its former members' record
        cards.append(CommitteeCard(committee, membership, _apply_problem(db, member_id, committee, membership, keys)))
    return cards


@dataclass(frozen=True)
class Space:
    committee: Committee
    membership: Membership | None
    apply_problem: str | None
    items: list[Item]  # only for an approved member, filtered by what their role may open
    own_waiting: list[Item]
    my_signups: set[uuid.UUID]
    member_id: uuid.UUID


def _visible_committee(db: Session, member_id: uuid.UUID, committee_id: uuid.UUID) -> tuple[Committee, Membership | None]:
    committee = repository.find_committee(db, committee_id)
    membership = repository.find_membership(db, committee_id, member_id)
    keys = _member_area_keys(db, member_id)
    if committee is None or committee.kind != "committee":
        raise CommitteeNotFound()
    if membership is None and (committee.state != "active" or (
            committee.area_key != "platform" and committee.area_key not in keys and committee.wing_type != rules.DIASPORA_WING)):
        raise CommitteeNotFound()
    return committee, membership


def _approved(membership: Membership | None) -> bool:
    return membership is not None and membership.state == "approved"


def space(db: Session, member_id: uuid.UUID, committee_id: uuid.UUID) -> Space:
    """M32: everything inside the committee for an approved member; for anyone else only the committee's
    public description and their application (FR-COM-004: non-members see no announcements)."""
    committee, membership = _visible_committee(db, member_id, committee_id)
    problem = _apply_problem(db, member_id, committee, membership, _member_area_keys(db, member_id))
    if not _approved(membership) or committee.state != "active":
        return Space(committee, membership, problem, [], [], set(), member_id)
    assert membership is not None
    shown = [
        item for item in repository.items(db, committee_id, states=["published"])
        if item.item_type != "document" or rules.can_open_document(membership.role, item.access_roles)
    ]
    signups = repository.my_signups(db, member_id, [i.id for i in shown if i.item_type == "volunteer"])
    return Space(committee, membership, problem, shown, repository.own_waiting_items(db, committee_id, member_id),
                 signups, member_id)


def apply(db: Session, member_id: uuid.UUID, committee_id: uuid.UUID, note: str | None, ip: str) -> Membership:
    """FR-COM-002: access opens only after a coordinator approves."""
    committee, membership = _visible_committee(db, member_id, committee_id)
    problem = _apply_problem(db, member_id, committee, membership, _member_area_keys(db, member_id))
    if problem:
        raise CommitteeRefused(problem)
    membership_id = repository.save_application(db, committee_id, member_id, (note or "").strip() or None)
    for coordinator in repository.holders_of_roles(db, committee_id, ["coordinator"]):
        notifications.notify(db, coordinator, "committee_application_received", committee_id)
    audit.record(db, actor_id=member_id, action="committee.application.made", target_type="committee_membership",
                 target_id=str(membership_id), area_path=_path(committee), ip=ip)
    db.commit()
    found = repository.find_membership_by_id(db, membership_id)
    assert found is not None
    return found


def leave(db: Session, member_id: uuid.UUID, committee_id: uuid.UUID, ip: str) -> None:
    """Withdraw an application, or leave the committee; access ends at once."""
    committee = repository.find_committee(db, committee_id, lock=True)
    membership = repository.find_membership(db, committee_id, member_id, lock=True)
    if committee is None or membership is None or membership.state not in ("applied", "approved"):
        raise CommitteeNotFound()
    if membership.state == "approved":
        problem = rules.check_removal(current_role=membership.role,
                                      coordinators=len(repository.holders_of_roles(db, committee_id, ["coordinator"])))
        if problem and committee.state == "active":
            raise CommitteeRefused(problem)
    now = datetime.now(UTC)
    state = "withdrawn" if membership.state == "applied" else "left"
    repository.update_membership(db, membership.id, {"state": state, "role": None, "ended_by": member_id, "ended_at": now})
    audit.record(db, actor_id=member_id, action=f"committee.membership.{state}", target_type="committee_membership",
                 target_id=str(membership.id), area_path=_path(committee), ip=ip)
    db.commit()


def _member_of(db: Session, member_id: uuid.UUID, committee_id: uuid.UUID) -> tuple[Committee, Membership]:
    committee, membership = _visible_committee(db, member_id, committee_id)
    if not _approved(membership) or committee.state != "active":
        raise CommitteeRefused("not_a_member")
    assert membership is not None
    return committee, membership


def _item_in(db: Session, committee_id: uuid.UUID, item_id: uuid.UUID, *, lock: bool = False) -> Item:
    item = repository.find_item(db, item_id, lock=lock)
    if item is None or item.committee_id != committee_id:
        raise CommitteeNotFound()
    return item


@dataclass(frozen=True)
class ThreadView:
    thread: Item
    posts: list[Post]
    can_moderate: bool


def thread(db: Session, member_id: uuid.UUID, committee_id: uuid.UUID, thread_id: uuid.UUID) -> ThreadView:
    _, membership = _member_of(db, member_id, committee_id)
    item = _item_in(db, committee_id, thread_id)
    moderator = membership.role in rules.MODERATOR_ROLES
    visible = item.state == "published" or (item.author_id == member_id and item.state in ("awaiting_approval", "returned")) or (
        moderator and item.state == "awaiting_approval")
    if item.item_type != "thread" or not visible:
        raise CommitteeNotFound()
    return ThreadView(item, repository.posts(db, thread_id, viewer=member_id, moderator=moderator), moderator)


def reply(db: Session, member_id: uuid.UUID, committee_id: uuid.UUID, thread_id: uuid.UUID, body: str, ip: str) -> Post:
    """FR-COM-008: a reply inside the committee's thread; never to one person."""
    committee, membership = _member_of(db, member_id, committee_id)
    item = _item_in(db, committee_id, thread_id)
    if item.item_type != "thread" or item.state != "published":
        raise CommitteeRefused("thread_not_open")
    state = "awaiting_approval" if membership.role in rules.PRE_MODERATED_ROLES else "published"
    post_id = repository.insert_post(db, thread_id, member_id, body.strip(), state)
    audit.record(db, actor_id=member_id, action="committee.post.made", target_type="committee_post",
                 target_id=str(post_id), area_path=_path(committee), ip=ip)
    db.commit()
    found = repository.find_post(db, post_id)
    assert found is not None
    return found


def complete_task(db: Session, member_id: uuid.UUID, committee_id: uuid.UUID, item_id: uuid.UUID, ip: str) -> Item:
    """The person the task was given to marks it done; a coordinator may too."""
    committee, membership = _member_of(db, member_id, committee_id)
    item = _item_in(db, committee_id, item_id, lock=True)
    if item.item_type != "task" or item.state != "published":
        raise CommitteeNotFound()
    if item.assignee_id != member_id and membership.role != "coordinator":
        raise CommitteeRefused("not_your_task")
    if item.done_at is not None:
        raise CommitteeRefused("already_done")
    repository.update_item(db, item_id, {"done_at": datetime.now(UTC), "done_by": member_id})
    audit.record(db, actor_id=member_id, action="committee.task.done", target_type="committee_item",
                 target_id=str(item_id), area_path=_path(committee), ip=ip)
    db.commit()
    found = repository.find_item(db, item_id)
    assert found is not None
    return found


def set_signup(db: Session, member_id: uuid.UUID, committee_id: uuid.UUID, item_id: uuid.UUID, signed_up: bool,
               ip: str) -> Item:
    """FR-COM-006: offer to help with a committee's volunteer opportunity before its due date, while places remain."""
    committee, _ = _member_of(db, member_id, committee_id)
    item = _item_in(db, committee_id, item_id, lock=True)
    if item.item_type != "volunteer" or item.state != "published":
        raise CommitteeNotFound()
    if signed_up:
        if item.due_on is not None and item.due_on < _today():
            raise CommitteeRefused("due_date_past")
        if member_id in repository.my_signups(db, member_id, [item_id]):
            raise CommitteeRefused("already_signed_up")
        if item.places is not None and item.signups >= item.places:
            raise CommitteeRefused("no_places_left")
        repository.sign_up(db, item_id, member_id)
    elif not repository.withdraw_signup(db, item_id, member_id):
        raise CommitteeRefused("not_signed_up")
    audit.record(db, actor_id=member_id, action="committee.volunteer." + ("signed_up" if signed_up else "withdrawn"),
                 target_type="committee_item", target_id=str(item_id), area_path=_path(committee), ip=ip)
    db.commit()
    found = repository.find_item(db, item_id)
    assert found is not None
    return found


# --- Coordinators and secretaries (S18) --------------------------------------------------------------------


def coordinating(db: Session, member_id: uuid.UUID) -> list[repository.Coordinating]:
    return repository.coordinating(db, member_id)


def _officer(db: Session, member_id: uuid.UUID, committee_id: uuid.UUID, roles: frozenset[str], ip: str,
             *, lock: bool = False) -> tuple[Committee, Membership]:
    """The committee and the actor's membership, when they hold one of the roles in this committee (RB-09).
    Anyone else, staff included, is refused: geography alone never opens a committee (RB-08)."""
    committee = repository.find_committee(db, committee_id, lock=lock)
    membership = repository.find_membership(db, committee_id, member_id)
    if committee is None or committee.kind != "committee":
        raise CommitteeNotFound()
    if committee.state != "active" or not _approved(membership) or membership is None or membership.role not in roles:
        audit.record(db, actor_id=member_id, action="committee.access_refused", target_type="committee",
                     target_id=str(committee_id), area_path=_path(committee), details={"reason": "not_an_officer"}, ip=ip)
        db.commit()
        raise AccessRefused("not_committee_officer")
    return committee, membership


COORDINATOR = frozenset({"coordinator"})
OFFICERS = frozenset({"coordinator", "secretary"})


@dataclass(frozen=True)
class ManageView:
    committee: Committee
    role: str
    applications: list[Membership]
    roster: list[Membership]
    waiting_items: list[Item]
    waiting_posts: list[tuple[Post, str]]
    recent_items: list[Item]
    report: dict[str, int]
    report_since: datetime


def manage_view(db: Session, member_id: uuid.UUID, committee_id: uuid.UUID, ip: str) -> ManageView:
    """S18: what the coordinator or secretary works on, for this committee only (FR-COM-009)."""
    committee, membership = _officer(db, member_id, committee_id, OFFICERS, ip)
    assert membership.role is not None
    since = datetime.now(UTC) - REPORT_WINDOW
    coordinator = membership.role == "coordinator"
    return ManageView(
        committee=committee,
        role=membership.role,
        applications=repository.roster(db, committee_id, ["applied"]) if coordinator else [],
        roster=repository.roster(db, committee_id, ["approved"]),
        waiting_items=repository.items(db, committee_id, states=["awaiting_approval"]),
        waiting_posts=repository.waiting_posts(db, committee_id),
        recent_items=repository.items(db, committee_id, states=["published"], limit=100),
        report=repository.activity(db, committee_id, since, _today()),
        report_since=since,
    )


def decide_application(db: Session, member_id: uuid.UUID, committee_id: uuid.UUID, membership_id: uuid.UUID,
                       approve: bool, role: str, reason: str | None, ip: str) -> Membership:
    """FR-COM-002, 003: the coordinator approves with a role, or declines with a reason."""
    committee, _ = _officer(db, member_id, committee_id, COORDINATOR, ip, lock=True)
    application = repository.find_membership_by_id(db, membership_id, lock=True)
    if application is None or application.committee_id != committee_id:
        raise CommitteeNotFound()
    if application.state != "applied":
        raise CommitteeRefused(f"not_allowed_from:{application.state}")
    now = datetime.now(UTC)
    if approve:
        repository.update_membership(db, membership_id, {"state": "approved", "role": role, "decided_by": member_id,
                                                         "decided_at": now, "role_set_by": member_id, "role_set_at": now})
    else:
        if not (reason and reason.strip()):
            raise CommitteeRefused("reason_required")
        repository.update_membership(db, membership_id, {"state": "declined", "decided_by": member_id, "decided_at": now,
                                                         "decision_reason": reason.strip()})
    notifications.notify(db, application.member_id, "committee_application_decided", committee_id)
    if not repository.roster(db, committee_id, ["applied"]):
        notifications.complete_action(db, "committee_applications", committee_id)
    audit.record(db, actor_id=member_id, action="committee.application." + ("approved" if approve else "declined"),
                 target_type="committee_membership", target_id=str(membership_id), area_path=_path(committee),
                 details={"role": role} if approve else None, ip=ip)
    db.commit()
    found = repository.find_membership_by_id(db, membership_id)
    assert found is not None
    return found


def _change_role(db: Session, actor_id: uuid.UUID, committee: Committee, target: Membership, role: str, ip: str) -> None:
    problem = rules.check_role_change(new_role=role, current_role=target.role,
                                      coordinators=len(repository.holders_of_roles(db, committee.id, ["coordinator"])))
    if problem:
        raise CommitteeRefused(problem)
    repository.update_membership(db, target.id, {"role": role, "role_set_by": actor_id, "role_set_at": datetime.now(UTC)})
    notifications.notify(db, target.member_id, "committee_role_changed", committee.id)
    # FR-COM-003: every role change is logged with the person who made it.
    audit.record(db, actor_id=actor_id, action="committee.role.changed", target_type="committee_membership",
                 target_id=str(target.id), area_path=_path(committee),
                 details={"from": target.role, "to": role}, ip=ip)


def set_role(db: Session, member_id: uuid.UUID, committee_id: uuid.UUID, membership_id: uuid.UUID, role: str,
             ip: str) -> Membership:
    """S18: a coordinator assigns coordinator, secretary and member roles inside the committee."""
    committee, _ = _officer(db, member_id, committee_id, COORDINATOR, ip, lock=True)
    target = repository.find_membership_by_id(db, membership_id, lock=True)
    if target is None or target.committee_id != committee_id or target.state != "approved":
        raise CommitteeNotFound()
    _change_role(db, member_id, committee, target, role, ip)
    db.commit()
    found = repository.find_membership_by_id(db, membership_id)
    assert found is not None
    return found


def _remove(db: Session, actor_id: uuid.UUID, committee: Committee, target: Membership, reason: str, ip: str) -> None:
    if not reason.strip():
        raise CommitteeRefused("reason_required")
    problem = rules.check_removal(current_role=target.role,
                                  coordinators=len(repository.holders_of_roles(db, committee.id, ["coordinator"])))
    if problem:
        raise CommitteeRefused(problem)
    repository.update_membership(db, target.id, {"state": "removed", "role": None, "ended_by": actor_id,
                                                 "ended_at": datetime.now(UTC), "decision_reason": reason.strip()})
    audit.record(db, actor_id=actor_id, action="committee.membership.removed", target_type="committee_membership",
                 target_id=str(target.id), area_path=_path(committee), ip=ip)


def remove_member(db: Session, member_id: uuid.UUID, committee_id: uuid.UUID, membership_id: uuid.UUID, reason: str,
                  ip: str) -> None:
    """Removed: their access to the committee ends at once (M32 "Removed → access ends")."""
    committee, _ = _officer(db, member_id, committee_id, COORDINATOR, ip, lock=True)
    target = repository.find_membership_by_id(db, membership_id, lock=True)
    if target is None or target.committee_id != committee_id or target.state != "approved":
        raise CommitteeNotFound()
    if target.member_id == member_id:
        raise CommitteeRefused("leave_instead")
    _remove(db, member_id, committee, target, reason, ip)
    db.commit()


def create_item(db: Session, member_id: uuid.UUID, committee_id: uuid.UUID, values: dict[str, Any], ip: str) -> Item:
    """FR-COM-004 to 008: post or record something for this committee only."""
    item_type = values["item_type"]
    if item_type == "thread":
        committee, membership = _member_of(db, member_id, committee_id)
    else:
        committee, membership = _officer(db, member_id, committee_id, OFFICERS, ip)
    if not rules.can_post(membership.role, item_type):
        raise AccessRefused("coordinator_only")
    assignee_id = None
    if item_type == "task":
        assignee = repository.find_membership_by_id(db, values["assignee_membership_id"]) if values.get(
            "assignee_membership_id") else None
        if assignee is None or assignee.committee_id != committee_id or assignee.state != "approved":
            raise CommitteeRefused("assignee_not_a_member")
        assignee_id = assignee.member_id
    meeting_given = False
    if item_type == "minutes" and values.get("meeting_id"):
        meeting = repository.find_item(db, values["meeting_id"])
        if meeting is None or meeting.committee_id != committee_id or meeting.item_type != "meeting":
            raise CommitteeRefused("meeting_required")
        meeting_given = True
    starts_at, ends_at = values.get("starts_at"), values.get("ends_at")
    access_roles = sorted(set(values.get("access_roles") or rules.ROLES))
    problems = rules.check_item(
        item_type=item_type,
        starts_at_given=starts_at is not None,
        ends_before_start=starts_at is not None and ends_at is not None and ends_at <= starts_at,
        meeting_given=meeting_given,
        due_on=values.get("due_on"),
        today=_today(),
        assignee_given=assignee_id is not None,
        places=values.get("places"),
        access_roles=access_roles,
    )
    if problems:
        raise CommitteeRefused(problems)
    assert membership.role is not None
    row = {
        "committee_id": committee_id,
        "item_type": item_type,
        "title": values["title"].strip(),
        "body": values["body"].strip(),
        "author_id": member_id,
        "state": rules.initial_state(membership.role, item_type),
        "starts_at": starts_at if item_type == "meeting" else None,
        "ends_at": ends_at if item_type == "meeting" else None,
        "place": (values.get("place") or "").strip() or None if item_type == "meeting" else None,
        "meeting_id": values.get("meeting_id") if item_type == "minutes" else None,
        "due_on": values.get("due_on") if item_type in ("task", "volunteer") else None,
        "assignee_id": assignee_id,
        "places": values.get("places") if item_type == "volunteer" else None,
        "access_roles": access_roles if item_type == "document" else list(rules.ROLES),
    }
    item_id = repository.insert_item(db, row)
    if item_type == "task" and assignee_id is not None:
        notifications.notify(db, assignee_id, "committee_task_assigned", committee_id)
    elif item_type == "announcement":
        for person in repository.approved_member_ids(db, committee_id):
            if person != member_id:
                notifications.notify(db, person, "committee_announcement", committee_id)
    elif item_type == "minutes":
        for coordinator in repository.holders_of_roles(db, committee_id, ["coordinator"]):
            if coordinator != member_id:
                notifications.notify(db, coordinator, "committee_minutes_waiting", committee_id)
    audit.record(db, actor_id=member_id, action=f"committee.{item_type}.posted", target_type="committee_item",
                 target_id=str(item_id), area_path=_path(committee), ip=ip)
    db.commit()
    found = repository.find_item(db, item_id)
    assert found is not None
    return found


def decide_item(db: Session, member_id: uuid.UUID, committee_id: uuid.UUID, item_id: uuid.UUID, approve: bool,
                reason: str | None, ip: str) -> Item:
    """Minutes are approved by a coordinator other than their author (FR-COM-005); a member's thread
    by a coordinator or secretary (FR-COM-008). A returned item keeps the reason for its author."""
    committee, membership = _officer(db, member_id, committee_id, OFFICERS, ip, lock=True)
    item = _item_in(db, committee_id, item_id, lock=True)
    if item.state != "awaiting_approval":
        raise CommitteeRefused(f"not_allowed_from:{item.state}")
    if item.item_type == "minutes":
        problem = rules.check_minutes_decision(author=item.author_id, approver=member_id, approver_role=membership.role)
        if problem:
            raise AccessRefused(problem)
    elif item.item_type != "thread":
        raise CommitteeRefused("nothing_to_decide")
    if not approve and not (reason and reason.strip()):
        raise CommitteeRefused("reason_required")
    repository.update_item(db, item_id, {
        "state": "published" if approve else "returned", "decided_by": member_id, "decided_at": datetime.now(UTC),
        "decision_reason": None if approve else (reason or "").strip(),
    })
    if item.item_type == "minutes" and not [i for i in repository.items(db, committee_id, states=["awaiting_approval"])
                                            if i.item_type == "minutes" and i.id != item_id]:
        notifications.complete_action(db, "committee_minutes", committee_id)
    audit.record(db, actor_id=member_id, action=f"committee.{item.item_type}." + ("approved" if approve else "returned"),
                 target_type="committee_item", target_id=str(item_id), area_path=_path(committee), ip=ip)
    db.commit()
    found = repository.find_item(db, item_id)
    assert found is not None
    return found


def hide_item(db: Session, member_id: uuid.UUID, committee_id: uuid.UUID, item_id: uuid.UUID, reason: str, ip: str) -> Item:
    """A coordinator takes anything down; a secretary only discussion threads. Nothing is deleted."""
    committee, membership = _officer(db, member_id, committee_id, OFFICERS, ip, lock=True)
    item = _item_in(db, committee_id, item_id, lock=True)
    if membership.role != "coordinator" and item.item_type != "thread":
        raise AccessRefused("coordinator_only")
    if item.state == "hidden":
        raise CommitteeRefused("already_hidden")
    if not reason.strip():
        raise CommitteeRefused("reason_required")
    repository.update_item(db, item_id, {"state": "hidden", "hidden_by": member_id, "hidden_at": datetime.now(UTC),
                                         "hidden_reason": reason.strip()})
    audit.record(db, actor_id=member_id, action="committee.item.hidden", target_type="committee_item",
                 target_id=str(item_id), area_path=_path(committee), ip=ip)
    db.commit()
    found = repository.find_item(db, item_id)
    assert found is not None
    return found


def decide_post(db: Session, member_id: uuid.UUID, committee_id: uuid.UUID, post_id: uuid.UUID, decision: str,
                reason: str | None, ip: str) -> Post:
    """FR-COM-008: publish or return a waiting reply, or hide a published one, with a reason."""
    committee, _ = _officer(db, member_id, committee_id, OFFICERS, ip, lock=True)
    post = repository.find_post(db, post_id, lock=True)
    thread_item = repository.find_item(db, post.thread_id) if post else None
    if post is None or thread_item is None or thread_item.committee_id != committee_id:
        raise CommitteeNotFound()
    allowed = {"publish": ("awaiting_approval",), "return": ("awaiting_approval",), "hide": ("published",)}
    if post.state not in allowed[decision]:
        raise CommitteeRefused(f"not_allowed_from:{post.state}")
    if decision != "publish" and not (reason and reason.strip()):
        raise CommitteeRefused("reason_required")
    state = {"publish": "published", "return": "returned", "hide": "hidden"}[decision]
    repository.update_post(db, post_id, {"state": state, "decided_by": member_id,
                                         "decision_reason": None if decision == "publish" else (reason or "").strip()})
    audit.record(db, actor_id=member_id, action=f"committee.post.{state}", target_type="committee_post",
                 target_id=str(post_id), area_path=_path(committee), ip=ip)
    db.commit()
    found = repository.find_post(db, post_id)
    assert found is not None
    return found


def signups(db: Session, member_id: uuid.UUID, committee_id: uuid.UUID, item_id: uuid.UUID, ip: str) -> list[str]:
    """Who offered to help: the coordinator plans with the committee's own volunteers."""
    _officer(db, member_id, committee_id, OFFICERS, ip)
    item = _item_in(db, committee_id, item_id)
    if item.item_type != "volunteer":
        raise CommitteeNotFound()
    return repository.signup_names(db, item_id)


# --- Administrators (D23) ----------------------------------------------------------------------------------

ADMIN_PERMISSIONS = (rules.ADMINISTER, rules.APPROVE)


def _admin_areas(staff: Staff) -> list[str] | None:
    keys: set[str] = set()
    for permission in ADMIN_PERMISSIONS:
        if not access_rules.holds(staff.rule_assignments(), permission):
            continue
        areas = visible_areas(staff, permission)
        if areas is None:
            return None
        keys.update(areas)
    return sorted(keys)


def _require(db: Session, staff: Staff, permissions: tuple[str, ...], path: AreaPath, ip: str, target: str) -> None:
    if not any(access_rules.holds(staff.rule_assignments(), p, path) for p in permissions):
        refuse(db, staff, "/".join(permissions), "outside_your_area", ip, target=("committee", target), area_path=path)


def admin_list(db: Session, staff: Staff, states: list[str] | None, wing_type: str | None) -> list[Committee]:
    return repository.search_committees(db, states=states, area_keys=_admin_areas(staff), wing_type=wing_type)


def _admin_committee(db: Session, staff: Staff, committee_id: uuid.UUID, permissions: tuple[str, ...], ip: str,
                     *, lock: bool = False) -> Committee:
    committee = repository.find_committee(db, committee_id, lock=lock)
    if committee is None:
        raise CommitteeNotFound()
    _require(db, staff, permissions, _path(committee), ip, str(committee_id))
    return committee


@dataclass(frozen=True)
class AdminView:
    committee: Committee
    roster: list[Membership]
    committees: list[Committee]  # a wing's committees
    report: dict[str, int] | None
    report_since: datetime


def admin_view(db: Session, staff: Staff, committee_id: uuid.UUID, ip: str) -> AdminView:
    """D23: the committee, its roster with roles, and its activity in numbers; never its content (RB-08)."""
    committee = _admin_committee(db, staff, committee_id, ADMIN_PERMISSIONS, ip)
    since = datetime.now(UTC) - REPORT_WINDOW
    children = [c for c in repository.search_committees(db, states=None, area_keys=None, wing_type=committee.wing_type)
                if c.wing_id == committee.id] if committee.kind == "wing" else []
    roster = repository.roster(db, committee_id, ["approved", "applied"]) if committee.kind == "committee" else []
    report = repository.activity(db, committee_id, since, _today()) if committee.kind == "committee" else None
    return AdminView(committee, roster, children, report, since)


def propose(db: Session, staff: Staff, values: dict[str, Any], area: Area, ip: str) -> Committee:
    """FR-COM-001: a proposed wing or committee exists for members only after a Tier 5 approves it."""
    path = access_repository.area_path(db, area)
    if path is None:
        raise CommitteeRefused("unknown_area")
    _require(db, staff, ADMIN_PERMISSIONS, path, ip, "new")
    wing = repository.find_committee(db, values["wing_id"]) if values.get("wing_id") else None
    if wing is not None and wing.kind != "wing":
        wing = None
    problems = rules.check_proposal(kind=values["kind"], wing_state=wing.state if wing else None,
                                    wing_type_matches=wing is not None and wing.wing_type == values["wing_type"])
    if wing is not None and values["kind"] == "committee" and not access_rules.contains(area_from_key(wing.area_key), path):
        problems.append("outside_wing_area")
    if problems:
        raise CommitteeRefused(problems)
    committee_id = repository.insert_committee(
        db, {**values, "wing_id": wing.id if (wing and values["kind"] == "committee") else None},
        area_key=area.key, area_path=[a.key for a in path], proposed_by=staff.member_id,
    )
    for approver in _holders(db, rules.APPROVE, [a.key for a in path]):
        if approver != staff.member_id:
            notifications.notify(db, approver, "committee_approval_needed", committee_id)
    audit.record(db, actor_id=staff.member_id, action=f"committee.{values['kind']}.proposed", target_type="committee",
                 target_id=str(committee_id), area_path=path, details={"wingType": values["wing_type"]}, ip=ip)
    db.commit()
    found = repository.find_committee(db, committee_id)
    assert found is not None
    return found


def decide(db: Session, staff: Staff, committee_id: uuid.UUID, approve: bool, reason: str | None, ip: str) -> Committee:
    """FR-COM-001: only Tier 5 approves (system.configure is a Tier 5 permission)."""
    committee = _admin_committee(db, staff, committee_id, (rules.APPROVE,), ip, lock=True)
    if committee.state != "proposed":
        raise CommitteeRefused(f"not_allowed_from:{committee.state}")
    if committee.wing_id is not None and approve:
        wing = repository.find_committee(db, committee.wing_id)
        if wing is None or wing.state != "active":
            raise CommitteeRefused("wing_not_active")
    if not approve and not (reason and reason.strip()):
        raise CommitteeRefused("reason_required")
    repository.update_committee(db, committee_id, {
        "state": "active" if approve else "rejected", "decided_by": staff.member_id, "decided_at": datetime.now(UTC),
        "decision_reason": (reason or "").strip() or None,
    })
    notifications.complete_action(db, "committee_admin", committee_id)
    if approve and committee.wing_type == rules.DIASPORA_WING and committee.kind == "committee":
        # FR-DSP-005: overseas supporters who asked to hear about networking committees are told.
        for supporter in db.scalars(text(
                "SELECT member_id FROM diaspora.supporter WHERE 'committee_networking' = ANY(contact_topics)")):
            notifications.notify(db, supporter, "diaspora_committee_opened", committee_id)
    audit.record(db, actor_id=staff.member_id, action="committee." + ("approved" if approve else "rejected"),
                 target_type="committee", target_id=str(committee_id), area_path=_path(committee), ip=ip)
    db.commit()
    found = repository.find_committee(db, committee_id)
    assert found is not None
    return found


def close(db: Session, staff: Staff, committee_id: uuid.UUID, reason: str, ip: str) -> Committee:
    """A Tier 5 closes a wing or committee with a reason; its records stay (life of committee + 2 years, ENT-48)."""
    committee = _admin_committee(db, staff, committee_id, (rules.APPROVE,), ip, lock=True)
    if committee.state != "active":
        raise CommitteeRefused(f"not_allowed_from:{committee.state}")
    if committee.kind == "wing" and any(
            c.state in ("active", "proposed") for c in repository.search_committees(
                db, states=None, area_keys=None, wing_type=committee.wing_type) if c.wing_id == committee.id):
        raise CommitteeRefused("wing_has_open_committees")
    if not reason.strip():
        raise CommitteeRefused("reason_required")
    repository.update_committee(db, committee_id, {"state": "closed", "closed_by": staff.member_id,
                                                   "closed_at": datetime.now(UTC), "close_reason": reason.strip()})
    audit.record(db, actor_id=staff.member_id, action="committee.closed", target_type="committee",
                 target_id=str(committee_id), area_path=_path(committee), ip=ip)
    db.commit()
    found = repository.find_committee(db, committee_id)
    assert found is not None
    return found


def grant_role(db: Session, staff: Staff, committee_id: uuid.UUID, member_code: str, role: str, ip: str) -> Membership:
    """FR-COM-003: an explicit grant of a committee role by the role administrator, logged with them.
    [ASSUMPTION] The person needs a Verified identity and an Active membership, as staff roles do (BR-097)."""
    committee = _admin_committee(db, staff, committee_id, ADMIN_PERMISSIONS, ip, lock=True)
    if committee.kind != "committee" or committee.state != "active":
        raise CommitteeRefused("committee_not_open")
    found_member = access_repository.resolve_member_by_code(db, member_code)
    if found_member is None:
        raise CommitteeRefused("unknown_member")
    person_id = found_member[0]
    status = access_repository.find_member_status(db, person_id)
    if status is None or not status.identity_verified:
        raise CommitteeRefused("identity_not_verified")
    if not status.membership_active:
        raise CommitteeRefused("membership_not_active")
    current = repository.find_membership(db, committee_id, person_id, lock=True)
    if current is not None and current.state == "approved":
        if current.role == role:
            raise CommitteeRefused("already_has_role")
        _change_role(db, staff.member_id, committee, current, role, ip)
        membership_id = current.id
    else:
        membership_id = repository.grant_role(db, committee_id, person_id, role, staff.member_id)
        notifications.notify(db, person_id, "committee_role_changed", committee_id)
        audit.record(db, actor_id=staff.member_id, action="committee.role.granted", target_type="committee_membership",
                     target_id=str(membership_id), area_path=_path(committee), details={"to": role}, ip=ip)
    db.commit()
    found = repository.find_membership_by_id(db, membership_id)
    assert found is not None
    return found


def admin_remove(db: Session, staff: Staff, committee_id: uuid.UUID, membership_id: uuid.UUID, reason: str,
                 ip: str) -> None:
    committee = _admin_committee(db, staff, committee_id, ADMIN_PERMISSIONS, ip, lock=True)
    target = repository.find_membership_by_id(db, membership_id, lock=True)
    if target is None or target.committee_id != committee_id or target.state != "approved":
        raise CommitteeNotFound()
    if target.member_id == staff.member_id:
        raise CommitteeRefused("own_record")
    _remove(db, staff.member_id, committee, target, reason, ip)
    db.commit()
