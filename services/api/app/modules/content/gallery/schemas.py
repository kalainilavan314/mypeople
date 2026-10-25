import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.access.schemas import AreaRef
from app.modules.content.gallery.repository import StoredAlbum, StoredPhoto, StoredRequest
from app.modules.content.gallery.service import AlbumDetail, QueuedRequest

Category = Literal["events", "community"]
Reason = Literal["appears_in_photo", "safety", "inaccurate", "other"]


class AlbumSummaryOut(CamelModel):
    """A G01 grid card: cover, title, photo count and date."""

    id: uuid.UUID
    album_ref: str
    title_en: str
    title_ta: str
    category: Category
    place: str
    album_date: date
    photo_count: int
    cover_photo_id: uuid.UUID | None

    @classmethod
    def build(cls, album: StoredAlbum) -> "AlbumSummaryOut":
        return cls(
            id=album.id,
            album_ref=album.album_ref,
            title_en=album.title_en,
            title_ta=album.title_ta,
            category=album.category,  # type: ignore[arg-type]
            place=album.place,
            album_date=album.album_date,
            photo_count=album.photo_count,
            cover_photo_id=album.cover_photo_id,
        )


class GalleryPhotoOut(CamelModel):
    """A photo with its captions. The image is at /v1/content/photos/{id}/thumb or /display;
    there is no download, share or tagging (BR-071)."""

    id: uuid.UUID
    number: int = Field(description="Its place in the album as shown, from 1 (the public removal form uses it)")
    caption_en: str
    caption_ta: str
    width: int
    height: int
    blurred: bool

    @classmethod
    def build(cls, photo: StoredPhoto, number: int) -> "GalleryPhotoOut":
        return cls(
            id=photo.id,
            number=number,
            caption_en=photo.caption_en,
            caption_ta=photo.caption_ta,
            width=photo.width,
            height=photo.height,
            blurred=photo.state == "blurred",
        )


class AlbumDetailOut(AlbumSummaryOut):
    """G02: publisher, bilingual summary, date, area, linked event and the captioned photos."""

    summary_en: str
    summary_ta: str
    publisher: str
    area_key: str
    event_id: uuid.UUID | None
    event_title_en: str | None
    event_title_ta: str | None
    photos: list[GalleryPhotoOut]

    @classmethod
    def from_detail(cls, detail: AlbumDetail) -> "AlbumDetailOut":
        album = detail.album
        return cls(
            **AlbumSummaryOut.build(album).model_dump(),
            summary_en=album.summary_en,
            summary_ta=album.summary_ta,
            publisher=album.publisher,
            area_key=album.area_key,
            event_id=album.event_id,
            event_title_en=detail.event_titles[0] if detail.event_titles else None,
            event_title_ta=detail.event_titles[1] if detail.event_titles else None,
            photos=[GalleryPhotoOut.build(photo, number) for number, photo in enumerate(detail.photos, start=1)],
        )


class ManagedAlbumOut(AlbumDetailOut):
    state: Literal["draft", "submitted", "published"]
    return_note: str | None
    published_at: datetime | None

    @classmethod
    def managed(cls, detail: AlbumDetail) -> "ManagedAlbumOut":
        return cls(
            **AlbumDetailOut.from_detail(detail).model_dump(),
            state=detail.album.state,  # type: ignore[arg-type]
            return_note=detail.album.return_note,
            published_at=detail.album.published_at,
        )


class RemovalRequestIn(CamelModel):
    reason: Reason
    note: str = Field(default="", max_length=1000)


class PublicRemovalRequestIn(RemovalRequestIn):
    """FR-GAL-007, for someone who is not a member: the album reference (AL-…) and the photo's number."""

    album_ref: str = Field(min_length=4, max_length=20)
    photo_number: int = Field(ge=1, le=10000)
    contact: str = Field(min_length=5, max_length=200, description="A phone number or address to send the outcome to")


class RemovalReceiptOut(CamelModel):
    """BR-028: the tracking reference, where the request stands and who handles it."""

    request_ref: str
    state: Literal["open", "removed", "blurred", "kept"]
    handled_by: str = "Gallery takedown team (gallery.takedown)"
    created_at: datetime
    due_at: datetime = Field(description="24 hours after the request (BR-070)")
    decision_reason: str | None
    decided_at: datetime | None

    @classmethod
    def build(cls, request: StoredRequest) -> "RemovalReceiptOut":
        return cls(
            request_ref=request.request_ref,
            state=request.state,  # type: ignore[arg-type]
            created_at=request.created_at,
            due_at=request.due_at,
            decision_reason=request.decision_reason,
            decided_at=request.decided_at,
        )


class QueuedRemovalOut(RemovalReceiptOut):
    id: uuid.UUID
    photo_id: uuid.UUID
    album_id: uuid.UUID
    album_ref: str
    reason: Reason
    note: str
    from_member: bool
    contact: str | None = Field(description="Only for a request from someone who is not a member")
    escalated: bool = Field(description="Open 18 hours or more: Tier 5 sees it")

    @classmethod
    def queued(cls, item: QueuedRequest) -> "QueuedRemovalOut":
        request = item.request
        return cls(
            **RemovalReceiptOut.build(request).model_dump(),
            id=request.id,
            photo_id=request.photo_id,
            album_id=request.album_id,
            album_ref=request.album_ref,
            reason=request.reason,  # type: ignore[arg-type]
            note=request.note,
            from_member=request.requester_id is not None,
            contact=request.contact,
            escalated=item.escalated,
        )


class RemovalDecisionIn(CamelModel):
    decision: Literal["remove", "blur", "keep"]
    reason: str = Field(min_length=3, max_length=1000)


# --- The media console --------------------------------------------------------------------------------


class AlbumIn(CamelModel):
    title_en: str = Field(min_length=1, max_length=160)
    title_ta: str = Field(min_length=1, max_length=160)
    summary_en: str = Field(default="", max_length=2000)
    summary_ta: str = Field(default="", max_length=2000)
    category: Category
    place: str = Field(default="", max_length=200)
    album_date: date
    publisher: str = Field(min_length=1, max_length=160, description="The office credited, e.g. a district media team")
    event_id: uuid.UUID | None = None


class AlbumCreateIn(AlbumIn):
    area: AreaRef


class AlbumUpdateIn(CamelModel):
    """Only the fields sent change, in a draft; the area stays as created."""

    title_en: str | None = Field(default=None, min_length=1, max_length=160)
    title_ta: str | None = Field(default=None, min_length=1, max_length=160)
    summary_en: str | None = Field(default=None, max_length=2000)
    summary_ta: str | None = Field(default=None, max_length=2000)
    category: Category | None = None
    place: str | None = Field(default=None, max_length=200)
    album_date: date | None = None
    publisher: str | None = Field(default=None, min_length=1, max_length=160)
    event_id: uuid.UUID | None = None


class PhotoCaptionsIn(CamelModel):
    caption_en: str | None = Field(default=None, max_length=500)
    caption_ta: str | None = Field(default=None, max_length=500)


class AlbumReturnIn(CamelModel):
    note: str = Field(min_length=3, max_length=1000)
