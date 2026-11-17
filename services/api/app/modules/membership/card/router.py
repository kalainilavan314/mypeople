from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.content.gallery.dependencies import PhotoBody
from app.modules.membership.card import extras, service, tokens
from app.modules.membership.card.extras import CardPhotoVault
from app.modules.membership.card.schemas import (
    CardCodeOut,
    CardOut,
    CardPhotoOut,
    CardSignatureIn,
    PublicCardOut,
    ScanInput,
    ScanOut,
)

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
        referral_code=card.referral_code,
        photo_version=card.photo_version,
        signature=card.signature,
    )


# The card's photo and the member's drawn signature: only ever the member's own.
PHOTO_HEADERS = {"Cache-Control": "private, no-store"}


def _refused(error: extras.CardExtraRefused) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "card_refused", "problems": [error.code]})


@router.put("/me/card/photo", response_model=CardPhotoOut)
def put_my_card_photo(member: CurrentMember, photo: PhotoBody, vault: CardPhotoVault, request: Request, db: Db) -> CardPhotoOut:
    """A photo for the card (JPEG, PNG or WebP): re-encoded without metadata and stored encrypted; replaces the last one."""
    try:
        photo_id = extras.set_photo(db, vault, member.id, photo, client_ip(request))
    except extras.CardExtraRefused as error:
        raise _refused(error) from None
    return CardPhotoOut(photo_version=str(photo_id))


@router.get("/me/card/photo", response_class=Response, responses={404: {"description": "No card photo"}})
def read_my_card_photo(member: CurrentMember, vault: CardPhotoVault, db: Db) -> Response:
    try:
        data = extras.photo_bytes(db, vault, member.id)
    except extras.CardPhotoMissing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    return Response(content=data, media_type="image/webp", headers=PHOTO_HEADERS)


@router.delete("/me/card/photo", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_card_photo(member: CurrentMember, vault: CardPhotoVault, request: Request, db: Db) -> None:
    extras.remove_photo(db, vault, member.id, client_ip(request))


@router.put("/me/card/signature", status_code=status.HTTP_204_NO_CONTENT)
def put_my_card_signature(body: CardSignatureIn, member: CurrentMember, request: Request, db: Db) -> None:
    """The signature the member drew on the card's pad."""
    try:
        extras.set_signature(db, member.id, body.strokes, client_ip(request))
    except extras.CardExtraRefused as error:
        raise _refused(error) from None


@router.delete("/me/card/signature", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_card_signature(member: CurrentMember, request: Request, db: Db) -> None:
    extras.remove_signature(db, member.id, client_ip(request))


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
