"""SQL for D32's operational figures. Every query is limited to the viewer's areas (`areas`
None means the whole platform) and returns counts only, never a member row (RR-06).

npm.member, geo.* and events.* come from the Express and Alembic migrations, so this is
plain SQL. A member with no area on record is counted only for platform-wide viewers.
"""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

# Working days from the day after `start` to `end`, Monday to Friday (KPI-04's
# 5-working-day target); public holidays are not known to the platform.
_WORKING_DAYS = """(SELECT count(*) FROM generate_series(({start})::date + 1, ({end})::date, interval '1 day') AS day
                    WHERE extract(isodow FROM day) < 6)"""
_WAITING_SINCE = "COALESCE(r.resubmitted_at, r.submitted_at)"
_REVIEW_IN_SCOPE = "(CAST(:areas AS text[]) IS NULL OR r.area_path && CAST(:areas AS text[]))"


@dataclass(frozen=True)
class Funnel:
    started: int
    submitted: int
    verified: int
    active: int


@dataclass(frozen=True)
class Turnaround:
    decided: int
    median_hours: float | None
    within_target: int


@dataclass(frozen=True)
class Queue:
    waiting: int
    over_target: int


@dataclass(frozen=True)
class Attendance:
    events: int
    going: int
    attended: int


def registration_funnel(db: Session, *, since: datetime, areas: list[str] | None) -> Funnel:
    """Members who registered since `since`: how many sent their identity, were verified, are Active."""
    row = db.execute(
        text(
            """
            WITH scoped AS (
                SELECT m.id FROM npm.member m
                LEFT JOIN geo.district d ON d.district_code = m.district_code
                WHERE m.deleted_at IS NULL AND m.created_at >= :since
                  AND (CAST(:areas AS text[]) IS NULL
                       OR ARRAY['gn:' || m.gs_code, 'ds:' || m.ds_code, 'district:' || m.district_code,
                                'province:' || d.province_code] && CAST(:areas AS text[]))
            )
            SELECT count(*) AS started,
                   count(*) FILTER (WHERE EXISTS (SELECT 1 FROM identity.identity_review r WHERE r.member_id = s.id))
                       AS submitted,
                   count(*) FILTER (WHERE EXISTS (SELECT 1 FROM identity.identity_review r
                                                  WHERE r.member_id = s.id AND r.state = 'verified')) AS verified,
                   count(*) FILTER (WHERE EXISTS (SELECT 1 FROM membership.membership ms
                                                  WHERE ms.member_id = s.id AND ms.state = 'active')) AS active
            FROM scoped s
            """
        ),
        {"since": since, "areas": areas},
    ).one()
    return Funnel(started=row.started, submitted=row.submitted, verified=row.verified, active=row.active)


def verification_turnaround(db: Session, *, since: datetime, areas: list[str] | None) -> Turnaround:
    """Identity reviews decided since `since`: how many, the median wait, how many within 5 working days."""
    within = _WORKING_DAYS.format(start=_WAITING_SINCE, end="r.decided_at")
    row = db.execute(
        text(
            f"""
            SELECT count(*) AS decided,
                   percentile_cont(0.5) WITHIN GROUP (
                       ORDER BY extract(epoch FROM r.decided_at - {_WAITING_SINCE}) / 3600) AS median_hours,
                   count(*) FILTER (WHERE {within} <= 5) AS within_target
            FROM identity.identity_review r
            WHERE r.decided_at >= :since AND {_REVIEW_IN_SCOPE}
            """
        ),
        {"since": since, "areas": areas},
    ).one()
    median = None if row.median_hours is None else round(float(row.median_hours), 1)
    return Turnaround(decided=row.decided, median_hours=median, within_target=row.within_target)


def review_queue(db: Session, *, areas: list[str] | None) -> Queue:
    """Reviews waiting on a reviewer now (not those waiting on the member), and how many are past 5 working days."""
    over = _WORKING_DAYS.format(start=_WAITING_SINCE, end="now()")
    row = db.execute(
        text(
            f"""
            SELECT count(*) AS waiting, count(*) FILTER (WHERE {over} > 5) AS over_target
            FROM identity.identity_review r
            WHERE r.state IN ('submitted', 'in_review') AND {_REVIEW_IN_SCOPE}
            """
        ),
        {"areas": areas},
    ).one()
    return Queue(waiting=row.waiting, over_target=row.over_target)


def event_attendance(db: Session, *, since: datetime, areas: list[str] | None) -> Attendance:
    """Published events held since `since`: how many, the Going answers, and the check-ins."""
    row = db.execute(
        text(
            """
            WITH held AS (
                SELECT e.id FROM events.event e
                WHERE e.state = 'published' AND e.starts_at >= :since AND e.starts_at < now()
                  AND (CAST(:areas AS text[]) IS NULL OR e.area_path && CAST(:areas AS text[]))
            )
            SELECT (SELECT count(*) FROM held) AS events,
                   (SELECT count(*) FROM events.rsvp r JOIN held h ON h.id = r.event_id WHERE r.response = 'going') AS going,
                   (SELECT count(*) FROM events.attendance a JOIN held h ON h.id = a.event_id) AS attended
            """
        ),
        {"since": since, "areas": areas},
    ).one()
    return Attendance(events=row.events, going=row.going, attended=row.attended)
