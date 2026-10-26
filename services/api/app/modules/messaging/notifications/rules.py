"""Notification rules (BRD FR-HOME-009 to 011, FR-PROF-012, FR-STF-009, FR-MSG-004, 008, BR-027)
as plain functions.

Every notification lands in the in-app inbox; push (and later SMS) follow
the member's choice for its topic. Account and review notices are security
and transactional, so they cannot be turned off (FR-PROF-012). Quiet hours
hold back pushes that are not urgent until they end (FR-STF-009); the inbox
item is there at once either way.
"""

from datetime import datetime, time, timedelta
from typing import Literal

Topic = Literal["account", "review", "events", "announcements", "emergency"]
TOPICS: tuple[Topic, ...] = ("account", "review", "events", "announcements", "emergency")
LOCKED_TOPICS = frozenset({"account", "review"})

# [ASSUMPTION] Until a member chooses: push for every topic; SMS for none, since no SMS
# vendor is contracted for notices yet (INT-01).
DEFAULT_PUSH = True
DEFAULT_SMS = False

# Sri Lanka keeps one offset all year (no daylight saving).
LOCAL_OFFSET = timedelta(hours=5, minutes=30)

PushDecision = Literal["send", "wait", "skip"]


def in_quiet_hours(now_utc: datetime, start: time | None, end: time | None) -> bool:
    """Quiet hours are local times and may cross midnight (22:00 to 06:00)."""
    if start is None or end is None or start == end:
        return False
    local = (now_utc + LOCAL_OFFSET).time()
    if start < end:
        return start <= local < end
    return local >= start or local < end


def push_decision(*, topic: str, push_wanted: bool, urgent: bool, quiet: bool) -> PushDecision:
    """skip: the member turned push off for this topic (never for a locked one). wait: quiet
    hours, and the notice is not urgent. send: otherwise."""
    if topic not in LOCKED_TOPICS and not push_wanted:
        return "skip"
    if quiet and not urgent:
        return "wait"
    return "send"


def check_preference(topic: str, push: bool) -> str | None:
    return "topic_locked" if topic in LOCKED_TOPICS and not push else None
