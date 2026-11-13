import logging
import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.modules.access import rules
from app.modules.access.rules import Area, PLATFORM, area_from_key
from app.modules.access.service import AccessRefused, Staff, visible_areas
from app.modules.audit import service as audit
from app.modules.community.reports import repository
from app.modules.community.reports.repository import StoredReport
from app.modules.community.reports.schemas import (
    ACTIONABLE_STATUSES,
    TERMINAL_STATUSES,
    CommunityReportsQueueCount,
)

logger = logging.getLogger(__name__)

PERMISSION = "reports.view"
VALID_STATUSES = frozenset((*ACTIONABLE_STATUSES, *TERMINAL_STATUSES))


class InvalidReportState(Exception):
    def __init__(self, state: str) -> None:
        super().__init__(f"Invalid community report state: {state}")
        self.state = state


class ReportNotFound(Exception):
    pass


def queue_counts(db: Session, staff: Staff) -> CommunityReportsQueueCount:
    """Aggregate actionable report counts for D01 operational work queues.

    ROUTINE DASHBOARD REFRESH AUDIT DECISION:
    Aggregate work-queue count queries (such as queue_counts) are deliberately
    NOT written to the tamper-evident audit log. Logging every periodic 60-second
    refresh creates excessive log volume and obscures genuine operational actions.
    Auditing is strictly applied to identifiable report listing and record interactions.
    """
    if not rules.holds(staff.rule_assignments(), PERMISSION):
        raise AccessRefused("forbidden")

    areas = visible_areas(staff, PERMISSION)
    return repository.queue_counts(db, areas)


def list_reports(
    db: Session,
    staff: Staff,
    *,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    ip: str = "127.0.0.1",
) -> tuple[list[StoredReport], int]:
    """Bounded, paginated list of area-scoped community reports."""
    if not rules.holds(staff.rule_assignments(), PERMISSION):
        raise AccessRefused("forbidden")

    if status is not None and status not in VALID_STATUSES:
        raise InvalidReportState(status)

    areas = visible_areas(staff, PERMISSION)
    bounded_limit = max(1, min(limit, 200))
    bounded_offset = max(0, offset)

    items, total = repository.list_reports(
        db,
        areas,
        status=status,
        limit=bounded_limit,
        offset=bounded_offset,
    )

    # Audited as an identifiable record-viewing query.
    primary_area = area_from_key(areas[0]) if areas and len(areas) == 1 else PLATFORM
    audit.record(
        db,
        actor_id=staff.member_id,
        action="reports.viewed",
        target_type="community_reports",
        target_id=status or "all",
        area_path=(primary_area,),
        details={
            "statusFilter": status,
            "limit": bounded_limit,
            "offset": bounded_offset,
            "totalMatched": total,
            "returnedCount": len(items),
        },
        ip=ip,
    )
    db.commit()

    return items, total


def get_report(db: Session, staff: Staff, report_id: uuid.UUID, ip: str) -> StoredReport:
    """Return and audit one report without revealing whether an out-of-scope id exists."""
    if not rules.holds(staff.rule_assignments(), PERMISSION):
        raise AccessRefused("forbidden")
    areas = visible_areas(staff, PERMISSION)
    report = repository.find_report(db, report_id, areas)
    if report is None:
        raise ReportNotFound()

    path = tuple(area_from_key(key) for key in report.area_path)
    audit.record(
        db,
        actor_id=staff.member_id,
        action="reports.record.viewed",
        target_type="community_report",
        target_id=str(report.id),
        area_path=path,
        details={"status": report.status, "category": report.category},
        ip=ip,
    )
    db.commit()
    return report
