"""Official content (BRD D30, M47, M48 check part; FR-AUT-001 to 005; INT-22, INT-24): /v1/content/official.

Checking a statement, its images and the public keys need no session (INT-22); the rest of the
member side needs one. Everything is behind the official_content feature switch.
"""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.content.gallery.dependencies import PhotoBody, Store
from app.modules.content.gallery.images import ACCEPTED_TYPES
from app.modules.content.official import service
from app.modules.content.official.dependencies import CurrentSigner, Limiter
from app.modules.content.official.rules import REGISTER, SIGN_PUBLISH, StatementState
from app.modules.content.official.schemas import (
    ManagedStatementOut,
    OfficialCheckOut,
    OfficialCorrectionIn,
    OfficialDraftIn,
    OfficialImageOut,
    OfficialStatementFileOut,
    OfficialStatementOut,
    OfficialWithdrawIn,
    PublicKeyOut,
    PublisherIn,
    PublisherOut,
    RevokeIn,
    SigningStatusOut,
)
from app.modules.election.service import SilencePeriod
from app.modules.features.dependencies import require_feature

router = APIRouter(
    prefix="/v1/content/official", tags=["official-content"], dependencies=[Depends(require_feature("official_content"))]
)

Db = Annotated[Session, Depends(get_db)]
CanSign = Annotated[Staff, Depends(require_permission(SIGN_PUBLISH))]
Reader = Annotated[Staff, Depends(require_permission(SIGN_PUBLISH, REGISTER))]
Registrar = Annotated[Staff, Depends(require_permission(REGISTER))]

REFUSED: dict[int | str, dict[str, Any]] = {
    403: {"description": "forbidden, platform_scope_required, own_record or not_a_registered_publisher"},
    404: {"description": "not_found"},
    422: {"description": "official_refused, with problems"},
}
SIGNING: dict[int | str, dict[str, Any]] = {
    **REFUSED,
    409: {"description": "silence_period, with the period refs (NFR-ELC-03)"},
    503: {"description": "signing_unavailable: no signing key is configured (INT-24)"},
}
_BINARY = {"schema": {"type": "string", "format": "binary"}}
IMAGE_BODY: dict[str, Any] = {"requestBody": {"required": True, "content": {t: _BINARY for t in ACCEPTED_TYPES}}}
IMAGE_RESPONSE: dict[int | str, dict[str, Any]] = {200: {"content": {"image/webp": _BINARY}}, 404: {"description": "not_found"}}
# Shown inside the app or the check page, never run.
IMAGE_HEADERS = {
    "Content-Disposition": "inline",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "X-Robots-Tag": "noindex, nofollow",
}


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.OfficialNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.SigningUnavailable:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="signing_unavailable") from None
    except SilencePeriod as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail={"code": "silence_period", "problems": error.period_refs}
        ) from None
    except service.OfficialRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "official_refused", "problems": error.problems}
        ) from None


def _app_url(request: Request) -> str:
    url: str = request.app.state.settings.member_app_url
    return url


# --- Public: keys, checks and images (INT-22) ---------------------------------------------------------------


@router.get("/keys")
def list_public_keys(signer: CurrentSigner, db: Db) -> list[PublicKeyOut]:
    """Every key that has signed a statement, and the current one: verify any signature with these."""
    return [PublicKeyOut.build(k) for k in service.public_keys(db, signer)]


@router.get("/check", responses={429: {"description": "too_many_requests, with Retry-After"}})
def check_statement(
    code: Annotated[str, Query(min_length=1, max_length=500, description="A check code, or a check link")],
    limiter: Limiter,
    request: Request,
    db: Db,
) -> OfficialCheckOut:
    """M48, FR-AUT-005: open to anyone, no session needed. Verified, withdrawn, or not verified
    ("No matching official record")."""
    try:
        result = service.check(db, limiter, code, client_ip(request))
    except service.TooManyChecks as error:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="too_many_requests",
            headers={"Retry-After": str(error.retry_after)},
        ) from None
    return OfficialCheckOut.build(result, _app_url(request))


@router.get("/images/{image_id}", response_class=Response, responses=IMAGE_RESPONSE)
def read_public_image(image_id: uuid.UUID, store: Store, db: Db, size: Literal["display", "thumb"] = "display") -> Response:
    """An image a published statement carries. Its SHA-256 (display size) is part of the signature."""
    with _answers():
        data = service.image_bytes(db, store, image_id, size)
    return Response(content=data, media_type="image/webp", headers={**IMAGE_HEADERS, "Cache-Control": "public, max-age=86400"})


# --- Publishers and the signing status (Tier 5, D30) --------------------------------------------------------


@router.get("/manage/signing")
def read_signing_status(staff: Reader, signer: CurrentSigner, db: Db) -> SigningStatusOut:
    """Whether signing is available (a key is configured) and whether the caller is a registered publisher."""
    return SigningStatusOut.build(service.signing_status(db, signer, staff))


@router.get("/publishers", responses=REFUSED)
def list_publishers(staff: Registrar, db: Db) -> list[PublisherOut]:
    with _answers():
        return [PublisherOut.build(p) for p in service.publishers(db, staff)]


@router.post("/publishers", status_code=status.HTTP_201_CREATED, responses=REFUSED)
def register_publisher(body: PublisherIn, staff: Registrar, request: Request, db: Db) -> PublisherOut:
    """FR-AUT-001: Tier 5 registers someone who holds content.sign_publish; never themselves."""
    with _answers():
        return PublisherOut.build(
            service.register_publisher(db, staff, body.member_code, body.name_en, body.name_ta, client_ip(request))
        )


@router.post("/publishers/{publisher_id}/revoke", responses=REFUSED)
def revoke_publisher(publisher_id: uuid.UUID, body: RevokeIn, staff: Registrar, request: Request, db: Db) -> PublisherOut:
    """Their signed statements keep verifying; they cannot sign again."""
    with _answers():
        return PublisherOut.build(service.revoke_publisher(db, staff, publisher_id, body.reason, client_ip(request)))


# --- Drafting, signing, correcting, withdrawing (D30) -------------------------------------------------------


@router.get("/manage", responses=REFUSED)
def list_managed(
    staff: Reader,
    request: Request,
    db: Db,
    state: Annotated[list[StatementState] | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[ManagedStatementOut]:
    """Drafts, published and withdrawn statements, latest change first."""
    states = list(state) if state else ["draft", "published", "withdrawn"]
    with _answers():
        return [ManagedStatementOut.build(v, _app_url(request)) for v in service.managed(db, staff, states, limit)]


@router.post("/manage", status_code=status.HTTP_201_CREATED, responses=REFUSED)
def create_draft(body: OfficialDraftIn, staff: CanSign, request: Request, db: Db) -> ManagedStatementOut:
    with _answers():
        statement = service.create_draft(db, staff, body.model_dump(), client_ip(request))
        return ManagedStatementOut.build(service.staff_view(db, staff, statement.id), _app_url(request))


@router.post(
    "/manage/images",
    status_code=status.HTTP_201_CREATED,
    openapi_extra=IMAGE_BODY,
    responses={**REFUSED, 413: {"description": "too_large"}, 415: {"description": "unsupported_type"}},
)
def upload_image(staff: CanSign, photo: PhotoBody, store: Store, db: Db) -> OfficialImageOut:
    """JPEG, PNG or WebP up to 15 MB; kept as WebP without metadata. Attach it to a draft or a correction."""
    with _answers():
        return OfficialImageOut.build(service.save_image(db, store, staff, photo))


@router.get("/manage/images/{image_id}", response_class=Response, responses=IMAGE_RESPONSE)
def read_draft_image(image_id: uuid.UUID, staff: Reader, store: Store, db: Db,
                     size: Literal["display", "thumb"] = "display") -> Response:
    with _answers():
        data = service.image_bytes(db, store, image_id, size, staff)
    return Response(content=data, media_type="image/webp", headers={**IMAGE_HEADERS, "Cache-Control": "no-store"})


@router.get("/manage/{statement_id}", responses=REFUSED)
def read_managed(statement_id: uuid.UUID, staff: Reader, request: Request, db: Db) -> ManagedStatementOut:
    with _answers():
        return ManagedStatementOut.build(service.staff_view(db, staff, statement_id), _app_url(request))


@router.put("/manage/{statement_id}", responses=REFUSED)
def save_draft(statement_id: uuid.UUID, body: OfficialDraftIn, staff: CanSign, request: Request, db: Db) -> ManagedStatementOut:
    """Only while it is a draft; once signed, it changes only by a correction."""
    with _answers():
        service.update_draft(db, staff, statement_id, body.model_dump())
        return ManagedStatementOut.build(service.staff_view(db, staff, statement_id), _app_url(request))


@router.post("/manage/{statement_id}/publish", responses=SIGNING)
def sign_and_publish(statement_id: uuid.UUID, staff: CanSign, signer: CurrentSigner, request: Request,
                     db: Db) -> ManagedStatementOut:
    """FR-AUT-002: signs the draft (and its image) as revision 1 and gives it its public check code."""
    with _answers():
        service.publish(db, signer, staff, statement_id, client_ip(request))
        return ManagedStatementOut.build(service.staff_view(db, staff, statement_id), _app_url(request))


@router.post("/manage/{statement_id}/corrections", responses=SIGNING)
def publish_correction(statement_id: uuid.UUID, body: OfficialCorrectionIn, staff: CanSign, signer: CurrentSigner,
                       request: Request, db: Db) -> ManagedStatementOut:
    """BR-150: a new signed revision with its reason; the original and every earlier revision stay."""
    with _answers():
        service.correct(db, signer, staff, statement_id, body.model_dump(), client_ip(request))
        return ManagedStatementOut.build(service.staff_view(db, staff, statement_id), _app_url(request))


@router.post("/manage/{statement_id}/withdraw", responses=REFUSED)
def withdraw_statement(statement_id: uuid.UUID, body: OfficialWithdrawIn, staff: Reader, request: Request,
                       db: Db) -> ManagedStatementOut:
    """By a registered publisher or Tier 5; every check then says it was withdrawn, and why."""
    with _answers():
        service.withdraw(db, staff, statement_id, body.reason_en, body.reason_ta, client_ip(request))
        return ManagedStatementOut.build(service.staff_view(db, staff, statement_id), _app_url(request))


# --- Members: official updates (M47) -------------------------------------------------------------------------


@router.get("")
def list_official_statements(
    member: CurrentMember, request: Request, db: Db, limit: Annotated[int, Query(ge=1, le=100)] = 50
) -> list[OfficialStatementOut]:
    """M47: published and withdrawn statements, latest first. "Official statement" only where signed (BR-148)."""
    return [OfficialStatementOut.build(v, _app_url(request)) for v in service.published(db, limit)]


@router.get("/{statement_id}", responses={404: {"description": "not_found"}})
def read_official_statement(statement_id: uuid.UUID, member: CurrentMember, request: Request,
                            db: Db) -> OfficialStatementFileOut:
    """M47: the statement with its full revision history (FR-AUT-004)."""
    with _answers():
        return OfficialStatementFileOut.from_view(service.member_view(db, statement_id), _app_url(request))
