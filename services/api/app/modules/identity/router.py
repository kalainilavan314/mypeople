import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Path, Request, Response, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.identity import service
from app.modules.identity.dependencies import Image, Vault
from app.modules.identity.images import ACCEPTED_TYPES
from app.modules.identity.repository import DocumentKind
from app.modules.identity.schemas import DocumentOut, EvidenceViewOut, ViewLinkOut
from app.modules.identity.vault import EvidenceUnreadable

router = APIRouter(prefix="/v1/identity", tags=["identity"])

Db = Annotated[Session, Depends(get_db)]
CanViewEvidence = Annotated[Staff, Depends(require_permission(service.PERMISSION))]

_BINARY = {"schema": {"type": "string", "format": "binary"}}
IMAGE_BODY: dict[str, Any] = {
    "requestBody": {"required": True, "content": {media_type: _BINARY for media_type in ACCEPTED_TYPES}}
}
REFUSED = {
    403: {"description": "forbidden, own_record, outside_your_area, link_expired, link_invalid or link_not_yours"},
    404: {"description": "not_found"},
}
NOT_CONFIGURED = {503: {"description": "evidence_storage_not_configured"}}

# The image is shown, never offered as a download (FR-WEB-006), and nothing
# in the response may run or be cached.
EVIDENCE_HEADERS = {
    "Content-Disposition": "inline",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "same-site",
    "X-Robots-Tag": "noindex, nofollow",
}


def _refused(error: service.EvidenceRefused) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code)


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")


@router.get("/me/documents")
def list_my_documents(member: CurrentMember, db: Db) -> list[DocumentOut]:
    """Which identity images the server holds for the signed-in member (BR-020).
    Members cannot download their images (BR-021, FR-PROF-007)."""
    return [DocumentOut.from_stored(d) for d in service.my_documents(db, member.id)]


@router.put(
    "/me/documents/{kind}",
    status_code=status.HTTP_201_CREATED,
    openapi_extra=IMAGE_BODY,
    responses={
        400: {"description": "empty_file"},
        413: {"description": "too_large (over 10 MB)"},
        415: {"description": "unsupported_type (JPEG, PNG or HEIC only)"},
        **NOT_CONFIGURED,
    },
)
def upload_my_document(
    kind: DocumentKind, member: CurrentMember, vault: Vault, image: Image, request: Request, db: Db
) -> DocumentOut:
    """Upload or replace one identity image; the body is the image itself (FR-REG-004, 005, 010).

    The response is the server's acknowledgement: only acknowledged images
    count (BR-020), and the app deletes its own copy after it (FR-REG-035).
    """
    document = service.upload(db, vault, member.id, kind, image, client_ip(request))
    return DocumentOut.from_stored(document)


@router.get("/me/evidence-views")
def list_my_evidence_views(member: CurrentMember, db: Db) -> list[EvidenceViewOut]:
    """When a reviewer viewed the member's identity evidence: date and role only (FR-AUTH-024)."""
    return [EvidenceViewOut.from_view(view) for view in service.evidence_views(db, member.id)]


@router.get("/members/{member_id}/documents", responses=REFUSED)
def list_member_documents(member_id: uuid.UUID, staff: CanViewEvidence, request: Request, db: Db) -> list[DocumentOut]:
    """A member's current identity images, without the images. Needs members.view_identity_evidence
    over the member's area, and never for one's own record (BR-085)."""
    try:
        documents = service.member_documents(db, staff, member_id, client_ip(request))
    except service.DocumentNotFound:
        raise _not_found() from None
    except service.EvidenceRefused as error:
        raise _refused(error) from None
    return [DocumentOut.from_stored(d) for d in documents]


@router.post("/documents/{document_id}/view-link", responses=REFUSED)
def create_view_link(document_id: uuid.UUID, staff: CanViewEvidence, request: Request, db: Db) -> ViewLinkOut:
    """Open one image: a link for the caller alone that expires after 5 minutes (FR-ARCH-007). Logged."""
    jwt_secret = request.app.state.settings.jwt_secret.get_secret_value()
    try:
        token, link = service.issue_view_link(db, staff, document_id, jwt_secret, client_ip(request))
    except service.DocumentNotFound:
        raise _not_found() from None
    except service.EvidenceRefused as error:
        raise _refused(error) from None
    return ViewLinkOut(url=f"{router.prefix}/evidence/{token}", expires_at=link.expires_at)


@router.get(
    "/evidence/{token}",
    response_class=Response,
    responses={
        200: {"description": "The image", "content": {media_type: _BINARY for media_type in ACCEPTED_TYPES}},
        **REFUSED,
        **NOT_CONFIGURED,
    },
)
def view_evidence(
    token: Annotated[str, Path(max_length=1000)], staff: CanViewEvidence, vault: Vault, request: Request, db: Db
) -> Response:
    """The image behind a view link, for the reviewer it was issued to. Every view is logged (BR-086)."""
    jwt_secret = request.app.state.settings.jwt_secret.get_secret_value()
    try:
        document, data = service.open_evidence(db, vault, staff, token, jwt_secret, client_ip(request))
    except service.DocumentNotFound:
        raise _not_found() from None
    except service.EvidenceRefused as error:
        raise _refused(error) from None
    except EvidenceUnreadable:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="evidence_unreadable") from None
    return Response(content=data, media_type=document.content_type, headers=EVIDENCE_HEADERS)
