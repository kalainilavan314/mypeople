"""The member card, its rotating QR code and scanning (BRD C01 to C06, FR-CARD-001 to 004, 007,
012, 014, 015, FR-ADM-001, BR-063 to BR-065).

The card and its code exist only while identity is Verified and membership
is Active (BR-065). A scan checks the code and then the member's state at
that moment, so a suspension applies to the very next scan (FR-CARD-015);
suspending or inactivating also replaces the card reference. The scanner
learns only "valid" with the display name and member ID, "expired" or "not
valid", never why a card is not valid.

Not built yet: wallet passes (FR-CARD-010, 011; INT-03 certificates, OD-06),
the offline credential and offline scanning (FR-CARD-008, FR-ADM-002; OD-08),
milestones (FR-CARD-013), event passes and per-event scope (events batch).
"""

import time
import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.permissions import TIER_RANK
from app.modules.access import repository as access_repository
from app.modules.audit import service as audit
from app.modules.membership import repository as membership_repository
from app.modules.membership.card import repository, tokens
from app.modules.membership.card.tokens import CardCode

SCAN = "events.checkin_scan"  # PRM-17


class CardNotAvailable(Exception):
    """Identity not Verified or membership not Active (BR-065)."""


@dataclass(frozen=True)
class Card:
    """C01 when available; otherwise what C06 explains (FR-CARD-014)."""

    available: bool
    identity_verified: bool
    membership_state: str
    reason_code: str | None
    # Shown only when available. Never the NIC or passport, date of birth or phone (FR-CARD-002).
    display_name: str | None
    member_code: str | None
    designation: str | None
    district_name: str | None
    gn_name: str | None
    member_since: datetime | None
    last_scanned_at: datetime | None


def _designation(db: Session, member_id: uuid.UUID) -> str | None:
    """The member's highest staff tier, or None for a member without a staff role."""
    tiers = [a.tier for a in access_repository.effective_assignments(db, member_id)]
    return max(tiers, key=lambda tier: TIER_RANK[tier], default=None)  # type: ignore[index]


def my_card(db: Session, member_id: uuid.UUID) -> Card:
    status = access_repository.find_member_status(db, member_id)
    profile = membership_repository.find_member_profile(db, member_id)
    assert status is not None and profile is not None
    membership = membership_repository.current_state(db, member_id)
    available = status.identity_verified and status.membership_active
    return Card(
        available=available,
        identity_verified=status.identity_verified,
        membership_state=membership.state,
        reason_code=membership.reason_code,
        display_name=profile["full_name"] if available else None,  # [ASSUMPTION] OD-16: the full name
        member_code=profile["member_code"] if available else None,
        designation=_designation(db, member_id) if available else None,
        district_name=profile["district_name"] if available else None,
        gn_name=profile["gs_name"] if available else None,
        member_since=profile["joined_at"] if available else None,
        last_scanned_at=repository.last_scanned_at(db, member_id) if available else None,
    )


def my_code(db: Session, member_id: uuid.UUID, jwt_secret: str) -> CardCode:
    """A new 60-second code for C02 (FR-CARD-003)."""
    status = access_repository.find_member_status(db, member_id)
    if status is None or not (status.identity_verified and status.membership_active):
        raise CardNotAvailable()
    ref = repository.card_ref(db, member_id)
    db.commit()
    return tokens.sign(ref, jwt_secret, int(time.time()))


@dataclass(frozen=True)
class ScanResult:
    result: str  # valid, expired or not_valid (FR-ADM-001)
    display_name: str | None = None
    member_code: str | None = None


def scan(db: Session, scanner_id: uuid.UUID, code: str, jwt_secret: str, ip: str) -> ScanResult:
    reason = None
    member_id = None
    try:
        ref = tokens.read(code, jwt_secret, int(time.time()))
        member_id = repository.member_by_card_ref(db, ref)
        status = access_repository.find_member_status(db, member_id) if member_id else None
        if status is None:
            reason = "unknown_card"
        elif not status.identity_verified:
            reason = "identity_not_verified"
        elif not status.membership_active:
            reason = "membership_not_active"
    except tokens.CardCodeExpired:
        reason = "expired"
    except tokens.CardCodeInvalid:
        reason = "bad_code"

    result = "valid" if reason is None else ("expired" if reason == "expired" else "not_valid")
    if result == "valid":
        assert member_id is not None
        repository.record_scan(db, member_id, scanner_id)
    # The reason stays in the audit log; the scanner sees only the result (BR-062: never a pretend success).
    audit.record(
        db,
        actor_id=scanner_id,
        action="membership.card.scanned",
        target_type="member" if member_id else None,
        target_id=str(member_id) if member_id else None,
        area_path=access_repository.member_area_path(db, member_id) if member_id else None,
        details={"result": result, "reason": reason, "memberId": str(member_id) if member_id else None},
        ip=ip,
    )
    db.commit()
    if result != "valid":
        return ScanResult(result=result)
    profile = membership_repository.find_member_profile(db, member_id)  # type: ignore[arg-type]
    assert profile is not None
    return ScanResult(result="valid", display_name=profile["full_name"], member_code=profile["member_code"])
