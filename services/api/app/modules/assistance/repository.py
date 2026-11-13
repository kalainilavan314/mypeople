"""SQL for Community Support. Every function opens the row-level firewall for its own transaction
first: without that, assistance rows are invisible to the database session (Alembic 0038)."""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


def _open(db: Session) -> None:
    db.execute(text("SELECT set_config('assistance.firewall', 'open', true)"))


# --- Programmes, criteria and partners (D14) -------------------------------------------------------------


@dataclass(frozen=True)
class Programme:
    id: uuid.UUID
    name_en: str
    name_ta: str
    description_en: str
    description_ta: str
    categories: list[str]
    active: bool
    created_at: datetime
    criteria_version_id: uuid.UUID | None
    criteria_version: int | None
    criteria_en: str | None
    criteria_ta: str | None


_PROGRAMME = """
    SELECT p.id, p.name_en, p.name_ta, p.description_en, p.description_ta, p.categories, p.active, p.created_at,
           c.id AS criteria_version_id, c.version AS criteria_version, c.criteria_en, c.criteria_ta
    FROM assistance.programme p
    LEFT JOIN LATERAL (SELECT * FROM assistance.criteria_version v WHERE v.programme_id = p.id
                       ORDER BY v.version DESC LIMIT 1) c ON TRUE
"""


def _programme(row: Any) -> Programme:
    return Programme(**{**row, "categories": list(row["categories"])})


def programmes(db: Session, *, active_only: bool) -> list[Programme]:
    _open(db)
    condition = "WHERE p.active" if active_only else ""
    return [_programme(row) for row in db.execute(text(f"{_PROGRAMME} {condition} ORDER BY p.name_en")).mappings()]


def find_programme(db: Session, programme_id: uuid.UUID) -> Programme | None:
    _open(db)
    row = db.execute(text(f"{_PROGRAMME} WHERE p.id = :id"), {"id": programme_id}).mappings().one_or_none()
    return _programme(row) if row else None


def insert_programme(db: Session, values: dict[str, Any], created_by: uuid.UUID) -> uuid.UUID:
    _open(db)
    return db.scalar(
        text("""INSERT INTO assistance.programme (name_en, name_ta, description_en, description_ta, categories, created_by)
                VALUES (:name_en, :name_ta, :description_en, :description_ta, :categories, :by) RETURNING id"""),
        {**values, "by": created_by},
    )


def set_programme_active(db: Session, programme_id: uuid.UUID, active: bool) -> None:
    _open(db)
    db.execute(text("UPDATE assistance.programme SET active = :a WHERE id = :id"), {"a": active, "id": programme_id})


def publish_criteria(db: Session, programme_id: uuid.UUID, criteria_en: str, criteria_ta: str, by: uuid.UUID) -> uuid.UUID:
    _open(db)
    return db.scalar(
        text(
            """INSERT INTO assistance.criteria_version (programme_id, version, criteria_en, criteria_ta, published_by)
               VALUES (:p, (SELECT COALESCE(max(version), 0) + 1 FROM assistance.criteria_version WHERE programme_id = :p),
                       :en, :ta, :by) RETURNING id"""
        ),
        {"p": programme_id, "en": criteria_en, "ta": criteria_ta, "by": by},
    )


@dataclass(frozen=True)
class CriteriaFacts:
    """What D13 needs to know about a criteria version a decision cites."""

    latest: bool
    active: bool
    categories: list[str]


def criteria_facts(db: Session, criteria_version_id: uuid.UUID) -> CriteriaFacts | None:
    _open(db)
    row = db.execute(
        text(
            """SELECT v.version = (SELECT max(o.version) FROM assistance.criteria_version o WHERE o.programme_id = v.programme_id)
                          AS latest,
                      p.active, p.categories
               FROM assistance.criteria_version v JOIN assistance.programme p ON p.id = v.programme_id
               WHERE v.id = :id"""
        ),
        {"id": criteria_version_id},
    ).mappings().one_or_none()
    return CriteriaFacts(latest=row["latest"], active=row["active"], categories=list(row["categories"])) if row else None


@dataclass(frozen=True)
class Partner:
    id: uuid.UUID
    name: str
    kind: str
    contact: str
    active: bool


def partners(db: Session, *, active_only: bool) -> list[Partner]:
    _open(db)
    condition = "WHERE active" if active_only else ""
    rows = db.execute(text(f"SELECT id, name, kind, contact, active FROM assistance.partner {condition} ORDER BY name")).mappings()
    return [Partner(**row) for row in rows]


def find_partner(db: Session, partner_id: uuid.UUID) -> Partner | None:
    _open(db)
    row = db.execute(text("SELECT id, name, kind, contact, active FROM assistance.partner WHERE id = :id"),
                     {"id": partner_id}).mappings().one_or_none()
    return Partner(**row) if row else None


def insert_partner(db: Session, name: str, kind: str, contact: str, created_by: uuid.UUID) -> uuid.UUID:
    _open(db)
    return db.scalar(
        text("INSERT INTO assistance.partner (name, kind, contact, created_by) VALUES (:n, :k, :c, :by) RETURNING id"),
        {"n": name, "k": kind, "c": contact, "by": created_by},
    )


# --- Applicants and cases -----------------------------------------------------------------------------------


def insert_applicant(db: Session, *, member_id: uuid.UUID | None, full_name: str, phone: str | None, household: str | None,
                     area_key: str, area_path: list[str]) -> uuid.UUID:
    _open(db)
    return db.scalar(
        text("""INSERT INTO assistance.applicant (member_id, full_name, phone, household, area_key, area_path)
                VALUES (:m, :n, :p, :h, :k, :path) RETURNING id"""),
        {"m": member_id, "n": full_name, "p": phone, "h": household, "k": area_key, "path": area_path},
    )


def insert_case(db: Session, *, case_ref: str, applicant_id: uuid.UUID, category: str, emergency: bool, summary: str,
                channel: str, partner_id: uuid.UUID | None, area_key: str, area_path: list[str], source_ip: str | None,
                created_by: uuid.UUID | None) -> uuid.UUID:
    _open(db)
    return db.scalar(
        text(
            """INSERT INTO assistance.case (case_ref, applicant_id, category, emergency, summary, channel, partner_id,
                                            consent_at, area_key, area_path, source_ip, created_by)
               VALUES (:ref, :a, :cat, :em, :sum, :ch, :p, clock_timestamp(), :k, :path, :ip, :by) RETURNING id"""
        ),
        {"ref": case_ref, "a": applicant_id, "cat": category, "em": emergency, "sum": summary, "ch": channel,
         "p": partner_id, "k": area_key, "path": area_path, "ip": source_ip, "by": created_by},
    )


@dataclass(frozen=True)
class Case:
    id: uuid.UUID
    case_ref: str
    applicant_id: uuid.UUID
    applicant_member_id: uuid.UUID | None
    applicant_name: str
    applicant_phone: str | None
    household: str | None
    category: str
    emergency: bool
    summary: str
    channel: str
    partner_id: uuid.UUID | None
    state: str
    caseworker_id: uuid.UUID | None
    caseworker_name: str | None
    linked_case_ref: str | None
    area_key: str
    area_path: list[str]
    created_at: datetime
    updated_at: datetime
    closed_at: datetime | None


_CASE = """
    SELECT c.id, c.case_ref, c.applicant_id, a.member_id AS applicant_member_id, a.full_name AS applicant_name,
           a.phone AS applicant_phone, a.household, c.category, c.emergency, c.summary, c.channel, c.partner_id, c.state,
           c.caseworker_id, w.full_name AS caseworker_name, l.case_ref AS linked_case_ref, c.area_key, c.area_path,
           c.created_at, c.updated_at, c.closed_at
    FROM assistance.case c
    JOIN assistance.applicant a ON a.id = c.applicant_id
    LEFT JOIN npm.member w ON w.id = c.caseworker_id
    LEFT JOIN assistance.case l ON l.id = c.linked_case_id
"""


def _case(row: Any) -> Case:
    return Case(**{**row, "area_path": list(row["area_path"])})


def find_case(db: Session, case_id: uuid.UUID, *, lock: bool = False) -> Case | None:
    _open(db)
    row = db.execute(text(f"{_CASE} WHERE c.id = :id{' FOR UPDATE OF c' if lock else ''}"), {"id": case_id}).mappings().one_or_none()
    return _case(row) if row else None


def member_cases(db: Session, member_id: uuid.UUID) -> list[Case]:
    _open(db)
    rows = db.execute(text(f"{_CASE} WHERE a.member_id = :m ORDER BY c.created_at DESC"), {"m": member_id}).mappings()
    return [_case(row) for row in rows]


def staff_cases(db: Session, *, areas: list[str] | None, caseworker: uuid.UUID | None, states: list[str] | None,
                screening_or_assigned_to: uuid.UUID | None, limit: int) -> list[Case]:
    _open(db)
    conditions, params = ["TRUE"], {"limit": limit}
    if areas is not None:
        conditions.append("c.area_path && CAST(:areas AS text[])")
        params["areas"] = areas or ["none"]
    if caseworker is not None:
        conditions.append("c.caseworker_id = :w")
        params["w"] = caseworker
    if screening_or_assigned_to is not None:
        conditions.append("(c.state = 'screening' AND c.caseworker_id IS NULL OR c.caseworker_id = :viewer)")
        params["viewer"] = screening_or_assigned_to
    if states:
        conditions.append("c.state = ANY(:states)")
        params["states"] = states
    rows = db.execute(
        text(f"{_CASE} WHERE {' AND '.join(conditions)} ORDER BY c.emergency DESC, c.created_at LIMIT :limit"), params
    ).mappings()
    return [_case(row) for row in rows]


def update_case(db: Session, case_id: uuid.UUID, values: dict[str, Any]) -> None:
    _open(db)
    assignments = ", ".join(f"{name} = :{name}" for name in values)
    db.execute(text(f"UPDATE assistance.case SET {assignments}, updated_at = clock_timestamp() WHERE id = :id"),
               {**values, "id": case_id})


def _normal_name(sql: str) -> str:
    """Names compare without case, dots, commas or extra spaces: "S. Kumar" is "s kumar"."""
    return rf"lower(btrim(regexp_replace({sql}, '[\s.,]+', ' ', 'g')))"


def _normal_phone(sql: str) -> str:
    """Phones compare by their digits, with +94 read as 0: "+94 77 123 4567" is "0771234567"."""
    return rf"regexp_replace(regexp_replace({sql}, '[^0-9]', '', 'g'), '^94([0-9]{{9}})$', '0\1')"


def possible_duplicates(db: Session, case: Case) -> list[Case]:
    """FR-AST-006, S11: other requests in the 30 days around this one from the same applicant: the same
    phone, the same app account, or the same name. The household is free text ("2 adults, 3 children")
    that many unrelated families share, so it never makes a match on its own."""
    _open(db)
    rows = db.execute(
        text(
            f"""{_CASE} WHERE c.id <> :id AND c.created_at > :created - interval '30 days'
                AND ((a.member_id IS NOT NULL AND a.member_id = :member)
                     OR (a.phone IS NOT NULL AND {_normal_phone('a.phone')} = {_normal_phone('CAST(:phone AS text)')})
                     OR {_normal_name('a.full_name')} = {_normal_name('CAST(:name AS text)')})
                ORDER BY c.created_at DESC LIMIT 10"""
        ),
        {"id": case.id, "created": case.created_at, "phone": case.applicant_phone, "name": case.applicant_name,
         "member": case.applicant_member_id},
    ).mappings()
    return [_case(row) for row in rows]


def count_from_ip(db: Session, ip: str) -> int:
    _open(db)
    return db.scalar(
        text("SELECT count(*) FROM assistance.case WHERE source_ip = :ip AND created_at > now() - interval '1 hour'"),
        {"ip": ip},
    ) or 0


# --- The case record ---------------------------------------------------------------------------------------


def add_note(db: Session, case_id: uuid.UUID, author: uuid.UUID, body: str) -> None:
    _open(db)
    db.execute(text("INSERT INTO assistance.case_note (case_id, author_id, body) VALUES (:c, :a, :b)"),
               {"c": case_id, "a": author, "b": body})


def notes(db: Session, case_id: uuid.UUID) -> list[dict[str, Any]]:
    _open(db)
    rows = db.execute(
        text("""SELECT n.body, n.created_at, m.full_name AS author FROM assistance.case_note n
                JOIN npm.member m ON m.id = n.author_id WHERE n.case_id = :c ORDER BY n.created_at"""),
        {"c": case_id},
    ).mappings()
    return [dict(row) for row in rows]


@dataclass(frozen=True)
class Decision:
    id: uuid.UUID
    outcome: str
    criteria_version_id: uuid.UUID
    criteria_version: int
    programme_name_en: str
    reason_en: str
    reason_ta: str
    decided_by: uuid.UUID
    replaces_id: uuid.UUID | None
    decided_at: datetime


def decisions(db: Session, case_id: uuid.UUID) -> list[Decision]:
    _open(db)
    rows = db.execute(
        text(
            """SELECT d.id, d.outcome, d.criteria_version_id, v.version AS criteria_version, p.name_en AS programme_name_en,
                      d.reason_en, d.reason_ta, d.decided_by, d.replaces_id, d.decided_at
               FROM assistance.decision d JOIN assistance.criteria_version v ON v.id = d.criteria_version_id
               JOIN assistance.programme p ON p.id = v.programme_id WHERE d.case_id = :c ORDER BY d.decided_at"""
        ),
        {"c": case_id},
    ).mappings()
    return [Decision(**row) for row in rows]


def insert_decision(db: Session, case_id: uuid.UUID, outcome: str, criteria_version_id: uuid.UUID, reason_en: str,
                    reason_ta: str, decided_by: uuid.UUID, replaces_id: uuid.UUID | None = None) -> uuid.UUID:
    _open(db)
    return db.scalar(
        text("""INSERT INTO assistance.decision (case_id, outcome, criteria_version_id, reason_en, reason_ta, decided_by,
                                                  replaces_id)
                VALUES (:c, :o, :v, :en, :ta, :by, :r) RETURNING id"""),
        {"c": case_id, "o": outcome, "v": criteria_version_id, "en": reason_en, "ta": reason_ta, "by": decided_by,
         "r": replaces_id},
    )


def add_delivery(db: Session, case_id: uuid.UUID, kind: str, amount: str, delivered_on: date, provider: str,
                 evidence: str, by: uuid.UUID) -> None:
    _open(db)
    db.execute(
        text("""INSERT INTO assistance.delivery (case_id, kind, amount, delivered_on, provider, evidence, recorded_by)
                VALUES (:c, :k, :a, :d, :p, :e, :by)"""),
        {"c": case_id, "k": kind, "a": amount, "d": delivered_on, "p": provider, "e": evidence, "by": by},
    )


def deliveries(db: Session, case_id: uuid.UUID) -> list[dict[str, Any]]:
    _open(db)
    rows = db.execute(
        text("""SELECT kind, amount, delivered_on, provider, evidence, created_at FROM assistance.delivery
                WHERE case_id = :c ORDER BY delivered_on, created_at"""),
        {"c": case_id},
    ).mappings()
    return [dict(row) for row in rows]


def add_referral(db: Session, case_id: uuid.UUID, partner_id: uuid.UUID, purpose: str, by: uuid.UUID, *,
                 caseworker_consent: bool) -> uuid.UUID:
    """Sent at once with the consent the caseworker recorded, or proposed to wait for the applicant's."""
    _open(db)
    return db.scalar(
        text("""INSERT INTO assistance.referral (case_id, partner_id, purpose, state, consent_at, consent_recorded_by, created_by)
                VALUES (:c, :p, :purpose, CASE WHEN :consented THEN 'sent' ELSE 'proposed' END,
                        CASE WHEN :consented THEN clock_timestamp() END, CASE WHEN :consented THEN 'caseworker' END, :by)
                RETURNING id"""),
        {"c": case_id, "p": partner_id, "purpose": purpose, "consented": caseworker_consent, "by": by},
    )


def referral_state(db: Session, referral_id: uuid.UUID, case_id: uuid.UUID, *, lock: bool = False) -> str | None:
    _open(db)
    return db.scalar(
        text(f"SELECT state FROM assistance.referral WHERE id = :id AND case_id = :c{' FOR UPDATE' if lock else ''}"),
        {"id": referral_id, "c": case_id},
    )


def answer_referral(db: Session, referral_id: uuid.UUID, consent: bool) -> None:
    """The applicant's own answer: consent shares the case with the partner, a refusal keeps it closed."""
    _open(db)
    db.execute(
        text("""UPDATE assistance.referral
                SET state = CASE WHEN :consent THEN 'sent' ELSE 'consent_declined' END,
                    consent_at = CASE WHEN :consent THEN clock_timestamp() END,
                    consent_recorded_by = CASE WHEN :consent THEN 'applicant' END,
                    updated_at = clock_timestamp()
                WHERE id = :id AND state = 'proposed'"""),
        {"consent": consent, "id": referral_id},
    )


def update_referral(db: Session, referral_id: uuid.UUID, case_id: uuid.UUID, state: str, outcome: str | None) -> bool:
    _open(db)
    return db.execute(
        text("""UPDATE assistance.referral SET state = :s, outcome = :o, updated_at = clock_timestamp()
                WHERE id = :id AND case_id = :c"""),
        {"s": state, "o": outcome, "id": referral_id, "c": case_id},
    ).rowcount > 0


def referrals(db: Session, case_id: uuid.UUID) -> list[dict[str, Any]]:
    _open(db)
    rows = db.execute(
        text("""SELECT r.id, p.name AS partner, p.kind, r.purpose, r.state, r.outcome, r.consent_at, r.consent_recorded_by,
                       r.created_at
                FROM assistance.referral r JOIN assistance.partner p ON p.id = r.partner_id
                WHERE r.case_id = :c ORDER BY r.created_at"""),
        {"c": case_id},
    ).mappings()
    return [dict(row) for row in rows]


@dataclass(frozen=True)
class Appeal:
    id: uuid.UUID
    decision_id: uuid.UUID
    case_id: uuid.UUID
    case_ref: str
    kind: str
    body: str
    state: str
    due_at: datetime
    reason: str | None
    created_at: datetime
    decided_at: datetime | None


_APPEAL = """SELECT a.id, a.decision_id, a.case_id, c.case_ref, a.kind, a.body, a.state, a.due_at, a.reason, a.created_at,
                     a.decided_at FROM assistance.appeal a JOIN assistance.case c ON c.id = a.case_id"""


def appeals(db: Session, case_id: uuid.UUID) -> list[Appeal]:
    _open(db)
    return [Appeal(**row) for row in db.execute(text(f"{_APPEAL} WHERE a.case_id = :c ORDER BY a.created_at"), {"c": case_id}).mappings()]


def find_appeal(db: Session, appeal_id: uuid.UUID) -> Appeal | None:
    _open(db)
    row = db.execute(text(f"{_APPEAL} WHERE a.id = :id"), {"id": appeal_id}).mappings().one_or_none()
    return Appeal(**row) if row else None


def appeal_for(db: Session, decision_id: uuid.UUID) -> Appeal | None:
    _open(db)
    row = db.execute(text(f"{_APPEAL} WHERE a.decision_id = :d"), {"d": decision_id}).mappings().one_or_none()
    return Appeal(**row) if row else None


def insert_appeal(db: Session, decision_id: uuid.UUID, case_id: uuid.UUID, kind: str, body: str, due_at: datetime) -> uuid.UUID:
    _open(db)
    return db.scalar(
        text("""INSERT INTO assistance.appeal (decision_id, case_id, kind, body, due_at) VALUES (:d, :c, :k, :b, :due)
                RETURNING id"""),
        {"d": decision_id, "c": case_id, "k": kind, "b": body, "due": due_at},
    )


def decide_appeal(db: Session, appeal_id: uuid.UUID, state: str, decided_by: uuid.UUID, reason: str) -> None:
    _open(db)
    db.execute(
        text("""UPDATE assistance.appeal SET state = :s, decided_by = :by, reason = :r, decided_at = clock_timestamp()
                WHERE id = :id"""),
        {"s": state, "by": decided_by, "r": reason, "id": appeal_id},
    )


def open_appeals(db: Session, areas: list[str] | None) -> list[Appeal]:
    _open(db)
    condition, params = "a.state = 'open'", {}
    if areas is not None:
        condition += " AND c.area_path && CAST(:areas AS text[])"
        params["areas"] = areas or ["none"]
    return [Appeal(**row) for row in db.execute(text(f"{_APPEAL} WHERE {condition} ORDER BY a.due_at"), params).mappings()]


def statistics(db: Session, areas: list[str] | None) -> list[tuple[str | None, str | None, str, str, int]]:
    """(district, DS division, category, state, count) for FR-AST-012."""
    _open(db)
    condition, params = "TRUE", {}
    if areas is not None:
        condition = "c.area_path && CAST(:areas AS text[])"
        params["areas"] = areas or ["none"]
    rows = db.execute(
        text(
            f"""SELECT (SELECT substring(k FROM 10) FROM unnest(c.area_path) k WHERE k LIKE 'district:%' LIMIT 1) AS district,
                       (SELECT substring(k FROM 4) FROM unnest(c.area_path) k WHERE k LIKE 'ds:%' LIMIT 1) AS ds,
                       c.category, c.state, count(*) AS n
                FROM assistance.case c WHERE {condition} GROUP BY 1, 2, 3, 4"""
        ),
        params,
    )
    return [(row.district, row.ds, row.category, row.state, row.n) for row in rows]


def staff_holders(db: Session, permission: str, area_path: list[str]) -> list[tuple[uuid.UUID, str]]:
    rows = db.execute(
        text(
            """SELECT DISTINCT a.member_id, m.full_name FROM access.staff_assignment a
               JOIN npm.member m ON m.id = a.member_id
               JOIN membership.membership ms ON ms.member_id = a.member_id AND ms.state = 'active'
               WHERE a.state = 'active' AND :permission = ANY(a.permissions)
                 AND (a.review_due_at IS NULL OR a.review_due_at > now())
                 AND (a.area_level = 'platform' OR (a.area_level || ':' || a.area_code) = ANY(:path))"""
        ),
        {"permission": permission, "path": area_path},
    )
    return sorted(((row.member_id, row.full_name) for row in rows), key=lambda h: h[1])
