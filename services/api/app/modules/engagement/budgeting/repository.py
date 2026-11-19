"""SQL for budgeting cycles, their projects, certifications, results, allocations and spending.

Ballots and participation are in ballot_box.py, behind their own firewall. Nothing here reads them.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Cycle:
    id: uuid.UUID
    cycle_ref: str
    title_en: str
    title_ta: str
    description_en: str
    description_ta: str
    fund_kind: str
    fund_source_en: str
    fund_source_ta: str
    budget: Decimal
    currency: str
    area_key: str
    area_path: list[str]
    eligibility_en: str
    eligibility_ta: str
    min_age: int
    max_choices: int
    voting_opens_at: datetime
    voting_closes_at: datetime
    status: str
    status_reason: str | None
    rules_published_at: datetime | None
    eligible_count: int | None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime


_CYCLE = """
    SELECT id, cycle_ref, title_en, title_ta, description_en, description_ta, fund_kind, fund_source_en, fund_source_ta,
           budget, currency, area_key, area_path, eligibility_en, eligibility_ta, min_age, max_choices, voting_opens_at,
           voting_closes_at, status, status_reason, rules_published_at, eligible_count, created_by, created_at, updated_at
    FROM engagement.pb_cycle
"""
CYCLE_FIELDS = (
    "title_en", "title_ta", "description_en", "description_ta", "fund_kind", "fund_source_en", "fund_source_ta", "budget",
    "eligibility_en", "eligibility_ta", "max_choices", "voting_opens_at", "voting_closes_at",
)


def _cycle(row: Any) -> Cycle:
    return Cycle(**{**row, "area_path": list(row["area_path"])})


def find_cycle(db: Session, cycle_id: uuid.UUID, *, lock: bool = False) -> Cycle | None:
    suffix = " FOR UPDATE" if lock else ""
    row = db.execute(text(f"{_CYCLE} WHERE id = :id{suffix}"), {"id": cycle_id}).mappings().one_or_none()
    return _cycle(row) if row else None


def published_cycles(db: Session, limit: int = 100) -> list[Cycle]:
    rows = db.execute(
        text(f"{_CYCLE} WHERE status <> 'draft' ORDER BY voting_opens_at DESC, cycle_ref DESC LIMIT :limit"),
        {"limit": limit},
    ).mappings()
    return [_cycle(row) for row in rows]


def managed_cycles(db: Session, areas: list[str] | None, limit: int = 200) -> list[Cycle]:
    condition, params = "TRUE", {"limit": limit}
    if areas is not None:
        condition = "area_path && CAST(:areas AS text[])"
        params["areas"] = areas or ["none"]
    rows = db.execute(
        text(f"{_CYCLE} WHERE {condition} ORDER BY created_at DESC LIMIT :limit"), params
    ).mappings()
    return [_cycle(row) for row in rows]


def insert_cycle(db: Session, values: dict[str, Any], area_key: str, area_path: list[str], min_age: int,
                 created_by: uuid.UUID) -> uuid.UUID:
    columns = ", ".join(CYCLE_FIELDS)
    params = ", ".join(f":{name}" for name in CYCLE_FIELDS)
    return db.scalar(
        text(
            f"""INSERT INTO engagement.pb_cycle ({columns}, area_key, area_path, min_age, created_by)
                VALUES ({params}, :area_key, :area_path, :min_age, :created_by) RETURNING id"""
        ),
        {**{name: values[name] for name in CYCLE_FIELDS}, "area_key": area_key, "area_path": area_path, "min_age": min_age,
         "created_by": created_by},
    )


def update_cycle(db: Session, cycle_id: uuid.UUID, values: dict[str, Any]) -> None:
    assignments = ", ".join(f"{name} = :{name}" for name in values)
    db.execute(
        text(f"UPDATE engagement.pb_cycle SET {assignments}, updated_at = clock_timestamp() WHERE id = :id"),
        {**values, "id": cycle_id},
    )


@dataclass(frozen=True)
class Project:
    id: uuid.UUID
    cycle_id: uuid.UUID
    proposal_id: uuid.UUID
    proposal_ref: str
    proposal_category: str
    proposal_area_key: str
    proposal_problem: str
    proposal_solution: str
    proposal_benefit: str
    title_en: str
    title_ta: str
    summary_en: str
    summary_ta: str
    estimated_cost: Decimal
    financial_review_ref: str | None
    financial_review_en: str | None
    financial_review_ta: str | None
    financial_reviewed_at: datetime | None
    legal_review_ref: str | None
    legal_review_en: str | None
    legal_review_ta: str | None
    legal_reviewed_at: datetime | None
    on_ballot: bool
    completed_on: date | None
    completion_evidence: str | None
    completion_en: str | None
    completion_ta: str | None
    created_at: datetime


_PROJECT = """
    SELECT p.id, p.cycle_id, p.proposal_id, d.proposal_ref, d.category AS proposal_category, d.area_key AS proposal_area_key,
           d.problem AS proposal_problem, d.solution AS proposal_solution, d.benefit AS proposal_benefit,
           p.title_en, p.title_ta, p.summary_en, p.summary_ta, p.estimated_cost,
           p.financial_review_ref, p.financial_review_en, p.financial_review_ta, p.financial_reviewed_at,
           p.legal_review_ref, p.legal_review_en, p.legal_review_ta, p.legal_reviewed_at,
           p.on_ballot, p.completed_on, p.completion_evidence, p.completion_en, p.completion_ta, p.created_at
    FROM engagement.pb_project p JOIN community.proposal d ON d.id = p.proposal_id
"""
PROJECT_FIELDS = ("title_en", "title_ta", "summary_en", "summary_ta", "estimated_cost")


def find_project(db: Session, project_id: uuid.UUID, *, lock: bool = False) -> Project | None:
    suffix = " FOR UPDATE OF p" if lock else ""
    row = db.execute(text(f"{_PROJECT} WHERE p.id = :id{suffix}"), {"id": project_id}).mappings().one_or_none()
    return Project(**row) if row else None


def projects(db: Session, cycle_id: uuid.UUID, *, on_ballot_only: bool) -> list[Project]:
    condition = " AND p.on_ballot" if on_ballot_only else ""
    rows = db.execute(
        text(f"{_PROJECT} WHERE p.cycle_id = :c{condition} ORDER BY d.proposal_ref"), {"c": cycle_id}
    ).mappings()
    return [Project(**row) for row in rows]


def insert_project(db: Session, cycle_id: uuid.UUID, proposal_id: uuid.UUID, values: dict[str, Any],
                   created_by: uuid.UUID) -> uuid.UUID | None:
    return db.scalar(
        text(
            """INSERT INTO engagement.pb_project (cycle_id, proposal_id, title_en, title_ta, summary_en, summary_ta,
                                                  estimated_cost, created_by)
               VALUES (:c, :p, :title_en, :title_ta, :summary_en, :summary_ta, :estimated_cost, :by)
               ON CONFLICT (cycle_id, proposal_id) DO NOTHING RETURNING id"""
        ),
        {"c": cycle_id, "p": proposal_id, **{name: values[name] for name in PROJECT_FIELDS}, "by": created_by},
    )


def update_project(db: Session, project_id: uuid.UUID, values: dict[str, Any]) -> None:
    assignments = ", ".join(f"{name} = :{name}" for name in values)
    db.execute(
        text(f"UPDATE engagement.pb_project SET {assignments}, updated_at = clock_timestamp() WHERE id = :id"),
        {**values, "id": project_id},
    )


@dataclass(frozen=True)
class Candidate:
    id: uuid.UUID
    proposal_ref: str
    title: str
    category: str
    area_key: str
    cost_estimate: Decimal | None


def candidate_proposals(db: Session, cycle_id: uuid.UUID, area_key: str, limit: int = 200) -> list[Candidate]:
    """FR-PBG-002: proposals approved for planning inside the cycle's area, not already in the cycle."""
    rows = db.execute(
        text(
            """
            SELECT d.id, d.proposal_ref, d.title, d.category, d.area_key, d.cost_estimate
            FROM community.proposal d
            WHERE d.stage = 'approved_for_planning' AND :area = ANY(d.area_path)
              AND NOT EXISTS (SELECT 1 FROM engagement.pb_project p WHERE p.cycle_id = :c AND p.proposal_id = d.id)
            ORDER BY d.proposal_ref LIMIT :limit
            """
        ),
        {"area": area_key, "c": cycle_id, "limit": limit},
    ).mappings()
    return [Candidate(**row) for row in rows]


@dataclass(frozen=True)
class Certification:
    certified_by: uuid.UUID
    ballot_count: int
    chain_head: str
    tally_hash: str
    certified_at: datetime


def certifications(db: Session, cycle_id: uuid.UUID) -> list[Certification]:
    rows = db.execute(
        text("""SELECT certified_by, ballot_count, chain_head, tally_hash, certified_at FROM engagement.pb_certification
                WHERE cycle_id = :c ORDER BY certified_at"""),
        {"c": cycle_id},
    ).mappings()
    return [Certification(**row) for row in rows]


def insert_certification(db: Session, cycle_id: uuid.UUID, certified_by: uuid.UUID, ballot_count: int, chain_head: str,
                         tally: str) -> None:
    db.execute(
        text("""INSERT INTO engagement.pb_certification (cycle_id, certified_by, ballot_count, chain_head, tally_hash)
                VALUES (:c, :by, :n, :head, :tally)"""),
        {"c": cycle_id, "by": certified_by, "n": ballot_count, "head": chain_head, "tally": tally},
    )


@dataclass(frozen=True)
class Result:
    project_id: uuid.UUID
    votes: int
    rank: int
    funded: bool


def results(db: Session, cycle_id: uuid.UUID) -> list[Result]:
    rows = db.execute(
        text("SELECT project_id, votes, rank, funded FROM engagement.pb_result WHERE cycle_id = :c ORDER BY rank"),
        {"c": cycle_id},
    ).mappings()
    return [Result(**row) for row in rows]


def insert_result(db: Session, cycle_id: uuid.UUID, project_id: uuid.UUID, votes: int, rank: int, funded: bool) -> None:
    db.execute(
        text("""INSERT INTO engagement.pb_result (cycle_id, project_id, votes, rank, funded)
                VALUES (:c, :p, :v, :r, :f)"""),
        {"c": cycle_id, "p": project_id, "v": votes, "r": rank, "f": funded},
    )


@dataclass(frozen=True)
class Allocation:
    project_id: uuid.UUID
    amount: Decimal
    fund_kind: str
    fund_source: str
    recorded_at: datetime


def allocations(db: Session, cycle_id: uuid.UUID) -> list[Allocation]:
    rows = db.execute(
        text("""SELECT project_id, amount, fund_kind, fund_source, recorded_at FROM finance.pb_allocation
                WHERE cycle_id = :c ORDER BY recorded_at"""),
        {"c": cycle_id},
    ).mappings()
    return [Allocation(**row) for row in rows]


def insert_allocation(db: Session, cycle_id: uuid.UUID, project_id: uuid.UUID, amount: Decimal, fund_kind: str,
                      fund_source: str, recorded_by: uuid.UUID) -> None:
    db.execute(
        text("""INSERT INTO finance.pb_allocation (cycle_id, project_id, amount, fund_kind, fund_source, recorded_by)
                VALUES (:c, :p, :amount, :kind, :source, :by)"""),
        {"c": cycle_id, "p": project_id, "amount": amount, "kind": fund_kind, "source": fund_source, "by": recorded_by},
    )


@dataclass(frozen=True)
class Expenditure:
    id: uuid.UUID
    project_id: uuid.UUID
    amount: Decimal
    spent_on: date
    description_en: str
    description_ta: str
    evidence_ref: str
    recorded_at: datetime


def expenditures(db: Session, project_ids: list[uuid.UUID]) -> list[Expenditure]:
    if not project_ids:
        return []
    rows = db.execute(
        text("""SELECT id, project_id, amount, spent_on, description_en, description_ta, evidence_ref, recorded_at
                FROM finance.pb_expenditure WHERE project_id = ANY(:ids) ORDER BY spent_on, recorded_at"""),
        {"ids": project_ids},
    ).mappings()
    return [Expenditure(**row) for row in rows]


def insert_expenditure(db: Session, project_id: uuid.UUID, values: dict[str, Any], recorded_by: uuid.UUID) -> uuid.UUID:
    return db.scalar(
        text("""INSERT INTO finance.pb_expenditure (project_id, amount, spent_on, description_en, description_ta,
                                                     evidence_ref, recorded_by)
                VALUES (:p, :amount, :spent_on, :description_en, :description_ta, :evidence_ref, :by) RETURNING id"""),
        {"p": project_id, **values, "by": recorded_by},
    )


def eligible_count(db: Session, area_key: str, min_age: int, today: date) -> int:
    """KPI-33: members who could vote when voting closed (OD-36), counted once, never listed."""
    return db.scalar(
        text(
            """
            SELECT count(*) FROM npm.member m
            JOIN membership.membership ms ON ms.member_id = m.id AND ms.state = 'active'
            WHERE m.deleted_at IS NULL AND m.verification_status = 'identity_confirmed'
              AND m.dob IS NOT NULL AND m.dob <= (CAST(:today AS date) - make_interval(years => :age))
              AND :area IN ('gn:' || m.gs_code, 'ds:' || m.ds_code, 'district:' || m.district_code,
                            (SELECT 'province:' || d.province_code FROM geo.district d WHERE d.district_code = m.district_code))
            """
        ),
        {"today": today, "age": min_age, "area": area_key},
    ) or 0


def member_birth_date(db: Session, member_id: uuid.UUID) -> date | None:
    return db.scalar(text("SELECT dob FROM npm.member WHERE id = :id AND deleted_at IS NULL"), {"id": member_id})


def holders(db: Session, permission: str, area_path: list[str]) -> list[uuid.UUID]:
    return list(
        db.scalars(
            text(
                """
                SELECT DISTINCT a.member_id FROM access.staff_assignment a
                JOIN membership.membership ms ON ms.member_id = a.member_id AND ms.state = 'active'
                WHERE a.state = 'active' AND :permission = ANY(a.permissions)
                  AND (a.review_due_at IS NULL OR a.review_due_at > now())
                  AND (a.area_level = 'platform' OR (a.area_level || ':' || a.area_code) = ANY(:path))
                """
            ),
            {"permission": permission, "path": area_path},
        )
    )


def retention_due(db: Session, before: datetime) -> list[uuid.UUID]:
    """Cycles whose results were certified (or that were cancelled) before this moment."""
    return list(
        db.scalars(
            text(
                """
                SELECT c.id FROM engagement.pb_cycle c
                WHERE (c.status IN ('results_certified', 'allocated', 'implemented')
                       AND (SELECT max(certified_at) FROM engagement.pb_certification x WHERE x.cycle_id = c.id) < :before)
                   OR (c.status = 'cancelled' AND c.updated_at < :before)
                """
            ),
            {"before": before},
        )
    )
