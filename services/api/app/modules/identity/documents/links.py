"""Short-lived signed links to one identity image (BRD FR-ARCH-007, INT-08).

A link is issued only after the permission and area check, names one
document and one viewer, and expires after 5 minutes. It is signed with a
key derived from JWT_SECRET for this purpose alone, and carries its own
audience, so a session token can never be used as a link or a link as a
session token. Using a link still needs the viewer's own session.
"""

import hashlib
import hmac
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt

LINK_LIFETIME = timedelta(minutes=5)
_AUDIENCE = "my-people:identity-evidence"


class LinkExpired(Exception):
    pass


class LinkInvalid(Exception):
    pass


@dataclass(frozen=True)
class ViewLink:
    link_id: uuid.UUID
    document_id: uuid.UUID
    viewer_id: uuid.UUID
    expires_at: datetime


def _link_key(jwt_secret: str) -> bytes:
    return hmac.new(jwt_secret.encode("utf-8"), b"my-people identity evidence link v1", hashlib.sha256).digest()


def sign_view_link(
    document_id: uuid.UUID, viewer_id: uuid.UUID, jwt_secret: str, issued_at: datetime | None = None
) -> tuple[str, ViewLink]:
    issued_at = issued_at or datetime.now(UTC)
    link = ViewLink(
        link_id=uuid.uuid4(),
        document_id=document_id,
        viewer_id=viewer_id,
        expires_at=issued_at.replace(microsecond=0) + LINK_LIFETIME,
    )
    payload = {
        "jti": str(link.link_id),
        "doc": str(document_id),
        "sub": str(viewer_id),
        "aud": _AUDIENCE,
        "iat": int(issued_at.timestamp()),
        "exp": int(link.expires_at.timestamp()),
    }
    return jwt.encode(payload, _link_key(jwt_secret), algorithm="HS256"), link


def read_view_link(token: str, jwt_secret: str) -> ViewLink:
    try:
        payload = jwt.decode(
            token,
            _link_key(jwt_secret),
            algorithms=["HS256"],
            audience=_AUDIENCE,
            options={"require": ["jti", "doc", "sub", "aud", "exp"]},
        )
        return ViewLink(
            link_id=uuid.UUID(payload["jti"]),
            document_id=uuid.UUID(payload["doc"]),
            viewer_id=uuid.UUID(payload["sub"]),
            expires_at=datetime.fromtimestamp(payload["exp"], UTC),
        )
    except jwt.ExpiredSignatureError:
        raise LinkExpired() from None
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise LinkInvalid() from None
