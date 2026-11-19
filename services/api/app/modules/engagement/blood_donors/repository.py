"""SQL for the blood donor network (Alembic 0048). Every function opens the donors firewall for its own
transaction first: without that, donor rows are invisible, so no other module, report or ad-hoc join can
list or search donors (FR-BLD-002)."""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


def _open(db: Session) -> None:
    db.execute(text("SELECT set_config('donors.firewall', 'open', true)"))


# --- Partners and their requesters (PRM-55) ------------------------------------------------------------------


@dataclass(frozen=True)
class Partner:
    id: uuid.UUID
    name: str
    kind: str
    district_key: str
    agreement_ref: str
    active: bool
    created_at: datetime


_PARTNER = "SELECT id, name, kind, district_key, agreement_ref, active, created_at FROM donors.partner"


def partners(db: Session) -> list[Partner]:
    _open(db)
    return [Partner(**row) for row in db.execute(text(f"{_PARTNER} ORDER BY name")).mappings()]


def find_partner(db: Session, partner_id: uuid.UUID, *, lock: bool = False) -> Partner | None:
    _open(db)
    row = db.execute(text(f"{_PARTNER} WHERE id = :id{' FOR UPDATE' if lock else ''}"), {"id": partner_id}).mappings().one_or_none()
    return Partner(**row) if row else None


def insert_partner(db: Session, *, name: str, kind: str, district_key: str, agreement_ref: str, by: uuid.UUID) -> uuid.UUID:
    _open(db)
    return db.scalar(
        text("""INSERT INTO donors.partner (name, kind, district_key, agreement_ref, created_by)
                VALUES (:name, :kind, :district, :agreement, :by) RETURNING id"""),
        {"name": name, "kind": kind, "district": district_key, "agreement": agreement_ref, "by": by},
    )


def set_partner_active(db: Session, partner_id: uuid.UUID, active: bool) -> None:
    _open(db)
    db.execute(text("UPDATE donors.partner SET active = :a WHERE id = :id"), {"a": active, "id": partner_id})


@dataclass(frozen=True)
class Requester:
    id: uuid.UUID
    partner_id: uuid.UUID
    member_id: uuid.UUID
    full_name: str
    member_code: str
    granted_at: datetime
    revoked_at: datetime | None


_REQUESTER = """SELECT r.id, r.partner_id, r.member_id, m.full_name, m.member_code, r.granted_at, r.revoked_at
                FROM donors.requester r JOIN npm.member m ON m.id = r.member_id"""


def active_requester(db: Session, member_id: uuid.UUID) -> tuple[Requester, Partner] | None:
    """The account's authorisation to raise requests, while both it and its partner are active."""
    _open(db)
    row = db.execute(text(f"{_REQUESTER} WHERE r.member_id = :m AND r.revoked_at IS NULL"), {"m": member_id}).mappings().one_or_none()
    if row is None:
        return None
    partner = find_partner(db, row["partner_id"])
    if partner is None or not partner.active:
        return None
    return Requester(**row), partner


def requesters(db: Session) -> list[Requester]:
    _open(db)
    return [Requester(**row) for row in db.execute(text(f"{_REQUESTER} ORDER BY r.revoked_at NULLS FIRST, m.full_name")).mappings()]


def find_requester(db: Session, requester_id: uuid.UUID) -> Requester | None:
    _open(db)
    row = db.execute(text(f"{_REQUESTER} WHERE r.id = :id"), {"id": requester_id}).mappings().one_or_none()
    return Requester(**row) if row else None


def insert_requester(db: Session, partner_id: uuid.UUID, member_id: uuid.UUID, by: uuid.UUID) -> uuid.UUID:
    _open(db)
    return db.scalar(
        text("INSERT INTO donors.requester (partner_id, member_id, granted_by) VALUES (:p, :m, :by) RETURNING id"),
        {"p": partner_id, "m": member_id, "by": by},
    )


def revoke_requester(db: Session, requester_id: uuid.UUID, by: uuid.UUID) -> None:
    _open(db)
    db.execute(text("UPDATE donors.requester SET revoked_at = clock_timestamp(), revoked_by = :by WHERE id = :id"),
               {"by": by, "id": requester_id})


def requester_members(db: Session, partner_id: uuid.UUID) -> list[uuid.UUID]:
    _open(db)
    return list(db.scalars(text("SELECT member_id FROM donors.requester WHERE partner_id = :p AND revoked_at IS NULL"),
                           {"p": partner_id}))


def member_by_code(db: Session, member_code: str) -> tuple[uuid.UUID, bool] | None:
    """An account by its member code, and whether a reviewer has confirmed its identity."""
    row = db.execute(
        text("SELECT id, verification_status FROM npm.member WHERE upper(member_code) = upper(:c) AND deleted_at IS NULL"),
        {"c": member_code.strip()},
    ).one_or_none()
    return (row.id, row.verification_status == "identity_confirmed") if row else None


# --- Donors (ENT-55) ------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Donor:
    member_id: uuid.UUID
    blood_group: str
    area_key: str
    area_path: list[str]
    contact_name: str
    contact_phone: str
    contact_methods: list[str]
    available: bool
    paused_until: date | None
    consented_at: datetime
    updated_at: datetime


def find_donor(db: Session, member_id: uuid.UUID) -> Donor | None:
    _open(db)
    row = db.execute(
        text("""SELECT member_id, blood_group, area_key, area_path, contact_name, contact_phone, contact_methods, available, paused_until,
                       consented_at, updated_at FROM donors.donor WHERE member_id = :m"""),
        {"m": member_id},
    ).mappings().one_or_none()
    return Donor(**{**row, "area_path": list(row["area_path"]), "contact_methods": list(row["contact_methods"])}) if row else None


def save_donor(db: Session, member_id: uuid.UUID, values: dict[str, Any], area_key: str, area_path: list[str],
               consent_version: str) -> None:
    _open(db)
    db.execute(
        text(
            """INSERT INTO donors.donor (member_id, blood_group, area_key, area_path, contact_name, contact_phone, contact_methods,
                                         available, paused_until, consent_version, consented_at)
               VALUES (:m, :blood_group, :area_key, :area_path, :contact_name, :contact_phone, :contact_methods, :available,
                       :paused_until, :consent, clock_timestamp())
               ON CONFLICT (member_id) DO UPDATE SET blood_group = EXCLUDED.blood_group, area_key = EXCLUDED.area_key,
                   area_path = EXCLUDED.area_path, contact_name = EXCLUDED.contact_name,
                   contact_phone = EXCLUDED.contact_phone, contact_methods = EXCLUDED.contact_methods,
                   available = EXCLUDED.available, paused_until = EXCLUDED.paused_until,
                   consent_version = EXCLUDED.consent_version, consented_at = EXCLUDED.consented_at,
                   updated_at = clock_timestamp()"""
        ),
        {**values, "m": member_id, "area_key": area_key, "area_path": area_path, "consent": consent_version},
    )


def delete_donor(db: Session, member_id: uuid.UUID) -> bool:
    """FR-BLD-007: the donor record and every answer they gave go at once. The requests keep only their counts."""
    _open(db)
    db.execute(text("DELETE FROM donors.response WHERE member_id = :m"), {"m": member_id})
    return db.execute(text("DELETE FROM donors.donor WHERE member_id = :m"), {"m": member_id}).rowcount > 0


# --- Requests and answers (ENT-56) --------------------------------------------------------------------------


@dataclass(frozen=True)
class Request:
    id: uuid.UUID
    request_ref: str
    partner_id: uuid.UUID
    partner_name: str
    partner_kind: str
    raised_by: uuid.UUID
    blood_group: str
    area_key: str
    area_path: list[str]
    units: int
    urgency: str
    needed_by: datetime
    state: str
    over_limit: bool
    decision_reason: str | None
    outcome: str | None
    notified: int
    accepted: int
    declined: int
    created_at: datetime
    closed_at: datetime | None


_REQUEST = """
    SELECT q.id, q.request_ref, q.partner_id, p.name AS partner_name, p.kind AS partner_kind, q.raised_by, q.blood_group,
           q.area_key, q.area_path, q.units, q.urgency, q.needed_by, q.state, q.over_limit, q.decision_reason, q.outcome,
           q.notified, q.accepted, q.declined, q.created_at, q.closed_at
    FROM donors.request q JOIN donors.partner p ON p.id = q.partner_id
"""


def _request(row: Any) -> Request:
    return Request(**{**row, "area_path": list(row["area_path"])})


def find_request(db: Session, request_id: uuid.UUID, *, lock: bool = False) -> Request | None:
    _open(db)
    row = db.execute(text(f"{_REQUEST} WHERE q.id = :id{' FOR UPDATE OF q' if lock else ''}"), {"id": request_id}).mappings().one_or_none()
    return _request(row) if row else None


def partner_requests(db: Session, partner_id: uuid.UUID, limit: int = 200) -> list[Request]:
    _open(db)
    rows = db.execute(text(f"{_REQUEST} WHERE q.partner_id = :p ORDER BY q.created_at DESC LIMIT :limit"),
                      {"p": partner_id, "limit": limit}).mappings()
    return [_request(row) for row in rows]


def all_requests(db: Session, *, awaiting_only: bool, limit: int = 200) -> list[Request]:
    _open(db)
    condition = "q.state = 'awaiting_approval'" if awaiting_only else "TRUE"
    rows = db.execute(text(f"{_REQUEST} WHERE {condition} ORDER BY q.created_at DESC LIMIT :limit"), {"limit": limit}).mappings()
    return [_request(row) for row in rows]


def count_since(db: Session, partner_id: uuid.UUID, since: datetime) -> int:
    _open(db)
    return int(db.scalar(text("SELECT count(*) FROM donors.request WHERE partner_id = :p AND created_at >= :since"),
                         {"p": partner_id, "since": since}) or 0)


def insert_request(db: Session, values: dict[str, Any]) -> uuid.UUID:
    _open(db)
    return db.scalar(
        text("""INSERT INTO donors.request (partner_id, raised_by, blood_group, area_key, area_path, units, urgency, needed_by,
                                            state, over_limit)
                VALUES (:partner_id, :raised_by, :blood_group, :area_key, :area_path, :units, :urgency, :needed_by, :state,
                        :over_limit) RETURNING id"""),
        values,
    )


def update_request(db: Session, request_id: uuid.UUID, values: dict[str, Any]) -> None:
    _open(db)
    assignments = ", ".join(f"{name} = :{name}" for name in values)
    db.execute(text(f"UPDATE donors.request SET {assignments} WHERE id = :id"), {**values, "id": request_id})


def match(db: Session, request: Request, *, today: date, notice_before: datetime, limit: int) -> list[uuid.UUID]:
    """FR-BLD-004: available donors of the same blood group whose broad area overlaps the request's, not asked
    in the last day, chosen at random so the same few are not always asked. Each gets a private answer row."""
    _open(db)
    members = list(db.scalars(
        text(
            """SELECT d.member_id FROM donors.donor d JOIN npm.member m ON m.id = d.member_id AND m.deleted_at IS NULL
               WHERE d.blood_group = :group AND d.available
                 AND (d.paused_until IS NULL OR d.paused_until < :today)
                 AND (d.area_key = ANY(:request_path) OR :request_key = ANY(d.area_path))
                 AND (d.last_notified_at IS NULL OR d.last_notified_at < :before)
                 AND d.member_id <> :raised_by
                 AND NOT EXISTS (SELECT 1 FROM donors.response r WHERE r.request_id = :request AND r.member_id = d.member_id)
               ORDER BY random() LIMIT :limit
               FOR UPDATE OF d SKIP LOCKED"""
        ),
        {"group": request.blood_group, "today": today, "request_path": request.area_path, "request_key": request.area_key,
         "before": notice_before, "raised_by": request.raised_by, "request": request.id, "limit": limit},
    ))
    if members:
        db.execute(text("""INSERT INTO donors.response (request_id, member_id)
                           SELECT :request, unnest(CAST(:members AS uuid[]))"""),
                   {"request": request.id, "members": members})
        db.execute(text("UPDATE donors.donor SET last_notified_at = clock_timestamp() WHERE member_id = ANY(:members)"),
                   {"members": members})
    return members


@dataclass(frozen=True)
class Response:
    id: uuid.UUID
    request_id: uuid.UUID
    state: str
    answered_at: datetime | None
    created_at: datetime


def find_response(db: Session, request_id: uuid.UUID, member_id: uuid.UUID, *, lock: bool = False) -> Response | None:
    _open(db)
    row = db.execute(
        text(f"""SELECT id, request_id, state, answered_at, created_at FROM donors.response
                 WHERE request_id = :q AND member_id = :m{' FOR UPDATE' if lock else ''}"""),
        {"q": request_id, "m": member_id},
    ).mappings().one_or_none()
    return Response(**row) if row else None


def my_notices(db: Session, member_id: uuid.UUID, limit: int = 30) -> list[tuple[Response, Request]]:
    """The requests a donor was told about, newest first."""
    _open(db)
    rows = db.execute(
        text("""SELECT r.id AS response_id, r.state AS response_state, r.answered_at, r.created_at AS notified_at, r.request_id
                FROM donors.response r WHERE r.member_id = :m ORDER BY r.created_at DESC LIMIT :limit"""),
        {"m": member_id, "limit": limit},
    ).mappings().all()
    out = []
    for row in rows:
        request = find_request(db, row["request_id"])
        if request is not None:
            out.append((Response(row["response_id"], row["request_id"], row["response_state"], row["answered_at"],
                                 row["notified_at"]), request))
    return out


def answer(db: Session, response_id: uuid.UUID, accept: bool, donor: Donor | None) -> None:
    """Accepting copies the donor's own contact onto the answer, which is the only thing the partner then sees."""
    _open(db)
    db.execute(
        text("""UPDATE donors.response SET state = :state, answered_at = clock_timestamp(), shared_name = :name,
                       shared_phone = :phone, shared_methods = :methods WHERE id = :id"""),
        {"state": "accepted" if accept else "declined", "id": response_id,
         "name": donor.contact_name if accept and donor else None, "phone": donor.contact_phone if accept and donor else None,
         "methods": donor.contact_methods if accept and donor else None},
    )


@dataclass(frozen=True)
class SharedContact:
    name: str
    phone: str
    methods: list[str]
    accepted_at: datetime


def shared_contacts(db: Session, request_id: uuid.UUID) -> list[SharedContact]:
    """FR-BLD-005: only donors who accepted and consented, in the order they answered."""
    _open(db)
    rows = db.execute(
        text("""SELECT shared_name AS name, shared_phone AS phone, shared_methods AS methods, answered_at AS accepted_at
                FROM donors.response WHERE request_id = :q AND state = 'accepted' ORDER BY answered_at"""),
        {"q": request_id},
    ).mappings()
    return [SharedContact(**{**row, "methods": list(row["methods"])}) for row in rows]


def purge_before(db: Session, created_before: datetime) -> int:
    """OD-39: requests (and their answers) are deleted 12 months after they were raised."""
    _open(db)
    return db.execute(text("DELETE FROM donors.request WHERE created_at < :before"), {"before": created_before}).rowcount


def holders(db: Session, permission: str) -> list[uuid.UUID]:
    """Platform holders of a permission whose role counts now (BR-097): the Tier 5 oversight."""
    return list(
        db.scalars(
            text(
                """SELECT DISTINCT a.member_id FROM access.staff_assignment a
                   JOIN membership.membership ms ON ms.member_id = a.member_id AND ms.state = 'active'
                   WHERE a.state = 'active' AND :permission = ANY(a.permissions)
                     AND (a.review_due_at IS NULL OR a.review_due_at > now())"""
            ),
            {"permission": permission},
        )
    )
