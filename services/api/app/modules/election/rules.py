"""Election periods, silence windows and election notices (BRD NFR-ELC-01, 03, 05, 06, 08; FR-ELX-001, 004,
008, 010; BR-119, BR-129) as plain functions.

A Tier 5 holder of election.mode.manage declares an election period for an
election type and an area, with its own silence window, from an Election
Commission publication. Several periods may run at once, each with its own
area and silence (NFR-ELC-05). While a silence window covers an area,
scheduled campaign messages for it are held and political publishing there
is refused, with an audit record (NFR-ELC-03). The silence window must cover
the whole polling day, which is how polling-day suspension (NFR-ELC-08) is
applied.

[ASSUMPTION] until the election-mode policy (POL-12) is signed off: every
announcement broadcast, event and gallery album counts as campaign or
political content; only emergency broadcasts and operational notices to one
member (identity decisions, event cancellations) go out during silence.

Nothing here records how anyone votes or intends to vote (FR-ELX-010).
"""

from datetime import UTC, date, datetime, time, timedelta
from typing import Literal

MANAGE = "election.mode.manage"  # PRM-48

ElectionType = Literal["presidential", "parliamentary", "provincial", "local", "referendum"]
NoticeSource = Literal["election_commission", "party"]
CloseAction = Literal["end", "withdraw"]

# FR-ELX-004: every election item carries exactly one of these labels.
LABELS: dict[NoticeSource, tuple[str, str]] = {
    "election_commission": ("Election Commission information", "தேர்தல்கள் ஆணைக்குழு தகவல்"),
    "party": ("Party information", "கட்சித் தகவல்"),
}

# Polling days are Sri Lankan calendar days.
LOCAL_OFFSET = timedelta(hours=5, minutes=30)


def local_day_bounds(day: date) -> tuple[datetime, datetime]:
    """The UTC start and end of a Sri Lankan calendar day."""
    start = datetime.combine(day, time(0), tzinfo=UTC) - LOCAL_OFFSET
    return start, start + timedelta(days=1)


def check_period(
    *,
    starts_at: datetime,
    ends_at: datetime,
    silence_starts_at: datetime,
    silence_ends_at: datetime,
    polling_day: date,
    source_published_at: datetime,
    now: datetime,
) -> list[str]:
    problems = []
    if ends_at <= starts_at:
        problems.append("ends_before_start")
    if ends_at <= now:
        problems.append("already_over")
    if silence_ends_at <= silence_starts_at:
        problems.append("silence_ends_before_start")
    elif silence_starts_at < starts_at or silence_ends_at > ends_at:
        problems.append("silence_outside_period")
    poll_start, poll_end = local_day_bounds(polling_day)
    if not (silence_starts_at <= poll_start and silence_ends_at >= poll_end):
        problems.append("silence_must_cover_polling_day")  # NFR-ELC-08
    if source_published_at > now:
        problems.append("source_in_future")
    return problems


def check_notice(
    source: NoticeSource, source_url: str | None, document_reference: str | None, source_published_at: datetime | None
) -> list[str]:
    """NFR-ELC-06: Election Commission information names its document, link and publication time."""
    if source == "election_commission" and not (source_url and document_reference and source_published_at):
        return ["official_source_required"]
    return []


def check_close(state: str) -> str | None:
    return None if state == "declared" else f"not_allowed_from:{state}"


def days_to_polling(polling_day: date, now: datetime) -> int:
    """The countdown on the banner (FR-ELX-001), in Sri Lankan calendar days; never negative."""
    today = (now + LOCAL_OFFSET).date()
    return max((polling_day - today).days, 0)
