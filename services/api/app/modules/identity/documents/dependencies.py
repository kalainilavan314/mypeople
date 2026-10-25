"""FastAPI dependencies for the evidence vault and image uploads."""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from app.core.config import Settings
from app.modules.auth.dependencies import CurrentMember
from app.modules.identity.documents.images import ACCEPTED_TYPES, MAX_IMAGE_BYTES, image_type
from app.modules.identity.documents.service import UploadedImage
from app.modules.identity.documents.vault import EvidenceVault, FileStore


def build_vault(settings: Settings) -> EvidenceVault | None:
    """The vault from EVIDENCE_STORAGE_DIR and EVIDENCE_ENCRYPTION_KEY, or None when they are unset."""
    if settings.evidence_storage_dir is None or settings.evidence_key is None:
        return None
    return EvidenceVault(FileStore(settings.evidence_storage_dir), settings.evidence_key)


def get_vault(request: Request) -> EvidenceVault:
    vault: EvidenceVault | None = request.app.state.evidence_vault
    if vault is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="evidence_storage_not_configured")
    return vault


Vault = Annotated[EvidenceVault, Depends(get_vault)]


def _refuse(status_code: int, code: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail=code)


async def read_image_body(request: Request, _member: CurrentMember) -> UploadedImage:
    """The request body as one identity image: JPEG, PNG or HEIC, at most 10 MB (FR-REG-010).

    Depends on the signed-in member so that nobody can make the API read
    10 MB without a session. The size is checked while reading, so a body
    without a Content-Length cannot exceed it either.
    """
    declared = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if declared not in ACCEPTED_TYPES:
        raise _refuse(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "unsupported_type")
    length = request.headers.get("content-length", "")
    if length.isdigit() and int(length) > MAX_IMAGE_BYTES:
        raise _refuse(status.HTTP_413_CONTENT_TOO_LARGE, "too_large")

    body = bytearray()
    async for chunk in request.stream():
        body += chunk
        if len(body) > MAX_IMAGE_BYTES:
            raise _refuse(status.HTTP_413_CONTENT_TOO_LARGE, "too_large")
    if not body:
        raise _refuse(status.HTTP_400_BAD_REQUEST, "empty_file")
    # The bytes must be the image type the client declared, so a PDF sent as image/jpeg is refused.
    if image_type(bytes(body)) != declared:
        raise _refuse(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "unsupported_type")
    return UploadedImage(content_type=declared, data=bytes(body))


Image = Annotated[UploadedImage, Depends(read_image_body)]
