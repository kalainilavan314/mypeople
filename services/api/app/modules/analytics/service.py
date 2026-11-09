"""D32 operational analytics: the figures MP-DEC-001 5.2 allows for Phase 1, scoped to the
viewer's areas and with small groups hidden. No voter intent, no rankings of people, nothing
from household, assistance, health or finance data (RR-06, RR-07)."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.modules.access import service as access
from app.modules.access.service import Staff
from app.modules.analytics import repository
from app.modules.analytics.rules import funnel, share, shown

VIEW = "analytics.view"  # PRM-24
PERIODS = (7, 30, 90)


@dataclass(frozen=True)
class Operations:
    period_days: int
    generated_at: datetime
    platform_wide: bool
    started: int | None
    submitted: int | None
    verified: int | None
    active: int | None
    completion_rate: float | None
    decided: int | None
    median_hours: float | None
    within_target_rate: float | None
    waiting: int | None
    over_target: int | None
    events: int
    going: int | None
    attended: int | None
    attendance_rate: float | None


def operations(db: Session, staff: Staff, *, period_days: int) -> Operations:
    areas = access.visible_areas(staff, VIEW)
    now = datetime.now(UTC)
    since = now - timedelta(days=period_days)

    signup = repository.registration_funnel(db, since=since, areas=areas)
    started, submitted, verified, active = funnel([signup.started, signup.submitted, signup.verified, signup.active])

    reviews = repository.verification_turnaround(db, since=since, areas=areas)
    decided = shown(reviews.decided)
    # The median and the on-time share describe the decided group, so they hide with it.
    within_target = funnel([reviews.decided, reviews.within_target])[1] if decided is not None else None

    queue = repository.review_queue(db, areas=areas)
    waiting, over_target = funnel([queue.waiting, queue.over_target])

    held = repository.event_attendance(db, since=since, areas=areas)
    going, attended = shown(held.going), shown(held.attended)

    return Operations(
        period_days=period_days,
        generated_at=now,
        platform_wide=areas is None,
        started=started,
        submitted=submitted,
        verified=verified,
        active=active,
        completion_rate=share(active, started),
        decided=decided,
        median_hours=reviews.median_hours if decided is not None else None,
        within_target_rate=share(within_target, decided),
        waiting=waiting,
        over_target=over_target,
        events=held.events,
        going=going,
        attended=attended,
        attendance_rate=share(attended, going),
    )
