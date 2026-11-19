"""Certificates (BRD M34, D25, INT-22, FR-RNW-004 to 008): /v1/membership/certificates and the public
check at /v1/public/certificates. Both answer 404 while the renewal module is off."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.features.dependencies import require_feature
from app.modules.membership.certificates import service
from app.modules.membership.certificates.rules import ISSUE_REVOKE, Kind, Status
from app.modules.membership.certificates.schemas import (
    CertificateOut,
    CertificateRequestIn,
    MyCertificatesOut,
    PublicCertificateOut,
    CertificateReasonIn,
    ManagedCertificateOut,
    CertificateIssueIn,
    my_certificates_out,
)

Db = Annotated[Session, Depends(get_db)]
CanIssue = Annotated[Staff, Depends(require_permission(ISSUE_REVOKE))]
REFUSED = {
    403: {"description": "forbidden, own_record or outside_your_area"},
    404: {"description": "not_found"},
    422: {"description": '{"code": "certificate_refused", "problems": [...]}'},
}

router = APIRouter(prefix="/v1/membership/certificates", tags=["certificates"],
                   dependencies=[Depends(require_feature("renewal"))])
public_router = APIRouter(prefix="/v1/public/certificates", tags=["certificates"],
                          dependencies=[Depends(require_feature("renewal"))])


def _secret(request: Request) -> str:
    return request.app.state.settings.jwt_secret.get_secret_value()


def _verify_url(request: Request, token: str) -> str:
    return f"{request.app.state.settings.member_app_url.rstrip('/')}/certificate/{token}"


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.CertificateNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.CertificateRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"code": "certificate_refused", "problems": error.problems},
        ) from None


def _mine(db: Session, member_id: uuid.UUID, request: Request) -> MyCertificatesOut:
    secret = _secret(request)
    mine = service.my_certificates(db, member_id, secret)
    urls = {c.id: _verify_url(request, service.token(c, secret)) for c in mine.certificates}
    return my_certificates_out(mine, urls)


@router.get("/me")
def read_my_certificates(member: CurrentMember, request: Request, db: Db) -> MyCertificatesOut:
    """M34: every certificate the member holds, with the address its QR carries, and what they can ask for."""
    return _mine(db, member.id, request)


@router.post("/me", status_code=status.HTTP_201_CREATED, responses=REFUSED)
def request_certificate(body: CertificateRequestIn, member: CurrentMember, request: Request, db: Db) -> CertificateOut:
    """FR-RNW-004 to 006. Problems: identity_not_verified, membership_not_active, event_required,
    no_attendance_recorded, no_completed_assignments. Asking again returns the same certificate unless
    its facts changed; then the new one supersedes it."""
    with _answers():
        created = service.request_certificate(db, member.id, body.kind, body.event_id, _secret(request),
                                              client_ip(request))
    return CertificateOut.build(created, verify_url=_verify_url(request, service.token(created, _secret(request))))


@router.get("/manage", responses=REFUSED)
def list_certificates(
    staff: CanIssue,
    db: Db,
    certificate_status: Annotated[Status | None, Query(alias="status")] = None,
    kind: Kind | None = None,
    ref: Annotated[str | None, Query(max_length=40, description="A CT- reference or a member ID")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[ManagedCertificateOut]:
    """D25: certificates of members in the caller's areas, newest first."""
    found = service.search(db, staff, status=certificate_status, kind=kind, ref=ref, limit=limit)
    refs = service.superseded_refs(db, [item.certificate for item in found])
    return [ManagedCertificateOut.from_listed(item, refs) for item in found]


def _listed(db: Session, staff: Staff, certificate_ref: str) -> ManagedCertificateOut:
    found = service.search(db, staff, status=None, kind=None, ref=certificate_ref, limit=1)
    if not found:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")
    return ManagedCertificateOut.from_listed(found[0], service.superseded_refs(db, [found[0].certificate]))


@router.post("/manage", status_code=status.HTTP_201_CREATED, responses=REFUSED)
def issue_certificate(body: CertificateIssueIn, staff: CanIssue, request: Request, db: Db) -> ManagedCertificateOut:
    """D25: issue a certificate to a member in the caller's area ("already_issued": reissue it instead)."""
    with _answers():
        created = service.staff_issue(db, staff, body.member_code, body.kind, body.event_id, _secret(request),
                                      client_ip(request))
    return _listed(db, staff, created.certificate_ref)


@router.post("/manage/{certificate_id}/revoke", responses=REFUSED)
def revoke_certificate(certificate_id: uuid.UUID, body: CertificateReasonIn, staff: CanIssue, request: Request,
                       db: Db) -> ManagedCertificateOut:
    """FR-RNW-008: it then verifies as Revoked. The member is told and sees the reason."""
    with _answers():
        revoked = service.revoke(db, staff, certificate_id, body.reason, client_ip(request))
    return _listed(db, staff, revoked.certificate_ref)


@router.post("/manage/{certificate_id}/reissue", responses=REFUSED)
def reissue_certificate(certificate_id: uuid.UUID, body: CertificateReasonIn, staff: CanIssue, request: Request,
                        db: Db) -> ManagedCertificateOut:
    """FR-RNW-008: a new certificate from the current records; the old one verifies as Superseded."""
    with _answers():
        created = service.reissue(db, staff, certificate_id, body.reason, _secret(request), client_ip(request))
    return _listed(db, staff, created.certificate_ref)


@public_router.get(
    "/{token}",
    responses={404: {"description": "not_found: no certificate has this code"},
               429: {"description": "too_many_requests, with Retry-After"}},
)
def check_certificate(token: Annotated[str, Path(min_length=10, max_length=100)], request: Request,
                      db: Db) -> PublicCertificateOut:
    """INT-22, FR-RNW-007: anyone, without an account. Only the type, the issue date and Valid, Revoked or
    Superseded, with the holder's name while it is valid; nothing else about the holder."""
    try:
        return PublicCertificateOut.build(service.check(db, token, client_ip(request), _secret(request)))
    except service.TooManyChecks:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="too_many_requests",
                            headers={"Retry-After": "3600"}) from None
    except service.CertificateNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
