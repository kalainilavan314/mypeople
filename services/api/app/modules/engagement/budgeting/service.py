"""Participatory budgeting (BRD M24 to M27, D19, FR-PBG-001 to 010, BR-121 to 124).

Members read each published cycle (its budget, fund source, dates, eligibility rules and the
consultation label), the projects on its ballot, and the certified totals. An eligible member casts
one private ballot and gets a receipt code that confirms the ballot was counted without showing the
choice. Staff with pb.manage set up cycles and projects; two different people with pb.certify
certify the same recount of the hash chain; the Treasurer (finance.approve) records allocations; the
office then records spending and completion evidence for each funded project.

Privacy (BR-122, BR-124): a ballot never carries the voter, and no audit entry, notification or log
records who cast a ballot or when. An audit entry per ballot would put voters in the same order as
the chain, so ballots are deliberately not audited one by one; the cycle's opening, closing,
certification and allocation are. Participation is never used for targeting or profiling: it is
read only to tell a member they took part and to count turnout.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import rules as access_rules
from app.modules.access.rules import LOCAL_ZONE, Area, AreaPath, area_from_key
from app.modules.access.service import AccessRefused, Staff, refuse, visible_areas
from app.modules.audit import service as audit
from app.modules.election import service as election
from app.modules.engagement.budgeting import ballot_box, repository, rules
from app.modules.engagement.budgeting.repository import (
    Allocation,
    Candidate,
    Certification,
    Cycle,
    Expenditure,
    Project,
    Result,
)
from app.modules.messaging.notifications import service as notifications

RETENTION = timedelta(days=365)  # ENT-46, ENT-47: certification + 12 months, then totals only


class BudgetingRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class BudgetingNotFound(Exception):
    pass


def _now() -> datetime:
    return datetime.now(UTC)


def _today(now: datetime) -> date:
    return now.astimezone(LOCAL_ZONE).date()


def _path(cycle: Cycle) -> AreaPath:
    return tuple(area_from_key(key) for key in cycle.area_path)


# --- Members (M24 to M27) ---------------------------------------------------------------------------------


@dataclass(frozen=True)
class Eligibility:
    reason: str | None  # None when the member may vote in this cycle


@dataclass(frozen=True)
class MemberCycle:
    cycle: Cycle
    phase: str
    projects: list[Project]
    in_my_area: bool
    eligibility: Eligibility
    participated_on: date | None


def _eligibility(db: Session, member_id: uuid.UUID, cycle: Cycle, now: datetime) -> Eligibility:
    status = access_repository.find_member_status(db, member_id)
    if status is None:
        return Eligibility("membership_not_active")
    areas = [a.key for a in access_repository.member_area_path(db, member_id)]
    return Eligibility(rules.check_eligibility(
        identity_verified=status.identity_verified, membership_active=status.membership_active,
        birth_date=repository.member_birth_date(db, member_id), today=_today(now), min_age=cycle.min_age,
        member_area_keys=areas, cycle_area_key=cycle.area_key,
    ))


def _published(db: Session, cycle_id: uuid.UUID) -> Cycle:
    cycle = repository.find_cycle(db, cycle_id)
    if cycle is None or cycle.status not in rules.PUBLISHED:
        raise BudgetingNotFound()
    return cycle


@dataclass(frozen=True)
class CycleListItem:
    cycle: Cycle
    phase: str
    in_my_area: bool


def published_cycles(db: Session, member_id: uuid.UUID) -> list[CycleListItem]:
    """M24: every published cycle, the member's own areas first."""
    now = _now()
    areas = {a.key for a in access_repository.member_area_path(db, member_id)}
    items = [
        CycleListItem(c, rules.phase(c.status, c.voting_opens_at, c.voting_closes_at, now), c.area_key in areas)
        for c in repository.published_cycles(db)
    ]
    return sorted(items, key=lambda item: (not item.in_my_area, item.phase == "results", item.phase == "cancelled"))


def member_cycle(db: Session, member_id: uuid.UUID, cycle_id: uuid.UUID) -> MemberCycle:
    """M24: the cycle with its rules and ballot projects, whether the member may vote, and whether
    they already took part (the day only)."""
    cycle = _published(db, cycle_id)
    now = _now()
    areas = {a.key for a in access_repository.member_area_path(db, member_id)}
    return MemberCycle(
        cycle=cycle,
        phase=rules.phase(cycle.status, cycle.voting_opens_at, cycle.voting_closes_at, now),
        projects=repository.projects(db, cycle.id, on_ballot_only=True),
        in_my_area=cycle.area_key in areas,
        eligibility=_eligibility(db, member_id, cycle, now),
        participated_on=ballot_box.participated_on(db, cycle.id, member_id),
    )


@dataclass(frozen=True)
class ProjectView:
    cycle: Cycle
    project: Project
    result: Result | None
    allocation: Allocation | None
    expenditures: list[Expenditure]
    counts_shown: bool


def _results_by_project(db: Session, cycle: Cycle) -> dict[uuid.UUID, Result]:
    return {r.project_id: r for r in repository.results(db, cycle.id)} if cycle.status in rules.RESULTS else {}


def _ballot_count(db: Session, cycle: Cycle) -> int:
    found = repository.certifications(db, cycle.id)
    return found[-1].ballot_count if found else 0


def member_project(db: Session, project_id: uuid.UUID) -> ProjectView:
    """M25: a project on a published ballot, with its reviews; once funded, its allocation, spending
    and completion evidence."""
    project = repository.find_project(db, project_id)
    if project is None or not project.on_ballot:
        raise BudgetingNotFound()
    cycle = _published(db, project.cycle_id)
    allocation = next((a for a in repository.allocations(db, cycle.id) if a.project_id == project.id), None)
    return ProjectView(cycle, project, _results_by_project(db, cycle).get(project.id), allocation,
                       repository.expenditures(db, [project.id]), rules.counts_shown(_ballot_count(db, cycle)))


@dataclass(frozen=True)
class Receipt:
    code: str
    participated_on: date


def cast_ballot(db: Session, member_id: uuid.UUID, cycle_id: uuid.UUID, choices: list[uuid.UUID]) -> Receipt:
    """M26, FR-PBG-003 to 005. Eligibility is checked now, at ballot time. The participation row and
    the ballot row are written in one transaction and share no identifier; the receipt code is
    returned only after the commit and is never stored."""
    cycle = _published(db, cycle_id)
    now = _now()
    if not rules.accepting_ballots(cycle.status, cycle.voting_opens_at, cycle.voting_closes_at, now):
        raise BudgetingRefused("voting_not_open")
    # NFR-ELC-08: no budgeting votes while an election silence covers the area.
    if election.silences(db, cycle.area_path, now):
        raise BudgetingRefused("election_silence")
    eligibility = _eligibility(db, member_id, cycle, now)
    if eligibility.reason:
        raise BudgetingRefused(eligibility.reason)
    if ballot_box.participated_on(db, cycle.id, member_id) is not None:
        raise BudgetingRefused("already_voted")
    on_ballot = {p.id for p in repository.projects(db, cycle.id, on_ballot_only=True)}
    problems = rules.check_choices(choices, on_ballot, cycle.max_choices)
    if problems:
        raise BudgetingRefused(problems)

    chain = ballot_box.lock_chain(db, cycle.id)
    if chain is None:
        raise BudgetingRefused("voting_not_open")
    length, head = chain
    code = rules.new_receipt_code()
    if not ballot_box.record_participation(db, cycle.id, member_id, _today(now),
                                           rules.participation_receipt_hash(cycle.id, code)):
        db.rollback()
        raise BudgetingRefused("already_voted")
    ballot_id = uuid.uuid4()  # random: says nothing about who or when
    receipt_hash = rules.ballot_receipt_hash(cycle.id, code)
    canonical = rules.canonical_choices(choices)
    ballot_box.append_ballot(db, cycle.id, rules.StoredBallot(
        ballot_id=ballot_id, position=length + 1, choices=canonical, receipt_hash=receipt_hash, prev_hash=head,
        ballot_hash=rules.ballot_hash(head, canonical, ballot_id, receipt_hash),
    ))
    db.commit()
    return Receipt(code=code, participated_on=_today(now))


@dataclass(frozen=True)
class ReceiptCheck:
    counted: bool  # the ballot with this receipt is in the cycle's chain
    certified: bool  # and the chain's totals have been certified


def check_receipt(db: Session, member_id: uuid.UUID, cycle_id: uuid.UUID, code: str) -> ReceiptCheck:
    """FR-PBG-005: the code confirms inclusion; it never reveals the choice."""
    cycle = _published(db, cycle_id)
    cleaned = rules.normalise_receipt(code)
    if cleaned is None:
        raise BudgetingRefused("receipt_code_invalid")
    counted = ballot_box.ballot_with_receipt(db, cycle.id, rules.ballot_receipt_hash(cycle.id, cleaned))
    return ReceiptCheck(counted=counted, certified=counted and cycle.status in rules.RESULTS)


@dataclass(frozen=True)
class ResultsView:
    cycle: Cycle
    projects: list[Project]
    results: list[Result]
    allocations: list[Allocation]
    expenditures: list[Expenditure]
    certifications: list[Certification]
    ballots: int
    counts_shown: bool


def member_results(db: Session, cycle_id: uuid.UUID) -> ResultsView:
    """M27: certified totals only (FR-PBG-007); 'not certified yet' until two people certify."""
    cycle = _published(db, cycle_id)
    if cycle.status not in rules.RESULTS:
        raise BudgetingRefused("results_not_certified")
    projects = repository.projects(db, cycle.id, on_ballot_only=True)
    ballots = _ballot_count(db, cycle)
    return ResultsView(cycle, projects, repository.results(db, cycle.id), repository.allocations(db, cycle.id),
                       repository.expenditures(db, [p.id for p in projects]), repository.certifications(db, cycle.id),
                       ballots, rules.counts_shown(ballots))


# --- Staff (D19) -----------------------------------------------------------------------------------------


def _holds_any(staff: Staff, path: AreaPath | None = None) -> bool:
    return any(access_rules.holds(staff.rule_assignments(), p, path) if path else access_rules.holds(staff.rule_assignments(), p)
               for p in rules.STAFF_PERMISSIONS)


def _require(db: Session, staff: Staff, permission: str, cycle: Cycle, ip: str) -> None:
    if not access_rules.holds(staff.rule_assignments(), permission, _path(cycle)):
        refuse(db, staff, permission, "outside_your_area", ip, target=("pb_cycle", str(cycle.id)), area_path=_path(cycle))


def _staff_areas(staff: Staff) -> list[str] | None:
    keys: set[str] = set()
    for permission in rules.STAFF_PERMISSIONS:
        areas = visible_areas(staff, permission)
        if areas is None:
            return None
        keys.update(areas)
    return sorted(keys)


def managed_cycles(db: Session, staff: Staff) -> list[Cycle]:
    if not _holds_any(staff):
        raise AccessRefused("forbidden")
    return repository.managed_cycles(db, _staff_areas(staff))


@dataclass(frozen=True)
class StaffCycleView:
    cycle: Cycle
    phase: str
    projects: list[Project]
    certifications: list[Certification]
    results: list[Result]
    allocations: list[Allocation]
    expenditures: list[Expenditure]
    participation: int  # how many took part so far; never who, and never a running total per project
    ballots: int


def _staff_cycle(db: Session, staff: Staff, cycle_id: uuid.UUID) -> Cycle:
    cycle = repository.find_cycle(db, cycle_id)
    if cycle is None or not _holds_any(staff, _path(cycle)):
        raise BudgetingNotFound()
    return cycle


def staff_view(db: Session, staff: Staff, cycle_id: uuid.UUID) -> StaffCycleView:
    cycle = _staff_cycle(db, staff, cycle_id)
    projects = repository.projects(db, cycle.id, on_ballot_only=False)
    took_part, ballots = ballot_box.counts(db, cycle.id)
    return StaffCycleView(
        cycle=cycle, phase=rules.phase(cycle.status, cycle.voting_opens_at, cycle.voting_closes_at, _now()),
        projects=projects, certifications=repository.certifications(db, cycle.id),
        results=repository.results(db, cycle.id), allocations=repository.allocations(db, cycle.id),
        expenditures=repository.expenditures(db, [p.id for p in projects]), participation=took_part, ballots=ballots,
    )


def _check_cycle_values(values: dict[str, Any]) -> None:
    problems = rules.check_schedule(opens_at=values["voting_opens_at"], closes_at=values["voting_closes_at"])
    if problems:
        raise BudgetingRefused(problems)


def create_cycle(db: Session, staff: Staff, values: dict[str, Any], area: Area, ip: str) -> Cycle:
    """D19: a draft cycle for one area. Members see nothing until its rules are published."""
    if area.level not in rules.CYCLE_LEVELS:
        raise BudgetingRefused("area_level_invalid")
    path = access_repository.area_path(db, area)
    if path is None:
        raise BudgetingRefused("unknown_area")
    if not access_rules.holds(staff.rule_assignments(), rules.MANAGE, path):
        refuse(db, staff, rules.MANAGE, "outside_your_area", ip, target=("pb_cycle", "new"), area_path=path)
    _check_cycle_values(values)
    cycle_id = repository.insert_cycle(db, values, area.key, [a.key for a in path], rules.MINIMUM_VOTING_AGE,
                                       staff.member_id)
    audit.record(db, actor_id=staff.member_id, action="pb.cycle.created", target_type="pb_cycle", target_id=str(cycle_id),
                 area_path=path, ip=ip)
    db.commit()
    found = repository.find_cycle(db, cycle_id)
    assert found is not None
    return found


def update_cycle(db: Session, staff: Staff, cycle_id: uuid.UUID, values: dict[str, Any], ip: str) -> Cycle:
    """BR-121: rules change only before voting is scheduled. A change after publication publishes
    the rules again, with a new publication date, and is audited."""
    cycle = repository.find_cycle(db, cycle_id, lock=True)
    if cycle is None:
        raise BudgetingNotFound()
    _require(db, staff, rules.MANAGE, cycle, ip)
    if cycle.status not in rules.EDITABLE:
        raise BudgetingRefused("rules_locked")
    _check_cycle_values(values)
    changes = {name: values[name] for name in repository.CYCLE_FIELDS}
    if cycle.status != "draft":
        now = _now()
        if values["voting_opens_at"] <= now:
            raise BudgetingRefused("voting_must_open_after_publication")
        changes["rules_published_at"] = now
    repository.update_cycle(db, cycle.id, changes)
    audit.record(db, actor_id=staff.member_id, action="pb.cycle.rules_updated", target_type="pb_cycle",
                 target_id=str(cycle.id), area_path=_path(cycle), details={"republished": cycle.status != "draft"}, ip=ip)
    db.commit()
    found = repository.find_cycle(db, cycle.id)
    assert found is not None
    return found


def move_cycle(db: Session, staff: Staff, cycle_id: uuid.UUID, target: str, reason: str | None, ip: str) -> Cycle:
    """Publish the rules (draft to proposal intake), review, schedule voting, close voting, or cancel."""
    cycle = repository.find_cycle(db, cycle_id, lock=True)
    if cycle is None:
        raise BudgetingNotFound()
    _require(db, staff, rules.MANAGE, cycle, ip)
    problem = rules.check_move(cycle.status, target, reason)
    if problem:
        raise BudgetingRefused(problem)
    now = _now()
    changes: dict[str, Any] = {"status": target}
    details: dict[str, Any] = {"from": cycle.status, "to": target}
    if target == "proposal_intake" and cycle.status == "draft":
        # FR-PBG-001: publication of the budget, fund source, dates and rules.
        if cycle.voting_opens_at <= now:
            raise BudgetingRefused("voting_must_open_after_publication")
        changes["rules_published_at"] = now
    elif target == "review" and not repository.projects(db, cycle.id, on_ballot_only=False):
        raise BudgetingRefused("no_projects")
    elif target == "voting_open":
        problems = rules.check_open_voting(
            opens_at=cycle.voting_opens_at, closes_at=cycle.voting_closes_at, rules_published_at=cycle.rules_published_at,
            now=now, on_ballot=len(repository.projects(db, cycle.id, on_ballot_only=True)), max_choices=cycle.max_choices,
        )
        if election.silences(db, cycle.area_path, max(now, cycle.voting_opens_at), cycle.voting_closes_at):
            problems.append("voting_overlaps_election_silence")
        if problems:
            raise BudgetingRefused(problems)
        ballot_box.start_chain(db, cycle.id, rules.genesis_hash(cycle.id))
    elif target == "voting_closed":
        problem = rules.check_close_voting(closes_at=cycle.voting_closes_at, now=now)
        if problem:
            raise BudgetingRefused(problem)
        ballot_box.reorder_participation(db, cycle.id)
        eligible = repository.eligible_count(db, cycle.area_key, cycle.min_age, _today(cycle.voting_closes_at))
        changes["eligible_count"] = eligible
        took_part, ballots = ballot_box.counts(db, cycle.id)
        details.update({"ballots": ballots, "participation": took_part, "eligible": eligible})
        for holder in repository.holders(db, rules.CERTIFY, cycle.area_path):
            notifications.notify(db, holder, "pb_certification_needed", cycle.id)
    elif target == "cancelled":
        changes["status_reason"] = (reason or "").strip()
        details["reason"] = changes["status_reason"]
    repository.update_cycle(db, cycle.id, changes)
    audit.record(db, actor_id=staff.member_id, action=f"pb.cycle.{target}", target_type="pb_cycle", target_id=str(cycle.id),
                 area_path=_path(cycle), details=details, ip=ip)
    db.commit()
    found = repository.find_cycle(db, cycle.id)
    assert found is not None
    return found


def candidates(db: Session, staff: Staff, cycle_id: uuid.UUID) -> list[Candidate]:
    cycle = _staff_cycle(db, staff, cycle_id)
    return repository.candidate_proposals(db, cycle.id, cycle.area_key)


def _editable_project(db: Session, staff: Staff, project_id: uuid.UUID, ip: str) -> tuple[Cycle, Project]:
    project = repository.find_project(db, project_id, lock=True)
    if project is None:
        raise BudgetingNotFound()
    cycle = repository.find_cycle(db, project.cycle_id, lock=True)
    assert cycle is not None
    _require(db, staff, rules.MANAGE, cycle, ip)
    if cycle.status not in rules.EDITABLE:
        raise BudgetingRefused("ballot_locked")
    return cycle, project


def add_project(db: Session, staff: Staff, cycle_id: uuid.UUID, proposal_id: uuid.UUID, values: dict[str, Any],
                ip: str) -> Project:
    """FR-PBG-002: only a proposal approved for planning, inside the cycle's area."""
    cycle = repository.find_cycle(db, cycle_id, lock=True)
    if cycle is None:
        raise BudgetingNotFound()
    _require(db, staff, rules.MANAGE, cycle, ip)
    if cycle.status not in rules.EDITABLE:
        raise BudgetingRefused("ballot_locked")
    if proposal_id not in {c.id for c in repository.candidate_proposals(db, cycle.id, cycle.area_key, limit=10_000)}:
        raise BudgetingRefused("proposal_not_approved_for_planning")
    project_id = repository.insert_project(db, cycle.id, proposal_id, values, staff.member_id)
    if project_id is None:
        raise BudgetingRefused("already_in_cycle")
    audit.record(db, actor_id=staff.member_id, action="pb.project.added", target_type="pb_cycle", target_id=str(cycle.id),
                 area_path=_path(cycle), details={"projectId": str(project_id), "proposalId": str(proposal_id)}, ip=ip)
    db.commit()
    found = repository.find_project(db, project_id)
    assert found is not None
    return found


def update_project(db: Session, staff: Staff, project_id: uuid.UUID, values: dict[str, Any], ip: str) -> Project:
    """A new estimated cost needs a new financial review, so it clears that review and takes the
    project off the ballot until it is recorded again."""
    cycle, project = _editable_project(db, staff, project_id, ip)
    changes = {name: values[name] for name in repository.PROJECT_FIELDS}
    if Decimal(values["estimated_cost"]) != project.estimated_cost:
        changes.update({"financial_review_ref": None, "financial_review_en": None, "financial_review_ta": None,
                        "financial_reviewed_by": None, "financial_reviewed_at": None, "on_ballot": False})
    repository.update_project(db, project.id, changes)
    audit.record(db, actor_id=staff.member_id, action="pb.project.updated", target_type="pb_cycle", target_id=str(cycle.id),
                 area_path=_path(cycle), details={"projectId": str(project.id)}, ip=ip)
    db.commit()
    found = repository.find_project(db, project.id)
    assert found is not None
    return found


def record_review(db: Session, staff: Staff, project_id: uuid.UUID, kind: str, reference: str, note_en: str, note_ta: str,
                  ip: str) -> Project:
    """FR-PBG-002: the financial or legal review, with its reference, shown to members in both languages."""
    cycle, project = _editable_project(db, staff, project_id, ip)
    repository.update_project(db, project.id, {
        f"{kind}_review_ref": reference.strip(), f"{kind}_review_en": note_en.strip(), f"{kind}_review_ta": note_ta.strip(),
        f"{kind}_reviewed_by": staff.member_id, f"{kind}_reviewed_at": _now(),
    })
    audit.record(db, actor_id=staff.member_id, action=f"pb.project.{kind}_review_recorded", target_type="pb_cycle",
                 target_id=str(cycle.id), area_path=_path(cycle), details={"projectId": str(project.id)}, ip=ip)
    db.commit()
    found = repository.find_project(db, project.id)
    assert found is not None
    return found


def set_on_ballot(db: Session, staff: Staff, project_id: uuid.UUID, on_ballot: bool, ip: str) -> Project:
    cycle, project = _editable_project(db, staff, project_id, ip)
    if on_ballot:
        missing = [f"{kind}_review_required" for kind, at in
                   (("financial", project.financial_reviewed_at), ("legal", project.legal_reviewed_at)) if at is None]
        if missing:
            raise BudgetingRefused(missing)
    repository.update_project(db, project.id, {"on_ballot": on_ballot})
    audit.record(db, actor_id=staff.member_id, action="pb.project.ballot_" + ("added" if on_ballot else "removed"),
                 target_type="pb_cycle", target_id=str(cycle.id), area_path=_path(cycle),
                 details={"projectId": str(project.id)}, ip=ip)
    db.commit()
    found = repository.find_project(db, project.id)
    assert found is not None
    return found


@dataclass(frozen=True)
class RecountView:
    cycle: Cycle
    recount: rules.Recount
    participation: int
    matches_certified: bool | None  # None before anyone certified


def recount(db: Session, staff: Staff, cycle_id: uuid.UUID, ip: str) -> RecountView:
    """FR-PBG-006: anyone certifying (or managing) reruns the count from the chain after voting closes;
    totals are never shown while voting is open."""
    cycle = _staff_cycle(db, staff, cycle_id)
    if not any(access_rules.holds(staff.rule_assignments(), p, _path(cycle)) for p in (rules.CERTIFY, rules.MANAGE)):
        refuse(db, staff, rules.CERTIFY, "outside_your_area", ip, target=("pb_cycle", str(cycle.id)), area_path=_path(cycle))
    if cycle.status not in ("voting_closed", *rules.RESULTS):
        raise BudgetingRefused("voting_not_closed")
    found = _recount(db, cycle)
    took_part, _ = ballot_box.counts(db, cycle.id)
    certified = repository.certifications(db, cycle.id)
    matches = None
    if certified and found.chain_valid:
        matches = rules.tally_hash(found.ballots, found.head, found.totals) == certified[0].tally_hash
    audit.record(db, actor_id=staff.member_id, action="pb.cycle.recounted", target_type="pb_cycle", target_id=str(cycle.id),
                 area_path=_path(cycle), details={"chainValid": found.chain_valid, "matchesCertified": matches}, ip=ip)
    db.commit()
    return RecountView(cycle, found, took_part, matches)


def _recount(db: Session, cycle: Cycle) -> rules.Recount:
    projects = [p.id for p in repository.projects(db, cycle.id, on_ballot_only=True)]
    return rules.recount(cycle.id, ballot_box.ballots(db, cycle.id), projects)


def certify(db: Session, staff: Staff, cycle_id: uuid.UUID, ip: str) -> Cycle:
    """FR-PBG-006, BR-123: each certifier reruns the count; the second, a different person, must reach
    the same totals. Then the ranked totals are published and the cycle is Results certified. A broken
    chain or a count that does not match the participation records blocks certification."""
    cycle = repository.find_cycle(db, cycle_id, lock=True)
    if cycle is None:
        raise BudgetingNotFound()
    _require(db, staff, rules.CERTIFY, cycle, ip)
    if cycle.status != "voting_closed":
        raise BudgetingRefused(f"not_allowed_from:{cycle.status}")
    found = _recount(db, cycle)
    took_part, _ = ballot_box.counts(db, cycle.id)
    if not found.chain_valid:
        _blocked(db, staff, cycle, found.problem or "chain_broken", ip)
    if took_part != found.ballots:
        _blocked(db, staff, cycle, "count_mismatch", ip)
    tally = rules.tally_hash(found.ballots, found.head, found.totals)
    previous = repository.certifications(db, cycle.id)
    problem = rules.check_certifier([c.certified_by for c in previous], staff.member_id)
    if problem:
        refuse(db, staff, rules.CERTIFY, problem, ip, target=("pb_cycle", str(cycle.id)), area_path=_path(cycle))
    if previous and previous[0].tally_hash != tally:
        _blocked(db, staff, cycle, "count_mismatch", ip)
    repository.insert_certification(db, cycle.id, staff.member_id, found.ballots, found.head, tally)
    details: dict[str, Any] = {"ballots": found.ballots, "tallyHash": tally, "certification": len(previous) + 1}
    if previous:
        projects = repository.projects(db, cycle.id, on_ballot_only=True)
        ranked = rules.rank_and_fund([(p.id, p.proposal_ref, p.estimated_cost) for p in projects], found.totals, cycle.budget)
        for item in ranked:
            repository.insert_result(db, cycle.id, item.project_id, item.votes, item.rank, item.funded)
        repository.update_cycle(db, cycle.id, {"status": "results_certified"})
        notifications.complete_action(db, "pb_cycle", cycle.id)
        details["funded"] = sum(1 for item in ranked if item.funded)
    audit.record(db, actor_id=staff.member_id, action="pb.results.certified" if previous else "pb.results.first_certification",
                 target_type="pb_cycle", target_id=str(cycle.id), area_path=_path(cycle), details=details, ip=ip)
    db.commit()
    found_cycle = repository.find_cycle(db, cycle.id)
    assert found_cycle is not None
    return found_cycle


def _blocked(db: Session, staff: Staff, cycle: Cycle, problem: str, ip: str) -> None:
    """Certification refused: kept in the audit log so a mismatch is never silent (D19)."""
    db.rollback()
    audit.record(db, actor_id=staff.member_id, action="pb.results.certification_blocked", target_type="pb_cycle",
                 target_id=str(cycle.id), area_path=_path(cycle), details={"problem": problem}, ip=ip)
    db.commit()
    raise BudgetingRefused(problem)


def allocate(db: Session, staff: Staff, cycle_id: uuid.UUID, ip: str) -> Cycle:
    """FR-PBG-008: the Treasurer records an allocation in the finance schema for each funded project,
    at its estimated cost, from the cycle's fund. Never more than the budget."""
    cycle = repository.find_cycle(db, cycle_id, lock=True)
    if cycle is None:
        raise BudgetingNotFound()
    _require(db, staff, rules.ALLOCATE, cycle, ip)
    if cycle.status != "results_certified":
        raise BudgetingRefused(f"not_allowed_from:{cycle.status}")
    funded = {r.project_id for r in repository.results(db, cycle.id) if r.funded}
    if not funded:
        raise BudgetingRefused("nothing_to_allocate")
    projects = [p for p in repository.projects(db, cycle.id, on_ballot_only=True) if p.id in funded]
    if sum((p.estimated_cost for p in projects), Decimal(0)) > cycle.budget:
        raise BudgetingRefused("allocations_exceed_budget")
    for project in projects:
        repository.insert_allocation(db, cycle.id, project.id, project.estimated_cost, cycle.fund_kind,
                                     cycle.fund_source_en, staff.member_id)
    repository.update_cycle(db, cycle.id, {"status": "allocated"})
    audit.record(db, actor_id=staff.member_id, action="pb.allocations.recorded", target_type="pb_cycle",
                 target_id=str(cycle.id), area_path=_path(cycle),
                 details={"projects": len(projects), "total": str(sum((p.estimated_cost for p in projects), Decimal(0)))},
                 ip=ip)
    db.commit()
    found = repository.find_cycle(db, cycle.id)
    assert found is not None
    return found


def _funded_project(db: Session, staff: Staff, project_id: uuid.UUID, ip: str) -> tuple[Cycle, Project, Allocation | None]:
    project = repository.find_project(db, project_id, lock=True)
    if project is None:
        raise BudgetingNotFound()
    cycle = repository.find_cycle(db, project.cycle_id, lock=True)
    assert cycle is not None
    _require(db, staff, rules.MANAGE, cycle, ip)
    allocation = next((a for a in repository.allocations(db, cycle.id) if a.project_id == project.id), None)
    return cycle, project, allocation


def record_expenditure(db: Session, staff: Staff, project_id: uuid.UUID, values: dict[str, Any], ip: str) -> Expenditure:
    """FR-PBG-008: spending on a funded project, with evidence; append-only."""
    cycle, project, allocation = _funded_project(db, staff, project_id, ip)
    if project.completed_on is not None:
        raise BudgetingRefused("project_completed")
    spent = sum((e.amount for e in repository.expenditures(db, [project.id])), Decimal(0))
    problem = rules.check_spending(allocated=allocation.amount if allocation else None, spent=spent,
                                   amount=Decimal(values["amount"]))
    if problem:
        raise BudgetingRefused(problem)
    expenditure_id = repository.insert_expenditure(db, project.id, values, staff.member_id)
    audit.record(db, actor_id=staff.member_id, action="pb.expenditure.recorded", target_type="pb_cycle",
                 target_id=str(cycle.id), area_path=_path(cycle),
                 details={"projectId": str(project.id), "amount": str(values["amount"])}, ip=ip)
    db.commit()
    return next(e for e in repository.expenditures(db, [project.id]) if e.id == expenditure_id)


def record_completion(db: Session, staff: Staff, project_id: uuid.UUID, values: dict[str, Any], ip: str) -> Project:
    """FR-PBG-008: completion with its evidence. When every funded project is complete the cycle is
    Implemented."""
    cycle, project, allocation = _funded_project(db, staff, project_id, ip)
    if allocation is None:
        raise BudgetingRefused("not_allocated")
    if project.completed_on is not None:
        raise BudgetingRefused("project_completed")
    repository.update_project(db, project.id, {
        "completed_on": values["completed_on"], "completion_evidence": values["evidence_ref"].strip(),
        "completion_en": values["note_en"].strip(), "completion_ta": values["note_ta"].strip(),
        "completed_by": staff.member_id,
    })
    funded = {a.project_id for a in repository.allocations(db, cycle.id)}
    open_projects = [p for p in repository.projects(db, cycle.id, on_ballot_only=True)
                     if p.id in funded and p.completed_on is None]
    if not open_projects and cycle.status == "allocated":
        repository.update_cycle(db, cycle.id, {"status": "implemented"})
    audit.record(db, actor_id=staff.member_id, action="pb.project.completed", target_type="pb_cycle",
                 target_id=str(cycle.id), area_path=_path(cycle), details={"projectId": str(project.id)}, ip=ip)
    db.commit()
    found = repository.find_project(db, project.id)
    assert found is not None
    return found


def purge_expired(db: Session, now: datetime) -> int:
    """ENT-46, ENT-47, run by the notifications task: 12 months after certification (or cancellation)
    participation records and ballots are deleted; the certified totals stay."""
    removed = 0
    for cycle_id in repository.retention_due(db, now - RETENTION):
        took_part, cast = ballot_box.purge(db, cycle_id)
        if took_part or cast:
            audit.record(db, actor_id=None, action="pb.ballots.purged", target_type="pb_cycle", target_id=str(cycle_id),
                         details={"participation": took_part, "ballots": cast})
            removed += cast
    db.commit()
    return removed
