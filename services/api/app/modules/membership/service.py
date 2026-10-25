"""Membership activation, suspension, reinstatement and inactivation (BRD GAP-02, FR-ADM-003).

Each change needs members.activate over the member's area, is never made on
one's own record (BR-085), carries a reason (BR-015), and is saved with its
history row and audit entry in one transaction. Suspending or inactivating a
staff member also stops their staff rights on their next request, because
staff access needs an Active membership (BR-097).

Suspending or inactivating also replaces the member's card reference, so
every QR code shown before then stops working (FR-CARD-015).

Not built yet: notifying the member (FR-ADM-003, needs messaging).
"""

import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import service as access
from app.modules.access.service import Staff
from app.modules.audit import service as audit
from app.modules.membership import repository, rules
from app.modules.membership.card import repository as card_repository
from app.modules.membership.repository import AwaitingMember, MembershipChange, MembershipState
from app.modules.membership.rules import ACTIVATE, Action


class MemberNotFound(Exception):
    pass


class ChangeRefused(Exception):
    def __init__(self, problems: list[str]) -> None:
        super().__init__(", ".join(problems))
        self.problems = problems


@dataclass(frozen=True)
class MembershipFile:
    member_id: uuid.UUID
    identity_verified: bool
    current: MembershipState
    history: list[MembershipChange]


def my_membership(db: Session, member_id: uuid.UUID) -> MembershipState:
    return repository.current_state(db, member_id)


def _check_scope(db: Session, staff: Staff, member_id: uuid.UUID, ip: str) -> None:
    access.check_record_scope(
        db,
        staff,
        ACTIVATE,
        member_id=member_id,
        area_path=access_repository.member_area_path(db, member_id),
        target=("membership", str(member_id)),
        ip=ip,
    )


def membership_file(db: Session, staff: Staff, member_id: uuid.UUID, ip: str) -> MembershipFile:
    status = access_repository.find_member_status(db, member_id)
    if status is None:
        raise MemberNotFound()
    _check_scope(db, staff, member_id, ip)
    return MembershipFile(
        member_id=member_id,
        identity_verified=status.identity_verified,
        current=repository.current_state(db, member_id),
        history=repository.history(db, member_id),
    )


def awaiting_activation(db: Session, staff: Staff, limit: int) -> list[AwaitingMember]:
    """Verified members still Pending, in the areas where the person holds members.activate."""
    return repository.awaiting_activation(db, visible_areas=access.visible_areas(staff, ACTIVATE), limit=limit)


def change(
    db: Session, staff: Staff, member_id: uuid.UUID, action: Action, reason_code: str, note: str | None, ip: str
) -> MembershipState:
    status = access_repository.find_member_status(db, member_id)
    if status is None:
        raise MemberNotFound()
    _check_scope(db, staff, member_id, ip)
    # Suspending a staff member ends their staff rights (BR-097), so a peer or junior must not be
    # able to do it to them, nor reinstate someone a senior suspended.
    access.check_rank(
        db,
        staff,
        ACTIVATE,
        member_id=member_id,
        area_path=access_repository.member_area_path(db, member_id),
        target=("membership", str(member_id)),
        ip=ip,
    )

    repository.lock_member(db, member_id)
    current = repository.current_state(db, member_id)
    problems = rules.check_change(action, current.state, status.identity_verified, reason_code, note)  # type: ignore[arg-type]
    if problems:
        raise ChangeRefused(problems)

    to_state = rules.state_after(action)
    if to_state in ("suspended", "inactive"):
        # Codes shown before now must name nobody (FR-CARD-015); scans also check the state live.
        card_repository.replace_card_ref(db, member_id)
    repository.record_change(
        db,
        member_id=member_id,
        action=action,
        from_state=current.state,
        to_state=to_state,
        reason_code=reason_code,
        note=note,
        changed_by=staff.member_id,
    )
    # The note stays in the membership history; the audit entry holds codes only.
    audit.record(
        db,
        actor_id=staff.member_id,
        action=f"membership.{action}",
        target_type="membership",
        target_id=str(member_id),
        area_path=access_repository.member_area_path(db, member_id),
        details={"memberId": str(member_id), "from": current.state, "to": to_state, "reasonCode": reason_code},
        ip=ip,
    )
    db.commit()
    return repository.current_state(db, member_id)

