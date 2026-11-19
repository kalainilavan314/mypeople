"""Participatory budgeting rules (BRD FR-PBG-001 to 010, BR-121 to 124, OD-36) as plain functions.

A cycle publishes its budget, fund source, dates and eligibility rules before voting opens, and
they never change once voting is scheduled. Only development proposals approved for planning, with
an estimated cost and a recorded financial and legal review, go on the ballot. Eligibility is
checked at ballot time; each member takes part at most once per cycle; the ballot holds the choices
and nothing about the voter. Ballots are hash-chained so anyone certifying can reproduce the count,
and two different people certify the same totals. Results are totals only.
"""

import base64
import hashlib
import json
import secrets
import uuid
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from app.core.small_numbers import SMALL_GROUP
from app.modules.identity.registration.rules import age_on

MANAGE = "pb.manage"  # PRM-45
CERTIFY = "pb.certify"  # PRM-46 (two-person)
# [ASSUMPTION] FR-PBG-008 names the Treasurer for allocations; the dashboard's Treasurer is the
# finance approver (finance.approve), so allocations need that permission over the cycle's area.
ALLOCATE = "finance.approve"
STAFF_PERMISSIONS = (MANAGE, CERTIFY, ALLOCATE)

# [ASSUMPTION] OD-36 (BRD recommendation): verified, active members aged 18 or over who live in the
# cycle's area; one ballot per cycle. Kept here and on each cycle (min_age) so a decision changes one place.
MINIMUM_VOTING_AGE = 18
# [ASSUMPTION] OD-36 piloting: a cycle is for a province, district, DS division or GN division.
CYCLE_LEVELS = ("province", "district", "ds", "gn")
# [ASSUMPTION] a ballot needs a real choice: at least two projects on it before voting opens.
MINIMUM_PROJECTS = 2
# [ASSUMPTION] with fewer ballots than this the per-project counts are not shown to members, so a
# small group's choices cannot be read from the totals (BRD §8 small numbers, BR-122).
SHOW_COUNTS_FROM = SMALL_GROUP

Status = Literal[
    "draft", "proposal_intake", "review", "voting_open", "voting_closed", "results_certified", "allocated",
    "implemented", "cancelled",
]
FundKind = Literal["party_fund", "community_fund"]
ReviewKind = Literal["financial", "legal"]
# What a member sees of a published cycle.
Phase = Literal["upcoming", "voting", "counting", "results", "cancelled"]

# Rules may be edited only before voting is scheduled (BR-121).
EDITABLE = frozenset({"draft", "proposal_intake", "review"})
PUBLISHED = frozenset({
    "proposal_intake", "review", "voting_open", "voting_closed", "results_certified", "allocated", "implemented", "cancelled",
})
RESULTS = frozenset({"results_certified", "allocated", "implemented"})

# (from, to) moves a pb.manage holder records. Certification, allocation and completion move the
# cycle on by themselves.
MOVES: dict[tuple[str, str], str] = {
    ("draft", "proposal_intake"): MANAGE,
    ("proposal_intake", "review"): MANAGE,
    ("review", "proposal_intake"): MANAGE,
    ("review", "voting_open"): MANAGE,
    ("voting_open", "voting_closed"): MANAGE,
    ("draft", "cancelled"): MANAGE,
    ("proposal_intake", "cancelled"): MANAGE,
    ("review", "cancelled"): MANAGE,
}


def check_move(current: str, target: str, reason: str | None) -> str | None:
    if (current, target) not in MOVES:
        return f"not_allowed_from:{current}"
    if target == "cancelled" and len((reason or "").strip()) < 10:
        return "reason_required"
    return None


def check_schedule(*, opens_at: datetime, closes_at: datetime) -> list[str]:
    return ["closes_before_opens"] if closes_at <= opens_at else []


def check_open_voting(*, opens_at: datetime, closes_at: datetime, rules_published_at: datetime | None, now: datetime,
                      on_ballot: int, max_choices: int) -> list[str]:
    """FR-PBG-001: the rules were published before voting opens; voting has not already ended."""
    problems = []
    if rules_published_at is None or rules_published_at >= opens_at:
        problems.append("rules_not_published_before_voting")
    if closes_at <= now:
        problems.append("voting_window_passed")
    if on_ballot < MINIMUM_PROJECTS:
        problems.append("too_few_projects_on_ballot")
    elif max_choices > on_ballot:
        problems.append("max_choices_above_projects")
    return problems


def check_close_voting(*, closes_at: datetime, now: datetime) -> str | None:
    """Voting closes when the published closing time has passed, never earlier (BR-121)."""
    return None if now >= closes_at else "voting_still_open"


def accepting_ballots(status: str, opens_at: datetime, closes_at: datetime, now: datetime) -> bool:
    return status == "voting_open" and opens_at <= now < closes_at


def phase(status: str, opens_at: datetime, closes_at: datetime, now: datetime) -> Phase:
    if status == "cancelled":
        return "cancelled"
    if status in RESULTS:
        return "results"
    if status == "voting_closed" or (status == "voting_open" and now >= closes_at):
        return "counting"
    if accepting_ballots(status, opens_at, closes_at, now):
        return "voting"
    return "upcoming"


def check_eligibility(*, identity_verified: bool, membership_active: bool, birth_date: date | None, today: date,
                      min_age: int, member_area_keys: list[str], cycle_area_key: str) -> str | None:
    """FR-PBG-003, OD-36: the reason a member may not vote in this cycle, or None."""
    if not identity_verified:
        return "identity_not_verified"
    if not membership_active:
        return "membership_not_active"
    if birth_date is None:
        return "age_not_recorded"
    if age_on(birth_date, today) < max(min_age, MINIMUM_VOTING_AGE):
        return "under_voting_age"
    if cycle_area_key not in member_area_keys:
        return "outside_cycle_area"
    return None


def check_choices(choices: list[uuid.UUID], on_ballot: set[uuid.UUID], max_choices: int) -> list[str]:
    problems = []
    if not choices:
        problems.append("choice_required")
    if len(set(choices)) != len(choices):
        problems.append("duplicate_choice")
    if len(set(choices)) > max_choices:
        problems.append("too_many_choices")
    if any(choice not in on_ballot for choice in choices):
        problems.append("not_on_ballot")
    return problems


# --- Receipt codes ---------------------------------------------------------------------------------------

# 80 random bits in base32 (A-Z, 2-7), shown as four groups of four: too many to guess or try in turn.
RECEIPT_BYTES = 10


def new_receipt_code() -> str:
    raw = base64.b32encode(secrets.token_bytes(RECEIPT_BYTES)).decode()
    return "-".join(raw[i:i + 4] for i in range(0, len(raw), 4))


def normalise_receipt(code: str) -> str | None:
    """The 16 characters a member typed, whatever spaces, dashes or case they used; None if not a code."""
    cleaned = "".join(ch for ch in code.upper() if ch.isalnum())
    if len(cleaned) != 16 or any(ch not in "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567" for ch in cleaned):
        return None
    return cleaned


def _receipt_hash(purpose: str, cycle_id: uuid.UUID, code: str) -> str:
    cleaned = normalise_receipt(code)
    assert cleaned is not None
    return hashlib.sha256(f"pb-{purpose}:{cycle_id}:{cleaned}".encode()).hexdigest()


def participation_receipt_hash(cycle_id: uuid.UUID, code: str) -> str:
    """Kept on the participation row (ENT-46). A different hash from the ballot's, so the two rows
    cannot be matched without the code, which only the voter has (FR-PBG-005)."""
    return _receipt_hash("participation", cycle_id, code)


def ballot_receipt_hash(cycle_id: uuid.UUID, code: str) -> str:
    """Kept on the ballot row, so the code confirms the ballot is in the counted chain."""
    return _receipt_hash("ballot", cycle_id, code)


# --- The hash chain and the count ------------------------------------------------------------------------


def genesis_hash(cycle_id: uuid.UUID) -> str:
    """The chain of each cycle starts from its own id, so ballots cannot be moved between cycles."""
    return hashlib.sha256(f"pb-genesis:{cycle_id}".encode()).hexdigest()


def canonical_choices(choices: list[uuid.UUID]) -> list[uuid.UUID]:
    return sorted(set(choices), key=str)


def ballot_hash(prev_hash: str, choices: list[uuid.UUID], ballot_id: uuid.UUID, receipt_hash: str) -> str:
    """The BRD's SHA-256(prev_hash ‖ choices ‖ ballot_id), with the receipt hash added so a receipt
    cannot be moved to another ballot without breaking the chain."""
    joined = ",".join(str(choice) for choice in canonical_choices(choices))
    return hashlib.sha256(f"{prev_hash}|{joined}|{ballot_id}|{receipt_hash}".encode()).hexdigest()


@dataclass(frozen=True)
class StoredBallot:
    ballot_id: uuid.UUID
    position: int
    choices: list[uuid.UUID]
    receipt_hash: str
    prev_hash: str
    ballot_hash: str


@dataclass(frozen=True)
class Recount:
    chain_valid: bool
    problem: str | None
    ballots: int
    head: str
    totals: dict[uuid.UUID, int]


def recount(cycle_id: uuid.UUID, ballots: list[StoredBallot], projects: list[uuid.UUID]) -> Recount:
    """FR-PBG-006: replay the chain from the genesis hash, checking every link and hash, and count
    each project's ballots. Any break stops certification."""
    totals = {project: 0 for project in projects}
    head = genesis_hash(cycle_id)
    for expected, ballot in enumerate(sorted(ballots, key=lambda b: b.position), start=1):
        if ballot.position != expected:
            return Recount(False, "chain_gap", len(ballots), head, totals)
        if ballot.prev_hash != head:
            return Recount(False, "chain_broken", len(ballots), head, totals)
        if ballot_hash(ballot.prev_hash, ballot.choices, ballot.ballot_id, ballot.receipt_hash) != ballot.ballot_hash:
            return Recount(False, "ballot_altered", len(ballots), head, totals)
        for choice in canonical_choices(ballot.choices):
            if choice not in totals:
                return Recount(False, "unknown_choice", len(ballots), head, totals)
            totals[choice] += 1
        head = ballot.ballot_hash
    return Recount(True, None, len(ballots), head, totals)


def tally_hash(ballots: int, head: str, totals: dict[uuid.UUID, int]) -> str:
    """What each certifier signs: the ballot count, the chain head and every project's total."""
    body = json.dumps({"ballots": ballots, "head": head, "totals": {str(k): v for k, v in sorted(totals.items(), key=lambda kv: str(kv[0]))}},
                      sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(body.encode()).hexdigest()


def check_certifier(previous: list[uuid.UUID], certifier: uuid.UUID) -> str | None:
    """FR-PBG-006: two different people certify; nobody certifies twice."""
    return "already_certified_by_you" if certifier in previous else None


@dataclass(frozen=True)
class Ranked:
    project_id: uuid.UUID
    votes: int
    rank: int
    funded: bool


def rank_and_fund(projects: list[tuple[uuid.UUID, str, Decimal]], totals: dict[uuid.UUID, int], budget: Decimal) -> list[Ranked]:
    """[ASSUMPTION] the published method: projects in order of votes (ties: lower cost, then proposal
    reference) are funded in turn while their estimated cost fits in what is left of the budget."""
    ordered = sorted(projects, key=lambda p: (-totals.get(p[0], 0), p[2], p[1]))
    left = budget
    ranked = []
    for rank, (project_id, _ref, cost) in enumerate(ordered, start=1):
        funded = totals.get(project_id, 0) > 0 and cost <= left
        if funded:
            left -= cost
        ranked.append(Ranked(project_id, totals.get(project_id, 0), rank, funded))
    return ranked


def counts_shown(ballots: int) -> bool:
    return ballots >= SHOW_COUNTS_FROM


def check_spending(*, allocated: Decimal | None, spent: Decimal, amount: Decimal) -> str | None:
    """[ASSUMPTION] spending is recorded only against an allocation and never beyond it."""
    if allocated is None:
        return "not_allocated"
    if spent + amount > allocated:
        return "spending_exceeds_allocation"
    return None
