import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.community.reports.schemas import CommunityReportsQueueCount


@dataclass(frozen=True)
class StoredReport:
    id: uuid.UUID
    member_id: uuid.UUID
    category: str
    title: str
    description: str
    district_code: str | None
    ds_code: str | None
    gs_code: str | None
    area_path: list[str]
    priority: str
    status: str
    created_at: datetime
    updated_at: datetime


_COLUMNS = """
    id, member_id, category, title, description, district_code, ds_code, gs_code,
    area_path, priority, status, created_at, updated_at
"""


def queue_counts(db: Session, visible_areas: list[str] | None) -> CommunityReportsQueueCount:
    """Aggregate actionable report counts for the staff member's visible areas."""
    if visible_areas is not None and len(visible_areas) == 0:
        return CommunityReportsQueueCount(submitted=0, under_review=0, in_progress=0, total_actionable=0)

    conditions: list[str] = []
    params: dict[str, Any] = {}
    if visible_areas is not None:
        conditions.append("area_path && CAST(:areas AS text[])")
        params["areas"] = visible_areas

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    sql = f"""
        SELECT
            count(*) FILTER (WHERE status = 'submitted') AS submitted,
            count(*) FILTER (WHERE status = 'under_review') AS under_review,
            count(*) FILTER (WHERE status = 'in_progress') AS in_progress,
            count(*) FILTER (WHERE status IN ('submitted', 'under_review', 'in_progress')) AS total_actionable
        FROM npm.community_report
        {where_clause}
    """
    row = db.execute(text(sql), params).one()
    return CommunityReportsQueueCount(
        submitted=int(row.submitted or 0),
        under_review=int(row.under_review or 0),
        in_progress=int(row.in_progress or 0),
        total_actionable=int(row.total_actionable or 0),
    )


def list_reports(
    db: Session,
    visible_areas: list[str] | None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[StoredReport], int]:
    """Bounded, deterministically ordered list of community reports within caller's permitted area."""
    if visible_areas is not None and len(visible_areas) == 0:
        return [], 0

    conditions: list[str] = []
    params: dict[str, Any] = {"limit": limit, "offset": offset}

    if visible_areas is not None:
        conditions.append("area_path && CAST(:areas AS text[])")
        params["areas"] = visible_areas

    if status is not None:
        conditions.append("status = :status")
        params["status"] = status

    where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    count_sql = f"SELECT count(*) FROM npm.community_report {where_clause}"
    total = db.scalar(text(count_sql), params) or 0

    select_sql = f"""
        SELECT {_COLUMNS}
        FROM npm.community_report
        {where_clause}
        ORDER BY created_at DESC, id DESC
        LIMIT :limit OFFSET :offset
    """
    rows = db.execute(text(select_sql), params).mappings()
    items = [StoredReport(**row) for row in rows]
    return items, int(total)


def find_report(db: Session, report_id: uuid.UUID, visible_areas: list[str] | None) -> StoredReport | None:
    """One report only when its immutable snapshot intersects the caller's assignments."""
    conditions = ["id = :id"]
    params: dict[str, Any] = {"id": report_id}
    if visible_areas is not None:
        if not visible_areas:
            return None
        conditions.append("area_path && CAST(:areas AS text[])")
        params["areas"] = visible_areas
    row = db.execute(
        text(f"SELECT {_COLUMNS} FROM npm.community_report WHERE {' AND '.join(conditions)}"),
        params,
    ).mappings().one_or_none()
    return StoredReport(**row) if row else None
