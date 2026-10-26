"""Election periods, notices and silence-period controls (BRD D22, NFR-ELC-01, 03, 05, 06, 08; FR-ELX-001,
004, 008; FR-THL-008; BR-119, BR-129).

Tier 5 declares a period from an Election Commission publication and gets a
warning, not a refusal, when it overlaps another declared period in time and
area (D22; NFR-ELC-05 allows several at once). A period is ended when its
election is over, or withdrawn if declared in error; the reason stays on the
period and the audit entry holds codes only.

Other modules ask this one before acting:
- refuse_if_silent(): publishing an event or album in an area under silence
  is refused, with an audit record (NFR-ELC-03, FR-THL-008);
- silences(): the broadcast dispatcher holds a scheduled announcement for an
  area under silence and sends it once the silence ends (FR-ELX-008).

Members see the periods running for their area, each with its official
source and the notices published for it (FR-ELX-001, 004), only while the
election_mode feature is on (FR-ARCH-011).
"""

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import service as access
from app.modules.access.rules import Area, AreaPath, area_from_key
from app.modules.access.service import Staff
from app.modules.audit import service as audit
from app.modules.election import repository, rules
from app.modules.election.repository import StoredNotice, StoredPeriod
from app.modules.election.rules import MANAGE


class PeriodNotFound(Exception):
    pass


class ElectionRefused(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class ElectionInvalid(Exception):
    def __init__(self, problems: list[str]) -> None:
        super().__init__(", ".join(problems))
        self.problems = problems


class SilencePeriod(Exception):
    """Publishing refused because a declared silence window covers the area (NFR-ELC-03)."""

    def __init__(self, period_refs: list[str]) -> None:
        super().__init__("silence_period")
        self.period_refs = period_refs


def _now() -> datetime:
    return datetime.now(UTC)


def _path(keys: Sequence[str]) -> AreaPath:
    return tuple(area_from_key(key) for key in keys)


def _record(db: Session, staff: Staff, action: str, period: StoredPeriod, ip: str, **details: object) -> None:
    audit.record(
        db, actor_id=staff.member_id, action=action, target_type="election_period", target_id=str(period.id),
        area_path=_path(period.area_path), details={"periodRef": period.period_ref, **details}, ip=ip,
    )


def _in_scope(db: Session, staff: Staff, path: AreaPath, target: tuple[str, str], ip: str) -> None:
    if not access.has_permission_over(staff, MANAGE, path):
        access.refuse(db, staff, MANAGE, "outside_your_area", ip, target=target, area_path=path)


def _managed(db: Session, staff: Staff, period_id: uuid.UUID, ip: str) -> StoredPeriod:
    period = repository.find_period(db, period_id, for_update=True)
    if period is None:
        raise PeriodNotFound()
    _in_scope(db, staff, _path(period.area_path), ("election_period", str(period.id)), ip)
    return period


# --- Tier 5: periods and notices (D22) ----------------------------------------------------------------------


@dataclass(frozen=True)
class Declared:
    period: StoredPeriod
    overlaps: list[str]  # refs of other declared periods for the same time and area


def declare(db: Session, staff: Staff, details: dict[str, Any], area: Area, ip: str) -> Declared:
    path = access_repository.area_path(db, area)
    if path is None:
        raise ElectionInvalid(["unknown_area"])
    problems = rules.check_period(
        starts_at=details["starts_at"],
        ends_at=details["ends_at"],
        silence_starts_at=details["silence_starts_at"],
        silence_ends_at=details["silence_ends_at"],
        polling_day=details["polling_day"],
        source_published_at=details["source_published_at"],
        now=_now(),
    )
    if problems:
        raise ElectionInvalid(problems)
    _in_scope(db, staff, path, ("election_period", "new"), ip)
    keys = [a.key for a in path]
    overlaps = repository.overlapping(db, keys, details["starts_at"], details["ends_at"])
    period = repository.insert_period(db, details, area.key, keys, staff.member_id)
    _record(db, staff, "election.period.declared", period, ip, overlaps=overlaps)
    db.commit()
    return Declared(period, overlaps)


def close(db: Session, staff: Staff, period_id: uuid.UUID, action: rules.CloseAction, reason: str, ip: str) -> StoredPeriod:
    period = _managed(db, staff, period_id, ip)
    problem = rules.check_close(period.state)
    if problem:
        raise ElectionRefused(problem)
    state = "ended" if action == "end" else "withdrawn"
    repository.close_period(db, period.id, state, reason, staff.member_id)
    _record(db, staff, f"election.period.{state}", period, ip)
    db.commit()
    return _reload(db, period.id)


def _reload(db: Session, period_id: uuid.UUID) -> StoredPeriod:
    period = repository.find_period(db, period_id)
    assert period is not None
    return period


def managed_periods(db: Session, staff: Staff, states: list[str], limit: int) -> list[StoredPeriod]:
    visible = access.visible_areas(staff, MANAGE)
    found = repository.periods(db, states, limit)
    return [p for p in found if visible is None or any(key in visible for key in p.area_path)]


@dataclass(frozen=True)
class PeriodFile:
    period: StoredPeriod
    notices: list[StoredNotice]


def period_file(db: Session, staff: Staff, period_id: uuid.UUID, ip: str) -> PeriodFile:
    period = repository.find_period(db, period_id)
    if period is None:
        raise PeriodNotFound()
    _in_scope(db, staff, _path(period.area_path), ("election_period", str(period.id)), ip)
    return PeriodFile(period, repository.notices(db, [period.id], include_withdrawn=True))


def publish_notice(db: Session, staff: Staff, period_id: uuid.UUID, details: dict[str, Any], ip: str) -> StoredNotice:
    period = _managed(db, staff, period_id, ip)
    problem = rules.check_close(period.state)
    if problem:
        raise ElectionRefused(problem)
    problems = rules.check_notice(
        details["source"], details.get("source_url"), details.get("document_reference"), details.get("source_published_at")
    )
    if problems:
        raise ElectionInvalid(problems)
    notice = repository.insert_notice(db, period.id, details, staff.member_id)
    _record(db, staff, "election.notice.published", period, ip, noticeId=str(notice.id), source=notice.source)
    db.commit()
    return notice


def withdraw_notice(db: Session, staff: Staff, notice_id: uuid.UUID, ip: str) -> StoredNotice:
    """NFR-ELC-06: when the source is superseded, the notice stops showing."""
    notice = repository.find_notice(db, notice_id, for_update=True)
    if notice is None:
        raise PeriodNotFound()
    period = _managed(db, staff, notice.period_id, ip)
    if notice.withdrawn_at is not None:
        raise ElectionRefused("already_withdrawn")
    repository.withdraw_notice(db, notice.id)
    _record(db, staff, "election.notice.withdrawn", period, ip, noticeId=str(notice.id))
    db.commit()
    withdrawn = repository.find_notice(db, notice.id)
    assert withdrawn is not None
    return withdrawn


# --- Members: the election banner and notices (FR-ELX-001, 004) ---------------------------------------------


@dataclass(frozen=True)
class CurrentElection:
    period: StoredPeriod
    days_to_polling: int
    in_silence: bool
    notices: list[StoredNotice]


def current_for_member(db: Session, member_id: uuid.UUID) -> list[CurrentElection]:
    now = _now()
    keys = [a.key for a in access_repository.member_area_path(db, member_id)]
    found = repository.current_for(db, keys, now)
    notices = repository.notices(db, [p.id for p in found], include_withdrawn=False)
    return [
        CurrentElection(
            period=period,
            days_to_polling=rules.days_to_polling(period.polling_day, now),
            in_silence=period.silence_starts_at <= now < period.silence_ends_at,
            notices=[n for n in notices if n.period_id == period.id],
        )
        for period in found
    ]


# --- Silence-period controls for other modules (NFR-ELC-03) -------------------------------------------------


def silences(db: Session, area_path: Sequence[str], starts_at: datetime, ends_at: datetime | None = None) -> list[str]:
    """Refs of the periods whose silence covers the area at that moment, or at any time in the span."""
    return repository.silences(db, list(area_path), starts_at, ends_at or starts_at)


def refuse_if_silent(
    db: Session,
    staff: Staff,
    *,
    action: str,
    target: tuple[str, str],
    area_path: Sequence[str],
    spans: Sequence[tuple[datetime, datetime]],
    ip: str,
) -> None:
    """Refuse publishing when any span (the moment of publishing, the event's own time) falls inside a
    silence window for the area. The refusal is audited and kept, so nothing else in the caller's
    transaction may have been written yet."""
    refs = sorted({ref for start, end in spans for ref in silences(db, area_path, start, end)})
    if not refs:
        return
    audit.record(
        db, actor_id=staff.member_id, action="election.silence.blocked", target_type=target[0], target_id=target[1],
        area_path=_path(area_path), details={"blockedAction": action, "periodRefs": refs}, ip=ip,
    )
    db.commit()
    raise SilencePeriod(refs)
