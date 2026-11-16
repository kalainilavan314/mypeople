"""Our Development Ideas: structured development proposals (BRD M15 to M17, D15, FR-DEV-001 to 008).

Members propose for a District, DS division or GN division. Every proposal is moderated before
publication, with a reason for any rejection; the author may revise and send it again. Published
proposals move through review, approval for planning, funding identified and implementation, each
step recorded by the tier holding that authority, and the author is told of every change.

Not built: AI topic, duplicate and summary suggestions (FR-DEV-004) and semantic search
(FR-DEV-005) wait for the AI provider decision (OD-42); search here matches words.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from app.core.permissions import TIER_RANK
from app.modules.access import repository as access_repository
from app.modules.access import rules as access_rules
from app.modules.access.rules import Area, AreaPath, area_from_key
from app.modules.access.service import AccessRefused, Staff, refuse, visible_areas
from app.modules.audit import service as audit
from app.modules.community.proposals import repository, rules
from app.modules.community.proposals.repository import Proposal, StageEvent
from app.modules.messaging.notifications import service as notifications

PROPOSALS_PER_DAY = 5  # [ASSUMPTION]


class ProposalRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class ProposalNotFound(Exception):
    pass


def _path(proposal: Proposal) -> AreaPath:
    return tuple(area_from_key(key) for key in proposal.area_path)


@dataclass(frozen=True)
class NewProposal:
    client_reference: uuid.UUID
    title: str
    category: str
    area: Area
    problem: str
    solution: str
    benefit: str
    cost_estimate: Decimal | None
    evidence: str | None


def submit(db: Session, member_id: uuid.UUID, new: NewProposal, ip: str) -> Proposal:
    """FR-DEV-001; the same client reference returns the first proposal (an offline draft sent twice)."""
    existing = repository.find_by_reference(db, member_id, new.client_reference)
    if existing is not None:
        return existing
    status = access_repository.find_member_status(db, member_id)
    assert status is not None
    if not status.identity_verified:
        raise ProposalRefused("identity_not_verified")
    if not status.membership_active:
        raise ProposalRefused("membership_not_active")
    if new.area.level not in rules.PROPOSAL_LEVELS:
        raise ProposalRefused("area_level_invalid")
    path = access_repository.area_path(db, new.area)
    if path is None:
        raise ProposalRefused("unknown_area")
    if repository.count_recent(db, member_id) >= PROPOSALS_PER_DAY:
        raise ProposalRefused("too_many_proposals_today")
    proposal_id = repository.insert(db, {
        "author_id": member_id, "client_reference": new.client_reference, "title": new.title.strip(),
        "category": new.category, "area_key": new.area.key, "area_path": [a.key for a in path],
        "problem": new.problem.strip(), "solution": new.solution.strip(), "benefit": new.benefit.strip(),
        "cost_estimate": new.cost_estimate, "evidence": new.evidence.strip() if new.evidence else None,
    })
    if proposal_id is None:  # a parallel send of the same draft won
        db.rollback()
        found = repository.find_by_reference(db, member_id, new.client_reference)
        assert found is not None
        return found
    repository.record_event(db, proposal_id, None, "pending_moderation", member_id, None, None)
    audit.record(db, actor_id=member_id, action="proposal.submitted", target_type="proposal", target_id=str(proposal_id),
                 area_path=path, details={"category": new.category}, ip=ip)
    db.commit()
    found = repository.find(db, proposal_id)
    assert found is not None
    return found


def revise(db: Session, member_id: uuid.UUID, proposal_id: uuid.UUID, changes: dict[str, Any], ip: str) -> Proposal:
    """FR-DEV-003: a rejected proposal may be revised and goes back to moderation."""
    proposal = repository.find(db, proposal_id, lock=True)
    if proposal is None or proposal.author_id != member_id:
        raise ProposalNotFound()
    if proposal.stage != "rejected":
        raise ProposalRefused("only_rejected_proposals_are_revised")
    cleaned = {k: (v.strip() if isinstance(v, str) else v) for k, v in changes.items()}
    repository.update(db, proposal_id, {**cleaned, "stage": "pending_moderation", "stage_reason": None,
                                        "revision": proposal.revision + 1})
    repository.record_event(db, proposal_id, "rejected", "pending_moderation", member_id, None, None)
    audit.record(db, actor_id=member_id, action="proposal.revised", target_type="proposal", target_id=str(proposal_id),
                 area_path=_path(proposal), ip=ip)
    db.commit()
    found = repository.find(db, proposal_id)
    assert found is not None
    return found


def withdraw(db: Session, member_id: uuid.UUID, proposal_id: uuid.UUID, ip: str) -> Proposal:
    proposal = repository.find(db, proposal_id, lock=True)
    if proposal is None or proposal.author_id != member_id:
        raise ProposalNotFound()
    if proposal.stage not in rules.AUTHOR_MAY_WITHDRAW:
        raise ProposalRefused(f"not_allowed_from:{proposal.stage}")
    repository.update(db, proposal_id, {"stage": "withdrawn"})
    repository.record_event(db, proposal_id, proposal.stage, "withdrawn", member_id, None, None)
    audit.record(db, actor_id=member_id, action="proposal.withdrawn", target_type="proposal", target_id=str(proposal_id),
                 area_path=_path(proposal), ip=ip)
    db.commit()
    found = repository.find(db, proposal_id)
    assert found is not None
    return found


@dataclass(frozen=True)
class ProposalView:
    proposal: Proposal
    mine: bool
    history: list[StageEvent]


def _local_keys(db: Session, member_id: uuid.UUID) -> list[str]:
    """M15 "proposals for my area": the member's GN division, DS division and district. The province
    and platform levels would bring in every proposal in the Northern Province."""
    return [a.key for a in access_repository.member_area_path(db, member_id) if a.level in rules.PROPOSAL_LEVELS]


def browse(db: Session, member_id: uuid.UUID, query: str | None, category: str | None) -> tuple[list[Proposal], list[Proposal]]:
    """M15: published proposals touching the member's area, and their own in every stage."""
    area = repository.search(db, area_keys=_local_keys(db, member_id), stages=list(rules.PUBLISHED_STAGES), author_id=None,
                             query=query, category=category, limit=100)
    mine = repository.search(db, area_keys=None, stages=None, author_id=member_id, query=query, category=category, limit=100)
    return area, mine


def view(db: Session, member_id: uuid.UUID, proposal_id: uuid.UUID) -> ProposalView:
    proposal = repository.find(db, proposal_id)
    if proposal is None:
        raise ProposalNotFound()
    mine = proposal.author_id == member_id
    keys = _local_keys(db, member_id)
    visible = mine or (proposal.stage in rules.PUBLISHED_STAGES and any(key in proposal.area_path for key in keys))
    if not visible:
        raise ProposalNotFound()
    return ProposalView(proposal=proposal, mine=mine, history=repository.history(db, proposal_id))


# --- Staff (D15) -----------------------------------------------------------------------------------------


def _staff_areas(staff: Staff) -> list[str] | None:
    keys: set[str] = set()
    for permission in rules.STAFF_PERMISSIONS:
        areas = visible_areas(staff, permission)
        if areas is None:
            return None
        keys.update(areas)
    return sorted(keys)


def queue(db: Session, staff: Staff, stages: list[str] | None, query: str | None, category: str | None) -> list[Proposal]:
    if not any(access_rules.holds(staff.rule_assignments(), p) for p in rules.STAFF_PERMISSIONS):
        raise AccessRefused("forbidden")
    return repository.search(db, area_keys=_staff_areas(staff), stages=stages, author_id=None, query=query,
                             category=category, limit=200)


def staff_view(db: Session, staff: Staff, proposal_id: uuid.UUID) -> ProposalView:
    proposal = repository.find(db, proposal_id)
    if proposal is None or not any(access_rules.holds(staff.rule_assignments(), p, _path(proposal)) for p in rules.STAFF_PERMISSIONS):
        raise ProposalNotFound()
    return ProposalView(proposal=proposal, mine=proposal.author_id == staff.member_id, history=repository.history(db, proposal_id))


def _acting_tier(staff: Staff, permission: str, path: AreaPath) -> str | None:
    tiers = [a.tier for a in staff.assignments if permission in a.permissions and access_rules.contains(a.area, path)]
    return max(tiers, key=lambda tier: TIER_RANK[tier], default=None)


def move(db: Session, staff: Staff, proposal_id: uuid.UUID, target: str, reason: str | None, ip: str) -> Proposal:
    """FR-DEV-006: each stage recorded by the tier holding that authority; the author is told (FR-DEV-007)."""
    proposal = repository.find(db, proposal_id, lock=True)
    if proposal is None:
        raise ProposalNotFound()
    path = _path(proposal)
    problem, permission = rules.check_move(proposal.stage, target, reason)
    if permission is None:
        raise ProposalRefused(problem or "not_allowed")
    if not access_rules.holds(staff.rule_assignments(), permission, path):
        refuse(db, staff, permission, "forbidden", ip, target=("proposal", str(proposal_id)), area_path=path)
    if proposal.author_id == staff.member_id:
        refuse(db, staff, permission, "own_record", ip, target=("proposal", str(proposal_id)), area_path=path)
    if problem:
        raise ProposalRefused(problem)
    values: dict[str, Any] = {"stage": target, "stage_reason": reason.strip() if reason else None}
    if target == "review" and proposal.published_at is None:
        values["published_at"] = datetime.now(UTC)
    repository.update(db, proposal_id, values)
    tier = _acting_tier(staff, permission, path)
    repository.record_event(db, proposal_id, proposal.stage, target, staff.member_id, tier, values["stage_reason"])
    notifications.notify(db, proposal.author_id, "proposal_rejected" if target == "rejected" else "proposal_stage", proposal_id)
    audit.record(db, actor_id=staff.member_id, action=f"proposal.{target}", target_type="proposal",
                 target_id=str(proposal_id), area_path=path, details={"from": proposal.stage, "tier": tier}, ip=ip)
    db.commit()
    found = repository.find(db, proposal_id)
    assert found is not None
    return found


def regional_needs(db: Session, staff: Staff) -> list[tuple[str, str, int | None]]:
    """FR-DEV-008: published proposals by area and category; groups under 10 hidden or merged."""
    if not any(access_rules.holds(staff.rule_assignments(), p) for p in (rules.REVIEW, rules.APPROVE)):
        raise AccessRefused("forbidden")
    keys: set[str] = set()
    for permission in (rules.REVIEW, rules.APPROVE):
        areas = visible_areas(staff, permission)
        if areas is None:
            keys = set()
            scope: list[str] | None = None
            break
        keys.update(areas)
    else:
        scope = sorted(keys)
    return rules.needs_table(repository.needs_counts(db, scope, rules.PUBLISHED_STAGES))
