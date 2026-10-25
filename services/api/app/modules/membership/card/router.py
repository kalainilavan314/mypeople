from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.membership.card import service, tokens
from app.modules.membership.card.schemas import CardCodeOut, CardOut, PublicCardOut, ScanInput, ScanOut

router = APIRouter(prefix="/v1/membership", tags=["member card"])

Db = Annotated[Session, Depends(get_db)]
CanScan = Annotated[Staff, Depends(require_permission(service.SCAN))]


@router.get("/me/card")
def read_my_card(member: CurrentMember, db: Db) -> CardOut:
    """C01, or the C06 explanation when identity is not Verified or membership not Active (FR-CARD-001, 014)."""
    card = service.my_card(db, member.id)
    public = (
        PublicCardOut(
            display_name=card.display_name or "",
            member_code=card.member_code or "",
            district_name=card.district_name,
            gn_name=card.gn_name,
        )
        if card.available
        else None
    )
    return CardOut(
        available=card.available,
        identity_verified=card.identity_verified,
        membership_state=card.membership_state,
        reason_code=card.reason_code,
        display_name=card.display_name,
        member_code=card.member_code,
        designation=card.designation,
        district_name=card.district_name,
        gn_name=card.gn_name,
        member_since=card.member_since,
        last_scanned_at=card.last_scanned_at,
        public_card=public,
    )


@router.get("/me/card/code", responses={409: {"description": "card_not_available"}})
def read_my_card_code(member: CurrentMember, request: Request, db: Db) -> CardCodeOut:
    """C02: a signed code valid for 60 seconds; ask again when it expires (FR-CARD-003, BR-064)."""
    try:
        code = service.my_code(db, member.id, request.app.state.settings.jwt_secret.get_secret_value())
    except service.CardNotAvailable:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="card_not_available") from None
    return CardCodeOut(
        code=code.code,
        expires_at=datetime.fromtimestamp(code.expires_at, UTC),
        refresh_after_seconds=tokens.LIFETIME_SECONDS,
    )


@router.post("/card/scan")
def scan_card(body: ScanInput, staff: CanScan, request: Request, db: Db) -> ScanOut:
    """Check a member's code (FR-ADM-001, FR-STF-005). Needs events.checkin_scan. The answer is
    valid with the display name and member ID only, expired, or not valid, never the reason."""
    result = service.scan(
        db, staff.member_id, body.code, request.app.state.settings.jwt_secret.get_secret_value(), client_ip(request)
    )
    return ScanOut(result=result.result, display_name=result.display_name, member_code=result.member_code)  # type: ignore[arg-type]
