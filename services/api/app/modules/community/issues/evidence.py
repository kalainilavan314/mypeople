"""Report and case photos in the restricted evidence store (BRD FR-RPT-009, BR-033, ENT-11).

A photo is decoded and re-encoded like a gallery photo, which drops its EXIF and GPS data, then
sealed with the evidence key (AES-256-GCM, the photo id bound in) in its own folder of the
evidence directory, apart from identity images. It is never published to the gallery and is
served only to staff who may open the case, or back to the member who sent it.
"""

import uuid
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from app.core.config import Settings
from app.modules.content.gallery import images
from app.modules.identity.documents.vault import EvidenceUnreadable, EvidenceVault, FileStore

FOLDER = "issue-photos"


@dataclass(frozen=True)
class PreparedEvidence:
    data: bytes  # WebP, no metadata
    width: int
    height: int


class EvidenceRejected(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def build_issue_vault(settings: Settings) -> EvidenceVault | None:
    if settings.evidence_storage_dir is None or settings.evidence_key is None:
        return None
    return EvidenceVault(FileStore(settings.evidence_storage_dir / FOLDER), settings.evidence_key)


def get_issue_vault(request: Request) -> EvidenceVault:
    vault: EvidenceVault | None = getattr(request.app.state, "issue_vault", None)
    if vault is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="evidence_storage_not_configured")
    return vault


IssueVault = Annotated[EvidenceVault, Depends(get_issue_vault)]


def prepare(data: bytes) -> PreparedEvidence:
    try:
        prepared = images.prepare(data)
    except images.ImageRejected as error:
        raise EvidenceRejected(error.code) from None
    return PreparedEvidence(data=prepared.display, width=prepared.width, height=prepared.height)


def read(vault: EvidenceVault, evidence_id: uuid.UUID, sealed_with: str) -> bytes:
    try:
        return vault.read(evidence_id, sealed_with)
    except EvidenceUnreadable:
        raise EvidenceRejected("evidence_unreadable") from None
