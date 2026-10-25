"""Identity evidence: members upload ID images; authorised reviewers view them
through short-lived signed links, and every view is logged.

BRD FR-ARCH-007 (private storage, signed links after an authorisation
check), BR-086 and FR-WEB-005 (every view logged), FR-AUTH-024 (members see
when their evidence was viewed), BR-021 (no member download), BR-085 (nobody
reviews their own record), PRM-03 members.view_identity_evidence.

PRM-03 "only inside an open review": a reviewer sees a member's evidence
only while they hold that member's identity review in review (claimed in
W01, see identity/reviews), the member's appeal (D05, see
identity/appeals) or a duplicate investigation of the member's account
(D04, see identity/duplicates).

Not yet enforced, because what they need does not exist yet: BR-085's "or a
declared relative" (no relatives are recorded) and the OD-03 retention
period (nothing is deleted).
"""

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import service as access
from app.modules.access.rules import AreaPath
from app.modules.access.service import AccessRefused, Staff
from app.modules.audit import service as audit
from app.modules.identity.documents import links, repository
from app.modules.identity.documents.links import ViewLink
from app.modules.identity.documents.repository import DocumentKind, StoredDocument
from app.modules.identity.documents.vault import EvidenceVault
from app.modules.membership import repository as membership_repository
from app.modules.membership.rules import NOTICE_VERSIONS
from app.modules.identity.reviews import repository as verification_repository
from app.modules.identity.appeals import repository as appeals_repository
from app.modules.identity.duplicates import repository as duplicates_repository

PERMISSION = "members.view_identity_evidence"  # PRM-03
VIEWED = "identity.evidence.viewed"

# [ASSUMPTION] The BRD sets no figure. Every image is kept (decisions name the
# versions they saw), so without a cap one account could fill the private disk
# at 10 MB a time (review finding, 25 October 2026). A full submission is three
# images; twelve a day leaves room for several retakes.
UPLOADS_PER_DAY = 12
UPLOAD_WINDOW = "24 hours"


class DocumentNotFound(Exception):
    pass


class ConsentRequired(Exception):
    """BR-008: consent to identity review comes before any upload."""


class UploadLimit(Exception):
    def __init__(self, retry_after: int) -> None:
        super().__init__(f"retry after {retry_after}s")
        self.retry_after = retry_after


@dataclass(frozen=True)
class UploadedImage:
    content_type: str
    data: bytes


@dataclass(frozen=True)
class EvidenceView:
    viewed_at: datetime
    kind: str


def upload(
    db: Session, vault: EvidenceVault, member_id: uuid.UUID, kind: DocumentKind, image: UploadedImage, ip: str
) -> StoredDocument:
    """Store a new image of this kind for the member; it replaces the current one (FR-REG-005)."""
    if not membership_repository.has_consent(db, member_id, "identity_review", NOTICE_VERSIONS["identity_review"]):
        raise ConsentRequired()
    # Checked under the member's upload lock and before the file is written, so
    # neither parallel uploads nor a refused one use any disk.
    repository.lock_member_uploads(db, member_id)
    uploads, oldest_leaves_in = repository.recent_uploads(db, member_id, UPLOAD_WINDOW)
    if uploads >= UPLOADS_PER_DAY:
        db.commit()
        raise UploadLimit(oldest_leaves_in)
    document_id = uuid.uuid4()
    # The file is written before the record, so a failed commit can leave an
    # unused file but never a record whose image is missing.
    key_id = vault.save(document_id, image.data)
    document = repository.insert_document(
        db,
        document_id=document_id,
        member_id=member_id,
        kind=kind,
        content_type=image.content_type,
        byte_size=len(image.data),
        key_id=key_id,
    )
    audit.record(
        db,
        actor_id=member_id,
        action="identity.document.uploaded",
        target_type="identity_document",
        target_id=str(document.id),
        area_path=access_repository.member_area_path(db, member_id),
        details={"memberId": str(member_id), "kind": kind, "version": document.version},
        ip=ip,
    )
    db.commit()
    return document


def my_documents(db: Session, member_id: uuid.UUID) -> list[StoredDocument]:
    return repository.current_documents(db, member_id)


def _check_reviewer(db: Session, staff: Staff, member_id: uuid.UUID, ip: str) -> AreaPath:
    """Not the reviewer's own record (BR-085), the permission over the member's area,
    and an open review, appeal or duplicate case of this member held by this person (PRM-03)."""
    area_path = access_repository.member_area_path(db, member_id)
    target = ("member", str(member_id))
    access.check_record_scope(db, staff, PERMISSION, member_id=member_id, area_path=area_path, target=target, ip=ip)
    if not (
        verification_repository.has_open_review_claimed_by(db, member_id, staff.member_id)
        or appeals_repository.has_open_appeal_claimed_by(db, member_id, staff.member_id)
        or duplicates_repository.has_open_case_claimed_by(db, member_id, staff.member_id)
    ):
        access.refuse(db, staff, PERMISSION, "no_open_review", ip, target=target, area_path=area_path)
    return area_path


def member_documents(db: Session, staff: Staff, member_id: uuid.UUID, ip: str) -> list[StoredDocument]:
    """Which images a member has, for a reviewer; the images stay closed until a link is issued."""
    if not repository.member_exists(db, member_id):
        raise DocumentNotFound()
    _check_reviewer(db, staff, member_id, ip)
    return repository.current_documents(db, member_id)


def _details(document: StoredDocument, link: ViewLink) -> dict[str, object]:
    return {
        "memberId": str(document.member_id),
        "kind": document.kind,
        "version": document.version,
        "linkId": str(link.link_id),
    }


def issue_view_link(
    db: Session, staff: Staff, document_id: uuid.UUID, jwt_secret: str, ip: str
) -> tuple[str, ViewLink]:
    """Open one image for 5 minutes, after the permission and area check (FR-ARCH-007)."""
    document = repository.find_document(db, document_id)
    if document is None:
        raise DocumentNotFound()
    area_path = _check_reviewer(db, staff, document.member_id, ip)
    token, link = links.sign_view_link(document.id, staff.member_id, jwt_secret)
    audit.record(
        db,
        actor_id=staff.member_id,
        action="identity.evidence.link_issued",
        target_type="identity_document",
        target_id=str(document.id),
        area_path=area_path,
        details=_details(document, link),
        ip=ip,
    )
    db.commit()
    return token, link


def open_evidence(
    db: Session, vault: EvidenceVault, staff: Staff, token: str, jwt_secret: str, ip: str
) -> tuple[StoredDocument, bytes]:
    """The decrypted image, for the person the link was issued to. Each use is logged (BR-086)."""
    try:
        link = links.read_view_link(token, jwt_secret)
    except links.LinkExpired:
        raise AccessRefused("link_expired") from None
    except links.LinkInvalid:
        raise AccessRefused("link_invalid") from None
    if link.viewer_id != staff.member_id:
        # A link passed to someone else: refused and logged, even though they are staff.
        target = ("identity_document", str(link.document_id))
        access.refuse(db, staff, PERMISSION, "link_not_yours", ip, target=target, area_path=None)

    document = repository.find_document(db, link.document_id)
    if document is None:
        raise DocumentNotFound()
    # Checked again: a permission revoked or a review closed since the link was issued applies now (FR-WEB-033).
    area_path = _check_reviewer(db, staff, document.member_id, ip)
    data = vault.read(document.id, document.key_id)
    audit.record(
        db,
        actor_id=staff.member_id,
        action=VIEWED,
        target_type="identity_document",
        target_id=str(document.id),
        area_path=area_path,
        details=_details(document, link),
        ip=ip,
    )
    db.commit()
    return document, data


def evidence_views(db: Session, member_id: uuid.UUID) -> list[EvidenceView]:
    """When the member's evidence was viewed, newest first (FR-AUTH-024).

    One entry per opened link: a reviewer zooming in loads the image again
    with the same link. Who viewed it is not returned, only that a reviewer did.
    """
    first_views: dict[str, EvidenceView] = {}
    for entry in reversed(audit.entries_about_member(db, action=VIEWED, member_id=member_id)):
        view = EvidenceView(viewed_at=entry.occurred_at, kind=str(entry.details.get("kind")))
        first_views.setdefault(str(entry.details.get("linkId", entry.id)), view)
    return sorted(first_views.values(), key=lambda view: view.viewed_at, reverse=True)
