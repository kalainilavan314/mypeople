"""SQL for wings, committees, their rosters, items, discussion replies and volunteer sign-ups (Alembic 0047)."""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

# --- Wings and committees --------------------------------------------------------------------------------

_COMMITTEE = """
    SELECT c.id, c.committee_ref, c.kind, c.wing_type, c.wing_id, w.name_en AS wing_name_en, w.name_ta AS wing_name_ta,
           c.name_en, c.name_ta, c.purpose_en, c.purpose_ta, c.area_key, c.area_path, c.state, c.proposed_by,
           c.proposed_at, c.decided_by, c.decided_at, c.decision_reason, c.closed_at, c.close_reason,
           (SELECT count(*) FROM engagement.committee_membership m
             WHERE m.committee_id = c.id AND m.state = 'approved')::int AS members,
           (SELECT count(*) FROM engagement.committee_membership m
             WHERE m.committee_id = c.id AND m.state = 'applied')::int AS applications
    FROM engagement.committee c LEFT JOIN engagement.committee w ON w.id = c.wing_id
"""


@dataclass(frozen=True)
class Committee:
    id: uuid.UUID
    committee_ref: str
    kind: str
    wing_type: str
    wing_id: uuid.UUID | None
    wing_name_en: str | None
    wing_name_ta: str | None
    name_en: str
    name_ta: str
    purpose_en: str
    purpose_ta: str
    area_key: str
    area_path: list[str]
    state: str
    proposed_by: uuid.UUID
    proposed_at: datetime
    decided_by: uuid.UUID | None
    decided_at: datetime | None
    decision_reason: str | None
    closed_at: datetime | None
    close_reason: str | None
    members: int
    applications: int


def _committee(row: Any) -> Committee:
    return Committee(**{**row, "area_path": list(row["area_path"])})


COMMITTEE_FIELDS = ("kind", "wing_type", "wing_id", "name_en", "name_ta", "purpose_en", "purpose_ta")


def insert_committee(db: Session, values: dict[str, Any], *, area_key: str, area_path: list[str],
                     proposed_by: uuid.UUID) -> uuid.UUID:
    columns = ", ".join(COMMITTEE_FIELDS)
    params = ", ".join(f":{name}" for name in COMMITTEE_FIELDS)
    return db.scalar(
        text(
            f"""INSERT INTO engagement.committee ({columns}, area_key, area_path, proposed_by)
                VALUES ({params}, :area_key, :area_path, :proposed_by) RETURNING id"""
        ),
        {**{name: values[name] for name in COMMITTEE_FIELDS}, "area_key": area_key, "area_path": area_path,
         "proposed_by": proposed_by},
    )


def update_committee(db: Session, committee_id: uuid.UUID, values: dict[str, Any]) -> None:
    allowed = ("state", "decided_by", "decided_at", "decision_reason", "closed_by", "closed_at", "close_reason")
    changes = {name: values[name] for name in allowed if name in values}
    assignments = ", ".join(f"{name} = :{name}" for name in changes)
    db.execute(
        text(f"UPDATE engagement.committee SET {assignments}, updated_at = clock_timestamp() WHERE id = :id"),
        {**changes, "id": committee_id},
    )


def find_committee(db: Session, committee_id: uuid.UUID, *, lock: bool = False) -> Committee | None:
    if lock:
        db.execute(text("SELECT 1 FROM engagement.committee WHERE id = :id FOR UPDATE"), {"id": committee_id})
    row = db.execute(text(f"{_COMMITTEE} WHERE c.id = :id"), {"id": committee_id}).mappings().one_or_none()
    return _committee(row) if row else None


def search_committees(db: Session, *, states: list[str] | None, area_keys: list[str] | None,
                      wing_type: str | None = None) -> list[Committee]:
    """For administrators: committees whose area overlaps theirs (None: every area)."""
    conditions = ["TRUE"]
    params: dict[str, Any] = {}
    if states:
        conditions.append("c.state = ANY(:states)")
        params["states"] = states
    if area_keys is not None:
        conditions.append("c.area_path && CAST(:areas AS text[])")
        params["areas"] = area_keys
    if wing_type:
        conditions.append("c.wing_type = :wing_type")
        params["wing_type"] = wing_type
    rows = db.execute(
        text(f"{_COMMITTEE} WHERE {' AND '.join(conditions)} ORDER BY c.wing_type, c.kind DESC, c.name_en LIMIT 500"),
        params,
    ).mappings()
    return [_committee(row) for row in rows]


def active_for_member(db: Session, member_area_keys: list[str], member_id: uuid.UUID,
                      wing_type: str | None, *, overseas: bool) -> list[Committee]:
    """M31: active wings and committees set for the platform or for an area the member lives in, every
    committee the member has a membership row in, and for a registered overseas supporter every active
    diaspora committee, wherever it is based (FR-DSP-005)."""
    rows = db.execute(
        text(
            f"""{_COMMITTEE}
                WHERE (c.state = 'active' AND (c.area_key = 'platform' OR c.area_key = ANY(:areas)
                                               OR (:overseas AND c.wing_type = 'diaspora')))
                   OR c.id IN (SELECT committee_id FROM engagement.committee_membership WHERE member_id = :member)
                ORDER BY c.wing_type, c.kind DESC, c.name_en LIMIT 300"""
        ),
        {"areas": member_area_keys, "member": member_id, "overseas": overseas},
    ).mappings()
    found = [_committee(row) for row in rows]
    return [c for c in found if wing_type is None or c.wing_type == wing_type]


# --- Memberships ----------------------------------------------------------------------------------------

_MEMBERSHIP = """
    SELECT m.id, m.committee_id, m.member_id, m.state, m.role, m.application_note, m.applied_at, m.decided_at,
           m.decision_reason, m.role_set_at, m.ended_at, COALESCE(dn.display_name, n.full_name) AS name, n.member_code
    FROM engagement.committee_membership m
    JOIN npm.member n ON n.id = m.member_id
    LEFT JOIN profile.display_name dn ON dn.member_id = m.member_id
"""


@dataclass(frozen=True)
class Membership:
    id: uuid.UUID
    committee_id: uuid.UUID
    member_id: uuid.UUID
    state: str
    role: str | None
    application_note: str | None
    applied_at: datetime
    decided_at: datetime | None
    decision_reason: str | None
    role_set_at: datetime | None
    ended_at: datetime | None
    name: str
    member_code: str


def find_membership(db: Session, committee_id: uuid.UUID, member_id: uuid.UUID, *, lock: bool = False) -> Membership | None:
    suffix = " FOR UPDATE OF m" if lock else ""
    row = db.execute(
        text(f"{_MEMBERSHIP} WHERE m.committee_id = :committee AND m.member_id = :member{suffix}"),
        {"committee": committee_id, "member": member_id},
    ).mappings().one_or_none()
    return Membership(**row) if row else None


def find_membership_by_id(db: Session, membership_id: uuid.UUID, *, lock: bool = False) -> Membership | None:
    suffix = " FOR UPDATE OF m" if lock else ""
    row = db.execute(text(f"{_MEMBERSHIP} WHERE m.id = :id{suffix}"), {"id": membership_id}).mappings().one_or_none()
    return Membership(**row) if row else None


def save_application(db: Session, committee_id: uuid.UUID, member_id: uuid.UUID, note: str | None) -> uuid.UUID:
    """A new application, or a fresh one after a decline, withdrawal or leaving."""
    return db.scalar(
        text(
            """
            INSERT INTO engagement.committee_membership (committee_id, member_id, application_note)
            VALUES (:committee, :member, :note)
            ON CONFLICT (committee_id, member_id) DO UPDATE SET
                state = 'applied', role = NULL, application_note = EXCLUDED.application_note,
                applied_at = clock_timestamp(), decided_by = NULL, decided_at = NULL, decision_reason = NULL,
                ended_by = NULL, ended_at = NULL, updated_at = clock_timestamp()
            RETURNING id
            """
        ),
        {"committee": committee_id, "member": member_id, "note": note},
    )


def grant_role(db: Session, committee_id: uuid.UUID, member_id: uuid.UUID, role: str, by: uuid.UUID) -> uuid.UUID:
    """An administrator's explicit grant (FR-COM-003): the person is a member with this role at once."""
    return db.scalar(
        text(
            """
            INSERT INTO engagement.committee_membership (committee_id, member_id, state, role, decided_by, decided_at,
                                                         role_set_by, role_set_at)
            VALUES (:committee, :member, 'approved', :role, :by, clock_timestamp(), :by, clock_timestamp())
            ON CONFLICT (committee_id, member_id) DO UPDATE SET
                state = 'approved', role = EXCLUDED.role, decided_by = EXCLUDED.decided_by,
                decided_at = COALESCE(engagement.committee_membership.decided_at, EXCLUDED.decided_at),
                decision_reason = NULL, role_set_by = EXCLUDED.role_set_by, role_set_at = EXCLUDED.role_set_at,
                ended_by = NULL, ended_at = NULL, updated_at = clock_timestamp()
            RETURNING id
            """
        ),
        {"committee": committee_id, "member": member_id, "role": role, "by": by},
    )


def update_membership(db: Session, membership_id: uuid.UUID, values: dict[str, Any]) -> None:
    allowed = ("state", "role", "decided_by", "decided_at", "decision_reason", "role_set_by", "role_set_at",
               "ended_by", "ended_at")
    changes = {name: values[name] for name in allowed if name in values}
    assignments = ", ".join(f"{name} = :{name}" for name in changes)
    db.execute(
        text(f"UPDATE engagement.committee_membership SET {assignments}, updated_at = clock_timestamp() WHERE id = :id"),
        {**changes, "id": membership_id},
    )


def roster(db: Session, committee_id: uuid.UUID, states: list[str]) -> list[Membership]:
    rows = db.execute(
        text(
            f"""{_MEMBERSHIP} WHERE m.committee_id = :committee AND m.state = ANY(:states)
                ORDER BY CASE m.role WHEN 'coordinator' THEN 0 WHEN 'secretary' THEN 1 ELSE 2 END, name"""
        ),
        {"committee": committee_id, "states": states},
    ).mappings()
    return [Membership(**row) for row in rows]


def memberships_of(db: Session, member_id: uuid.UUID) -> dict[uuid.UUID, Membership]:
    rows = db.execute(text(f"{_MEMBERSHIP} WHERE m.member_id = :member"), {"member": member_id}).mappings()
    return {row["committee_id"]: Membership(**row) for row in rows}


def holders_of_roles(db: Session, committee_id: uuid.UUID, roles: list[str]) -> list[uuid.UUID]:
    return list(db.scalars(
        text("""SELECT member_id FROM engagement.committee_membership
                WHERE committee_id = :committee AND state = 'approved' AND role = ANY(:roles)"""),
        {"committee": committee_id, "roles": roles},
    ))


def approved_member_ids(db: Session, committee_id: uuid.UUID) -> list[uuid.UUID]:
    return list(db.scalars(
        text("SELECT member_id FROM engagement.committee_membership WHERE committee_id = :c AND state = 'approved'"),
        {"c": committee_id},
    ))


def birth_date(db: Session, member_id: uuid.UUID) -> date | None:
    return db.scalar(text("SELECT dob FROM npm.member WHERE id = :id"), {"id": member_id})


@dataclass(frozen=True)
class Coordinating:
    committee: Committee
    role: str
    waiting: int  # applications, minutes and discussion waiting for a decision


def coordinating(db: Session, member_id: uuid.UUID) -> list[Coordinating]:
    rows = db.execute(
        text(
            """
            SELECT m.committee_id, m.role,
                   (SELECT count(*) FROM engagement.committee_membership a
                     WHERE a.committee_id = m.committee_id AND a.state = 'applied')
                 + (SELECT count(*) FROM engagement.committee_item i
                     WHERE i.committee_id = m.committee_id AND i.state = 'awaiting_approval')
                 + (SELECT count(*) FROM engagement.committee_post p JOIN engagement.committee_item t ON t.id = p.thread_id
                     WHERE t.committee_id = m.committee_id AND p.state = 'awaiting_approval') AS waiting
            FROM engagement.committee_membership m
            JOIN engagement.committee c ON c.id = m.committee_id
            WHERE m.member_id = :member AND m.state = 'approved' AND m.role IN ('coordinator', 'secretary')
              AND c.state = 'active'
            """
        ),
        {"member": member_id},
    ).all()
    found = []
    for row in rows:
        committee = find_committee(db, row.committee_id)
        if committee is not None:
            found.append(Coordinating(committee, row.role, int(row.waiting)))
    return sorted(found, key=lambda item: item.committee.name_en)


# --- Items -----------------------------------------------------------------------------------------------

_ITEM = """
    SELECT i.id, i.item_ref, i.committee_id, i.item_type, i.title, i.body, i.author_id,
           COALESCE(adn.display_name, a.full_name) AS author_name, i.state, i.starts_at, i.ends_at, i.place,
           i.meeting_id, i.due_on, i.assignee_id, COALESCE(sdn.display_name, s.full_name) AS assignee_name, i.places,
           i.done_at, i.access_roles, i.decided_at, i.decision_reason, i.hidden_reason, i.created_at, i.updated_at,
           (SELECT count(*) FROM engagement.committee_signup g WHERE g.item_id = i.id AND g.withdrawn_at IS NULL)::int
               AS signups,
           (SELECT count(*) FROM engagement.committee_post p WHERE p.thread_id = i.id AND p.state = 'published')::int
               AS replies
    FROM engagement.committee_item i
    JOIN npm.member a ON a.id = i.author_id
    LEFT JOIN profile.display_name adn ON adn.member_id = i.author_id
    LEFT JOIN npm.member s ON s.id = i.assignee_id
    LEFT JOIN profile.display_name sdn ON sdn.member_id = i.assignee_id
"""


@dataclass(frozen=True)
class Item:
    id: uuid.UUID
    item_ref: str
    committee_id: uuid.UUID
    item_type: str
    title: str
    body: str
    author_id: uuid.UUID
    author_name: str
    state: str
    starts_at: datetime | None
    ends_at: datetime | None
    place: str | None
    meeting_id: uuid.UUID | None
    due_on: date | None
    assignee_id: uuid.UUID | None
    assignee_name: str | None
    places: int | None
    done_at: datetime | None
    access_roles: list[str]
    decided_at: datetime | None
    decision_reason: str | None
    hidden_reason: str | None
    created_at: datetime
    updated_at: datetime
    signups: int
    replies: int


def _item(row: Any) -> Item:
    return Item(**{**row, "access_roles": list(row["access_roles"])})


ITEM_FIELDS = ("committee_id", "item_type", "title", "body", "author_id", "state", "starts_at", "ends_at", "place",
               "meeting_id", "due_on", "assignee_id", "places", "access_roles")


def insert_item(db: Session, values: dict[str, Any]) -> uuid.UUID:
    columns = ", ".join(ITEM_FIELDS)
    params = ", ".join(f":{name}" for name in ITEM_FIELDS)
    return db.scalar(
        text(f"INSERT INTO engagement.committee_item ({columns}) VALUES ({params}) RETURNING id"),
        {name: values.get(name) for name in ITEM_FIELDS},
    )


def update_item(db: Session, item_id: uuid.UUID, values: dict[str, Any]) -> None:
    allowed = ("state", "decided_by", "decided_at", "decision_reason", "hidden_by", "hidden_at", "hidden_reason",
               "done_at", "done_by")
    changes = {name: values[name] for name in allowed if name in values}
    assignments = ", ".join(f"{name} = :{name}" for name in changes)
    db.execute(
        text(f"UPDATE engagement.committee_item SET {assignments}, updated_at = clock_timestamp() WHERE id = :id"),
        {**changes, "id": item_id},
    )


def find_item(db: Session, item_id: uuid.UUID, *, lock: bool = False) -> Item | None:
    if lock:
        db.execute(text("SELECT 1 FROM engagement.committee_item WHERE id = :id FOR UPDATE"), {"id": item_id})
    row = db.execute(text(f"{_ITEM} WHERE i.id = :id"), {"id": item_id}).mappings().one_or_none()
    return _item(row) if row else None


def items(db: Session, committee_id: uuid.UUID, *, states: list[str], limit: int = 200) -> list[Item]:
    rows = db.execute(
        text(
            f"""{_ITEM} WHERE i.committee_id = :committee AND i.state = ANY(:states)
                ORDER BY i.created_at DESC LIMIT :limit"""
        ),
        {"committee": committee_id, "states": states, "limit": limit},
    ).mappings()
    return [_item(row) for row in rows]


def own_waiting_items(db: Session, committee_id: uuid.UUID, member_id: uuid.UUID) -> list[Item]:
    """The member's own threads still waiting for moderation or returned, so they know where they stand."""
    rows = db.execute(
        text(
            f"""{_ITEM} WHERE i.committee_id = :committee AND i.author_id = :member
                AND i.state IN ('awaiting_approval', 'returned') ORDER BY i.created_at DESC LIMIT 50"""
        ),
        {"committee": committee_id, "member": member_id},
    ).mappings()
    return [_item(row) for row in rows]


def my_signups(db: Session, member_id: uuid.UUID, item_ids: list[uuid.UUID]) -> set[uuid.UUID]:
    if not item_ids:
        return set()
    return set(db.scalars(
        text("""SELECT item_id FROM engagement.committee_signup
                WHERE member_id = :member AND item_id = ANY(:items) AND withdrawn_at IS NULL"""),
        {"member": member_id, "items": item_ids},
    ))


def sign_up(db: Session, item_id: uuid.UUID, member_id: uuid.UUID) -> None:
    db.execute(
        text(
            """INSERT INTO engagement.committee_signup (item_id, member_id) VALUES (:item, :member)
               ON CONFLICT (item_id, member_id) DO UPDATE SET signed_up_at = clock_timestamp(), withdrawn_at = NULL"""
        ),
        {"item": item_id, "member": member_id},
    )


def withdraw_signup(db: Session, item_id: uuid.UUID, member_id: uuid.UUID) -> bool:
    return db.execute(
        text("""UPDATE engagement.committee_signup SET withdrawn_at = clock_timestamp()
                WHERE item_id = :item AND member_id = :member AND withdrawn_at IS NULL"""),
        {"item": item_id, "member": member_id},
    ).rowcount > 0


def signup_names(db: Session, item_id: uuid.UUID) -> list[str]:
    return list(db.scalars(
        text(
            """SELECT COALESCE(dn.display_name, m.full_name) FROM engagement.committee_signup g
               JOIN npm.member m ON m.id = g.member_id LEFT JOIN profile.display_name dn ON dn.member_id = g.member_id
               WHERE g.item_id = :item AND g.withdrawn_at IS NULL ORDER BY g.signed_up_at"""
        ),
        {"item": item_id},
    ))


# --- Discussion replies -----------------------------------------------------------------------------------

_POST = """
    SELECT p.id, p.thread_id, p.author_id, COALESCE(dn.display_name, m.full_name) AS author_name, p.body, p.state,
           p.decision_reason, p.created_at
    FROM engagement.committee_post p
    JOIN npm.member m ON m.id = p.author_id
    LEFT JOIN profile.display_name dn ON dn.member_id = p.author_id
"""


@dataclass(frozen=True)
class Post:
    id: uuid.UUID
    thread_id: uuid.UUID
    author_id: uuid.UUID
    author_name: str
    body: str
    state: str
    decision_reason: str | None
    created_at: datetime


def insert_post(db: Session, thread_id: uuid.UUID, author_id: uuid.UUID, body: str, state: str) -> uuid.UUID:
    return db.scalar(
        text("""INSERT INTO engagement.committee_post (thread_id, author_id, body, state)
                VALUES (:thread, :author, :body, :state) RETURNING id"""),
        {"thread": thread_id, "author": author_id, "body": body, "state": state},
    )


def find_post(db: Session, post_id: uuid.UUID, *, lock: bool = False) -> Post | None:
    suffix = " FOR UPDATE OF p" if lock else ""
    row = db.execute(text(f"{_POST} WHERE p.id = :id{suffix}"), {"id": post_id}).mappings().one_or_none()
    return Post(**row) if row else None


def posts(db: Session, thread_id: uuid.UUID, *, viewer: uuid.UUID, moderator: bool) -> list[Post]:
    """Published replies; a moderator also sees those waiting, and an author their own."""
    rows = db.execute(
        text(
            f"""{_POST} WHERE p.thread_id = :thread
                AND (p.state = 'published' OR (:moderator AND p.state = 'awaiting_approval')
                     OR (p.author_id = :viewer AND p.state IN ('awaiting_approval', 'returned')))
                ORDER BY p.created_at LIMIT 500"""
        ),
        {"thread": thread_id, "viewer": viewer, "moderator": moderator},
    ).mappings()
    return [Post(**row) for row in rows]


def waiting_posts(db: Session, committee_id: uuid.UUID) -> list[tuple[Post, str]]:
    rows = db.execute(
        text(
            f"""{_POST.replace('FROM engagement.committee_post p', 'FROM engagement.committee_post p JOIN engagement.committee_item t ON t.id = p.thread_id')}
                WHERE t.committee_id = :committee AND p.state = 'awaiting_approval' ORDER BY p.created_at LIMIT 200"""
        ),
        {"committee": committee_id},
    ).mappings()
    found = []
    for row in rows:
        thread = find_item(db, row["thread_id"])
        found.append((Post(**row), thread.title if thread else ""))
    return found


def update_post(db: Session, post_id: uuid.UUID, values: dict[str, Any]) -> None:
    db.execute(
        text("""UPDATE engagement.committee_post SET state = :state, decided_by = :decided_by,
                decided_at = clock_timestamp(), decision_reason = :decision_reason WHERE id = :id"""),
        {"id": post_id, "state": values["state"], "decided_by": values["decided_by"],
         "decision_reason": values.get("decision_reason")},
    )


# --- Activity (FR-COM-009) --------------------------------------------------------------------------------


def activity(db: Session, committee_id: uuid.UUID, since: datetime, today: date) -> dict[str, int]:
    """Counts only, for one committee: never anyone's name or another committee's data."""
    row = db.execute(
        text(
            """
            SELECT
              (SELECT count(*) FROM engagement.committee_membership WHERE committee_id = :c AND state = 'approved'
                 AND role = 'coordinator') AS coordinators,
              (SELECT count(*) FROM engagement.committee_membership WHERE committee_id = :c AND state = 'approved'
                 AND role = 'secretary') AS secretaries,
              (SELECT count(*) FROM engagement.committee_membership WHERE committee_id = :c AND state = 'approved'
                 AND role = 'member') AS members,
              (SELECT count(*) FROM engagement.committee_membership WHERE committee_id = :c AND state = 'applied')
                 AS applications_waiting,
              (SELECT count(*) FROM engagement.committee_membership WHERE committee_id = :c AND state = 'approved'
                 AND decided_at >= :since) AS joined_recently,
              (SELECT count(*) FROM engagement.committee_membership WHERE committee_id = :c
                 AND state IN ('left', 'removed') AND ended_at >= :since) AS left_recently,
              (SELECT count(*) FROM engagement.committee_item WHERE committee_id = :c AND item_type = 'announcement'
                 AND state = 'published' AND created_at >= :since) AS announcements,
              (SELECT count(*) FROM engagement.committee_item WHERE committee_id = :c AND item_type = 'meeting'
                 AND state = 'published' AND starts_at >= :since AND starts_at < clock_timestamp()) AS meetings_held,
              (SELECT count(*) FROM engagement.committee_item WHERE committee_id = :c AND item_type = 'meeting'
                 AND state = 'published' AND starts_at >= clock_timestamp()) AS meetings_planned,
              (SELECT count(*) FROM engagement.committee_item WHERE committee_id = :c AND item_type = 'minutes'
                 AND state = 'published' AND decided_at >= :since) AS minutes_approved,
              (SELECT count(*) FROM engagement.committee_item WHERE committee_id = :c AND item_type = 'minutes'
                 AND state = 'awaiting_approval') AS minutes_waiting,
              (SELECT count(*) FROM engagement.committee_item WHERE committee_id = :c AND item_type = 'task'
                 AND state = 'published' AND done_at IS NULL AND due_on >= :today) AS tasks_open,
              (SELECT count(*) FROM engagement.committee_item WHERE committee_id = :c AND item_type = 'task'
                 AND state = 'published' AND done_at IS NULL AND due_on < :today) AS tasks_overdue,
              (SELECT count(*) FROM engagement.committee_item WHERE committee_id = :c AND item_type = 'task'
                 AND state = 'published' AND done_at >= :since) AS tasks_done,
              (SELECT count(*) FROM engagement.committee_signup g JOIN engagement.committee_item i ON i.id = g.item_id
                 WHERE i.committee_id = :c AND g.withdrawn_at IS NULL AND g.signed_up_at >= :since) AS volunteer_signups,
              (SELECT count(*) FROM engagement.committee_item WHERE committee_id = :c AND item_type = 'document'
                 AND state = 'published') AS documents,
              (SELECT count(*) FROM engagement.committee_item WHERE committee_id = :c AND item_type = 'thread'
                 AND state = 'published' AND created_at >= :since) AS threads,
              (SELECT count(*) FROM engagement.committee_post p JOIN engagement.committee_item t ON t.id = p.thread_id
                 WHERE t.committee_id = :c AND p.state = 'published' AND p.created_at >= :since) AS replies,
              (SELECT count(*) FROM engagement.committee_item WHERE committee_id = :c AND state = 'awaiting_approval'
                 AND item_type = 'thread')
              + (SELECT count(*) FROM engagement.committee_post p JOIN engagement.committee_item t ON t.id = p.thread_id
                 WHERE t.committee_id = :c AND p.state = 'awaiting_approval') AS discussion_waiting
            """
        ),
        {"c": committee_id, "since": since, "today": today},
    ).mappings().one()
    return {key: int(value) for key, value in row.items()}
