import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.community.promises.rules import STATUSES, Status
from app.modules.events.schemas import EventSummaryOut
from app.modules.home.service import Home, Lock, PromiseSummary

IdentityState = Literal["not_submitted", "submitted", "in_review", "needs_update", "verified", "unable_to_verify"]


class HomeFeatureOut(CamelModel):
    """Open, or locked with a plain reason and the next step to take (FR-HOME-008, BR-026)."""

    key: str
    available: bool
    reason: Literal["identity_not_verified", "membership_not_active", "not_open"] | None
    next_step: Literal["view_verification", "view_membership"] | None

    @classmethod
    def build(cls, lock: Lock) -> "HomeFeatureOut":
        return cls(
            key=lock.feature,
            available=lock.reason is None,
            reason=lock.reason,  # type: ignore[arg-type]
            next_step=lock.next_step,  # type: ignore[arg-type]
        )


class HomeNextStepOut(CamelModel):
    """Exactly one (BR-025)."""

    kind: Literal["correct_identity", "submit_identity", "event_soon", "confirm_recovery_number", "complete_profile"]
    review_ref: str | None = None
    event_id: uuid.UUID | None = None
    event_title_en: str | None = None
    event_title_ta: str | None = None
    starts_at: datetime | None = None


class HomeHubOut(CamelModel):
    gn_label: str | None = Field(description="The member's GN division, labelling the hub (FR-HOME-012)")
    services: list[HomeFeatureOut] = Field(description="Eight services in this order; the party fund never comes first")


class HomePromiseCountOut(CamelModel):
    status: Status
    count: int


class HomePromisesOut(CamelModel):
    """M18 on Home: the Promise Tracker, with the published promises made for the member's GN, DS
    division, district, province or the whole platform, counted by status."""

    feature: HomeFeatureOut = Field(description="Open, or not open yet while the Promise Tracker is switched off")
    total: int
    counts: list[HomePromiseCountOut] = Field(description="Statuses with at least one promise, in the tracker's order")

    @classmethod
    def build(cls, summary: PromiseSummary) -> "HomePromisesOut":
        return cls(
            feature=HomeFeatureOut.build(summary.lock),
            total=sum(summary.counts.values()),
            counts=[HomePromiseCountOut(status=s, count=summary.counts[s]) for s in STATUSES if summary.counts.get(s)],
        )


class HomeOut(CamelModel):
    layout: Literal["active", "awaiting_review"] = Field(
        description="H01 only when identity is Verified and membership Active (FR-HOME-001)"
    )
    display_name: str = Field(description="For the greeting; the app adds the time of day (FR-HOME-002)")
    district_name: str | None
    gn_name: str | None
    identity_state: IdentityState
    review_ref: str | None = Field(description="The VR reference for H02's status card (FR-HOME-006)")
    membership_state: Literal["pending", "active", "suspended", "inactive"]
    next_step: HomeNextStepOut | None
    coming_up: EventSummaryOut | None = Field(description="The next event in the member's area (FR-HOME-005)")
    quick_actions: list[HomeFeatureOut] = Field(description="Report issue, Volunteer, My area, Community (FR-HOME-004)")
    tabs: list[HomeFeatureOut] = Field(description="Events, Card and Gallery, open or locked")
    hub: HomeHubOut
    promises: HomePromisesOut

    @classmethod
    def build(cls, home: Home) -> "HomeOut":
        step = None
        if home.next_step is not None:
            event = home.next_step_event
            step = HomeNextStepOut(
                kind=home.next_step,  # type: ignore[arg-type]
                review_ref=home.review_ref if home.next_step == "correct_identity" else None,
                event_id=event.id if event else None,
                event_title_en=event.title_en if event else None,
                event_title_ta=event.title_ta if event else None,
                starts_at=event.starts_at if event else None,
            )
        actions = [lock for lock in home.features if lock.feature in ("report_issue", "volunteer", "my_area", "community")]
        tabs = [lock for lock in home.features if lock not in actions]
        return cls(
            layout="active" if home.active else "awaiting_review",
            display_name=home.display_name,
            district_name=home.district_name,
            gn_name=home.gn_name,
            identity_state=home.identity_state,  # type: ignore[arg-type]
            review_ref=home.review_ref,
            membership_state=home.membership_state,  # type: ignore[arg-type]
            next_step=step,
            coming_up=EventSummaryOut.build(home.coming_up.event, home.coming_up.my_response) if home.coming_up else None,
            quick_actions=[HomeFeatureOut.build(lock) for lock in actions],
            tabs=[HomeFeatureOut.build(lock) for lock in tabs],
            hub=HomeHubOut(gn_label=home.gn_name, services=[HomeFeatureOut.build(lock) for lock in home.hub]),
            promises=HomePromisesOut.build(home.promises),
        )
