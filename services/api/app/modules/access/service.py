"""Staff assignments: preview, create, revoke and bootstrap (BRD W09, RB-02 to RB-06).

Each change and its audit entry are saved in one transaction (BRD §13.8), so
there is never a grant without a record of who made it.
"""

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import NoReturn

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.access import repository, rules, schemas
from app.core.permissions import MATRIX, Tier, default_permissions, grant_for
from app.modules.access.repository import StoredAssignment
from app.modules.access.rules import Area, AreaPath, AssignmentRequest, Grantee
from app.modules.audit import service as audit
from app.modules.membership import repository as membership_repository

logger = logging.getLogger(__name__)


class AssignmentRefused(Exception):
    def __init__(self, problems: list[str]) -> None:
        super().__init__(", ".join(problems))
        self.problems = problems


class AssignmentNotFound(Exception):
    pass


class AccessRefused(Exception):
    """A staff action refused for one record: own_record, outside_your_area, or a module's own reason."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


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
            membership_active=status.membership_active,
            assignments=tuple((a.as_rule(), repository.area_path(db, a.area) or (a.area,)) for a in current),
        )
    problems = rules.check_assignment(
        granter_id=actor.member_id,
        granter_assignments=actor.rule_assignments(),
        grantee=grantee,
        request=request,
        area_path=repository.area_path(db, request.area),
    )
    return problems, rules.review_due(request.tier, datetime.now(UTC))


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


def create_preview(
    db: Session, actor: Staff, proposal: AssignmentRequest, note: str | None, member_id: uuid.UUID
) -> repository.StoredAssignmentPreview:
    """Validate assignment rules and store a durable 10-minute preview record."""
    problems, review_due_at = evaluate(db, actor, proposal)
    if problems:
        raise AssignmentRefused(problems)

    expires_at = datetime.now(UTC) + timedelta(minutes=10)
    preview = repository.insert_assignment_preview(
        db,
        created_by=actor.member_id,
        member_id=member_id,
        tier=proposal.tier,
        area=proposal.area,
        permissions=proposal.permissions,
        note=note,
        review_due_at=review_due_at,
        expires_at=expires_at,
    )
    db.commit()
    return preview


def get_preview(
    db: Session, actor: Staff, preview_id: uuid.UUID
) -> tuple[repository.StoredAssignmentPreview, str, str]:
    """Retrieve an active preview belonging to the caller. Refuse missing, expired, consumed, or other-user previews."""
    preview = repository.find_assignment_preview(db, preview_id)
    now = datetime.now(UTC)
    if preview is None or preview.created_by != actor.member_id or preview.status != "active" or preview.expires_at <= now:
        raise AccessRefused("preview_expired_or_invalid")

    member_info = repository.member_code_and_name(db, preview.member_id)
    if member_info is None:
        raise AccessRefused("preview_expired_or_invalid")

    return preview, member_info[0], member_info[1]


def confirm_preview(db: Session, actor: Staff, preview_id: uuid.UUID, ip: str) -> StoredAssignment:
    """Atomic confirmation with row lock, re-validation, assignment creation, audit logging, and single-use consumption."""
    preview = repository.find_assignment_preview(db, preview_id, for_update=True)
    now = datetime.now(UTC)
    if preview is None or preview.created_by != actor.member_id or preview.status != "active" or preview.expires_at <= now:
        raise AccessRefused("preview_expired_or_invalid")

    proposal = to_request(preview.member_id, preview.tier, preview.area, list(preview.permissions))
    problems, review_due_at = evaluate(db, actor, proposal)
    if problems:
        raise AssignmentRefused(problems)

    assignment = repository.insert_assignment(
        db,
        member_id=preview.member_id,
        tier=preview.tier,
        area=preview.area,
        permissions=preview.permissions,
        granted_by=actor.member_id,
        granted_at=now,
        review_due_at=review_due_at,
        note=preview.note,
    )
    audit.record(
        db,
        actor_id=actor.member_id,
        action="access.assignment.created",
        target_type="staff_assignment",
        target_id=str(assignment.id),
        area_path=repository.area_path(db, preview.area),
        details={"memberId": str(preview.member_id), "tier": preview.tier, "permissions": sorted(preview.permissions)},
        ip=ip,
    )
    repository.consume_assignment_preview(db, preview.id)
    db.commit()
    return assignment


def cancel_preview(db: Session, actor: Staff, preview_id: uuid.UUID) -> None:
    """Cancel an active preview belonging to the caller."""
    preview = repository.find_assignment_preview(db, preview_id, for_update=True)
    now = datetime.now(UTC)
    if preview is None or preview.created_by != actor.member_id or preview.status != "active" or preview.expires_at <= now:
        raise AccessRefused("preview_expired_or_invalid")

    repository.cancel_assignment_preview(db, preview.id)
    db.commit()


def cleanup_previews(db: Session, *, older_than_hours: int = 1) -> int:
    """Clean up expired and consumed/cancelled previews."""
    cleaned = repository.cleanup_expired_previews(db, older_than_hours=older_than_hours)
    db.commit()
    return cleaned


def bootstrap_super_administrator(db: Session, member_id: uuid.UUID, extra_permissions: list[str]) -> StoredAssignment:
    """Create the first Tier 5 assignment, which nobody above can grant.

    Gets the Tier 5 defaults plus any explicit Tier 5 permissions named (for
    example members.verify). Refused if a Super Administrator already exists
    (the BRD has one position), the person's identity is not verified, or
    their membership is suspended or inactive. A Pending membership is
    activated here, since nobody else could do it yet (BR-097).
    """
    status = repository.find_member_status(db, member_id)
    if status is None:
        raise AssignmentRefused(["unknown_member"])
    if not status.identity_verified:
        raise AssignmentRefused(["identity_not_verified"])
    if status.membership_state in ("suspended", "inactive"):
        raise AssignmentRefused(["membership_not_active"])
    if repository.has_active_super_administrator(db):
        raise AssignmentRefused(["super_administrator_exists"])
    tier: Tier = "5"
    invalid = [f"permission_not_for_tier:{p}" for p in extra_permissions if grant_for(p, tier) is None]
    if invalid:
        raise AssignmentRefused(invalid)

    if status.membership_state == "pending":
        membership_repository.record_change(
            db,
            member_id=member_id,
            action="activate",
            from_state="pending",
            to_state="active",
            reason_code="identity_verified",
            note="Activated by the bootstrap command",
            changed_by=None,
        )
        audit.record(
            db,
            actor_id=None,
            action="membership.activate",
            target_type="membership",
            target_id=str(member_id),
            area_path=(rules.PLATFORM,),
            details={"memberId": str(member_id), "from": "pending", "to": "active", "reasonCode": "identity_verified"},
        )

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
        review_due_at=rules.review_due(tier, now),
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



def grant_every_tier5_permission(db: Session, member_id: uuid.UUID) -> StoredAssignment:
    """Give the Super Administrator every permission Tier 5 may hold (the owner's decision, 12 November 2026).

    Like the bootstrap, this is a server command: Tier 5 has nobody above it to grant it. If nobody
    holds Tier 5 yet, it is the bootstrap with every explicit Tier 5 permission. If this member is the
    Super Administrator, their Tier 5 assignment ends and a new one with all of them takes its place, so
    the history keeps both. Refused if someone else holds the position (the BRD has one), the identity
    is not verified, or the membership is suspended or inactive. Permissions the BRD gives only to other
    tiers are not included; per-record rules (nobody decides their own appeal) still apply.
    """
    tier: Tier = "5"
    every = frozenset(code for code, tiers in MATRIX.items() if tier in tiers)
    holders = repository.active_super_administrator_assignments(db)
    if not holders:
        explicit = sorted(code for code in every if grant_for(code, tier) == "explicit")
        return bootstrap_super_administrator(db, member_id, explicit)
    if any(held.member_id != member_id for held in holders):
        raise AssignmentRefused(["super_administrator_exists"])
    status = repository.find_member_status(db, member_id)
    if status is None or not status.identity_verified:
        raise AssignmentRefused(["identity_not_verified"])
    if status.membership_state in ("suspended", "inactive"):
        raise AssignmentRefused(["membership_not_active"])

    reason = "Replaced by the server command that grants every Tier 5 permission"
    for held in holders:
        repository.revoke_assignment(db, held.id, None, reason)
    now = datetime.now(UTC)
    assignment = repository.insert_assignment(
        db,
        member_id=member_id,
        tier=tier,
        area=rules.PLATFORM,
        permissions=every,
        granted_by=None,
        granted_at=now,
        review_due_at=rules.review_due(tier, now),
        note="Every Tier 5 permission, granted by server command (owner's decision, 12 November 2026)",
    )
    audit.record(
        db,
        actor_id=None,
        action="access.assignment.widened",
        target_type="staff_assignment",
        target_id=str(assignment.id),
        area_path=(rules.PLATFORM,),
        details={
            "memberId": str(member_id),
            "replaced": [str(held.id) for held in holders],
            "permissions": sorted(every),
        },
    )
    db.commit()
    return assignment


DENIAL_WINDOW = "10 minutes"


def record_denial(
    db: Session,
    *,
    actor_id: uuid.UUID,
    permission: str,
    reason: str,
    ip: str,
    target: tuple[str, str] | None = None,
    area_path: AreaPath | None = None,
    details: dict[str, object] | None = None,
) -> None:
    """Log a refused staff action so that probing for access is visible (FR-ARCH-002).

    At most one entry per person, permission and reason in DENIAL_WINDOW; the
    repeats are counted and the next entry reports them as repeatsHeldBack.
    Writing every one let any signed-in member flood the append-only audit log
    (review finding, 25 October 2026). The caller commits.
    """
    held_back = repository.tally_denial(db, actor_id, permission, reason, DENIAL_WINDOW)
    if held_back is None:
        return
    audit.record(
        db,
        actor_id=actor_id,
        action="access.denied",
        target_type=target[0] if target else None,
        target_id=target[1] if target else None,
        area_path=area_path,
        details={
            "permission": permission,
            "reason": reason,
            **(details or {}),
            **({"repeatsHeldBack": held_back} if held_back else {}),
        },
        ip=ip,
    )


def refuse(
    db: Session, staff: Staff, permission: str, reason: str, ip: str, *, target: tuple[str, str], area_path: AreaPath | None
) -> NoReturn:
    """Record a refused staff action (see record_denial), then raise it."""
    record_denial(
        db, actor_id=staff.member_id, permission=permission, reason=reason, ip=ip, target=target, area_path=area_path
    )
    db.commit()
    raise AccessRefused(reason)


def check_record_scope(
    db: Session,
    staff: Staff,
    permission: str,
    *,
    member_id: uuid.UUID,
    area_path: AreaPath,
    target: tuple[str, str],
    ip: str,
) -> None:
    """For an action on one member's record: never the person's own record (BR-085),
    and the permission over the record's area (RB-01). Refusals are audited."""
    if member_id == staff.member_id:
        refuse(db, staff, permission, "own_record", ip, target=target, area_path=area_path)
    if not rules.holds(staff.rule_assignments(), permission, area_path):
        refuse(db, staff, permission, "outside_your_area", ip, target=target, area_path=area_path)


def check_rank(
    db: Session,
    staff: Staff,
    permission: str,
    *,
    member_id: uuid.UUID,
    area_path: AreaPath,
    target: tuple[str, str],
    ip: str,
) -> None:
    """For changes that could silence or take over a staff account (its membership state, its
    recovery number): only someone of a higher tier may make them. Nobody outranks the Super
    Administrator, so that account is not changed through the API at all. Refusals are audited."""
    if rules.target_outranks(staff.rule_assignments(), permission, area_path, repository.held_tiers(db, member_id)):
        refuse(db, staff, permission, "target_outranks_you", ip, target=target, area_path=area_path)


def visible_areas(staff: Staff, permission: str) -> list[str] | None:
    """None when the person holds the permission over the whole platform; otherwise the area keys where they hold it."""
    areas = [a.area for a in staff.assignments if permission in a.permissions]
    if any(area.level == "platform" for area in areas):
        return None
    return [area.key for area in areas]


def visible_audit_areas(staff: Staff) -> list[str] | None:
    """None when the person may read every audit entry; otherwise the areas they may read."""
    return visible_areas(staff, "audit.view")


def has_permission_over(staff: Staff, permission: str, area_path: AreaPath) -> bool:
    return rules.holds(staff.rule_assignments(), permission, area_path)


def has_platform_permission(staff: Staff, permission: str) -> bool:
    return any(permission in a.permissions and a.area.level == "platform" for a in staff.assignments)


def visible_assignments(db: Session, staff: Staff, state: str, limit: int) -> list[repository.ListedAssignment]:
    """W09: assignments whose area lies inside the caller's own roles.assign areas (RB-03)."""
    shown = []
    for listed in repository.list_assignments(db, state=state, limit=500):
        path = repository.area_path(db, listed.assignment.area)
        if path is not None and has_permission_over(staff, "roles.assign", path):
            shown.append(listed)
        if len(shown) == limit:
            break
    return shown


def to_request(member_id: uuid.UUID, tier: Tier, area: Area, permissions: list[str]) -> AssignmentRequest:
    return AssignmentRequest(member_id=member_id, tier=tier, area=area, permissions=frozenset(permissions))


def work_queues(db: Session, staff: Staff) -> schemas.WorkQueuesOut:
    """Aggregate work queue counts for the staff member's visible areas and permissions (D01).

    Uses true scoped SQL COUNT(*) queries without limit cutoffs. Errors are captured
    and returned in `unavailable` so failures are never silently swallowed or mistaken
    for lack of permission.
    """
    verification = None
    appeals = None
    duplicates = None
    membership = None
    events = None
    gallery_removals = None
    gallery_albums = None
    messaging = None
    configuration = None
    reports = None
    unavailable: list[str] = []

    rule_assignments = staff.rule_assignments()

    # 1. Identity Reviews (members.verify)
    if rules.holds(rule_assignments, "members.verify"):
        try:
            from app.modules.identity.reviews import service as reviews_service

            counts = reviews_service.queue_counts(db, staff)
            verification = schemas.VerificationQueueCount(
                awaiting_review=counts.awaiting_review,
                needs_update=counts.needs_update,
                assigned_to_me=counts.assigned_to_me,
            )
        except Exception:
            db.rollback()
            logger.exception("Failed to query verification queue counts for member %s", staff.member_id)
            unavailable.append("verification")

    # 2. Appeals (idv.appeal.decide)
    if rules.holds(rule_assignments, "idv.appeal.decide"):
        try:
            areas = visible_areas(staff, "idv.appeal.decide")
            cond = "WHERE a.state = 'submitted'"
            params: dict[str, object] = {}
            if areas is not None:
                cond += " AND a.area_path && CAST(:areas AS text[])"
                params["areas"] = areas
            waiting = db.scalar(text(f"SELECT count(*) FROM identity.review_appeal a {cond}"), params) or 0
            appeals = schemas.SimpleQueueCount(waiting=int(waiting))
        except Exception:
            db.rollback()
            logger.exception("Failed to query appeals queue counts for member %s", staff.member_id)
            unavailable.append("appeals")

    # 3. Duplicate Cases (idv.duplicate.investigate)
    if rules.holds(rule_assignments, "idv.duplicate.investigate"):
        try:
            areas = visible_areas(staff, "idv.duplicate.investigate")
            cond = "WHERE c.state = 'open'"
            params = {}
            if areas is not None:
                cond += " AND c.area_path && CAST(:areas AS text[])"
                params["areas"] = areas
            open_cases = db.scalar(text(f"SELECT count(*) FROM identity.duplicate_case c {cond}"), params) or 0
            duplicates = schemas.DuplicateQueueCount(open=int(open_cases))
        except Exception:
            db.rollback()
            logger.exception("Failed to query duplicates queue counts for member %s", staff.member_id)
            unavailable.append("duplicates")

    # 4. Membership Activation (members.activate)
    if rules.holds(rule_assignments, "members.activate"):
        try:
            areas = visible_areas(staff, "members.activate")
            area_cond = "AND areas.keys && CAST(:areas AS text[])" if areas is not None else ""
            params = {"areas": areas} if areas is not None else {}
            sql = f"""
                SELECT count(*)
                FROM npm.member m
                LEFT JOIN membership.membership ms ON ms.member_id = m.id
                LEFT JOIN geo.district d ON d.district_code = m.district_code
                CROSS JOIN LATERAL (
                    SELECT array_remove(
                        ARRAY['platform', 'province:' || d.province_code, 'district:' || m.district_code,
                              'ds:' || m.ds_code, 'gn:' || m.gs_code],
                        NULL
                    ) AS keys
                ) areas
                WHERE m.deleted_at IS NULL
                  AND m.verification_status = 'identity_confirmed'
                  AND COALESCE(ms.state, 'pending') = 'pending'
                  {area_cond}
            """
            awaiting = db.scalar(text(sql), params) or 0
            membership = schemas.MembershipQueueCount(awaiting_activation=int(awaiting))
        except Exception:
            db.rollback()
            logger.exception("Failed to query membership queue counts for member %s", staff.member_id)
            unavailable.append("membership")

    # 5. Events Management (events.manage)
    if rules.holds(rule_assignments, "events.manage"):
        try:
            areas = visible_areas(staff, "events.manage")
            cond = "WHERE e.state IN ('draft', 'published')"
            params = {}
            if areas is not None:
                cond += " AND e.area_path && CAST(:areas AS text[])"
                params["areas"] = areas
            sql = f"""
                SELECT
                    count(*) FILTER (WHERE e.state = 'draft') AS drafts,
                    count(*) FILTER (WHERE e.state = 'published') AS published,
                    count(*) AS total
                FROM events.event e
                {cond}
            """
            row = db.execute(text(sql), params).one()
            events = schemas.EventsQueueCount(
                drafts=int(row.drafts or 0),
                published=int(row.published or 0),
                total=int(row.total or 0),
            )
        except Exception:
            db.rollback()
            logger.exception("Failed to query events queue counts for member %s", staff.member_id)
            unavailable.append("events")

    # 6. Photo Removal Requests (gallery.takedown)
    if rules.holds(rule_assignments, "gallery.takedown"):
        try:
            areas = visible_areas(staff, "gallery.takedown")
            cond = "WHERE r.state = 'open'"
            params = {}
            if areas is not None:
                cond += " AND r.area_path && CAST(:areas AS text[])"
                params["areas"] = areas
            sql = f"""
                SELECT
                    count(*) AS open,
                    count(*) FILTER (WHERE r.due_at < now() + interval '6 hours' OR r.escalated_at IS NOT NULL) AS escalated_18h
                FROM content.removal_request r
                {cond}
            """
            row = db.execute(text(sql), params).one()
            gallery_removals = schemas.GalleryRemovalsQueueCount(
                open=int(row.open or 0),
                escalated_18h=int(row.escalated_18h or 0),
            )
        except Exception:
            db.rollback()
            logger.exception("Failed to query gallery removals queue counts for member %s", staff.member_id)
            unavailable.append("gallery_removals")

    # 7. Gallery Album Publishing (gallery.publish)
    if rules.holds(rule_assignments, "gallery.publish"):
        try:
            areas = visible_areas(staff, "gallery.publish")
            cond = "WHERE a.state IN ('draft', 'submitted')"
            params = {}
            if areas is not None:
                cond += " AND a.area_path && CAST(:areas AS text[])"
                params["areas"] = areas
            sql = f"""
                SELECT
                    count(*) FILTER (WHERE a.state = 'draft') AS drafts,
                    count(*) FILTER (WHERE a.state = 'submitted') AS submitted
                FROM content.album a
                {cond}
            """
            row = db.execute(text(sql), params).one()
            gallery_albums = schemas.GalleryAlbumsQueueCount(
                drafts=int(row.drafts or 0),
                submitted=int(row.submitted or 0),
            )
        except Exception:
            db.rollback()
            logger.exception("Failed to query gallery albums queue counts for member %s", staff.member_id)
            unavailable.append("gallery_albums")

    # 8. Broadcast Messaging (notifications.send)
    if rules.holds(rule_assignments, "notifications.send"):
        try:
            areas = visible_areas(staff, "notifications.send")
            cond = "WHERE b.state IN ('draft', 'pending_approval')"
            params = {}
            if areas is not None:
                cond += " AND b.area_path && CAST(:areas AS text[])"
                params["areas"] = areas
            sql = f"""
                SELECT
                    count(*) FILTER (WHERE b.state = 'draft') AS drafts,
                    count(*) FILTER (WHERE b.state = 'pending_approval') AS pending_approval
                FROM notifications.broadcast b
                {cond}
            """
            row = db.execute(text(sql), params).one()
            messaging = schemas.BroadcastsQueueCount(
                drafts=int(row.drafts or 0),
                pending_approval=int(row.pending_approval or 0),
            )
        except Exception:
            db.rollback()
            logger.exception("Failed to query messaging queue counts for member %s", staff.member_id)
            unavailable.append("messaging")

    # 9. Configuration & Feature Flags (system.configure)
    if rules.holds(rule_assignments, "system.configure"):
        try:
            from app.modules.features import service as features_service

            registry = features_service.registry(db)
            total = len(registry)
            enabled = sum(1 for f in registry if f.enabled)
            configuration = schemas.ConfigurationQueueCount(total=total, enabled=enabled)
        except Exception:
            db.rollback()
            logger.exception("Failed to query configuration queue counts for member %s", staff.member_id)
            unavailable.append("configuration")

    # 10. Community Reports (reports.view)
    if rules.holds(rule_assignments, "reports.view"):
        try:
            from app.modules.community.reports import service as reports_service

            counts = reports_service.queue_counts(db, staff)
            reports = schemas.CommunityReportsQueueCount(
                submitted=counts.submitted,
                under_review=counts.under_review,
                in_progress=counts.in_progress,
                total_actionable=counts.total_actionable,
            )
        except Exception:
            db.rollback()
            logger.exception("Failed to query community reports queue counts for member %s", staff.member_id)
            unavailable.append("reports")

    return schemas.WorkQueuesOut(
        verification=verification,
        appeals=appeals,
        duplicates=duplicates,
        membership=membership,
        events=events,
        gallery_removals=gallery_removals,
        gallery_albums=gallery_albums,
        messaging=messaging,
        configuration=configuration,
        reports=reports,
        unavailable=unavailable,
    )
