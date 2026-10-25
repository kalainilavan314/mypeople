"""Staff assignments: preview, create, revoke and bootstrap (BRD W09, RB-02 to RB-06).

Each change and its audit entry are saved in one transaction (BRD §13.8), so
there is never a grant without a record of who made it.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.modules.access import repository, rules
from app.modules.access.permissions import Tier, default_permissions, grant_for
from app.modules.access.repository import StoredAssignment
from app.modules.access.rules import Area, AssignmentRequest, Grantee
from app.modules.audit import service as audit


class AssignmentRefused(Exception):
    def __init__(self, problems: list[str]) -> None:
        super().__init__(", ".join(problems))
        self.problems = problems


class AssignmentNotFound(Exception):
    pass


@dataclass(frozen=True)
class Staff:
    """The signed-in person acting as staff, with the assignments that count right now."""

    member_id: uuid.UUID
    assignments: list[StoredAssignment]

    def rule_assignments(self) -> list[rules.Assignment]:
        return [assignment.as_rule() for assignment in self.assignments]


def load_staff(db: Session, member_id: uuid.UUID) -> Staff:
    return Staff(member_id=member_id, assignments=repository.effective_assignments(db, member_id))


def evaluate(db: Session, actor: Staff, request: AssignmentRequest) -> tuple[list[str], datetime | None]:
    """The problems with a proposed assignment and when it would need review (W09 preview, RB-06)."""
    status = repository.find_member_status(db, request.member_id)
    grantee = None
    if status is not None:
        current = repository.effective_assignments(db, request.member_id)
        grantee = Grantee(
            member_id=status.id,
            identity_verified=status.identity_verified,
            assignments=tuple((a.as_rule(), repository.area_path(db, a.area) or (a.area,)) for a in current),
        )
    problems = rules.check_assignment(
        granter_id=actor.member_id,
        granter_assignments=actor.rule_assignments(),
        grantee=grantee,
        request=request,
        area_path=repository.area_path(db, request.area),
    )
    return problems, rules.review_due(request.tier, request.permissions, datetime.now(UTC))


def create(db: Session, actor: Staff, request: AssignmentRequest, note: str | None, ip: str) -> StoredAssignment:
    problems, review_due_at = evaluate(db, actor, request)
    if problems:
        raise AssignmentRefused(problems)

    assignment = repository.insert_assignment(
        db,
        member_id=request.member_id,
        tier=request.tier,
        area=request.area,
        permissions=request.permissions,
        granted_by=actor.member_id,
        granted_at=datetime.now(UTC),
        review_due_at=review_due_at,
        note=note,
    )
    audit.record(
        db,
        actor_id=actor.member_id,
        action="access.assignment.created",
        target_type="staff_assignment",
        target_id=str(assignment.id),
        area_path=repository.area_path(db, request.area),
        details={"memberId": str(request.member_id), "tier": request.tier, "permissions": sorted(request.permissions)},
        ip=ip,
    )
    db.commit()
    return assignment


def revoke(db: Session, actor: Staff, assignment_id: uuid.UUID, reason: str, ip: str) -> StoredAssignment:
    """Takes effect on the member's next request: every check reads the database (FR-WEB-033)."""
    assignment = repository.find_assignment(db, assignment_id)
    if assignment is None or assignment.state != "active":
        raise AssignmentNotFound()

    area_path = repository.area_path(db, assignment.area) or (assignment.area,)
    problems = rules.check_revocation(
        granter_id=actor.member_id,
        granter_assignments=actor.rule_assignments(),
        member_id=assignment.member_id,
        assignment=assignment.as_rule(),
        area_path=area_path,
    )
    if problems:
        raise AssignmentRefused(problems)

    revoked = repository.revoke_assignment(db, assignment_id, actor.member_id, reason)
    # The reason stays in the assignment record; the audit entry holds ids only.
    audit.record(
        db,
        actor_id=actor.member_id,
        action="access.assignment.revoked",
        target_type="staff_assignment",
        target_id=str(assignment_id),
        area_path=area_path,
        details={"memberId": str(assignment.member_id), "tier": assignment.tier},
        ip=ip,
    )
    db.commit()
    return revoked


def bootstrap_super_administrator(db: Session, member_id: uuid.UUID, extra_permissions: list[str]) -> StoredAssignment:
    """Create the first Tier 5 assignment, which nobody above can grant.

    Gets the Tier 5 defaults plus any explicit Tier 5 permissions named (for
    example members.verify). Refused if a Super Administrator already exists
    (the BRD has one position) or the person's identity is not verified.
    """
    status = repository.find_member_status(db, member_id)
    if status is None:
        raise AssignmentRefused(["unknown_member"])
    if not status.identity_verified:
        raise AssignmentRefused(["identity_not_verified"])
    if repository.has_active_super_administrator(db):
        raise AssignmentRefused(["super_administrator_exists"])
    tier: Tier = "5"
    invalid = [f"permission_not_for_tier:{p}" for p in extra_permissions if grant_for(p, tier) is None]
    if invalid:
        raise AssignmentRefused(invalid)

    permissions = frozenset(default_permissions(tier)) | frozenset(extra_permissions)
    now = datetime.now(UTC)
    assignment = repository.insert_assignment(
        db,
        member_id=member_id,
        tier=tier,
        area=rules.PLATFORM,
        permissions=permissions,
        granted_by=None,
        granted_at=now,
        review_due_at=rules.review_due(tier, permissions, now),
        note="Created by the bootstrap command",
    )
    audit.record(
        db,
        actor_id=None,
        action="access.assignment.bootstrapped",
        target_type="staff_assignment",
        target_id=str(assignment.id),
        area_path=(rules.PLATFORM,),
        details={"memberId": str(member_id), "permissions": sorted(permissions)},
    )
    db.commit()
    return assignment


def visible_audit_areas(staff: Staff) -> list[str] | None:
    """None when the person may read every audit entry; otherwise the areas they may read."""
    areas = [a.area for a in staff.assignments if "audit.view" in a.permissions]
    if any(area.level == "platform" for area in areas):
        return None
    return [area.key for area in areas]


def has_platform_permission(staff: Staff, permission: str) -> bool:
    return any(permission in a.permissions and a.area.level == "platform" for a in staff.assignments)


def to_request(member_id: uuid.UUID, tier: Tier, area: Area, permissions: list[str]) -> AssignmentRequest:
    return AssignmentRequest(member_id=member_id, tier=tier, area=area, permissions=frozenset(permissions))
