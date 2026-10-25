"""FastAPI dependencies for the gallery's photo store and photo uploads."""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from app.core.config import Settings
from app.modules.auth.dependencies import CurrentMember
from app.modules.content.gallery.images import ACCEPTED_TYPES, MAX_UPLOAD_BYTES
from app.modules.content.gallery.media_store import MediaStore


def build_media_store(settings: Settings) -> MediaStore | None:
    return MediaStore(settings.media_storage_dir) if settings.media_storage_dir else None


def get_media_store(request: Request) -> MediaStore:
    store: MediaStore | None = request.app.state.media_store
    if store is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="media_storage_not_configured")
    return store


Store = Annotated[MediaStore, Depends(get_media_store)]


def _declared_type(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


async def read_photo_body(request: Request, _member: CurrentMember) -> bytes:
    """The request body as one photo: JPEG, PNG or WebP, at most 15 MB, of the type declared.

    Depends on a session, so nobody can make the API read 15 MB without one;
    the size is checked while reading. The image is decoded and re-encoded
    afterwards (images.prepare), which is what removes its metadata.
    """
    declared = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if declared not in ACCEPTED_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="unsupported_type")
    length = request.headers.get("content-length", "")
    if length.isdigit() and int(length) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="too_large")
    body = bytearray()
    async for chunk in request.stream():
        body += chunk
        if len(body) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="too_large")
    if not body:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="empty_file")
    if _declared_type(bytes(body)) != declared:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="unsupported_type")
    return bytes(body)


PhotoBody = Annotated[bytes, Depends(read_photo_body)]
