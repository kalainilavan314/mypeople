"""Accountability scorecard rules (BRD FR-ACS-001 to 008, BR-115 to 117) as plain functions.

Each GN, DS division and district gets the same figures for a quarter, computed from its cases:
accepted issues, issues closed with evidence, resolution rate, on-time rate, cases now delayed,
average processing time, member-confirmed outcomes and reopen rate. Every value carries its
numerator and denominator. An area with fewer than 10 accepted cases shows "Insufficient data" and
no figures. No person is named and no case text appears.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

PUBLISH = "scorecard.publish"  # PRM-42
SLA_VERSION = "BRD 4.3 proposal v1 (OD-10)"
MINIMUM_ACCEPTED = 10
SHARE_WORKING_DAYS = 10
METRICS = (
    "accepted", "closed_with_evidence", "resolution_rate", "on_time_rate", "currently_delayed",
    "average_processing_days", "member_confirmed_rate", "reopen_rate",
)
LOCAL_OFFSET = timedelta(hours=5, minutes=30)


def period_bounds(period: str) -> tuple[datetime, datetime]:
    """'2026-Q4' -> its start and end as UTC instants, in Sri Lankan time."""
    year, quarter = int(period[:4]), int(period[-1])
    start_month = 3 * (quarter - 1) + 1
    start = datetime(year, start_month, 1, tzinfo=UTC) - LOCAL_OFFSET
    end_year, end_month = (year + 1, 1) if quarter == 4 else (year, start_month + 3)
    end = datetime(end_year, end_month, 1, tzinfo=UTC) - LOCAL_OFFSET
    return start, end


def previous_periods(period: str, count: int) -> list[str]:
    year, quarter = int(period[:4]), int(period[-1])
    out = []
    for _ in range(count):
        out.append(f"{year}-Q{quarter}")
        quarter -= 1
        if quarter == 0:
            year, quarter = year - 1, 4
    return out


@dataclass(frozen=True)
class CaseFacts:
    """What one accepted case contributes; nothing that identifies it."""

    area_keys: list[str]
    closed: bool
    on_time: bool
    delayed: bool
    processing_days: float | None
    confirmed: bool | None  # the reporter's rating of the closure, when given
    reopened: bool


def _ratio(numerator: int, denominator: int) -> dict[str, Any]:
    value = round(100 * numerator / denominator, 1) if denominator else None
    return {"value": value, "numerator": numerator, "denominator": denominator}


def figures(facts: list[CaseFacts]) -> dict[str, Any]:
    """Per area key (gn, ds or district): either {"insufficient": true} or every metric with its parts."""
    by_area: dict[str, list[CaseFacts]] = {}
    for fact in facts:
        for key in fact.area_keys:
            if key.split(":")[0] in ("gn", "ds", "district"):
                by_area.setdefault(key, []).append(fact)
    out: dict[str, Any] = {}
    for key, cases in sorted(by_area.items()):
        accepted = len(cases)
        if accepted < MINIMUM_ACCEPTED:
            out[key] = {"insufficient": True}
            continue
        closed = [c for c in cases if c.closed]
        responses = [c for c in closed if c.confirmed is not None]
        days = [c.processing_days for c in closed if c.processing_days is not None]
        out[key] = {
            "insufficient": False,
            "metrics": {
                "accepted": {"value": accepted, "numerator": accepted, "denominator": None},
                "closed_with_evidence": {"value": len(closed), "numerator": len(closed), "denominator": None},
                "resolution_rate": _ratio(len(closed), accepted),
                "on_time_rate": _ratio(sum(1 for c in closed if c.on_time), len(closed)),
                "currently_delayed": {"value": sum(1 for c in cases if c.delayed), "numerator": None, "denominator": None},
                "average_processing_days": {
                    "value": round(sum(days) / len(days), 1) if days else None, "numerator": None, "denominator": len(days),
                },
                "member_confirmed_rate": _ratio(sum(1 for c in responses if c.confirmed), len(responses)),
                "reopen_rate": _ratio(sum(1 for c in closed if c.reopened), len(closed)),
            },
        }
    return out


def check_publish(state: str, publishable_at: datetime | None, now: datetime) -> str | None:
    """FR-ACS-005: published only after 10 working days with the responsible tiers."""
    if state != "shared":
        return f"not_allowed_from:{state}"
    if publishable_at is None or now < publishable_at:
        return "review_period_running"
    return None
