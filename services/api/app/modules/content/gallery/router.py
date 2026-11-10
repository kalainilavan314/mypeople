import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.rules import Area
from app.modules.access.service import AccessRefused, Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.content.gallery import service
from app.modules.content.gallery.dependencies import PhotoBody, Store
from app.modules.content.gallery.images import ACCEPTED_TYPES, ImageRejected
from app.modules.content.gallery.media_store import PhotoMissing
from app.modules.content.gallery.rules import PUBLISH, TAKEDOWN
from app.modules.content.gallery.schemas import (
    AlbumCreateIn,
    AlbumDetailOut,
    AlbumSummaryOut,
    AlbumUpdateIn,
    PhotoCaptionsIn,
    RemovalDecisionIn,
    ManagedAlbumOut,
    GalleryPhotoOut,
    PublicRemovalRequestIn,
    QueuedRemovalOut,
    RemovalReceiptOut,
    RemovalRequestIn,
    AlbumReturnIn,
)

router = APIRouter(prefix="/v1/content", tags=["gallery"])

Db = Annotated[Session, Depends(get_db)]
CanPublish = Annotated[Staff, Depends(require_permission(PUBLISH))]
CanTakeDown = Annotated[Staff, Depends(require_permission(TAKEDOWN))]

NOT_FOUND = {404: {"description": "not_found"}}
REFUSED = {403: {"description": "forbidden or outside_your_area"}, **NOT_FOUND}
_BINARY = {"schema": {"type": "string", "format": "binary"}}
PHOTO_BODY: dict[str, Any] = {
    "requestBody": {"required": True, "content": {media_type: _BINARY for media_type in ACCEPTED_TYPES}}
}
# Shown inside the app, never offered as a download (BR-071), and nothing in it may run.
PHOTO_HEADERS = {
    "Content-Disposition": "inline",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "same-site",
    "X-Robots-Tag": "noindex, nofollow",
}


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found")


def _forbidden(error: AccessRefused) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code)


def _conflict(error: service.GalleryRefused) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=error.code)


def _invalid(error: service.GalleryInvalid) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "album_invalid", "problems": error.problems}
    )


# --- The media console (GAP-04, FR-ADM-005); declared before /albums/{album_id} -----------------------


@router.get("/albums/manage")
def list_managed_albums(
    staff: CanPublish,
    db: Db,
    state: Annotated[list[Literal["draft", "submitted", "published"]] | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0, le=100000)] = 0,
) -> list[AlbumSummaryOut]:
    """Albums in the caller's areas, newest first: drafts and submitted ones unless asked otherwise."""
    states = list(state) if state else ["draft", "submitted"]
    return [AlbumSummaryOut.build(album) for album in service.managed_albums(db, staff, states, limit, offset)]


@router.get("/albums/manage/{album_id}", responses=REFUSED)
def read_managed_album(album_id: uuid.UUID, staff: CanPublish, request: Request, db: Db) -> ManagedAlbumOut:
    try:
        detail = service.managed_album(db, staff, album_id, client_ip(request))
    except service.NotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _forbidden(error) from None
    return ManagedAlbumOut.managed(detail)


def _managed_out(db: Session, staff: Staff, album_id: uuid.UUID, request: Request) -> ManagedAlbumOut:
    return ManagedAlbumOut.managed(service.managed_album(db, staff, album_id, client_ip(request)))


@router.post("/albums", status_code=status.HTTP_201_CREATED, responses={**REFUSED, 422: {"description": "album_invalid"}})
def create_album(body: AlbumCreateIn, staff: CanPublish, request: Request, db: Db) -> ManagedAlbumOut:
    """A draft album in an area where the caller holds gallery.publish."""
    try:
        album = service.create_album(
            db, staff, body.model_dump(exclude={"area"}), Area(body.area.level, body.area.code), client_ip(request)
        )
    except AccessRefused as error:
        raise _forbidden(error) from None
    except service.GalleryInvalid as error:
        raise _invalid(error) from None
    return _managed_out(db, staff, album.id, request)


@router.patch("/albums/{album_id}", responses={**REFUSED, 409: {"description": "not_allowed_from:<state>"}})
def update_album(album_id: uuid.UUID, body: AlbumUpdateIn, staff: CanPublish, request: Request, db: Db) -> ManagedAlbumOut:
    try:
        service.update_album(db, staff, album_id, body.model_dump(exclude_unset=True), client_ip(request))
    except service.NotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _forbidden(error) from None
    except service.GalleryRefused as error:
        raise _conflict(error) from None
    except service.GalleryInvalid as error:
        raise _invalid(error) from None
    return _managed_out(db, staff, album_id, request)


@router.post(
    "/albums/{album_id}/photos",
    status_code=status.HTTP_201_CREATED,
    openapi_extra=PHOTO_BODY,
    responses={
        **REFUSED,
        400: {"description": "empty_file"},
        409: {"description": "not_allowed_from:<state>"},
        413: {"description": "too_large (over 15 MB) or too_many_pixels"},
        415: {"description": "unsupported_type (JPEG, PNG or WebP)"},
        503: {"description": "media_storage_not_configured"},
    },
)
def add_photo(
    album_id: uuid.UUID, photo: PhotoBody, staff: CanPublish, store: Store, request: Request, db: Db
) -> GalleryPhotoOut:
    """Add a photo to a draft. It is re-encoded as WebP without any metadata (GPS included)."""
    try:
        stored = service.add_photo(db, store, staff, album_id, photo, client_ip(request))
    except service.NotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _forbidden(error) from None
    except service.GalleryRefused as error:
        raise _conflict(error) from None
    except ImageRejected as error:
        code = status.HTTP_413_CONTENT_TOO_LARGE if error.code == "too_many_pixels" else status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
        raise HTTPException(status_code=code, detail=error.code) from None
    return GalleryPhotoOut.build(stored, stored.position)


@router.patch("/photos/{photo_id}", responses={**REFUSED, 409: {"description": "not_allowed_from:<state>"}})
def update_captions(photo_id: uuid.UUID, body: PhotoCaptionsIn, staff: CanPublish, request: Request, db: Db) -> GalleryPhotoOut:
    """Captions change only while the album is a draft."""
    try:
        photo = service.update_captions(db, staff, photo_id, body.model_dump(exclude_unset=True), client_ip(request))
    except service.NotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _forbidden(error) from None
    except service.GalleryRefused as error:
        raise _conflict(error) from None
    return GalleryPhotoOut.build(photo, photo.position)


@router.delete(
    "/photos/{photo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**REFUSED, 409: {"description": "not_allowed_from:<state>"}, 503: {"description": "media_storage_not_configured"}},
)
def delete_photo(photo_id: uuid.UUID, staff: CanPublish, store: Store, request: Request, db: Db) -> None:
    """Only from a draft; a published photo leaves through a removal decision."""
    try:
        service.delete_photo(db, store, staff, photo_id, client_ip(request))
    except service.NotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _forbidden(error) from None
    except service.GalleryRefused as error:
        raise _conflict(error) from None


@router.post(
    "/albums/{album_id}/submit",
    responses={**REFUSED, 409: {"description": "not_allowed_from:<state>"}, 422: {"description": "album_invalid"}},
)
def submit_album(album_id: uuid.UUID, staff: CanPublish, request: Request, db: Db) -> ManagedAlbumOut:
    """For approval: needs a bilingual summary, both captions on every photo (a missing Tamil caption
    blocks it) and, for an event album, a published event."""
    try:
        service.submit_album(db, staff, album_id, client_ip(request))
    except service.NotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _forbidden(error) from None
    except service.GalleryRefused as error:
        raise _conflict(error) from None
    except service.GalleryInvalid as error:
        raise _invalid(error) from None
    return _managed_out(db, staff, album_id, request)


@router.post(
    "/albums/{album_id}/publish",
    responses={**REFUSED, 409: {"description": "not_allowed_from:<state>, own_submission or silence_period"}},
)
def publish_album(album_id: uuid.UUID, staff: CanPublish, request: Request, db: Db) -> ManagedAlbumOut:
    """Publish a submitted album; never by the person who submitted it."""
    try:
        service.publish_album(db, staff, album_id, client_ip(request))
    except service.NotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _forbidden(error) from None
    except service.GalleryRefused as error:
        raise _conflict(error) from None
    return _managed_out(db, staff, album_id, request)


@router.post("/albums/{album_id}/return", responses={**REFUSED, 409: {"description": "not_allowed_from:<state>"}})
def return_album(album_id: uuid.UUID, body: AlbumReturnIn, staff: CanPublish, request: Request, db: Db) -> ManagedAlbumOut:
    """Send a submitted album back to draft with a note for its author."""
    try:
        service.return_album(db, staff, album_id, body.note, client_ip(request))
    except service.NotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _forbidden(error) from None
    except service.GalleryRefused as error:
        raise _conflict(error) from None
    return _managed_out(db, staff, album_id, request)


# --- Removal requests: members, the public form and the queue (FR-GAL-004, 005, 007, FR-ADM-006) ---------


@router.get("/removal-requests/mine")
def list_my_requests(member: CurrentMember, db: Db) -> list[RemovalReceiptOut]:
    return [RemovalReceiptOut.build(request) for request in service.my_requests(db, member.id)]


@router.post(
    "/removal-requests/public",
    status_code=status.HTTP_201_CREATED,
    responses={**NOT_FOUND, 429: {"description": "too_many_requests, with Retry-After"}},
)
def request_removal_publicly(body: PublicRemovalRequestIn, request: Request, db: Db) -> RemovalReceiptOut:
    """For someone who is not a member (FR-GAL-007): name the album and the photo's number. The same
    24-hour queue handles it."""
    try:
        receipt = service.request_removal_publicly(
            db,
            album_ref=body.album_ref,
            photo_number=body.photo_number,
            reason=body.reason,
            note=body.note,
            contact=body.contact,
            ip=client_ip(request),
        )
    except service.TooManyRequests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="too_many_requests", headers={"Retry-After": "3600"}
        ) from None
    except service.NotFound:
        raise _not_found() from None
    return RemovalReceiptOut.build(receipt)


@router.get("/removal-requests")
def list_removal_requests(
    staff: CanTakeDown,
    db: Db,
    state: Annotated[list[Literal["open", "removed", "blurred", "kept"]] | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0, le=100000)] = 0,
) -> list[QueuedRemovalOut]:
    """The queue in the caller's areas, soonest due first, with the 18-hour escalation flag."""
    states = list(state) if state else ["open"]
    return [QueuedRemovalOut.queued(item) for item in service.removal_queue(db, staff, states, limit, offset)]


@router.post(
    "/removal-requests/{request_id}/decision",
    responses={**REFUSED, 409: {"description": "already_decided"}, 503: {"description": "media_storage_not_configured"}},
)
def decide_removal(
    request_id: uuid.UUID,
    body: RemovalDecisionIn,
    staff: CanTakeDown,
    store: Store,
    request: Request,
    background: BackgroundTasks,
    db: Db,
) -> RemovalReceiptOut:
    """Remove, blur or keep, always with a reason; the requester is told by SMS when a number is known."""
    try:
        decided, outcome = service.decide_removal(db, store, staff, request_id, body.decision, body.reason, client_ip(request))
    except service.NotFound:
        raise _not_found() from None
    except AccessRefused as error:
        raise _forbidden(error) from None
    except service.GalleryRefused as error:
        raise _conflict(error) from None
    if outcome.messages:
        background.add_task(service.deliver, request.app.state.sms, outcome)
    return RemovalReceiptOut.build(decided)


# --- Members (G01 to G03) -----------------------------------------------------------------------------------


@router.get("/albums")
def list_albums(
    member: CurrentMember,
    db: Db,
    category: Annotated[Literal["events", "community"] | None, Query()] = None,
    q: Annotated[str | None, Query(max_length=100, description="Search titles and places")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[AlbumSummaryOut]:
    """G01: published albums, newest first."""
    albums = service.published_albums(db, category=category, search=q.strip() if q else None, limit=limit)
    return [AlbumSummaryOut.build(album) for album in albums]


@router.get("/albums/{album_id}", responses=NOT_FOUND)
def read_album(album_id: uuid.UUID, member: CurrentMember, db: Db) -> AlbumDetailOut:
    """G02, with the photos still shown (blurred ones say so)."""
    try:
        return AlbumDetailOut.from_detail(service.album_detail(db, album_id))
    except service.NotFound:
        raise _not_found() from None


@router.get(
    "/photos/{photo_id}/{size}",
    response_class=Response,
    responses={200: {"content": {"image/webp": _BINARY}}, **NOT_FOUND, 503: {"description": "media_storage_not_configured"}},
)
def read_photo(
    photo_id: uuid.UUID, size: Literal["thumb", "display"], member: CurrentMember, store: Store, db: Db
) -> Response:
    """G03: the image, shown inside the app; thumbnails first on a slow connection (FR-GAL-006)."""
    try:
        data = service.photo_file(db, store, member.id, photo_id, size)
    except (service.NotFound, PhotoMissing):
        raise _not_found() from None
    return Response(content=data, media_type="image/webp", headers=PHOTO_HEADERS)


@router.post(
    "/photos/{photo_id}/removal-requests",
    status_code=status.HTTP_201_CREATED,
    responses=NOT_FOUND,
)
def request_removal(
    photo_id: uuid.UUID, body: RemovalRequestIn, member: CurrentMember, request: Request, db: Db
) -> RemovalReceiptOut:
    """G03 "Report a concern / Request photo removal": a receipt, due within 24 hours (FR-GAL-004)."""
    try:
        receipt = service.request_removal(db, member.id, photo_id, body.reason, body.note, client_ip(request))
    except service.NotFound:
        raise _not_found() from None
    return RemovalReceiptOut.build(receipt)
