import uuid
from datetime import datetime
from typing import Literal, Self

from app.core.schemas import CamelModel
from app.modules.identity.documents.repository import DocumentKind, StoredDocument
from app.modules.identity.documents.service import EvidenceView


class DocumentOut(CamelModel):
    """An identity image the server holds (BR-020). Never the image itself."""

    id: uuid.UUID
    kind: DocumentKind
    version: int
    content_type: str
    byte_size: int
    server_ack_at: datetime

    @classmethod
    def from_stored(cls, document: StoredDocument) -> Self:
        return cls(
            id=document.id,
            kind=document.kind,
            version=document.version,
            content_type=document.content_type,
            byte_size=document.byte_size,
            server_ack_at=document.server_ack_at,
        )


class ViewLinkOut(CamelModel):
    """A path on this API that shows one image to the reviewer it was issued to, until expiresAt."""

    url: str
    expires_at: datetime


class EvidenceViewOut(CamelModel):
    """FR-AUTH-024: the date and the role, never the person."""

    viewed_at: datetime
    kind: str
    role: Literal["identity_reviewer"] = "identity_reviewer"

    @classmethod
    def from_view(cls, view: EvidenceView) -> Self:
        return cls(viewed_at=view.viewed_at, kind=view.kind)
