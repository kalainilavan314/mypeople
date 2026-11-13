"""SQL for community issues, their case history, evidence, follows, additions and closure responses."""

import json
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

_ISSUE_COLUMNS = """
    i.id, i.case_number, i.reporter_id, i.client_reference, i.category, i.title, i.description, i.location_kind,
    i.location_text, i.district_code, i.ds_code, i.gn_code, i.area_path, i.visibility, i.stage, i.owner_id,
    i.stage_entered_at, i.stage_due_at, i.breach_alerted_at, i.parent_id, i.public_state, i.public_title_en,
    i.public_title_ta, i.public_summary_en, i.public_summary_ta, i.published_at, i.implementation_due_at,
    i.closed_at, i.closed_level, i.closing_summary_en, i.closing_summary_ta, i.closure_round, i.affected_area, i.created_at,
    i.updated_at, owner.full_name AS owner_name, parent.case_number AS parent_case_number, parent.stage AS parent_stage
"""
_ISSUE_FROM = """
    FROM community.issue i
    LEFT JOIN npm.member owner ON owner.id = i.owner_id
    LEFT JOIN community.issue parent ON parent.id = i.parent_id
"""


@dataclass(frozen=True)
class StoredIssue:
    id: uuid.UUID
    case_number: str
    reporter_id: uuid.UUID
    client_reference: uuid.UUID
    category: str
    title: str
    description: str
    location_kind: str
    location_text: str | None
    district_code: str | None
    ds_code: str | None
    gn_code: str | None
    area_path: list[str]
    visibility: str
    stage: str
    owner_id: uuid.UUID | None
    stage_entered_at: datetime
    stage_due_at: datetime | None
    breach_alerted_at: datetime | None
    parent_id: uuid.UUID | None
    public_state: str
    public_title_en: str | None
    public_title_ta: str | None
    public_summary_en: str | None
    public_summary_ta: str | None
    published_at: datetime | None
    implementation_due_at: datetime | None
    closed_at: datetime | None
    closed_level: str | None
    closing_summary_en: str | None
    closing_summary_ta: str | None
    closure_round: int
    affected_area: str | None  # W03: recorded by the GN collector when forwarding
    created_at: datetime
    updated_at: datetime
    owner_name: str | None
    parent_case_number: str | None
    parent_stage: str | None


def _issue(row: Any) -> StoredIssue:
    return StoredIssue(**{**row, "area_path": list(row["area_path"] or [])})


@dataclass(frozen=True)
class MemberPlace:
    gn_code: str | None
    ds_code: str | None
    district_code: str | None


def member_place(db: Session, member_id: uuid.UUID) -> MemberPlace:
    row = db.execute(
        text("SELECT gs_code, ds_code, district_code FROM npm.member WHERE id = :id"), {"id": member_id}
    ).one()
    return MemberPlace(gn_code=row.gs_code, ds_code=row.ds_code, district_code=row.district_code)


# --- Issues --------------------------------------------------------------------------------------------


def find_issue(db: Session, issue_id: uuid.UUID, *, lock: bool = False) -> StoredIssue | None:
    suffix = " FOR UPDATE OF i" if lock else ""
    row = db.execute(text(f"SELECT {_ISSUE_COLUMNS} {_ISSUE_FROM} WHERE i.id = :id{suffix}"), {"id": issue_id}).mappings().one_or_none()
    return _issue(row) if row else None


def find_by_number(db: Session, case_number: str) -> StoredIssue | None:
    row = db.execute(
        text(f"SELECT {_ISSUE_COLUMNS} {_ISSUE_FROM} WHERE i.case_number = :number"), {"number": case_number}
    ).mappings().one_or_none()
    return _issue(row) if row else None


def find_by_reference(db: Session, reporter_id: uuid.UUID, client_reference: uuid.UUID) -> StoredIssue | None:
    row = db.execute(
        text(f"SELECT {_ISSUE_COLUMNS} {_ISSUE_FROM} WHERE i.reporter_id = :reporter AND i.client_reference = :reference"),
        {"reporter": reporter_id, "reference": client_reference},
    ).mappings().one_or_none()
    return _issue(row) if row else None


def insert_issue(db: Session, **values: Any) -> uuid.UUID | None:
    """None when this draft was already submitted (the unique client reference)."""
    return db.scalar(
        text(
            """
            INSERT INTO community.issue (reporter_id, client_reference, category, title, description, location_kind,
                                         location_text, district_code, ds_code, gn_code, area_path, visibility,
                                         stage, stage_entered_at, stage_due_at, public_state)
            VALUES (:reporter_id, :client_reference, :category, :title, :description, :location_kind,
                    :location_text, :district_code, :ds_code, :gn_code, :area_path, :visibility,
                    'gn', :entered_at, :due_at, :public_state)
            ON CONFLICT (reporter_id, client_reference) DO NOTHING
            RETURNING id
            """
        ),
        values,
    )


def count_reports_since(db: Session, reporter_id: uuid.UUID, since: datetime) -> int:
    return db.scalar(
        text("SELECT count(*) FROM community.issue WHERE reporter_id = :member AND created_at >= :since"),
        {"member": reporter_id, "since": since},
    ) or 0


def update_issue(db: Session, issue_id: uuid.UUID, **values: Any) -> None:
    """Set the given columns; names come from the service, never from a request."""
    assignments = ", ".join(f"{column} = :{column}" for column in values)
    db.execute(
        text(f"UPDATE community.issue SET {assignments}, updated_at = clock_timestamp() WHERE id = :issue_id"),
        {**values, "issue_id": issue_id},
    )


def list_mine(db: Session, reporter_id: uuid.UUID, limit: int = 50) -> list[StoredIssue]:
    rows = db.execute(
        text(f"SELECT {_ISSUE_COLUMNS} {_ISSUE_FROM} WHERE i.reporter_id = :reporter ORDER BY i.created_at DESC LIMIT :limit"),
        {"reporter": reporter_id, "limit": limit},
    ).mappings()
    return [_issue(row) for row in rows]


def list_public_in_gn(db: Session, gn_code: str, stages: tuple[str, ...], limit: int = 50) -> list[StoredIssue]:
    rows = db.execute(
        text(
            f"""SELECT {_ISSUE_COLUMNS} {_ISSUE_FROM}
            WHERE i.gn_code = :gn AND i.public_state = 'published' AND i.stage = ANY(:stages)
            ORDER BY i.updated_at DESC LIMIT :limit"""
        ),
        {"gn": gn_code, "stages": list(stages), "limit": limit},
    ).mappings()
    return [_issue(row) for row in rows]


@dataclass(frozen=True)
class AreaUpdate:
    issue_id: uuid.UUID
    case_number: str
    public_title_en: str | None
    public_title_ta: str | None
    to_stage: str
    at: datetime


def public_updates_in_gn(db: Session, gn_code: str, limit: int = 30) -> list[AreaUpdate]:
    """Stage changes of published issues in a GN division, newest first (H05 Updates)."""
    rows = db.execute(
        text(
            """
            SELECT i.id AS issue_id, i.case_number, i.public_title_en, i.public_title_ta, a.to_stage, a.created_at AS at
            FROM community.case_action a JOIN community.issue i ON i.id = a.issue_id
            WHERE i.gn_code = :gn AND i.public_state = 'published' AND a.to_stage IS NOT NULL
              AND a.to_stage NOT IN ('returned', 'linked') AND a.created_at >= i.created_at
            ORDER BY a.created_at DESC LIMIT :limit
            """
        ),
        {"gn": gn_code, "limit": limit},
    ).mappings()
    return [AreaUpdate(**row) for row in rows]


def stage_entries(db: Session, issue_id: uuid.UUID) -> dict[str, datetime]:
    """When the case first entered each stage."""
    rows = db.execute(
        text(
            """
            SELECT to_stage, min(created_at) AS at FROM community.case_action
            WHERE issue_id = :id AND to_stage IS NOT NULL GROUP BY to_stage
            """
        ),
        {"id": issue_id},
    )
    return {row.to_stage: row.at for row in rows}


def linked_children(db: Session, parent_id: uuid.UUID) -> list[StoredIssue]:
    rows = db.execute(
        text(f"SELECT {_ISSUE_COLUMNS} {_ISSUE_FROM} WHERE i.parent_id = :id ORDER BY i.created_at"), {"id": parent_id}
    ).mappings()
    return [_issue(row) for row in rows]


def list_cases(
    db: Session,
    *,
    areas: list[str] | None,
    stages: list[str] | None,
    owner_id: uuid.UUID | None,
    overdue_at: datetime | None,
    district_closures: bool,
    search: str | None,
    limit: int,
    offset: int,
) -> tuple[list[StoredIssue], int]:
    """Cases in the given areas (None: everywhere), newest activity first, with the total."""
    conditions = ["TRUE"]
    params: dict[str, Any] = {"limit": limit, "offset": offset}
    if areas is not None:
        conditions.append("i.area_path && CAST(:areas AS text[])")
        params["areas"] = areas
    if stages:
        conditions.append("i.stage = ANY(:stages)")
        params["stages"] = stages
    if owner_id is not None:
        conditions.append("i.owner_id = :owner")
        params["owner"] = owner_id
    if overdue_at is not None:
        conditions.append(
            "i.stage IN ('gn', 'ds', 'district', 'regional', 'executive', 'implementation') AND i.stage_due_at < :now"
        )
        params["now"] = overdue_at
    if district_closures:
        conditions.append("i.stage = 'resolved' AND i.closed_level = 'district'")
    if search:
        conditions.append("(i.case_number ILIKE :search OR i.title ILIKE :search)")
        params["search"] = f"%{search}%"
    where = " AND ".join(conditions)
    total = db.scalar(text(f"SELECT count(*) FROM community.issue i WHERE {where}"), params) or 0
    rows = db.execute(
        text(
            f"""SELECT {_ISSUE_COLUMNS} {_ISSUE_FROM} WHERE {where}
            ORDER BY (i.stage_due_at IS NOT NULL AND i.stage_due_at < now()) DESC, i.updated_at DESC
            LIMIT :limit OFFSET :offset"""
        ),
        params,
    ).mappings()
    return [_issue(row) for row in rows], total


def stage_counts(db: Session, areas: list[str] | None, now: datetime) -> dict[str, int]:
    params: dict[str, Any] = {"now": now}
    where = "TRUE"
    if areas is not None:
        where = "i.area_path && CAST(:areas AS text[])"
        params["areas"] = areas
    rows = db.execute(
        text(
            f"""
            SELECT i.stage, count(*) AS total,
                   count(*) FILTER (WHERE i.stage_due_at < :now
                       AND i.stage IN ('gn', 'ds', 'district', 'regional', 'executive', 'implementation')) AS overdue
            FROM community.issue i WHERE {where} GROUP BY i.stage
            """
        ),
        params,
    )
    counts: dict[str, int] = {}
    for row in rows:
        counts[row.stage] = row.total
        counts["overdue"] = counts.get("overdue", 0) + row.overdue
    return counts


# --- History -------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class StoredAction:
    id: uuid.UUID
    issue_id: uuid.UUID
    kind: str
    actor_id: uuid.UUID | None
    actor_name: str | None
    from_stage: str | None
    to_stage: str | None
    previous_owner_id: uuid.UUID | None
    previous_owner_name: str | None
    new_owner_id: uuid.UUID | None
    new_owner_name: str | None
    note: str | None
    details: dict[str, Any]
    created_at: datetime


def insert_action(
    db: Session,
    issue_id: uuid.UUID,
    kind: str,
    *,
    actor_id: uuid.UUID | None,
    from_stage: str | None = None,
    to_stage: str | None = None,
    previous_owner_id: uuid.UUID | None = None,
    new_owner_id: uuid.UUID | None = None,
    note: str | None = None,
    details: dict[str, Any] | None = None,
) -> uuid.UUID:
    return db.scalar(
        text(
            """
            INSERT INTO community.case_action (issue_id, kind, actor_id, from_stage, to_stage, previous_owner_id,
                                               new_owner_id, note, details)
            VALUES (:issue_id, :kind, :actor_id, :from_stage, :to_stage, :previous_owner_id, :new_owner_id, :note,
                    CAST(:details AS jsonb))
            RETURNING id
            """
        ),
        {
            "issue_id": issue_id,
            "kind": kind,
            "actor_id": actor_id,
            "from_stage": from_stage,
            "to_stage": to_stage,
            "previous_owner_id": previous_owner_id,
            "new_owner_id": new_owner_id,
            "note": note,
            "details": json.dumps(details or {}),
        },
    )


def history(db: Session, issue_id: uuid.UUID) -> list[StoredAction]:
    rows = db.execute(
        text(
            """
            SELECT a.id, a.issue_id, a.kind, a.actor_id, actor.full_name AS actor_name, a.from_stage, a.to_stage,
                   a.previous_owner_id, prev.full_name AS previous_owner_name, a.new_owner_id,
                   new.full_name AS new_owner_name, a.note, a.details, a.created_at
            FROM community.case_action a
            LEFT JOIN npm.member actor ON actor.id = a.actor_id
            LEFT JOIN npm.member prev ON prev.id = a.previous_owner_id
            LEFT JOIN npm.member new ON new.id = a.new_owner_id
            WHERE a.issue_id = :id ORDER BY a.created_at, a.id
            """
        ),
        {"id": issue_id},
    ).mappings()
    return [StoredAction(**row) for row in rows]


def count_actions(db: Session, issue_id: uuid.UUID, kind: str) -> int:
    return db.scalar(
        text("SELECT count(*) FROM community.case_action WHERE issue_id = :id AND kind = :kind"), {"id": issue_id, "kind": kind}
    ) or 0


def last_action(db: Session, issue_id: uuid.UUID, kinds: tuple[str, ...]) -> StoredAction | None:
    found = [action for action in history(db, issue_id) if action.kind in kinds]
    return found[-1] if found else None


# --- Evidence ------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class StoredEvidence:
    id: uuid.UUID
    uploader_id: uuid.UUID
    purpose: str
    issue_id: uuid.UUID | None
    addition_id: uuid.UUID | None
    action_id: uuid.UUID | None
    sealed_with: str
    byte_size: int
    width: int
    height: int
    created_at: datetime


_EVIDENCE = """SELECT id, uploader_id, purpose, issue_id, addition_id, action_id, sealed_with, byte_size, width,
                      height, created_at FROM community.issue_evidence"""


def insert_evidence(
    db: Session, evidence_id: uuid.UUID, *, uploader_id: uuid.UUID, purpose: str, issue_id: uuid.UUID | None,
    sealed_with: str, byte_size: int, width: int, height: int,
) -> None:
    db.execute(
        text(
            """
            INSERT INTO community.issue_evidence (id, uploader_id, purpose, issue_id, sealed_with, byte_size, width, height)
            VALUES (:id, :uploader_id, :purpose, :issue_id, :sealed_with, :byte_size, :width, :height)
            """
        ),
        {
            "id": evidence_id,
            "uploader_id": uploader_id,
            "purpose": purpose,
            "issue_id": issue_id,
            "sealed_with": sealed_with,
            "byte_size": byte_size,
            "width": width,
            "height": height,
        },
    )


def find_evidence(db: Session, evidence_id: uuid.UUID) -> StoredEvidence | None:
    row = db.execute(text(f"{_EVIDENCE} WHERE id = :id"), {"id": evidence_id}).mappings().one_or_none()
    return StoredEvidence(**row) if row else None


def count_uploads_since(db: Session, uploader_id: uuid.UUID, since: datetime) -> int:
    return db.scalar(
        text("SELECT count(*) FROM community.issue_evidence WHERE uploader_id = :member AND created_at >= :since"),
        {"member": uploader_id, "since": since},
    ) or 0


def unattached_evidence(
    db: Session, uploader_id: uuid.UUID, ids: list[uuid.UUID], purpose: str, since: datetime
) -> list[uuid.UUID]:
    """Which of these photos the person sent recently and has not attached to anything yet."""
    if not ids:
        return []
    return list(
        db.scalars(
            text(
                """
                SELECT id FROM community.issue_evidence
                WHERE id = ANY(:ids) AND uploader_id = :uploader AND purpose = :purpose AND issue_id IS NULL
                  AND created_at >= :since
                """
            ),
            {"ids": ids, "uploader": uploader_id, "purpose": purpose, "since": since},
        )
    )


def attach_evidence(
    db: Session, ids: list[uuid.UUID], issue_id: uuid.UUID, *, addition_id: uuid.UUID | None = None,
    action_id: uuid.UUID | None = None,
) -> None:
    if ids:
        db.execute(
            text(
                """UPDATE community.issue_evidence SET issue_id = :issue, addition_id = :addition, action_id = :action
                   WHERE id = ANY(:ids)"""
            ),
            {"ids": ids, "issue": issue_id, "addition": addition_id, "action": action_id},
        )


def issue_evidence(db: Session, issue_id: uuid.UUID) -> list[StoredEvidence]:
    rows = db.execute(text(f"{_EVIDENCE} WHERE issue_id = :id ORDER BY created_at"), {"id": issue_id}).mappings()
    return [StoredEvidence(**row) for row in rows]


def count_report_evidence(db: Session, issue_id: uuid.UUID) -> int:
    return db.scalar(
        text("SELECT count(*) FROM community.issue_evidence WHERE issue_id = :id AND purpose = 'report'"), {"id": issue_id}
    ) or 0


# --- Follows, additions and closure responses -----------------------------------------------------------


def follow(db: Session, issue_id: uuid.UUID, member_id: uuid.UUID) -> None:
    db.execute(
        text("INSERT INTO community.issue_follow (issue_id, member_id) VALUES (:issue, :member) ON CONFLICT DO NOTHING"),
        {"issue": issue_id, "member": member_id},
    )


def unfollow(db: Session, issue_id: uuid.UUID, member_id: uuid.UUID) -> None:
    db.execute(
        text("DELETE FROM community.issue_follow WHERE issue_id = :issue AND member_id = :member"),
        {"issue": issue_id, "member": member_id},
    )


def is_following(db: Session, issue_id: uuid.UUID, member_id: uuid.UUID) -> bool:
    return bool(
        db.scalar(
            text("SELECT EXISTS (SELECT 1 FROM community.issue_follow WHERE issue_id = :issue AND member_id = :member)"),
            {"issue": issue_id, "member": member_id},
        )
    )


def followers(db: Session, issue_id: uuid.UUID) -> list[uuid.UUID]:
    return list(db.scalars(text("SELECT member_id FROM community.issue_follow WHERE issue_id = :id"), {"id": issue_id}))


@dataclass(frozen=True)
class StoredAddition:
    id: uuid.UUID
    issue_id: uuid.UUID
    member_id: uuid.UUID
    member_name: str | None
    body: str
    is_reply: bool
    state: str
    moderated_by: uuid.UUID | None
    moderated_at: datetime | None
    moderation_reason: str | None
    published_body: str | None  # D12: the moderator's edited version, shown instead of body when set
    created_at: datetime
    photos: int

    @property
    def public_body(self) -> str:
        return self.published_body or self.body


_ADDITIONS = """
    SELECT a.id, a.issue_id, a.member_id, m.full_name AS member_name, a.body, a.is_reply, a.state, a.moderated_by,
           a.moderated_at, a.moderation_reason, a.published_body, a.created_at,
           (SELECT count(*) FROM community.issue_evidence e WHERE e.addition_id = a.id) AS photos
    FROM community.issue_addition a JOIN npm.member m ON m.id = a.member_id
"""


def insert_addition(db: Session, issue_id: uuid.UUID, member_id: uuid.UUID, body: str, is_reply: bool) -> uuid.UUID:
    return db.scalar(
        text(
            """INSERT INTO community.issue_addition (issue_id, member_id, body, is_reply)
               VALUES (:issue, :member, :body, :reply) RETURNING id"""
        ),
        {"issue": issue_id, "member": member_id, "body": body, "reply": is_reply},
    )


def additions(db: Session, issue_id: uuid.UUID, *, approved_only: bool = False) -> list[StoredAddition]:
    condition = " AND a.state = 'approved'" if approved_only else ""
    rows = db.execute(
        text(f"{_ADDITIONS} WHERE a.issue_id = :id{condition} ORDER BY a.created_at"), {"id": issue_id}
    ).mappings()
    return [StoredAddition(**row) for row in rows]


def find_addition(db: Session, addition_id: uuid.UUID) -> StoredAddition | None:
    row = db.execute(text(f"{_ADDITIONS} WHERE a.id = :id"), {"id": addition_id}).mappings().one_or_none()
    return StoredAddition(**row) if row else None


def moderate_addition(
    db: Session, addition_id: uuid.UUID, state: str, moderator: uuid.UUID, reason: str | None, published_body: str | None
) -> None:
    db.execute(
        text(
            """UPDATE community.issue_addition SET state = :state, moderated_by = :moderator,
                      moderated_at = clock_timestamp(), moderation_reason = :reason, published_body = :published
               WHERE id = :id"""
        ),
        {"id": addition_id, "state": state, "moderator": moderator, "reason": reason, "published": published_body},
    )


def additions_by(db: Session, issue_id: uuid.UUID, member_id: uuid.UUID) -> list[StoredAddition]:
    """What one member added to an issue, in every state, for that member's own view."""
    rows = db.execute(
        text(f"{_ADDITIONS} WHERE a.issue_id = :id AND a.member_id = :member ORDER BY a.created_at"),
        {"id": issue_id, "member": member_id},
    ).mappings()
    return [StoredAddition(**row) for row in rows]


# --- The moderation queue (D12) ------------------------------------------------------------------------


@dataclass(frozen=True)
class PendingSummary:
    """A public case whose public summary a moderator still has to write, or to update after closure."""

    issue: StoredIssue
    needs: str  # first_summary | update_after_closure
    waiting_since: datetime


def pending_summaries(db: Session, areas: list[str] | None, limit: int = 100) -> list[PendingSummary]:
    """Public cases never published (any open or resolved stage), and published ones closed since
    their summary was last written, so the closing outcome reaches the public only through a moderator."""
    params: dict[str, Any] = {"limit": limit}
    area_condition = "TRUE"
    if areas is not None:
        area_condition = "i.area_path && CAST(:areas AS text[])"
        params["areas"] = areas
    rows = db.execute(
        text(
            f"""
            SELECT * FROM (
                SELECT {_ISSUE_COLUMNS},
                       CASE WHEN i.public_state = 'pending' THEN 'first_summary' ELSE 'update_after_closure' END AS needs,
                       CASE WHEN i.public_state = 'pending' THEN i.created_at ELSE i.closed_at END AS waiting_since
                {_ISSUE_FROM}
                WHERE i.visibility = 'public' AND {area_condition}
                  AND i.stage IN ('gn', 'returned', 'ds', 'district', 'regional', 'executive', 'implementation', 'resolved')
                  AND (i.public_state = 'pending'
                       OR (i.public_state = 'published' AND i.stage = 'resolved' AND i.closed_at IS NOT NULL
                           AND NOT EXISTS (SELECT 1 FROM community.case_action s
                                           WHERE s.issue_id = i.id AND s.kind = 'public_summary'
                                             AND s.created_at >= i.closed_at)))
            ) queue
            ORDER BY waiting_since, id LIMIT :limit
            """
        ),
        params,
    ).mappings()
    found = []
    for row in rows:
        values = dict(row)
        needs = values.pop("needs")
        waiting_since = values.pop("waiting_since")
        found.append(PendingSummary(issue=_issue(values), needs=needs, waiting_since=waiting_since))
    return found


@dataclass(frozen=True)
class PendingAddition:
    addition: StoredAddition
    case_number: str
    reporter_id: uuid.UUID
    area_path: list[str]


def pending_additions(db: Session, areas: list[str] | None, limit: int = 100) -> list[PendingAddition]:
    """Added information waiting for a moderator in these areas, oldest first."""
    params: dict[str, Any] = {"limit": limit}
    area_condition = "TRUE"
    if areas is not None:
        area_condition = "i.area_path && CAST(:areas AS text[])"
        params["areas"] = areas
    rows = db.execute(
        text(
            f"""
            SELECT a.id, a.issue_id, a.member_id, m.full_name AS member_name, a.body, a.is_reply, a.state, a.moderated_by,
                   a.moderated_at, a.moderation_reason, a.published_body, a.created_at,
                   (SELECT count(*) FROM community.issue_evidence e WHERE e.addition_id = a.id) AS photos,
                   i.case_number, i.reporter_id, i.area_path
            FROM community.issue_addition a
            JOIN npm.member m ON m.id = a.member_id
            JOIN community.issue i ON i.id = a.issue_id
            WHERE a.state = 'pending' AND {area_condition}
            ORDER BY a.created_at, a.id LIMIT :limit
            """
        ),
        params,
    ).mappings()
    found = []
    for row in rows:
        values = dict(row)
        case_number = values.pop("case_number")
        reporter_id = values.pop("reporter_id")
        area_path = list(values.pop("area_path") or [])
        found.append(
            PendingAddition(addition=StoredAddition(**values), case_number=case_number, reporter_id=reporter_id, area_path=area_path)
        )
    return found


@dataclass(frozen=True)
class StoredClosureResponse:
    id: uuid.UUID
    issue_id: uuid.UUID
    member_id: uuid.UUID
    closure_round: int
    resolved: bool
    rating: int | None
    note: str | None
    state: str
    decided_by: uuid.UUID | None
    decided_at: datetime | None
    decision_reason: str | None
    created_at: datetime


_RESPONSES = """SELECT id, issue_id, member_id, closure_round, resolved, rating, note, state, decided_by, decided_at,
                       decision_reason, created_at FROM community.issue_closure_response"""


def insert_closure_response(
    db: Session, issue_id: uuid.UUID, member_id: uuid.UUID, closure_round: int, resolved: bool, rating: int | None,
    note: str | None,
) -> uuid.UUID:
    return db.scalar(
        text(
            """
            INSERT INTO community.issue_closure_response (issue_id, member_id, closure_round, resolved, rating, note, state)
            VALUES (:issue, :member, :round, :resolved, :rating, :note,
                    CASE WHEN :resolved THEN 'recorded' ELSE 'challenge_open' END)
            RETURNING id
            """
        ),
        {"issue": issue_id, "member": member_id, "round": closure_round, "resolved": resolved, "rating": rating, "note": note},
    )


def closure_response(db: Session, issue_id: uuid.UUID, member_id: uuid.UUID, closure_round: int) -> StoredClosureResponse | None:
    row = db.execute(
        text(f"{_RESPONSES} WHERE issue_id = :issue AND member_id = :member AND closure_round = :round"),
        {"issue": issue_id, "member": member_id, "round": closure_round},
    ).mappings().one_or_none()
    return StoredClosureResponse(**row) if row else None


def open_challenge(db: Session, issue_id: uuid.UUID) -> StoredClosureResponse | None:
    row = db.execute(
        text(f"{_RESPONSES} WHERE issue_id = :issue AND state = 'challenge_open' ORDER BY created_at LIMIT 1"),
        {"issue": issue_id},
    ).mappings().one_or_none()
    return StoredClosureResponse(**row) if row else None


def decide_challenge(db: Session, response_id: uuid.UUID, state: str, decided_by: uuid.UUID, reason: str) -> None:
    db.execute(
        text(
            """UPDATE community.issue_closure_response SET state = :state, decided_by = :by,
                      decided_at = clock_timestamp(), decision_reason = :reason WHERE id = :id"""
        ),
        {"id": response_id, "state": state, "by": decided_by, "reason": reason},
    )


# --- People --------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Holder:
    member_id: uuid.UUID
    full_name: str
    tier: str


def permission_holders(db: Session, permission: str, area_path: list[str], *, deciding_only: bool = True) -> list[Holder]:
    """Staff whose assignment counts now and gives this permission over the area (or the platform).
    Assisting tiers (2B, 3B) are left out when the work is a decision."""
    rows = db.execute(
        text(
            """
            SELECT DISTINCT ON (a.member_id) a.member_id, m.full_name, a.tier
            FROM access.staff_assignment a
            JOIN npm.member m ON m.id = a.member_id AND m.deleted_at IS NULL
            JOIN membership.membership ms ON ms.member_id = a.member_id AND ms.state = 'active'
            WHERE a.state = 'active' AND :permission = ANY(a.permissions)
              AND (a.review_due_at IS NULL OR a.review_due_at > now())
              AND (a.area_level = 'platform' OR (a.area_level || ':' || a.area_code) = ANY(:path))
              AND (NOT :deciding OR a.tier NOT IN ('2B', '3B'))
            ORDER BY a.member_id, a.granted_at
            """
        ),
        {"permission": permission, "path": area_path, "deciding": deciding_only},
    ).mappings()
    return sorted((Holder(**row) for row in rows), key=lambda holder: holder.full_name)


@dataclass(frozen=True)
class ReporterContact:
    full_name: str
    phone: str | None
    member_code: str


def reporter_contact(db: Session, member_id: uuid.UUID) -> ReporterContact:
    row = db.execute(
        text("SELECT full_name, phone, member_code FROM npm.member WHERE id = :id"), {"id": member_id}
    ).one()
    return ReporterContact(full_name=row.full_name, phone=row.phone, member_code=row.member_code)


# --- Stage deadlines ------------------------------------------------------------------------------------


def overdue_unalerted(db: Session, now: datetime, limit: int = 200) -> list[StoredIssue]:
    rows = db.execute(
        text(
            f"""SELECT {_ISSUE_COLUMNS} {_ISSUE_FROM}
            WHERE i.stage IN ('gn', 'ds', 'district', 'regional', 'executive', 'implementation')
              AND i.stage_due_at < :now AND i.breach_alerted_at IS NULL
            ORDER BY i.stage_due_at LIMIT :limit FOR UPDATE OF i SKIP LOCKED"""
        ),
        {"now": now, "limit": limit},
    ).mappings()
    return [_issue(row) for row in rows]


def remove_stale_unattached(db: Session, before: datetime) -> list[tuple[uuid.UUID, str]]:
    """Photos sent for a report that was never submitted; returns their ids so the files go too."""
    rows = db.execute(
        text(
            """DELETE FROM community.issue_evidence WHERE issue_id IS NULL AND created_at < :before
               RETURNING id, sealed_with"""
        ),
        {"before": before},
    )
    return [(row.id, row.sealed_with) for row in rows]
