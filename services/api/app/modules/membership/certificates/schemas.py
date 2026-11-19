"""Request and response bodies for certificates (M34, D25, INT-22). None carries an NIC or passport number."""

import datetime as dt
import uuid
from datetime import date
from typing import Literal, Self

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.community.issues.rules import LOCAL_ZONE
from app.modules.membership.certificates.repository import Certificate, ListedCertificate
from app.modules.membership.certificates.rules import Kind, Status
from app.modules.membership.certificates.service import MyCertificates, PublicCheck


class CertificateAssignmentOut(CamelModel):
    ref: str
    title_en: str
    title_ta: str
    role_en: str
    role_ta: str
    date: dt.date


class CertificateDetailsOut(CamelModel):
    """What the certificate says: the membership's start, the event, or the completed assignments."""

    member_since: date | None = None
    event_ref: str | None = None
    event_title_en: str | None = None
    event_title_ta: str | None = None
    event_date: date | None = None
    assignment_count: int | None = None
    assignments: list[CertificateAssignmentOut] | None = None


class CertificateOut(CamelModel):
    id: uuid.UUID
    certificate_ref: str
    kind: Kind
    status: Status
    status_reason: str | None = Field(description="Why it was revoked or replaced")
    superseded_by_ref: str | None
    holder_name: str
    issued_on: date
    details: CertificateDetailsOut
    verify_url: str | None = Field(
        default=None, description="The address in the QR; the member's own certificates only, never a staff list"
    )

    @classmethod
    def build(cls, c: Certificate, *, verify_url: str | None = None, superseded_by_ref: str | None = None) -> Self:
        return cls(
            id=c.id, certificate_ref=c.certificate_ref, kind=c.kind, status=c.status,  # type: ignore[arg-type]
            status_reason=c.status_reason, superseded_by_ref=superseded_by_ref, holder_name=c.holder_name,
            issued_on=c.issued_on, details=CertificateDetailsOut.model_validate(c.details), verify_url=verify_url,
        )


class CertificateEventOut(CamelModel):
    event_id: uuid.UUID
    event_ref: str
    title_en: str
    title_ta: str
    date: dt.date
    has_certificate: bool


class MyCertificatesOut(CamelModel):
    """M34: the member's certificates, newest first, and what they can ask for now."""

    certificates: list[CertificateOut]
    membership_problems: list[str] = Field(description="Empty when a membership certificate can be issued")
    events: list[CertificateEventOut]
    completed_assignments: int


class CertificateRequestIn(CamelModel):
    kind: Kind
    event_id: uuid.UUID | None = Field(default=None, description="Needed for an event-participation certificate")


class CertificateIssueIn(CertificateRequestIn):
    member_code: str = Field(min_length=3, max_length=40)


class CertificateReasonIn(CamelModel):
    reason: str = Field(min_length=3, max_length=500)


class ManagedCertificateOut(CertificateOut):
    member_code: str
    area_key: str

    @classmethod
    def from_listed(cls, listed: ListedCertificate) -> Self:
        base = CertificateOut.build(listed.certificate).model_dump()
        return cls(**base, member_code=listed.member_code, area_key=listed.area_key)


class PublicCertificateOut(CamelModel):
    """FR-RNW-007: only these four, and nothing else about the holder."""

    kind: Kind
    holder_name: str
    issued_on: date
    status: Literal["valid", "revoked", "superseded"]

    @classmethod
    def build(cls, result: PublicCheck) -> Self:
        return cls(kind=result.kind, holder_name=result.holder_name, issued_on=result.issued_on,  # type: ignore[arg-type]
                   status=result.status)  # type: ignore[arg-type]


def my_certificates_out(mine: MyCertificates, verify_url: dict[uuid.UUID, str]) -> MyCertificatesOut:
    return MyCertificatesOut(
        certificates=[
            CertificateOut.build(c, verify_url=verify_url[c.id],
                                 superseded_by_ref=mine.superseded_refs.get(c.superseded_by) if c.superseded_by else None)
            for c in mine.certificates
        ],
        membership_problems=mine.membership_problems,
        events=[
            CertificateEventOut(event_id=e.event.event_id, event_ref=e.event.event_ref, title_en=e.event.title_en,
                             title_ta=e.event.title_ta, date=e.event.starts_at.astimezone(LOCAL_ZONE).date(), has_certificate=e.has_certificate)
            for e in mine.events
        ],
        completed_assignments=mine.completed_assignments,
    )
