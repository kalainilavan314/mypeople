"""Public accountability scorecard (BRD M20, D17, FR-ACS-001 to 008).

A scorecard is computed for a finished quarter from the cases themselves, shared with the
responsible tiers for 10 working days so they can ask for corrections, then published with the
scorecard.publish permission. A correction after publication publishes the next version and keeps
the earlier one (FR-ACS-006). Members see their GN, DS and district for the last four periods.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import rules as access_rules
from app.modules.access.service import AccessRefused, Staff
from app.modules.audit import service as audit
from app.modules.community.issues.rules import CASE_PERMISSIONS, add_working_days
from app.modules.community.scorecards import repository, rules
from app.modules.community.scorecards.repository import Correction, Scorecard
from app.modules.geography import repository as geography

READERS = (rules.PUBLISH, *sorted(CASE_PERMISSIONS))


class ScorecardRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class ScorecardNotFound(Exception):
    pass


# --- Members (M20) -------------------------------------------------------------------------------------


@dataclass(frozen=True)
class AreaPeriod:
    period: str
    version: int
    published_at: datetime | None
    figures: dict
    note_en: str | None
    note_ta: str | None


@dataclass(frozen=True)
class AreaCard:
    area_key: str
    name_en: str | None
    name_ta: str | None
    periods: list[AreaPeriod]


def my_area(db: Session, member_id: uuid.UUID) -> list[AreaCard]:
    """FR-ACS-008: the member's GN, DS division and district for the last four published periods."""
    keys = [a.key for a in access_repository.member_area_path(db, member_id) if a.level in ("gn", "ds", "district")]
    latest = repository.latest_published_period(db)
    if not keys or latest is None:
        return []
    published = repository.latest_published(db, rules.previous_periods(latest, 4))
    names = geography.area_names(db, {level: [k.split(":", 1)[1] for k in keys if k.startswith(f"{level}:")]
                                      for level in ("gn", "ds", "district")})
    cards = []
    for key in reversed(keys):  # GN first, then DS, then district
        level, code = key.split(":", 1)
        place = names.get((level, code))
        periods = []
        for card in published:
            note = card.notes.get(key) or {}
            periods.append(AreaPeriod(card.period, card.version, card.published_at,
                                      card.figures.get(key, {"insufficient": True}), note.get("en"), note.get("ta")))
        cards.append(AreaCard(key, place.name_en if place else None, place.name_ta if place else None, periods))
    return cards


# --- Staff (D17) -----------------------------------------------------------------------------------------


def _require(staff: Staff, permission: str | tuple[str, ...]) -> None:
    permissions = (permission,) if isinstance(permission, str) else permission
    if not any(access_rules.holds(staff.rule_assignments(), p) for p in permissions):
        raise AccessRefused("forbidden")


def versions(db: Session, staff: Staff) -> list[Scorecard]:
    _require(staff, READERS)
    return repository.all_versions(db)


def view(db: Session, staff: Staff, scorecard_id: uuid.UUID) -> tuple[Scorecard, list[Correction]]:
    _require(staff, READERS)
    card = repository.find(db, scorecard_id)
    if card is None:
        raise ScorecardNotFound()
    return card, repository.corrections(db, scorecard_id)


def compute(db: Session, period: str, now: datetime) -> dict:
    start, end = rules.period_bounds(period)
    return rules.figures(repository.case_facts(db, start, end, now))


def draft(db: Session, staff: Staff, period: str, ip: str) -> Scorecard:
    _require(staff, rules.PUBLISH)
    now = datetime.now(UTC)
    if rules.period_bounds(period)[1] > now:
        raise ScorecardRefused("period_not_finished")
    if repository.has_open_draft(db, period):
        raise ScorecardRefused("draft_exists")
    scorecard_id = repository.insert(db, period, repository.next_version(db, period), "draft", rules.SLA_VERSION,
                                     compute(db, period, now), {}, staff.member_id)
    audit.record(db, actor_id=staff.member_id, action="scorecard.drafted", target_type="scorecard",
                 target_id=str(scorecard_id), details={"period": period}, ip=ip)
    db.commit()
    found = repository.find(db, scorecard_id)
    assert found is not None
    return found


def _open_card(db: Session, staff: Staff, scorecard_id: uuid.UUID, states: tuple[str, ...]) -> Scorecard:
    _require(staff, rules.PUBLISH)
    card = repository.find(db, scorecard_id, lock=True)
    if card is None:
        raise ScorecardNotFound()
    if card.state not in states:
        raise ScorecardRefused(f"not_allowed_from:{card.state}")
    return card


def share(db: Session, staff: Staff, scorecard_id: uuid.UUID, ip: str) -> Scorecard:
    """FR-ACS-005: the responsible tiers have 10 working days to ask for corrections."""
    card = _open_card(db, staff, scorecard_id, ("draft",))
    now = datetime.now(UTC)
    repository.update(db, card.id, {"state": "shared", "shared_at": now,
                                    "publishable_at": add_working_days(now, rules.SHARE_WORKING_DAYS)})
    audit.record(db, actor_id=staff.member_id, action="scorecard.shared", target_type="scorecard", target_id=str(card.id), ip=ip)
    db.commit()
    found = repository.find(db, card.id)
    assert found is not None
    return found


def set_note(db: Session, staff: Staff, scorecard_id: uuid.UUID, area_key: str, note_en: str, note_ta: str, ip: str) -> Scorecard:
    """FR-ACS-004: a publisher-approved context note beside an area's values (floods, a vacancy)."""
    card = _open_card(db, staff, scorecard_id, ("draft", "shared"))
    notes = dict(card.notes)
    if note_en.strip() or note_ta.strip():
        notes[area_key] = {"en": note_en.strip(), "ta": note_ta.strip()}
    else:
        notes.pop(area_key, None)
    repository.update(db, card.id, {"notes": notes})
    audit.record(db, actor_id=staff.member_id, action="scorecard.note_set", target_type="scorecard", target_id=str(card.id),
                 details={"area": area_key}, ip=ip)
    db.commit()
    found = repository.find(db, card.id)
    assert found is not None
    return found


def request_correction(db: Session, staff: Staff, scorecard_id: uuid.UUID, area_key: str, metric: str, reason: str,
                       ip: str) -> Correction:
    _require(staff, READERS)
    card = repository.find(db, scorecard_id)
    if card is None:
        raise ScorecardNotFound()
    if card.state == "superseded":
        raise ScorecardRefused("not_allowed_from:superseded")
    if metric not in rules.METRICS:
        raise ScorecardRefused("unknown_metric")
    correction_id = repository.insert_correction(db, card.id, area_key, metric, reason.strip(), staff.member_id)
    audit.record(db, actor_id=staff.member_id, action="scorecard.correction_requested", target_type="scorecard",
                 target_id=str(card.id), details={"area": area_key, "metric": metric}, ip=ip)
    db.commit()
    found = repository.find_correction(db, correction_id)
    assert found is not None
    return found


def decide_correction(db: Session, staff: Staff, correction_id: uuid.UUID, accept: bool, note: str, ip: str) -> Scorecard:
    """An accepted correction recomputes the figures from the corrected cases; on a published
    scorecard that publishes the next version, and the earlier one stays readable."""
    _require(staff, rules.PUBLISH)
    correction = repository.find_correction(db, correction_id)
    if correction is None:
        raise ScorecardNotFound()
    if correction.state != "open":
        raise ScorecardRefused("already_decided")
    card = repository.find(db, correction.scorecard_id, lock=True)
    assert card is not None
    repository.decide_correction(db, correction.id, accept, staff.member_id, note.strip())
    result_id = card.id
    if accept:
        figures = compute(db, card.period, datetime.now(UTC))
        if card.state == "published":
            repository.update(db, card.id, {"state": "superseded"})
            result_id = repository.insert(db, card.period, repository.next_version(db, card.period), "published",
                                          card.sla_version, figures, card.notes, staff.member_id, note.strip())
        elif card.state in ("draft", "shared"):
            repository.update(db, card.id, {"figures": figures})
    audit.record(db, actor_id=staff.member_id, action="scorecard.correction_decided", target_type="scorecard",
                 target_id=str(result_id), details={"accepted": accept}, ip=ip)
    db.commit()
    found = repository.find(db, result_id)
    assert found is not None
    return found


def publish(db: Session, staff: Staff, scorecard_id: uuid.UUID, ip: str) -> Scorecard:
    card = _open_card(db, staff, scorecard_id, ("draft", "shared", "published", "superseded"))
    problem = rules.check_publish(card.state, card.publishable_at, datetime.now(UTC))
    if problem:
        raise ScorecardRefused(problem)
    repository.update(db, card.id, {"state": "published", "published_by": staff.member_id, "published_at": datetime.now(UTC)})
    audit.record(db, actor_id=staff.member_id, action="scorecard.published", target_type="scorecard",
                 target_id=str(card.id), details={"period": card.period, "version": card.version}, ip=ip)
    db.commit()
    found = repository.find(db, card.id)
    assert found is not None
    return found
