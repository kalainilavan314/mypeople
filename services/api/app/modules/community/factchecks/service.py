"""Misinformation reports and the fact-check queue (BRD M48 reporting part, D12, FR-AUT-006 to 009, BR-149).

Members report suspected misinformation with a link or a screenshot. A fact-checker (content.moderate)
decides each report with a reason the reporter sees; the reporter may appeal once, and someone other
than the first fact-checker decides the appeal. No AI score exists here: a person decides (BR-149).
Every decision is in the audit log (FR-AUT-009). Screenshots are re-encoded without metadata and
sealed in the evidence store.
"""

import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.modules.access import rules as access_rules
from app.modules.access.service import AccessRefused, Staff, refuse
from app.modules.audit import service as audit
from app.modules.community.factchecks import repository
from app.modules.community.factchecks.repository import Report
from app.modules.community.issues import evidence
from app.modules.identity.documents.vault import EvidenceVault
from app.modules.messaging.notifications import service as notifications

FACT_CHECK = "content.moderate"  # PRM-20
REPORTS_PER_DAY = 10  # [ASSUMPTION]


class FactCheckRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class ReportNotFound(Exception):
    pass


def save_screenshot(db: Session, vault: EvidenceVault, member_id: uuid.UUID, data: bytes) -> repository.Screenshot:
    try:
        prepared = evidence.prepare(data)
    except evidence.EvidenceRejected as error:
        raise FactCheckRefused(error.code) from None
    screenshot_id = uuid.uuid4()
    sealed_with = vault.save(screenshot_id, prepared.data)
    repository.insert_screenshot(db, screenshot_id, member_id, sealed_with, len(prepared.data), prepared.width, prepared.height)
    db.commit()
    found = repository.find_screenshot(db, screenshot_id)
    assert found is not None
    return found


def report(db: Session, member_id: uuid.UUID, link: str | None, description: str, screenshot_id: uuid.UUID | None,
           ip: str) -> Report:
    """FR-AUT-006: the report enters the human fact-check queue."""
    if not link and screenshot_id is None:
        raise FactCheckRefused("link_or_screenshot_required")
    if screenshot_id is not None:
        shot = repository.find_screenshot(db, screenshot_id)
        if shot is None or shot.uploader_id != member_id or repository.screenshot_used(db, screenshot_id):
            raise FactCheckRefused("screenshot_not_found")
    if repository.count_recent(db, member_id) >= REPORTS_PER_DAY:
        raise FactCheckRefused("too_many_reports_today")
    report_id = repository.insert(db, member_id, link.strip() if link else None, description.strip(), screenshot_id)
    audit.record(db, actor_id=member_id, action="factcheck.reported", target_type="misinfo_report", target_id=str(report_id), ip=ip)
    db.commit()
    found = repository.find(db, report_id)
    assert found is not None
    return found


def my_reports(db: Session, member_id: uuid.UUID) -> list[Report]:
    return repository.by_member(db, member_id)


def appeal(db: Session, member_id: uuid.UUID, report_id: uuid.UUID, body: str, ip: str) -> Report:
    found = repository.find(db, report_id, lock=True)
    if found is None or found.member_id != member_id:
        raise ReportNotFound()
    if found.state != "decided":
        raise FactCheckRefused("not_decided")
    if found.appeal_state != "none":
        raise FactCheckRefused("already_appealed")
    repository.update(db, report_id, {"appeal_body": body.strip(), "appeal_state": "open"})
    audit.record(db, actor_id=member_id, action="factcheck.appealed", target_type="misinfo_report", target_id=str(report_id), ip=ip)
    db.commit()
    updated = repository.find(db, report_id)
    assert updated is not None
    return updated


# --- Fact-checkers (D12) ------------------------------------------------------------------------------


def _require(staff: Staff) -> None:
    # Reports are about content anywhere, so fact-checking is a platform-wide duty.
    if not access_rules.holds(staff.rule_assignments(), FACT_CHECK):
        raise AccessRefused("forbidden")


def queue(db: Session, staff: Staff, only_open: bool) -> list[Report]:
    _require(staff)
    return repository.queue(db, only_open)


def screenshot(db: Session, vault: EvidenceVault, staff: Staff, report_id: uuid.UUID, ip: str) -> bytes:
    _require(staff)
    found = repository.find(db, report_id)
    if found is None or found.screenshot_id is None:
        raise ReportNotFound()
    shot = repository.find_screenshot(db, found.screenshot_id)
    assert shot is not None
    try:
        data = evidence.read(vault, shot.id, shot.sealed_with)
    except evidence.EvidenceRejected:
        raise FactCheckRefused("evidence_unreadable") from None
    audit.record(db, actor_id=staff.member_id, action="factcheck.screenshot.viewed", target_type="misinfo_report",
                 target_id=str(report_id), ip=ip)
    db.commit()
    return data


def decide(db: Session, staff: Staff, report_id: uuid.UUID, outcome: str, reason: str, ip: str) -> Report:
    """FR-AUT-007: a decision with a reason the reporter sees."""
    _require(staff)
    found = repository.find(db, report_id, lock=True)
    if found is None:
        raise ReportNotFound()
    if found.member_id == staff.member_id:
        refuse(db, staff, FACT_CHECK, "own_record", ip, target=("misinfo_report", str(report_id)), area_path=None)
    if found.state != "pending":
        raise FactCheckRefused("already_decided")
    repository.update(db, report_id, {"state": "decided", "outcome": outcome, "reason": reason.strip(),
                                      "decided_by": staff.member_id, "decided_at": datetime.now(UTC)})
    notifications.notify(db, found.member_id, "factcheck_decided", report_id)
    audit.record(db, actor_id=staff.member_id, action="factcheck.decided", target_type="misinfo_report",
                 target_id=str(report_id), details={"outcome": outcome}, ip=ip)
    db.commit()
    updated = repository.find(db, report_id)
    assert updated is not None
    return updated


def decide_appeal(db: Session, staff: Staff, report_id: uuid.UUID, change: bool, outcome: str | None, reason: str,
                  ip: str) -> Report:
    """One appeal, decided by someone other than the first fact-checker."""
    _require(staff)
    found = repository.find(db, report_id, lock=True)
    if found is None:
        raise ReportNotFound()
    if found.decided_by == staff.member_id:
        refuse(db, staff, FACT_CHECK, "original_decider", ip, target=("misinfo_report", str(report_id)), area_path=None)
    if found.appeal_state != "open":
        raise FactCheckRefused("no_open_appeal")
    if change and (outcome is None or outcome == found.outcome):
        raise FactCheckRefused("new_outcome_required")
    repository.update(db, report_id, {"appeal_state": "changed" if change else "upheld",
                                      "appeal_outcome": outcome if change else found.outcome, "appeal_reason": reason.strip(),
                                      "appeal_decided_by": staff.member_id})
    notifications.notify(db, found.member_id, "factcheck_appeal_decided", report_id)
    audit.record(db, actor_id=staff.member_id, action="factcheck.appeal_decided", target_type="misinfo_report",
                 target_id=str(report_id), details={"changed": change}, ip=ip)
    db.commit()
    updated = repository.find(db, report_id)
    assert updated is not None
    return updated
