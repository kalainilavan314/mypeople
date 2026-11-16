"""Home for the signed-in member (BRD H01, H02, H04; FR-HOME-001 to 008, 012, 013).

One answer for the Home tab: which layout to show, the greeting's name and
area, exactly one next step, the nearest upcoming event in the member's
area, the Promise Tracker's count of promises made for the member's area
(M18), and which quick actions and hub services are open or locked, with the
reason and next step for each lock. The server decides the locks, so the app
never has to guess (BR-089). Home holds no data of its own; it reads the
member's own identity review, membership, contact, profile and events, and
the published promises.

Not here: the notification list (FR-HOME-009 to 011, notifications batch)
and the five bottom tabs (FR-HOME-014, the apps).
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.community.promises import repository as promises
from app.modules.events import repository as events
from app.modules.events.repository import EventListItem, StoredEvent
from app.modules.features import repository as features_repository
from app.modules.home import rules
from app.modules.identity.recovery import repository as contacts
from app.modules.identity.reviews import repository as reviews
from app.modules.membership import repository as membership

TABS_WITH_LOCKS = ("events", "card", "gallery")


@dataclass(frozen=True)
class Lock:
    feature: str
    reason: str | None  # None: open
    next_step: str | None


@dataclass(frozen=True)
class PromiseSummary:
    """M18 on Home: the Promise Tracker, open or not open yet, and when open the published promises
    made for the member's GN, DS division, district, province or the whole platform, by status."""

    lock: Lock
    counts: dict[str, int]  # empty while the tracker is not open


@dataclass(frozen=True)
class Home:
    active: bool  # H01; otherwise H02
    display_name: str
    district_name: str | None
    gn_name: str | None
    identity_state: str  # not_submitted, submitted, in_review, needs_update, verified or unable_to_verify
    review_ref: str | None
    membership_state: str
    next_step: str | None
    next_step_event: StoredEvent | None  # for event_soon
    coming_up: EventListItem | None
    features: list[Lock]
    hub: list[Lock]
    promises: PromiseSummary


def _lock(feature: str, identity_verified: bool, membership_active: bool, closed: frozenset[str]) -> Lock:
    if feature in closed:
        return Lock(feature, "not_open", None)
    lock = rules.feature_lock(feature, identity_verified=identity_verified, membership_active=membership_active)
    return Lock(feature, lock[0], lock[1]) if lock else Lock(feature, None, None)


def _closed_services(db: Session, flags_enforced: bool) -> frozenset[str]:
    """Services whose module switch is off where switches are enforced (production)."""
    if not flags_enforced:
        return frozenset()
    return frozenset(s for s, module in rules.GATED_BY_MODULE.items() if not features_repository.is_enabled(db, module))


def home(db: Session, member_id: uuid.UUID, *, flags_enforced: bool = False) -> Home:
    profile = membership.find_member_profile(db, member_id)
    status = access_repository.find_member_status(db, member_id)
    assert profile is not None and status is not None
    review = reviews.latest_review(db, member_id)
    verified, active = status.identity_verified, status.membership_active
    now = datetime.now(UTC)

    soon = events.next_going_event(db, member_id, now, rules.EVENT_SOON)
    candidates = set()
    if review is not None and review.state == "needs_update":
        candidates.add("correct_identity")
    if not verified and review is None:
        candidates.add("submit_identity")
    if soon is not None:
        candidates.add("event_soon")
    if contacts.find_contact(db, member_id) is None:
        candidates.add("confirm_recovery_number")
    if profile["gs_code"] is None:
        candidates.add("complete_profile")
    step = rules.next_step(candidates)
    closed = _closed_services(db, flags_enforced)

    area_keys = [area.key for area in access_repository.member_area_path(db, member_id)]
    upcoming = events.published_events(
        db, member_id=member_id, area_keys=area_keys, starts_from=now, starts_before=None,
        event_type=None, search=None, participation=None, limit=5,
    )
    return Home(
        active=verified and active,
        display_name=profile["full_name"],
        district_name=profile["district_name"],
        gn_name=profile["gs_name"],
        identity_state="verified" if verified else (review.state if review else "not_submitted"),
        review_ref=review.review_ref if review else None,
        membership_state=membership.current_state(db, member_id).state,
        next_step=step,
        next_step_event=soon if step == "event_soon" else None,
        coming_up=next((item for item in upcoming if item.event.state == "published"), None),
        features=[_lock(f, verified, active, closed) for f in (*rules.QUICK_ACTIONS, *TABS_WITH_LOCKS)],
        hub=[_lock(s, verified, active, closed) for s in rules.HUB_SERVICES],
        promises=_promises(db, area_keys, verified, active, closed),
    )


def _promises(db: Session, area_keys: list[str], verified: bool, active: bool, closed: frozenset[str]) -> PromiseSummary:
    lock = _lock(rules.PROMISE_TRACKER, verified, active, closed)
    # Nothing is read from a module that is switched off.
    return PromiseSummary(lock, promises.status_counts(db, area_keys) if lock.reason is None else {})
