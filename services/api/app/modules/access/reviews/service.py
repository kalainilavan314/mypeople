"""Quarterly privileged-access reviews (BRD FR-AUTH-027, NFR-SEC-13, BR-084, KPI-42, D31).

Every staff grant except the Super Administrator's falls due at the end of
the quarter after it was made or last confirmed. A reviewer confirms it,
which makes it due a quarter later, or revokes it. A grant nobody reviewed
in time stops counting on its own (access.repository.effective_assignments);
confirming it later restores it. Each decision is kept in
access.assignment_review with its reason, and audited with ids only.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import service as access
from app.modules.access.repository import StoredAssignment
from app.modules.access.reviews import repository, rules
from app.modules.access.reviews.repository import DueAssignment
from app.modules.access.rules import Area, AreaPath, quarter_end, quarter_of, review_due
from app.modules.access.service import Staff
from app.modules.audit import service as audit

PERMISSION = rules.PERMISSION
Decision = Literal["confirmed", "revoked"]


class ReviewNotFound(Exception):
    pass


class ReviewNotDue(Exception):
    """Already reviewed this quarter, or not due until a later one."""


@dataclass(frozen=True)
class DueReviews:
    quarter: str
    quarter_ends_at: datetime
    items: list[DueAssignment]
    reviewed_this_quarter: int  # in the reviewer's areas; with the items, the KPI-42 denominator


def due(db: Session, staff: Staff, limit: int) -> DueReviews:
    now = datetime.now(UTC)
    paths: dict[Area, AreaPath | None] = {}

    def path_of(area: Area) -> AreaPath | None:
        if area not in paths:
            paths[area] = access_repository.area_path(db, area)
        return paths[area]

    items = []
    for candidate in repository.due_assignments(db, quarter_end(now), limit=500):
        path = path_of(candidate.assignment.area)
        if path is not None and not _problems(staff, candidate.assignment, path):
            items.append(candidate)
        if len(items) == limit:
            break

    quarter = quarter_of(now)
    reviewed = 0
    for area in repository.reviewed_areas(db, quarter):
        path = path_of(area)
        if path is not None and access.has_permission_over(staff, PERMISSION, path):
            reviewed += 1
    return DueReviews(quarter=quarter, quarter_ends_at=quarter_end(now), items=items, reviewed_this_quarter=reviewed)


def decide(
    db: Session, staff: Staff, assignment_id: uuid.UUID, decision: Decision, reason: str, ip: str
) -> StoredAssignment:
    # Locked, so two reviewers cannot both decide the same grant.
    assignment = access_repository.find_assignment(db, assignment_id, for_update=True)
    if assignment is None or assignment.state != "active":
        raise ReviewNotFound()
    area_path = access_repository.area_path(db, assignment.area) or (assignment.area,)
    target = ("staff_assignment", str(assignment_id))
    problems = _problems(staff, assignment, area_path)
    if problems:
        access.refuse(db, staff, PERMISSION, problems[0], ip, target=target, area_path=area_path)
    now = datetime.now(UTC)
    if not rules.is_due(assignment.review_due_at, now):
        raise ReviewNotDue()

    if decision == "confirmed":
        repository.set_review_due(db, assignment_id, review_due(assignment.tier, now))
    else:
        access_repository.revoke_assignment(db, assignment_id, staff.member_id, reason)
    quarter = quarter_of(now)
    # The reason stays in the review record; the audit entry holds ids only.
    repository.insert_review(
        db, assignment_id=assignment_id, quarter=quarter, decision=decision, reason=reason, reviewed_by=staff.member_id
    )
    audit.record(
        db,
        actor_id=staff.member_id,
        action=f"access.review.{decision}",
        target_type=target[0],
        target_id=target[1],
        area_path=area_path,
        details={"memberId": str(assignment.member_id), "tier": assignment.tier, "quarter": quarter},
        ip=ip,
    )
    db.commit()
    decided = access_repository.find_assignment(db, assignment_id)
    assert decided is not None
    return decided


def _problems(staff: Staff, assignment: StoredAssignment, area_path: AreaPath) -> list[str]:
    return rules.check_review(
        reviewer_id=staff.member_id,
        reviewer_assignments=staff.rule_assignments(),
        member_id=assignment.member_id,
        assignment=assignment.as_rule(),
        area_path=area_path,
    )
