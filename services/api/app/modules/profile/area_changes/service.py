"""GN area-change requests (BRD P02, FR-PROF-005, BR-076).

A member asks to move to another GN division and uploads proof of residence;
the request has a receipt (AC- reference), and the member's area stays as it
is until a reviewer in the requested area approves. Proof of residence is
personal data: it is kept encrypted in the evidence vault, opened only by a
reviewer with the permission over the requested area, never by the person
for their own request, and every opening is logged. Only one request is open
at a time; a decision is final.
"""

import uuid

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import service as access
from app.modules.access.rules import Area, AreaPath, area_from_key
from app.modules.access.service import Staff
from app.modules.audit import service as audit
from app.modules.identity.documents.service import UploadedImage
from app.modules.identity.documents.vault import EvidenceVault
from app.modules.messaging.notifications import service as notifications
from app.modules.profile import rules
from app.modules.profile.area_changes import repository
from app.modules.profile.area_changes.repository import StoredChange

REVIEW = rules.AREA_REVIEW


class ChangeNotFound(Exception):
    pass


class ChangeRefused(Exception):
    """request_open, same_area, unknown_area, not_awaiting_proof or not_submitted."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _path(change: StoredChange) -> AreaPath:
    return tuple(area_from_key(key) for key in change.area_path)


def _record(db: Session, actor_id: uuid.UUID, action: str, change: StoredChange, ip: str, **details: object) -> None:
    audit.record(
        db, actor_id=actor_id, action=action, target_type="area_change", target_id=str(change.id),
        area_path=_path(change), details={"requestRef": change.request_ref, "memberId": str(change.member_id), **details},
        ip=ip,
    )


def request_change(db: Session, member_id: uuid.UUID, gn_code: str, ip: str) -> StoredChange:
    path = access_repository.area_path(db, Area("gn", gn_code))
    if path is None:
        raise ChangeRefused("unknown_area")
    problem = rules.check_area_request(repository.current_gn(db, member_id), gn_code, repository.has_open(db, member_id))
    if problem:
        raise ChangeRefused(problem)
    change = repository.insert(
        db, member_id=member_id, from_gn=repository.current_gn(db, member_id), to_gn=gn_code,
        area_path=[a.key for a in path],
    )
    _record(db, member_id, "profile.area_change.requested", change, ip)
    db.commit()
    return change


def _own(db: Session, member_id: uuid.UUID, change_id: uuid.UUID) -> StoredChange:
    change = repository.find(db, change_id, for_update=True)
    if change is None or change.member_id != member_id:
        raise ChangeNotFound()
    return change


def attach_proof(
    db: Session, vault: EvidenceVault, member_id: uuid.UUID, change_id: uuid.UUID, image: UploadedImage, ip: str
) -> StoredChange:
    change = _own(db, member_id, change_id)
    if change.state != "awaiting_proof":
        raise ChangeRefused("not_awaiting_proof")
    proof_id = uuid.uuid4()
    key = vault.save(proof_id, image.data)  # the file first: a failed commit leaves an unused file only
    repository.attach_proof(db, change.id, proof_id=proof_id, proof_key=key, proof_type=image.content_type)
    _record(db, member_id, "profile.area_change.submitted", change, ip)
    db.commit()
    submitted = repository.find(db, change.id)
    assert submitted is not None
    return submitted


def withdraw(db: Session, member_id: uuid.UUID, change_id: uuid.UUID, ip: str) -> StoredChange:
    change = _own(db, member_id, change_id)
    if change.state not in ("awaiting_proof", "submitted"):
        raise ChangeRefused("not_open")
    repository.withdraw(db, change.id)
    _record(db, member_id, "profile.area_change.withdrawn", change, ip)
    db.commit()
    withdrawn = repository.find(db, change.id)
    assert withdrawn is not None
    return withdrawn


def my_changes(db: Session, member_id: uuid.UUID) -> list[StoredChange]:
    return repository.of_member(db, member_id)


# --- Reviewers ------------------------------------------------------------------------------------------


def queue(db: Session, staff: Staff, states: list[str], limit: int) -> list[StoredChange]:
    return repository.queue(
        db, visible_areas=access.visible_areas(staff, REVIEW), states=states, limit=limit, reviewer_id=staff.member_id
    )


def _for_reviewer(db: Session, staff: Staff, change_id: uuid.UUID, ip: str, *, lock: bool = False) -> StoredChange:
    change = repository.find(db, change_id, for_update=lock)
    if change is None:
        raise ChangeNotFound()
    access.check_record_scope(
        db, staff, REVIEW, member_id=change.member_id, area_path=_path(change),
        target=("area_change", str(change.id)), ip=ip,
    )
    return change


def open_proof(db: Session, vault: EvidenceVault, staff: Staff, change_id: uuid.UUID, ip: str) -> tuple[bytes, str]:
    change = _for_reviewer(db, staff, change_id, ip)
    if change.proof_id is None or change.proof_key is None or change.proof_type is None:
        raise ChangeNotFound()
    data = vault.read(change.proof_id, change.proof_key)
    _record(db, staff.member_id, "profile.area_change.proof_viewed", change, ip)
    db.commit()
    return data, change.proof_type


def decide(
    db: Session, staff: Staff, change_id: uuid.UUID, decision: rules.AreaDecision, reason: str, ip: str
) -> StoredChange:
    change = _for_reviewer(db, staff, change_id, ip, lock=True)
    if change.state != "submitted":
        raise ChangeRefused("not_submitted")
    state = "approved" if decision == "approve" else "declined"
    if decision == "approve":
        repository.move_member(db, change.member_id, change.to_gn)
    repository.decide(db, change.id, state=state, reason=reason, decided_by=staff.member_id)
    notifications.notify(db, change.member_id, "area_change_decided", change.id)
    # The reason stays on the request; the audit entry holds ids only.
    _record(db, staff.member_id, f"profile.area_change.{state}", change, ip)
    db.commit()
    decided = repository.find(db, change.id)
    assert decided is not None
    return decided
