"""The staff case workflow, GN to executive (BRD W03 to W08, FR-WEB-014 to 029, BR-035 to 040, BR-080).

Each stage is worked by the tier that holds its permission over the case's area; Tiers 2B and 3B
add facts and notes but never send a decision (FR-WEB-020). Every move records the previous owner,
the new owner, a note and the time in the append-only case history (FR-WEB-029), and the stage's
time limit restarts. A case is never deleted: it is returned for details, linked to a parent, or
declined with a reason. Staff never act on a case they reported themselves, nor moderate what they
added to one (BR-085). A case that enters a stage without a named owner tells everyone who may take it.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from typing import Any

from sqlalchemy.orm import Session

from app.modules.access import rules as access_rules
from app.modules.access.service import AccessRefused, Staff, record_denial, visible_areas
from app.modules.audit import service as audit
from app.modules.community.issues import evidence, notices, repository, rules
from app.modules.community.issues.repository import Holder, StoredIssue
from app.modules.community.issues.service import issue_path
from app.modules.identity.documents.vault import EvidenceVault

MODERATE = "content.moderate"
CONTACT = "cases.view_reporter_contact"
READ_PERMISSIONS = (*sorted(rules.CASE_PERMISSIONS), MODERATE)


class CaseNotFound(Exception):
    pass


class CaseRefused(Exception):
    """The action is not possible in the case's current state: wrong_stage, facts_required, ..."""

    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


# --- Who may do what -----------------------------------------------------------------------------------


def _holds(staff: Staff, permission: str, issue: StoredIssue, *, deciding: bool) -> bool:
    path = issue_path(issue)
    return any(
        permission in assignment.permissions
        and access_rules.contains(assignment.area, path)
        and not (deciding and assignment.tier in rules.ASSISTING_TIERS)
        for assignment in staff.assignments
    )


def _may_read(staff: Staff, issue: StoredIssue) -> bool:
    return any(_holds(staff, permission, issue, deciding=False) for permission in READ_PERMISSIONS)


def allowed_actions(staff: Staff, issue: StoredIssue, open_challenge: bool) -> list[str]:
    """What this person may do on this case now; the dashboard shows only these forms."""
    stage = issue.stage
    own = issue.reporter_id == staff.member_id
    actions: list[str] = []
    if not own:
        if stage in rules.OPEN_STAGES and any(_holds(staff, p, issue, deciding=False) for p in rules.CASE_PERMISSIONS):
            actions.append("note")
        if stage in ("gn", "returned") and _holds(staff, "cases.collect", issue, deciding=False):
            actions.append("fact")
        if stage == "ds" and _holds(staff, "cases.research", issue, deciding=False):
            actions.append("finding")
        if stage in ("gn", "returned") and _holds(staff, "cases.collect", issue, deciding=True):
            actions += ["link"] if stage == "returned" else ["return", "link", "forward"]
        if stage == "ds" and _holds(staff, "cases.research", issue, deciding=True):
            actions.append("ds_report")
        if stage == "district" and _holds(staff, "cases.decide_district", issue, deciding=True):
            actions.append("district_decision")
        if stage == "regional" and _holds(staff, "cases.plan_regional", issue, deciding=True):
            actions.append("regional_plan")
        if stage == "executive" and _holds(staff, "cases.approve_executive", issue, deciding=True):
            actions.append("executive_decision")
        if (
            stage == "implementation"
            and issue.owner_id == staff.member_id
            and _holds(staff, "cases.implement_and_close", issue, deciding=False)
        ):
            actions += ["progress", "close"]
        if stage in rules.OPEN_STAGES and stage != "returned" and _may_assign(staff, issue):
            actions.append("assign")
        if stage == "resolved" and open_challenge and (
            _holds(staff, "cases.decide_district", issue, deciding=True)
            or _holds(staff, "cases.approve_executive", issue, deciding=True)
        ):
            actions.append("decide_challenge")
        # A resolved public case may get an updated summary: the closing summary itself reaches
        # only the reporter, so the public hears the outcome through a moderator (BR-032).
        if issue.visibility == "public" and stage != "linked" and _holds(staff, MODERATE, issue, deciding=False):
            actions.append("publish_summary")
        if _holds(staff, MODERATE, issue, deciding=False):
            actions.append("moderate_additions")
    if issue.owner_id == staff.member_id and _holds(staff, CONTACT, issue, deciding=False):
        actions.append("view_reporter_contact")
    return actions


def _may_assign(staff: Staff, issue: StoredIssue) -> bool:
    """The stage's own deciding tier, or the tier its breach alert goes to (§4.3: reassign if breached)."""
    permission = rules.STAGE_PERMISSION.get(issue.stage)
    supervisor = rules.BREACH_ALERTS.get(issue.stage)
    return any(p and _holds(staff, p, issue, deciding=True) for p in (permission, supervisor))


def _require(db: Session, staff: Staff, issue: StoredIssue, action: str, ip: str, open_challenge: bool = False) -> None:
    if action in allowed_actions(staff, issue, open_challenge):
        return
    stages = rules.ACTION_STAGES.get(action)
    if stages is not None and issue.stage not in stages:
        raise CaseRefused("wrong_stage")
    if action == "decide_challenge" and not open_challenge:
        raise CaseRefused("no_open_challenge")
    reason = "own_record" if issue.reporter_id == staff.member_id else "forbidden"
    record_denial(
        db, actor_id=staff.member_id, permission=f"cases:{action}", reason=reason, ip=ip,
        target=("issue", str(issue.id)), area_path=issue_path(issue),
    )
    db.commit()
    raise AccessRefused(reason)


def _load(db: Session, staff: Staff, issue_id: uuid.UUID, *, lock: bool = False) -> StoredIssue:
    issue = repository.find_issue(db, issue_id, lock=lock)
    if issue is None or not _may_read(staff, issue):
        raise CaseNotFound()  # out-of-area cases are indistinguishable from missing ones (BR-080)
    return issue


def _eligible_owner(db: Session, issue: StoredIssue, permission: str, owner_id: uuid.UUID | None) -> uuid.UUID:
    holders = {holder.member_id for holder in repository.permission_holders(db, permission, issue.area_path)}
    if owner_id is None or owner_id not in holders or owner_id == issue.reporter_id:
        raise CaseRefused("owner_not_eligible")
    return owner_id


# --- Reading -------------------------------------------------------------------------------------------


def viewable_areas(staff: Staff) -> list[str] | None:
    keys: set[str] = set()
    for permission in READ_PERMISSIONS:
        areas = visible_areas(staff, permission)
        if areas is None:
            return None
        keys.update(areas)
    return sorted(keys)


@dataclass(frozen=True)
class CaseList:
    items: list[StoredIssue]
    total: int
    counts: dict[str, int]


def list_cases(
    db: Session,
    staff: Staff,
    *,
    stages: list[str] | None,
    mine: bool,
    overdue: bool,
    district_closures: bool,
    search: str | None,
    limit: int,
    offset: int,
) -> CaseList:
    if not any(access_rules.holds(staff.rule_assignments(), p) for p in READ_PERMISSIONS):
        raise AccessRefused("forbidden")
    areas = viewable_areas(staff)
    now = datetime.now(UTC)
    items, total = repository.list_cases(
        db,
        areas=areas,
        stages=stages,
        owner_id=staff.member_id if mine else None,
        overdue_at=now if overdue else None,
        district_closures=district_closures,
        search=search.strip() if search else None,
        limit=limit,
        offset=offset,
    )
    return CaseList(items=items, total=total, counts=repository.stage_counts(db, areas, now))


@dataclass(frozen=True)
class CaseFile:
    issue: StoredIssue
    history: list[repository.StoredAction]
    evidence: list[repository.StoredEvidence]
    additions: list[repository.StoredAddition]
    children: list[StoredIssue]
    challenge: repository.StoredClosureResponse | None
    allowed: list[str]
    overdue: bool
    viewer: uuid.UUID


def case_file(db: Session, staff: Staff, issue_id: uuid.UUID, ip: str) -> CaseFile:
    """W03 to W08: the whole file, read access audited (FR-WEB-014, BR-080)."""
    issue = _load(db, staff, issue_id)
    audit.record(
        db, actor_id=staff.member_id, action="case.viewed", target_type="issue", target_id=str(issue.id),
        area_path=issue_path(issue), details={"stage": issue.stage}, ip=ip,
    )
    db.commit()
    return _file(db, staff, issue)


def current_file(db: Session, staff: Staff, issue_id: uuid.UUID) -> CaseFile:
    """The file again straight after an action, which is audited itself."""
    return _file(db, staff, _load(db, staff, issue_id))


def _file(db: Session, staff: Staff, issue: StoredIssue) -> CaseFile:
    challenge = repository.open_challenge(db, issue.id)
    return CaseFile(
        issue=issue,
        history=repository.history(db, issue.id),
        evidence=repository.issue_evidence(db, issue.id),
        additions=repository.additions(db, issue.id),
        children=repository.linked_children(db, issue.id),
        challenge=challenge,
        allowed=allowed_actions(staff, issue, challenge is not None),
        overdue=rules.is_overdue(issue.stage, issue.stage_due_at, datetime.now(UTC)),
        viewer=staff.member_id,
    )


def owner_options(db: Session, staff: Staff, issue_id: uuid.UUID, permission: str) -> list[Holder]:
    """People who may be named owner for a step: deciding holders of the permission over the area."""
    issue = _load(db, staff, issue_id)
    if permission not in rules.CASE_PERMISSIONS:
        raise CaseRefused("unknown_permission")
    return [h for h in repository.permission_holders(db, permission, issue.area_path) if h.member_id != issue.reporter_id]


def reporter_contact(db: Session, staff: Staff, issue_id: uuid.UUID, ip: str) -> repository.ReporterContact:
    """PRM-13: the assigned owner only, and every look is audited."""
    issue = _load(db, staff, issue_id)
    _require(db, staff, issue, "view_reporter_contact", ip)
    audit.record(
        db, actor_id=staff.member_id, action="case.reporter_contact.viewed", target_type="issue",
        target_id=str(issue.id), area_path=issue_path(issue), ip=ip,
    )
    db.commit()
    return repository.reporter_contact(db, issue.reporter_id)


def read_photo(db: Session, vault: EvidenceVault, staff: Staff, issue_id: uuid.UUID, photo_id: uuid.UUID, ip: str) -> bytes:
    issue = _load(db, staff, issue_id)
    found = repository.find_evidence(db, photo_id)
    if found is None or found.issue_id != issue.id:
        raise CaseNotFound()
    try:
        data = evidence.read(vault, found.id, found.sealed_with)
    except evidence.EvidenceRejected:
        raise CaseRefused("evidence_unreadable") from None
    audit.record(
        db, actor_id=staff.member_id, action="case.evidence.viewed", target_type="issue_evidence",
        target_id=str(found.id), area_path=issue_path(issue), ip=ip,
    )
    db.commit()
    return data


# --- Recording -----------------------------------------------------------------------------------------


def _record(
    db: Session,
    staff: Staff,
    issue: StoredIssue,
    kind: str,
    ip: str,
    *,
    note: str | None = None,
    details: dict[str, Any] | None = None,
    audit_details: dict[str, Any] | None = None,
) -> uuid.UUID:
    """An entry that does not move the case; audit_details adds ids and flags (never text) to the audit entry."""
    action_id = repository.insert_action(db, issue.id, kind, actor_id=staff.member_id, note=note, details=details)
    audit.record(
        db, actor_id=staff.member_id, action=f"case.{kind}", target_type="issue", target_id=str(issue.id),
        area_path=issue_path(issue), details={"stage": issue.stage, **(audit_details or {})}, ip=ip,
    )
    return action_id


def _move(
    db: Session,
    staff: Staff,
    issue: StoredIssue,
    kind: str,
    to_stage: str,
    ip: str,
    *,
    new_owner: uuid.UUID | None,
    note: str | None = None,
    details: dict[str, Any] | None = None,
    implementation_due: datetime | None = None,
    extra: dict[str, Any] | None = None,
) -> uuid.UUID:
    """Move a case to a stage with a new owner, restarting the stage clock (FR-WEB-028, 029). A
    handover always carries a note; a stage entered without an owner is announced to all who may take it."""
    assert kind not in rules.HANDOVER_KINDS or (note and note.strip()), f"a {kind} handover needs a note"
    now = datetime.now(UTC)
    repository.update_issue(
        db,
        issue.id,
        stage=to_stage,
        owner_id=new_owner,
        stage_entered_at=now,
        stage_due_at=rules.stage_due(to_stage, now, implementation_due),
        breach_alerted_at=None,
        **(extra or {}),
    )
    action_id = repository.insert_action(
        db, issue.id, kind, actor_id=staff.member_id, from_stage=issue.stage, to_stage=to_stage,
        previous_owner_id=issue.owner_id, new_owner_id=new_owner, note=note, details=details,
    )
    audit.record(
        db, actor_id=staff.member_id, action=f"case.{kind}", target_type="issue", target_id=str(issue.id),
        area_path=issue_path(issue), details={"from": issue.stage, "to": to_stage}, ip=ip,
    )
    if issue.owner_id is None and issue.stage in rules.STAGE_PERMISSION:
        notices.taken(db, issue.id, _stage_holders(db, issue, issue.stage))
    notices.assigned(db, issue.id, issue.owner_id, new_owner)
    if new_owner is None and to_stage in rules.STAGE_PERMISSION:
        notices.waiting(db, issue.id, _stage_holders(db, issue, to_stage))
    moved = repository.find_issue(db, issue.id)
    assert moved is not None
    # Members hear only of a change they can see: one of the four stages, or a decline. A report
    # linked to a parent shows the parent's stage, so linking alone tells its reporter nothing new.
    seen_before = rules.MEMBER_STAGE.get(rules.member_view_stage(issue.stage, issue.parent_stage))
    seen_now = rules.MEMBER_STAGE.get(rules.member_view_stage(to_stage, moved.parent_stage))
    if seen_now != seen_before or to_stage == "declined":
        notices.stage_changed(db, moved)
    return action_id


def _stage_holders(db: Session, issue: StoredIssue, stage: str) -> list[uuid.UUID]:
    """Everyone who may own the case at this stage: deciding holders of its permission over the area."""
    permission = rules.STAGE_PERMISSION[stage]
    return [h.member_id for h in repository.permission_holders(db, permission, issue.area_path) if h.member_id != issue.reporter_id]


def _due(day: date) -> datetime:
    """A due date is the end of that day in Sri Lanka."""
    return datetime.combine(day, time(23, 59), tzinfo=rules.LOCAL_ZONE).astimezone(UTC)


def _check_due(day: date) -> None:
    if _due(day) <= datetime.now(UTC):
        raise CaseRefused("due_date_in_past")


def add_fact(db: Session, staff: Staff, issue_id: uuid.UUID, statement: str, source: str, ip: str) -> None:
    """W03: an observed fact always carries its source (FR-WEB-015)."""
    issue = _load(db, staff, issue_id, lock=True)
    _require(db, staff, issue, "fact", ip)
    _record(db, staff, issue, "fact", ip, details={"statement": statement.strip(), "source": source.strip()})
    db.commit()


def add_finding(
    db: Session, staff: Staff, issue_id: uuid.UUID, kind: str, statement: str, source: str | None, ip: str
) -> None:
    """W04: verified facts kept apart from assumptions, options, stakeholders, resources and questions (FR-WEB-019)."""
    issue = _load(db, staff, issue_id, lock=True)
    _require(db, staff, issue, "finding", ip)
    if kind == "verified_fact" and not (source and source.strip()):
        raise CaseRefused("source_required")
    _record(db, staff, issue, "finding", ip, details={"kind": kind, "statement": statement.strip(), "source": (source or "").strip() or None})
    db.commit()


def add_note(db: Session, staff: Staff, issue_id: uuid.UUID, text: str, ip: str) -> None:
    issue = _load(db, staff, issue_id, lock=True)
    _require(db, staff, issue, "note", ip)
    _record(db, staff, issue, "note", ip, note=text.strip())
    db.commit()


def return_for_details(db: Session, staff: Staff, issue_id: uuid.UUID, question: str, ip: str) -> None:
    """FR-WEB-016: returned with the question asked, never deleted."""
    issue = _load(db, staff, issue_id, lock=True)
    _require(db, staff, issue, "return", ip)
    _move(db, staff, issue, "returned", "returned", ip, new_owner=issue.owner_id or staff.member_id, note=question.strip())
    returned = repository.find_issue(db, issue.id)
    assert returned is not None
    notices.returned(db, returned)
    db.commit()


def link_to_parent(db: Session, staff: Staff, issue_id: uuid.UUID, parent_case_number: str, note: str | None, ip: str) -> None:
    """FR-WEB-018: a duplicate joins its parent; its reporter keeps the receipt and hears the parent's updates."""
    issue = _load(db, staff, issue_id, lock=True)
    _require(db, staff, issue, "link", ip)
    parent = repository.find_by_number(db, parent_case_number.strip().upper())
    if parent is None or not _may_read(staff, parent):
        raise CaseRefused("parent_not_found")
    problem = rules.check_link(
        child_id=issue.id, parent_id=parent.id, parent_stage=parent.stage, parent_has_parent=parent.parent_id is not None
    )
    if problem:
        raise CaseRefused(problem)
    _move(
        db, staff, issue, "linked", "linked", ip, new_owner=None, note=note, details={"parent": parent.case_number},
        extra={"parent_id": parent.id},
    )
    db.commit()


@dataclass(frozen=True)
class Forward:
    location_confirmed: bool
    description_clear: bool
    evidence_reviewed: bool
    owner_id: uuid.UUID
    note: str
    affected_area: str


def forward_to_ds(db: Session, staff: Staff, issue_id: uuid.UUID, forward: Forward, ip: str) -> None:
    """FR-WEB-017: only after the completeness check, to a named DS owner."""
    issue = _load(db, staff, issue_id, lock=True)
    _require(db, staff, issue, "forward", ip)
    problems = rules.check_forward(
        facts=repository.count_actions(db, issue.id, "fact"),
        location_confirmed=forward.location_confirmed,
        description_clear=forward.description_clear,
        evidence_reviewed=forward.evidence_reviewed,
    )
    if len(forward.affected_area.strip()) < 3:
        problems.append("affected_area_required")
    if problems:
        raise CaseRefused(problems)
    owner = _eligible_owner(db, issue, "cases.research", forward.owner_id)
    _move(
        db, staff, issue, "forwarded", "ds", ip, new_owner=owner, note=forward.note.strip(),
        details={
            "checklist": {"locationConfirmed": True, "descriptionClear": True, "evidenceReviewed": True},
            "affectedArea": forward.affected_area.strip(),
        },
        extra={"affected_area": forward.affected_area.strip()},
    )
    db.commit()


@dataclass(frozen=True)
class DsReport:
    summary: str
    evidence_refs: list[str]
    recommendation: str
    district_owner_id: uuid.UUID


def send_ds_report(db: Session, staff: Staff, issue_id: uuid.UUID, report: DsReport, ip: str) -> None:
    """FR-WEB-019: the formal divisional report with evidence, recommendation and district owner."""
    issue = _load(db, staff, issue_id, lock=True)
    _require(db, staff, issue, "ds_report", ip)
    if not report.recommendation.strip():
        raise CaseRefused("recommendation_required")
    owner = _eligible_owner(db, issue, "cases.decide_district", report.district_owner_id)
    version = repository.count_actions(db, issue.id, "ds_report") + 1
    _move(
        db, staff, issue, "ds_report", "district", ip, new_owner=owner, note=report.recommendation.strip(),
        details={
            "version": version,
            "summary": report.summary.strip(),
            "evidenceRefs": [ref.strip() for ref in report.evidence_refs if ref.strip()],
            "recommendation": report.recommendation.strip(),
        },
    )
    db.commit()


@dataclass(frozen=True)
class DistrictDecision:
    decision: str  # act | escalate
    authority: str | None = None
    resources: str | None = None
    office: str | None = None
    owner_id: uuid.UUID | None = None
    due_date: date | None = None
    reason: str | None = None
    decision_required: str | None = None
    regional_owner_id: uuid.UUID | None = None
    scope: str | None = None  # W08: the approved scope the implementation works to


def decide_at_district(db: Session, staff: Staff, issue_id: uuid.UUID, decision: DistrictDecision, ip: str) -> None:
    """FR-WEB-021: act within delegated authority, or escalate with the reason and decision required.
    The history says "Escalated", never "Approved" (BR-035, BR-037)."""
    issue = _load(db, staff, issue_id, lock=True)
    _require(db, staff, issue, "district_decision", ip)
    if decision.decision == "act":
        missing = [
            name
            for name, value in (
                ("authority", decision.authority), ("resources", decision.resources), ("office", decision.office),
                ("scope", decision.scope),
            )
            if not (value and value.strip())
        ]
        if missing or decision.due_date is None:
            raise CaseRefused([f"{name}_required" for name in missing] + ([] if decision.due_date else ["due_date_required"]))
        _check_due(decision.due_date)
        owner = _eligible_owner(db, issue, "cases.implement_and_close", decision.owner_id)
        scope = decision.scope.strip()  # type: ignore[union-attr]
        _move(
            db, staff, issue, "district_action", "implementation", ip, new_owner=owner, note=scope,
            details={
                "authority": decision.authority.strip(),  # type: ignore[union-attr]
                "resources": decision.resources.strip(),  # type: ignore[union-attr]
                "office": decision.office.strip(),  # type: ignore[union-attr]
                "scope": scope,
                "dueDate": decision.due_date.isoformat(),
            },
            implementation_due=_due(decision.due_date),
            extra={"implementation_due_at": _due(decision.due_date)},
        )
    else:
        if not (decision.reason and decision.reason.strip()) or not (decision.decision_required and decision.decision_required.strip()):
            raise CaseRefused("reason_and_decision_required")
        owner = _eligible_owner(db, issue, "cases.plan_regional", decision.regional_owner_id)
        _move(
            db, staff, issue, "escalated", "regional", ip, new_owner=owner, note=decision.reason.strip(),
            details={"decisionRequired": decision.decision_required.strip()},
        )
    db.commit()


@dataclass(frozen=True)
class RegionalPlan:
    solution: str
    responsible_tier: str
    resources: str
    expected_outcome: str
    reporting_plan: str


def submit_regional_plan(db: Session, staff: Staff, issue_id: uuid.UUID, plan: RegionalPlan, ip: str) -> None:
    """FR-WEB-023: the plan goes to Tier 5; earlier versions are kept."""
    issue = _load(db, staff, issue_id, lock=True)
    _require(db, staff, issue, "regional_plan", ip)
    executives = [h for h in repository.permission_holders(db, "cases.approve_executive", issue.area_path)
                  if h.member_id != issue.reporter_id]
    version = repository.count_actions(db, issue.id, "regional_plan") + 1
    _move(
        db, staff, issue, "regional_plan", "executive", ip,
        new_owner=executives[0].member_id if len(executives) == 1 else None, note=plan.solution.strip(),
        details={
            "version": version,
            "solution": plan.solution.strip(),
            "responsibleTier": plan.responsible_tier,
            "resources": plan.resources.strip(),
            "expectedOutcome": plan.expected_outcome.strip(),
            "reportingPlan": plan.reporting_plan.strip(),
        },
    )
    db.commit()


@dataclass(frozen=True)
class ExecutiveDecision:
    decision: str  # approve | return | decline
    conditions: str | None = None
    implementer_id: uuid.UUID | None = None
    scope: str | None = None
    reporting_duty: str | None = None
    due_date: date | None = None
    question: str | None = None
    reason: str | None = None


def decide_executive(db: Session, staff: Staff, issue_id: uuid.UUID, decision: ExecutiveDecision, ip: str) -> None:
    """FR-WEB-024: approve with conditions, return for clarification, or decline with a reason."""
    issue = _load(db, staff, issue_id, lock=True)
    _require(db, staff, issue, "executive_decision", ip)
    if decision.decision == "approve":
        if not (decision.conditions and decision.conditions.strip()) or decision.implementer_id is None:
            raise CaseRefused("conditions_and_implementer_required")
        if not (decision.scope and decision.scope.strip()) or decision.due_date is None:
            raise CaseRefused("scope_and_due_date_required")
        _check_due(decision.due_date)
        owner = _eligible_owner(db, issue, "cases.implement_and_close", decision.implementer_id)
        _move(
            db, staff, issue, "executive_approved", "implementation", ip, new_owner=owner, note=decision.scope.strip(),
            details={
                "conditions": decision.conditions.strip(),
                "scope": decision.scope.strip(),
                "reportingDuty": (decision.reporting_duty or "").strip() or None,
                "dueDate": decision.due_date.isoformat(),
            },
            implementation_due=_due(decision.due_date),
            extra={"implementation_due_at": _due(decision.due_date)},
        )
    elif decision.decision == "return":
        if not (decision.question and decision.question.strip()):
            raise CaseRefused("question_required")
        planner = repository.last_action(db, issue.id, ("regional_plan",))
        _move(
            db, staff, issue, "executive_returned", "regional", ip,
            new_owner=planner.actor_id if planner else None, note=decision.question.strip(),
        )
    else:
        if not (decision.reason and decision.reason.strip()):
            raise CaseRefused("reason_required")
        _move(
            db, staff, issue, "executive_declined", "declined", ip, new_owner=None, note=decision.reason.strip(),
            extra={"closed_at": datetime.now(UTC)},
        )
    db.commit()


def _attach_case_photos(db: Session, staff: Staff, issue: StoredIssue, photo_ids: list[uuid.UUID], action_id: uuid.UUID) -> None:
    found = [
        e for e in (repository.find_evidence(db, photo_id) for photo_id in photo_ids)
        if e is not None and e.issue_id == issue.id and e.purpose == "case" and e.action_id is None
        and e.uploader_id == staff.member_id
    ]
    if len(found) != len(set(photo_ids)):
        raise CaseRefused("photo_not_found")
    repository.attach_evidence(db, [e.id for e in found], issue.id, action_id=action_id)


def record_progress(
    db: Session, staff: Staff, issue_id: uuid.UUID, step: str, evidence_refs: list[str], photo_ids: list[uuid.UUID], ip: str
) -> None:
    """FR-WEB-025: steps and progress evidence against the approved scope."""
    issue = _load(db, staff, issue_id, lock=True)
    _require(db, staff, issue, "progress", ip)
    action_id = _record(
        db, staff, issue, "progress", ip, note=step.strip(),
        details={"evidenceRefs": [ref.strip() for ref in evidence_refs if ref.strip()]},
    )
    _attach_case_photos(db, staff, issue, photo_ids, action_id)
    db.commit()


@dataclass(frozen=True)
class ClosingReport:
    outcome: str
    evidence_refs: list[str]
    photo_ids: list[uuid.UUID]
    limitations: str | None
    summary_en: str
    summary_ta: str


def close_case(db: Session, staff: Staff, issue_id: uuid.UUID, report: ClosingReport, ip: str) -> None:
    """FR-WEB-026: Resolved only with a closing report, evidence and a bilingual member summary."""
    issue = _load(db, staff, issue_id, lock=True)
    _require(db, staff, issue, "close", ip)
    problems = rules.check_closing(
        evidence_refs=report.evidence_refs, evidence_photos=len(report.photo_ids),
        summary_en=report.summary_en, summary_ta=report.summary_ta,
    )
    if problems:
        raise CaseRefused(problems)
    decided = repository.last_action(db, issue.id, ("district_action", "executive_approved", "reopened"))
    level = rules.closed_level(decided.kind if decided else None)
    if decided and decided.kind == "reopened":
        earlier = repository.last_action(db, issue.id, ("district_action", "executive_approved"))
        level = rules.closed_level(earlier.kind if earlier else None)
    now = datetime.now(UTC)
    action_id = _move(
        db, staff, issue, "closed", "resolved", ip, new_owner=None, note=report.outcome.strip(),
        details={
            "evidenceRefs": [ref.strip() for ref in report.evidence_refs if ref.strip()],
            "limitations": (report.limitations or "").strip() or None,
            "level": level,
        },
        extra={
            "closed_at": now,
            "closed_level": level,
            "closing_summary_en": report.summary_en.strip(),
            "closing_summary_ta": report.summary_ta.strip(),
            "closure_round": issue.closure_round + 1,
        },
    )
    _attach_case_photos(db, staff, issue, report.photo_ids, action_id)
    closed = repository.find_issue(db, issue.id)
    assert closed is not None
    notices.closed(db, closed, at_district=level == "district", area_path=closed.area_path)
    db.commit()


def assign(db: Session, staff: Staff, issue_id: uuid.UUID, owner_id: uuid.UUID, note: str, ip: str) -> None:
    """A handoff inside the stage: previous owner, new owner, note and time (FR-WEB-029)."""
    issue = _load(db, staff, issue_id, lock=True)
    _require(db, staff, issue, "assign", ip)
    permission = rules.STAGE_PERMISSION[issue.stage]
    owner = _eligible_owner(db, issue, permission, owner_id)
    if owner == issue.owner_id:
        raise CaseRefused("already_owner")
    repository.update_issue(db, issue.id, owner_id=owner)
    repository.insert_action(
        db, issue.id, "assigned", actor_id=staff.member_id, previous_owner_id=issue.owner_id, new_owner_id=owner,
        note=note.strip(),
    )
    if issue.owner_id is None:
        notices.taken(db, issue.id, _stage_holders(db, issue, issue.stage))
    audit.record(
        db, actor_id=staff.member_id, action="case.assigned", target_type="issue", target_id=str(issue.id),
        area_path=issue_path(issue), details={"stage": issue.stage}, ip=ip,
    )
    notices.assigned(db, issue.id, issue.owner_id, owner)
    db.commit()


REOPEN_STAGES = ("gn", "ds", "district", "implementation")


def decide_challenge(
    db: Session, staff: Staff, issue_id: uuid.UUID, *, accept: bool, reason: str, stage: str | None,
    owner_id: uuid.UUID | None, due_date: date | None, ip: str,
) -> None:
    """FR-WEB-027: an accepted challenge reopens the case at a chosen stage with a new owner;
    a rejected one is answered with the reason. History is kept either way."""
    issue = _load(db, staff, issue_id, lock=True)
    challenge = repository.open_challenge(db, issue.id)
    _require(db, staff, issue, "decide_challenge", ip, open_challenge=challenge is not None)
    assert challenge is not None
    if accept:
        if stage not in REOPEN_STAGES:
            raise CaseRefused("stage_required")
        owner = _eligible_owner(db, issue, rules.STAGE_PERMISSION[stage], owner_id)
        implementation_due = None
        if stage == "implementation":
            if due_date is None:
                raise CaseRefused("due_date_required")
            _check_due(due_date)
            implementation_due = _due(due_date)
        repository.decide_challenge(db, challenge.id, "challenge_accepted", staff.member_id, reason.strip())
        _move(
            db, staff, issue, "reopened", stage, ip, new_owner=owner, note=reason.strip(),
            implementation_due=implementation_due,
            extra={"closed_at": None, "closed_level": None, "implementation_due_at": implementation_due},
        )
    else:
        repository.decide_challenge(db, challenge.id, "challenge_rejected", staff.member_id, reason.strip())
        _record(db, staff, issue, "challenge_rejected", ip, note=reason.strip())
    decided = repository.find_issue(db, issue.id)
    assert decided is not None
    notices.challenge_decided(db, decided)
    db.commit()


@dataclass(frozen=True)
class PublicSummary:
    publish: bool
    title_en: str | None
    title_ta: str | None
    summary_en: str | None
    summary_ta: str | None
    reason: str | None


def set_public_summary(db: Session, staff: Staff, issue_id: uuid.UUID, summary: PublicSummary, ip: str) -> None:
    """BR-032: a moderator writes the public summary (no names, contacts or photos) or withholds it."""
    issue = _load(db, staff, issue_id, lock=True)
    _require(db, staff, issue, "publish_summary", ip)
    if summary.publish:
        values = (summary.title_en, summary.title_ta, summary.summary_en, summary.summary_ta)
        if not all(value and value.strip() for value in values):
            raise CaseRefused("bilingual_summary_required")
        repository.update_issue(
            db, issue.id, public_state="published", public_title_en=summary.title_en.strip(),  # type: ignore[union-attr]
            public_title_ta=summary.title_ta.strip(), public_summary_en=summary.summary_en.strip(),  # type: ignore[union-attr]
            public_summary_ta=summary.summary_ta.strip(), published_at=issue.published_at or datetime.now(UTC),  # type: ignore[union-attr]
        )
    else:
        if not (summary.reason and summary.reason.strip()):
            raise CaseRefused("reason_required")
        repository.update_issue(db, issue.id, public_state="withheld")
    outcome = "published" if summary.publish else "withheld"
    _record(
        db, staff, issue, "public_summary", ip, note=None if summary.publish else summary.reason,
        details={"action": outcome}, audit_details={"outcome": outcome},
    )
    db.commit()


def moderate_addition(
    db: Session,
    staff: Staff,
    issue_id: uuid.UUID,
    addition_id: uuid.UUID,
    approve: bool,
    reason: str | None,
    ip: str,
    edited_body: str | None = None,
) -> None:
    """D12: approve added information (as written, or as the moderator's edited version with names or
    contact details taken out), or reject it with a reason. Never one's own addition (BR-085)."""
    issue = _load(db, staff, issue_id, lock=True)
    _require(db, staff, issue, "moderate_additions", ip)
    addition = repository.find_addition(db, addition_id)
    if addition is None or addition.issue_id != issue.id:
        raise CaseNotFound()
    if addition.member_id == staff.member_id:
        record_denial(
            db, actor_id=staff.member_id, permission="cases:moderate_additions", reason="own_record", ip=ip,
            target=("issue_addition", str(addition.id)), area_path=issue_path(issue),
        )
        db.commit()
        raise AccessRefused("own_record")
    if addition.state != "pending":
        raise CaseRefused("already_moderated")
    if not approve and not (reason and reason.strip()):
        raise CaseRefused("reason_required")
    # The edited version is kept only when approving and only when it differs from what was written.
    published = (edited_body or "").strip() if approve else ""
    if published and len(published) < 5:
        raise CaseRefused("edited_body_too_short")
    redacted = bool(published) and published != addition.body.strip()
    repository.moderate_addition(
        db, addition.id, "approved" if approve else "rejected", staff.member_id, reason.strip() if reason else None,
        published if redacted else None,
    )
    _record(
        db, staff, issue, "addition_moderated", ip, note=reason.strip() if reason else None,
        details={"addition": str(addition.id), "approved": approve, "redacted": redacted},
        audit_details={"addition": str(addition.id), "outcome": "approved" if approve else "rejected", "redacted": redacted},
    )
    db.commit()


def save_case_photo(db: Session, vault: EvidenceVault, staff: Staff, issue_id: uuid.UUID, data: bytes) -> repository.StoredEvidence:
    """Progress or closing evidence, kept with the case until it is attached to a report."""
    issue = _load(db, staff, issue_id)
    if issue.stage not in rules.OPEN_STAGES or not any(_holds(staff, p, issue, deciding=False) for p in rules.CASE_PERMISSIONS):
        raise AccessRefused("forbidden")
    try:
        prepared = evidence.prepare(data)
    except evidence.EvidenceRejected as error:
        raise CaseRefused(error.code) from None
    evidence_id = uuid.uuid4()
    sealed_with = vault.save(evidence_id, prepared.data)
    repository.insert_evidence(
        db, evidence_id, uploader_id=staff.member_id, purpose="case", issue_id=issue.id, sealed_with=sealed_with,
        byte_size=len(prepared.data), width=prepared.width, height=prepared.height,
    )
    db.commit()
    found = repository.find_evidence(db, evidence_id)
    assert found is not None
    return found


# --- The moderation queue (D12) ------------------------------------------------------------------------


@dataclass(frozen=True)
class ModerationQueue:
    summaries: list[repository.PendingSummary]
    additions: list[repository.PendingAddition]


def pending_moderation(db: Session, staff: Staff) -> ModerationQueue:
    """Public summaries to write or update and added information to moderate, in the moderator's
    areas, oldest first; one queue for every moderator instead of a visit to each case file."""
    if not access_rules.holds(staff.rule_assignments(), MODERATE):
        raise AccessRefused("forbidden")
    areas = visible_areas(staff, MODERATE)
    return ModerationQueue(summaries=repository.pending_summaries(db, areas), additions=repository.pending_additions(db, areas))
