"""The gallery: published albums, the media console and photo removal requests (BRD G01 to G03,
GAP-04; FR-GAL-001 to 007, FR-ADM-005, 006, BR-069 to BR-072).

Members see published albums and their photos, and nothing else: no upload,
download, sharing or tagging (BR-069, BR-071). Every photo carries a
removal request route, for members and, through a public form, for people
who are not (FR-GAL-004, 007); each request gets a receipt and is due 24
hours after it was made (BR-070). A request open 18 hours is flagged for
Tier 5 in the queue [ASSUMPTION]; alerting Tier 5 waits on notifications.

Media staff (gallery.publish) build albums in their own areas: photos are
re-encoded without metadata (images.py), captions are bilingual, and an
event album links a published event (BR-072). A different gallery.publish
holder publishes a submitted album or returns it with a note.

Removal decisions (gallery.takedown over the album's area) remove the
photo and its files, blur it, or keep it with a reason. The requester is
told by SMS when a number is known (FR-GAL-005).
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.integrations.sms import SmsSender, SmsUnavailable
from app.modules.access import repository as access_repository
from app.modules.access import service as access
from app.modules.access.rules import Area, AreaPath, area_from_key
from app.modules.access.service import Staff, load_staff
from app.modules.audit import service as audit
from app.modules.content.gallery import images, repository, rules
from app.modules.content.gallery.media_store import MediaStore
from app.modules.content.gallery.repository import StoredAlbum, StoredPhoto, StoredRequest
from app.modules.content.gallery.rules import PUBLISH, TAKEDOWN, Decision, RemovalReason
from app.modules.identity.recovery import repository as contacts
from app.modules.messaging.notifications import service as notifications
from app.modules.identity.recovery import rules as contact_rules


class NotFound(Exception):
    pass


class GalleryRefused(Exception):
    """An action the album's or request's state does not allow; code is the reason."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class GalleryInvalid(Exception):
    def __init__(self, problems: list[str]) -> None:
        super().__init__(", ".join(problems))
        self.problems = problems


class TooManyRequests(Exception):
    pass


def _area_path(keys: list[str]) -> AreaPath:
    return tuple(area_from_key(key) for key in keys)


def _audit(db: Session, actor_id: uuid.UUID | None, action: str, target: tuple[str, str], area: list[str], ip: str,
           **details: object) -> None:
    audit.record(
        db, actor_id=actor_id, action=action, target_type=target[0], target_id=target[1],
        area_path=_area_path(area), details=details, ip=ip,
    )


# --- Members (G01 to G03) -----------------------------------------------------------------------------


def published_albums(db: Session, *, category: str | None, search: str | None, limit: int) -> list[StoredAlbum]:
    return repository.published_albums(db, category=category, search=search, limit=limit)


@dataclass(frozen=True)
class AlbumDetail:
    album: StoredAlbum
    photos: list[StoredPhoto]
    event_titles: tuple[str, str] | None


def _detail(db: Session, album: StoredAlbum) -> AlbumDetail:
    titles = repository.event_titles(db, album.event_id) if album.event_id else None
    return AlbumDetail(album=album, photos=repository.album_photos(db, album.id), event_titles=titles)


def album_detail(db: Session, album_id: uuid.UUID) -> AlbumDetail:
    album = repository.find_album(db, album_id)
    if album is None or album.state != "published":
        raise NotFound()
    return _detail(db, album)


def _may_see_unpublished(db: Session, member_id: uuid.UUID, album: StoredAlbum) -> bool:
    staff = load_staff(db, member_id)
    path = _area_path(album.area_path)
    return access.has_permission_over(staff, PUBLISH, path) or access.has_permission_over(staff, TAKEDOWN, path)


def photo_file(db: Session, store: MediaStore, member_id: uuid.UUID, photo_id: uuid.UUID, size: str) -> bytes:
    """A photo of a published album; media and takedown staff also see their areas' unpublished albums."""
    photo = repository.find_photo(db, photo_id)
    album = repository.find_album(db, photo.album_id) if photo else None
    if photo is None or album is None or photo.state == "removed":
        raise NotFound()
    if album.state != "published" and not _may_see_unpublished(db, member_id, album):
        raise NotFound()
    return store.read(photo_id, size)


def _visible_photo(db: Session, photo_id: uuid.UUID) -> tuple[StoredPhoto, StoredAlbum]:
    photo = repository.find_photo(db, photo_id)
    album = repository.find_album(db, photo.album_id) if photo else None
    if photo is None or album is None or album.state != "published" or photo.state == "removed":
        raise NotFound()
    return photo, album


def request_removal(
    db: Session, member_id: uuid.UUID, photo_id: uuid.UUID, reason: RemovalReason, note: str, ip: str
) -> StoredRequest:
    """A receipt for the request (BR-028); asking again about the same photo returns the open one."""
    photo, album = _visible_photo(db, photo_id)
    existing = repository.open_request_of(db, photo_id, member_id)
    if existing is not None:
        return existing
    request = repository.insert_request(
        db, photo_id=photo.id, reason=reason, note=note, requester_id=member_id, contact=None, ip=ip,
        area_path=album.area_path,
    )
    # The note stays on the request; the audit entry holds ids only.
    _audit(db, member_id, "gallery.removal.requested", ("removal_request", str(request.id)), album.area_path, ip,
           requestRef=request.request_ref, photoId=str(photo.id), reason=reason)
    db.commit()
    return request


def request_removal_publicly(
    db: Session, *, album_ref: str, photo_number: int, reason: RemovalReason, note: str, contact: str, ip: str
) -> StoredRequest:
    """FR-GAL-007: someone who is not a member names the album and the photo's number in it."""
    if repository.public_requests_from(db, ip) >= rules.MAX_PUBLIC_REQUESTS_PER_HOUR:
        raise TooManyRequests()
    album = repository.find_album_by_ref(db, album_ref.strip().upper())
    photo = repository.photo_at(db, album.id, photo_number) if album and album.state == "published" else None
    if album is None or photo is None:
        raise NotFound()
    request = repository.insert_request(
        db, photo_id=photo.id, reason=reason, note=note, requester_id=None, contact=contact.strip(), ip=ip,
        area_path=album.area_path,
    )
    _audit(db, None, "gallery.removal.requested", ("removal_request", str(request.id)), album.area_path, ip,
           requestRef=request.request_ref, photoId=str(photo.id), reason=reason, public=True)
    db.commit()
    return request


def my_requests(db: Session, member_id: uuid.UUID) -> list[StoredRequest]:
    return repository.requests_of(db, member_id)


# --- The media console (GAP-04, FR-ADM-005) ------------------------------------------------------------


def _check_scope(db: Session, staff: Staff, permission: str, area_keys: list[str], target: tuple[str, str], ip: str) -> None:
    path = _area_path(area_keys)
    if not access.has_permission_over(staff, permission, path):
        access.refuse(db, staff, permission, "outside_your_area", ip, target=target, area_path=path)


def _managed(db: Session, staff: Staff, album_id: uuid.UUID, ip: str) -> StoredAlbum:
    album = repository.find_album(db, album_id, for_update=True)
    if album is None:
        raise NotFound()
    _check_scope(db, staff, PUBLISH, album.area_path, ("album", str(album.id)), ip)
    return album


def _require(action: rules.AlbumAction, album: StoredAlbum) -> None:
    problem = rules.check_transition(action, album.state)
    if problem:
        raise GalleryRefused(problem)


def _check_event(db: Session, event_id: uuid.UUID | None) -> None:
    if event_id is not None and repository.event_state(db, event_id) is None:
        raise GalleryInvalid(["unknown_event"])


def create_album(db: Session, staff: Staff, details: dict[str, Any], area: Area, ip: str) -> StoredAlbum:
    path = access_repository.area_path(db, area)
    if path is None:
        raise GalleryInvalid(["unknown_area"])
    keys = [a.key for a in path]
    _check_scope(db, staff, PUBLISH, keys, ("album", "new"), ip)
    _check_event(db, details.get("event_id"))
    album = repository.insert_album(db, details=details, area_key=area.key, area_path=keys, created_by=staff.member_id)
    _audit(db, staff.member_id, "gallery.album.created", ("album", str(album.id)), keys, ip, albumRef=album.album_ref)
    db.commit()
    return album


def update_album(db: Session, staff: Staff, album_id: uuid.UUID, changes: dict[str, Any], ip: str) -> StoredAlbum:
    album = _managed(db, staff, album_id, ip)
    _require("edit", album)
    if "event_id" in changes:
        _check_event(db, changes["event_id"])
    if changes:
        repository.update_album(db, album_id, changes)
        _audit(db, staff.member_id, "gallery.album.updated", ("album", str(album.id)), album.area_path, ip,
               albumRef=album.album_ref, changed=sorted(changes))
    db.commit()
    updated = repository.find_album(db, album_id)
    assert updated is not None
    return updated


def add_photo(db: Session, store: MediaStore, staff: Staff, album_id: uuid.UUID, data: bytes, ip: str) -> StoredPhoto:
    album = _managed(db, staff, album_id, ip)
    _require("edit", album)
    prepared = images.prepare(data)
    photo_id = uuid.uuid4()
    # Files first: a failed commit can leave unused files, never a record without its image.
    store.save(photo_id, "display", prepared.display)
    store.save(photo_id, "thumb", prepared.thumb)
    photo = repository.insert_photo(
        db, photo_id=photo_id, album_id=album_id, width=prepared.width, height=prepared.height, created_by=staff.member_id
    )
    _audit(db, staff.member_id, "gallery.photo.added", ("photo", str(photo_id)), album.area_path, ip,
           albumRef=album.album_ref)
    db.commit()
    return photo


def _managed_photo(db: Session, staff: Staff, photo_id: uuid.UUID, ip: str) -> tuple[StoredPhoto, StoredAlbum]:
    photo = repository.find_photo(db, photo_id)
    if photo is None:
        raise NotFound()
    album = _managed(db, staff, photo.album_id, ip)
    _require("edit", album)
    return photo, album


def update_captions(db: Session, staff: Staff, photo_id: uuid.UUID, captions: dict[str, str], ip: str) -> StoredPhoto:
    photo, _ = _managed_photo(db, staff, photo_id, ip)
    if captions:
        repository.update_captions(db, photo.id, captions)
    db.commit()
    updated = repository.find_photo(db, photo.id)
    assert updated is not None
    return updated


def delete_photo(db: Session, store: MediaStore, staff: Staff, photo_id: uuid.UUID, ip: str) -> None:
    """Only from a draft: a published photo leaves only through a removal decision."""
    photo, album = _managed_photo(db, staff, photo_id, ip)
    repository.delete_photo(db, photo.id)
    _audit(db, staff.member_id, "gallery.photo.deleted", ("photo", str(photo.id)), album.area_path, ip,
           albumRef=album.album_ref)
    db.commit()
    store.delete(photo.id)


def submit_album(db: Session, staff: Staff, album_id: uuid.UUID, ip: str) -> StoredAlbum:
    album = _managed(db, staff, album_id, ip)
    _require("submit", album)
    problems = rules.check_submission(
        summary_en=album.summary_en,
        summary_ta=album.summary_ta,
        category=album.category,
        event_state=repository.event_state(db, album.event_id) if album.event_id else None,
        captions=[(p.caption_en, p.caption_ta) for p in repository.album_photos(db, album.id)],
    )
    if problems:
        raise GalleryInvalid(problems)
    repository.submit(db, album_id, staff.member_id)
    _audit(db, staff.member_id, "gallery.album.submitted", ("album", str(album.id)), album.area_path, ip,
           albumRef=album.album_ref)
    db.commit()
    submitted = repository.find_album(db, album_id)
    assert submitted is not None
    return submitted


def publish_album(db: Session, staff: Staff, album_id: uuid.UUID, ip: str) -> StoredAlbum:
    album = _managed(db, staff, album_id, ip)
    _require("publish", album)
    problem = rules.check_publisher(staff.member_id, album.submitted_by)
    if problem:
        raise GalleryRefused(problem)
    repository.publish(db, album_id, staff.member_id)
    _audit(db, staff.member_id, "gallery.album.published", ("album", str(album.id)), album.area_path, ip,
           albumRef=album.album_ref)
    db.commit()
    published = repository.find_album(db, album_id)
    assert published is not None
    return published


def return_album(db: Session, staff: Staff, album_id: uuid.UUID, note: str, ip: str) -> StoredAlbum:
    album = _managed(db, staff, album_id, ip)
    _require("return", album)
    repository.return_to_draft(db, album_id, note)
    _audit(db, staff.member_id, "gallery.album.returned", ("album", str(album.id)), album.area_path, ip,
           albumRef=album.album_ref)
    db.commit()
    returned = repository.find_album(db, album_id)
    assert returned is not None
    return returned


def managed_albums(db: Session, staff: Staff, states: list[str], limit: int) -> list[StoredAlbum]:
    return repository.managed_albums(db, visible_areas=access.visible_areas(staff, PUBLISH), states=states, limit=limit)


def managed_album(db: Session, staff: Staff, album_id: uuid.UUID, ip: str) -> AlbumDetail:
    album = repository.find_album(db, album_id)
    if album is None:
        raise NotFound()
    _check_scope(db, staff, PUBLISH, album.area_path, ("album", str(album.id)), ip)
    return _detail(db, album)


# --- Removal requests (GAP-04, FR-ADM-006) ---------------------------------------------------------------


@dataclass(frozen=True)
class QueuedRequest:
    request: StoredRequest
    escalated: bool  # open 18 hours or more


def removal_queue(db: Session, staff: Staff, states: list[str], limit: int) -> list[QueuedRequest]:
    now = datetime.now(UTC)
    requests = repository.queue(db, visible_areas=access.visible_areas(staff, TAKEDOWN), states=states, limit=limit)
    return [QueuedRequest(r, r.state == "open" and rules.escalated(r.created_at, now)) for r in requests]


@dataclass(frozen=True)
class Outcome:
    messages: list[tuple[str, str]]  # (phone, text), one for each requester with a known number


def _requester_phone(db: Session, request: StoredRequest) -> str | None:
    if request.requester_id is not None:
        contact = contacts.find_contact(db, request.requester_id)
        return contact.phone if contact else None
    return contact_rules.normalise_phone(request.contact or "")  # a public request gave a number, or not


def decide_removal(
    db: Session, store: MediaStore, staff: Staff, request_id: uuid.UUID, decision: Decision, reason: str, ip: str
) -> tuple[StoredRequest, Outcome]:
    request = repository.find_request(db, request_id, for_update=True)
    if request is None:
        raise NotFound()
    target = ("removal_request", str(request.id))
    _check_scope(db, staff, TAKEDOWN, request.area_path, target, ip)
    if request.requester_id == staff.member_id:
        access.refuse(db, staff, TAKEDOWN, "own_record", ip, target=target, area_path=_area_path(request.area_path))
    if request.state != "open":
        raise GalleryRefused("already_decided")

    state = rules.DECISION_STATE[decision]
    decided = [request]
    if decision == "blur":
        for size in images.SIZES:
            store.save(request.photo_id, size, images.blurred(store.read(request.photo_id, size)))
        repository.set_photo_state(db, request.photo_id, "blurred")
    elif decision == "remove":
        repository.set_photo_state(db, request.photo_id, "removed")
        # Every other open request about the photo is answered by its removal.
        for other_id in repository.other_open_requests(db, request.photo_id, request.id):
            repository.decide(db, other_id, state=state, reason=reason, decided_by=staff.member_id)
            other = repository.find_request(db, other_id)
            assert other is not None
            decided.append(other)
    repository.decide(db, request.id, state=state, reason=reason, decided_by=staff.member_id)
    for answered in decided:
        if answered.requester_id is not None:
            notifications.notify(db, answered.requester_id, "removal_decided", answered.id)
        # A Tier 5 alert about it no longer needs action (BR-027).
        notifications.complete_action(db, "removal_request", answered.id)
    # The reason stays on the request; the audit entry holds ids only.
    _audit(db, staff.member_id, "gallery.removal.decided", target, request.area_path, ip,
           requestRef=request.request_ref, decision=decision, photoId=str(request.photo_id))
    messages = [
        (phone, rules.outcome_message(r.request_ref, state)) for r in decided if (phone := _requester_phone(db, r))
    ]
    db.commit()
    if decision == "remove":
        store.delete(request.photo_id)
    final = repository.find_request(db, request.id)
    assert final is not None
    return final, Outcome(messages=messages)


def escalate_overdue(db: Session) -> int:
    """FR-ADM-006: alert Tier 5 once about each request still open after 18 hours; for the
    dispatcher. Returns how many requests were escalated."""
    overdue = repository.overdue_unescalated(db, rules.ESCALATE_AFTER)
    holders = repository.tier5_takedown_holders(db) if overdue else []
    for request_id in overdue:
        for holder in holders:
            notifications.notify(db, holder, "removal_escalated", request_id)
        repository.mark_escalated(db, request_id)
    db.commit()
    return len(overdue)


def deliver(sms: SmsSender, outcome: Outcome) -> None:
    """Sent after the response; best effort."""
    for phone, text in outcome.messages:
        try:
            sms.send(phone, text)
        except SmsUnavailable:
            return
