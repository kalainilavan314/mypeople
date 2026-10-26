"""/v1/content (the gallery) against a real database. Skipped without DATABASE_URL.

Database changes are rolled back; photos go to a temporary media store and SMS to an in-memory outbox.
"""

import io
import random
from datetime import datetime, timedelta
from collections.abc import Callable
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import Row, text
from sqlalchemy.exc import DBAPIError

from app.db.session import get_db
from app.integrations.sms import DevelopmentSms
from app.main import create_app

PUBLISH = "gallery.publish"
TAKEDOWN = "gallery.takedown"


@pytest.fixture
def media_dir(tmp_path: Path) -> Path:
    return tmp_path / "media"


@pytest.fixture
def client(database_settings, db_session, media_dir) -> TestClient:
    app = create_app(database_settings.model_copy(update={"media_storage_dir": media_dir}))
    app.dependency_overrides[get_db] = lambda: db_session
    app.state.sms = DevelopmentSms()
    return TestClient(app)


@pytest.fixture
def officer(make_reviewer, area) -> Row:
    """A media officer (Tier 3B) who publishes in the district."""
    return make_reviewer(area.district, permissions=(PUBLISH,), tier="3B")


@pytest.fixture
def colleague(make_reviewer, area) -> Row:
    return make_reviewer(area.district, permissions=(PUBLISH,), tier="3B")


@pytest.fixture
def moderator(make_reviewer, area) -> Row:
    return make_reviewer(area.district, permissions=(TAKEDOWN,), tier="3A")


def photo_bytes(colour=(30, 120, 200)) -> bytes:
    image = Image.new("RGB", (1200, 800), "white")
    for x in range(0, 1200, 40):
        image.paste(colour, (x, 0, x + 20, 800))  # detail, so a blur visibly changes it
    exif = Image.Exif()
    exif[0x8825] = {1: "N", 2: (9.0, 40.0, 0.0), 3: "E", 4: (80.0, 0.0, 0.0)}  # a GPS position
    out = io.BytesIO()
    image.save(out, format="JPEG", exif=exif)
    return out.getvalue()


@pytest.fixture
def published_album(client, auth, officer, colleague, area) -> Callable[..., dict]:
    """An album with two captioned photos, submitted by the officer and published by a colleague."""

    def build(**overrides) -> dict:
        body = {
            "titleEn": "Beach clean-up",
            "titleTa": "கடற்கரைச் சுத்தம்",
            "summaryEn": "Volunteers cleaned the shore.",
            "summaryTa": "தன்னார்வலர்கள் கரையைச் சுத்தம் செய்தனர்.",
            "category": "community",
            "place": "Point Pedro",
            "albumDate": "2026-10-20",
            "publisher": "Jaffna district media team",
            "area": {"level": "district", "code": area.district},
            **overrides,
        }
        album = client.post("/v1/content/albums", json=body, headers=auth(officer)).json()
        for colour in ((30, 120, 200), (200, 80, 40)):
            photo = client.post(
                f"/v1/content/albums/{album['id']}/photos",
                content=photo_bytes(colour),
                headers={**auth(officer), "Content-Type": "image/jpeg"},
            ).json()
            client.patch(
                f"/v1/content/photos/{photo['id']}",
                json={"captionEn": "Volunteers at work", "captionTa": "பணியில் தன்னார்வலர்கள்"},
                headers=auth(officer),
            )
        assert client.post(f"/v1/content/albums/{album['id']}/submit", headers=auth(officer)).status_code == 200
        published = client.post(f"/v1/content/albums/{album['id']}/publish", headers=auth(colleague))
        assert published.status_code == 200, published.text
        return published.json()

    return build


# --- Publishing (GAP-04, FR-ADM-005, BR-069, BR-072) ----------------------------------------------------


def test_an_album_needs_both_captions_and_a_second_person_to_publish(client, db_session, auth, officer, colleague, area):
    album = client.post(
        "/v1/content/albums",
        json={
            "titleEn": "Library day", "titleTa": "நூலக நாள்", "summaryEn": "Reading.", "summaryTa": "வாசிப்பு.",
            "category": "community", "albumDate": "2026-10-21", "publisher": "District media team",
            "area": {"level": "district", "code": area.district},
        },
        headers=auth(officer),
    ).json()
    photo = client.post(
        f"/v1/content/albums/{album['id']}/photos", content=photo_bytes(), headers={**auth(officer), "Content-Type": "image/jpeg"}
    ).json()
    client.patch(f"/v1/content/photos/{photo['id']}", json={"captionEn": "Reading corner"}, headers=auth(officer))

    blocked = client.post(f"/v1/content/albums/{album['id']}/submit", headers=auth(officer))
    client.patch(f"/v1/content/photos/{photo['id']}", json={"captionTa": "வாசிப்பு மூலை"}, headers=auth(officer))
    submitted = client.post(f"/v1/content/albums/{album['id']}/submit", headers=auth(officer))
    own = client.post(f"/v1/content/albums/{album['id']}/publish", headers=auth(officer))
    published = client.post(f"/v1/content/albums/{album['id']}/publish", headers=auth(colleague))

    assert (blocked.status_code, blocked.json()["detail"]["problems"]) == (422, ["tamil_caption_missing"])
    assert submitted.json()["state"] == "submitted"
    assert (own.status_code, own.json()) == (409, {"detail": "own_submission"})
    assert published.json()["state"] == "published"
    actions = db_session.scalars(
        text("SELECT action FROM ops.audit_log WHERE target_id = :id ORDER BY id"), {"id": album["id"]}
    ).all()
    assert actions == ["gallery.album.created", "gallery.album.submitted", "gallery.album.published"]


def test_photos_are_stored_as_webp_without_their_location(client, auth, officer, media_dir, area):
    album = client.post(
        "/v1/content/albums",
        json={"titleEn": "x", "titleTa": "x", "category": "community", "albumDate": "2026-10-21",
              "publisher": "Team", "area": {"level": "district", "code": area.district}},
        headers=auth(officer),
    ).json()

    photo = client.post(
        f"/v1/content/albums/{album['id']}/photos", content=photo_bytes(), headers={**auth(officer), "Content-Type": "image/jpeg"}
    ).json()
    pdf = client.post(
        f"/v1/content/albums/{album['id']}/photos", content=b"%PDF-1.7 x", headers={**auth(officer), "Content-Type": "image/jpeg"}
    )

    stored = sorted(path.name for path in media_dir.iterdir())
    assert stored == [f"{photo['id']}-display.webp", f"{photo['id']}-thumb.webp"]
    with Image.open(media_dir / stored[0]) as image:
        assert image.format == "WEBP" and not image.getexif()
    assert (pdf.status_code, pdf.json()) == (415, {"detail": "unsupported_type"})


def test_members_cannot_publish_and_staff_only_in_their_area(client, db_session, auth, member_in, make_reviewer, area):
    member = member_in(area)
    other_district = db_session.scalar(
        text("SELECT district_code FROM geo.district WHERE district_code <> :code ORDER BY district_code LIMIT 1"),
        {"code": area.district},
    )
    outsider = make_reviewer(other_district, permissions=(PUBLISH,), tier="3B")
    body = {"titleEn": "x", "titleTa": "x", "category": "community", "albumDate": "2026-10-21",
            "publisher": "Team", "area": {"level": "district", "code": area.district}}

    by_member = client.post("/v1/content/albums", json=body, headers=auth(member))
    by_outsider = client.post("/v1/content/albums", json=body, headers=auth(outsider))

    assert (by_member.status_code, by_member.json()) == (403, {"detail": "forbidden"})  # BR-069
    assert (by_outsider.status_code, by_outsider.json()) == (403, {"detail": "outside_your_area"})


def test_an_event_album_needs_a_published_event(client, auth, officer, area):
    album = client.post(
        "/v1/content/albums",
        json={"titleEn": "x", "titleTa": "x", "summaryEn": "s", "summaryTa": "s", "category": "events",
              "albumDate": "2026-10-21", "publisher": "Team", "area": {"level": "district", "code": area.district}},
        headers=auth(officer),
    ).json()
    photo = client.post(
        f"/v1/content/albums/{album['id']}/photos", content=photo_bytes(), headers={**auth(officer), "Content-Type": "image/jpeg"}
    ).json()
    client.patch(f"/v1/content/photos/{photo['id']}", json={"captionEn": "a", "captionTa": "அ"}, headers=auth(officer))

    response = client.post(f"/v1/content/albums/{album['id']}/submit", headers=auth(officer))

    assert response.json()["detail"]["problems"] == ["event_required"]


def test_no_album_is_published_during_silence_in_its_area(client, db_session, auth, officer, colleague, area, silence):
    silence(area, level="province")
    album = client.post(
        "/v1/content/albums",
        json={"titleEn": "Library day", "titleTa": "நூலக நாள்", "summaryEn": "s", "summaryTa": "s", "category": "community",
              "albumDate": "2026-10-21", "publisher": "Team", "area": {"level": "district", "code": area.district}},
        headers=auth(officer),
    ).json()
    photo = client.post(
        f"/v1/content/albums/{album['id']}/photos", content=photo_bytes(), headers={**auth(officer), "Content-Type": "image/jpeg"}
    ).json()
    client.patch(f"/v1/content/photos/{photo['id']}", json={"captionEn": "a", "captionTa": "அ"}, headers=auth(officer))
    client.post(f"/v1/content/albums/{album['id']}/submit", headers=auth(officer))

    response = client.post(f"/v1/content/albums/{album['id']}/publish", headers=auth(colleague))

    assert (response.status_code, response.json()) == (409, {"detail": "silence_period"})  # NFR-ELC-03
    state = db_session.scalar(text("SELECT state FROM content.album WHERE id = :id"), {"id": album["id"]})
    assert state == "submitted"


# --- What members see (G01 to G03) ------------------------------------------------------------------------


def test_members_see_published_albums_and_their_photos_only(client, auth, member_in, area, officer, published_album):
    member = member_in(area)
    album = published_album()
    draft = client.post(
        "/v1/content/albums",
        json={"titleEn": "Draft", "titleTa": "வரைவு", "category": "community", "albumDate": "2026-10-22",
              "publisher": "Team", "area": {"level": "district", "code": area.district}},
        headers=auth(officer),
    ).json()

    listed = client.get("/v1/content/albums?category=community&q=beach", headers=auth(member)).json()
    detail = client.get(f"/v1/content/albums/{album['id']}", headers=auth(member)).json()
    thumb = client.get(f"/v1/content/photos/{detail['photos'][0]['id']}/thumb", headers=auth(member))

    assert [a["id"] for a in listed] == [album["id"]]
    assert (listed[0]["photoCount"], listed[0]["coverPhotoId"]) == (2, detail["photos"][0]["id"])
    assert (detail["publisher"], [p["number"] for p in detail["photos"]]) == ("Jaffna district media team", [1, 2])
    assert thumb.headers["content-type"] == "image/webp" and thumb.headers["content-disposition"] == "inline"
    assert client.get(f"/v1/content/albums/{draft['id']}", headers=auth(member)).json() == {"detail": "not_found"}
    assert client.get("/v1/content/albums?category=events", headers=auth(member)).json() == []


# --- Removal requests (FR-GAL-004, 005, 007, FR-ADM-006, BR-070) --------------------------------------------


def confirm_phone(db_session, member: Row) -> str:
    phone = f"+9477{random.randrange(10**6, 10**7)}"
    db_session.execute(
        text("INSERT INTO identity.recovery_contact (member_id, phone) VALUES (:id, :phone)"), {"id": member.id, "phone": phone}
    )
    return phone


def test_a_request_gets_a_receipt_due_in_24_hours_and_appears_in_the_queue(client, db_session, auth, member_in, area, moderator, published_album):
    member = member_in(area)
    album = published_album()
    photo_id = album["photos"][0]["id"]

    receipt = client.post(
        f"/v1/content/photos/{photo_id}/removal-requests", json={"reason": "appears_in_photo"}, headers=auth(member)
    )
    again = client.post(
        f"/v1/content/photos/{photo_id}/removal-requests", json={"reason": "safety"}, headers=auth(member)
    ).json()

    body = receipt.json()
    assert receipt.status_code == 201 and body["requestRef"].startswith("RR-") and body["state"] == "open"
    assert datetime.fromisoformat(body["dueAt"]) - datetime.fromisoformat(body["createdAt"]) == timedelta(hours=24)
    assert again["requestRef"] == body["requestRef"]  # one open request per photo
    assert [r["requestRef"] for r in client.get("/v1/content/removal-requests/mine", headers=auth(member)).json()] == [body["requestRef"]]

    queued = client.get("/v1/content/removal-requests", headers=auth(moderator)).json()
    mine = [q for q in queued if q["requestRef"] == body["requestRef"]]
    assert mine[0]["escalated"] is False and mine[0]["fromMember"] is True
    db_session.execute(
        text("UPDATE content.removal_request SET created_at = created_at - interval '19 hours' WHERE request_ref = :ref"),
        {"ref": body["requestRef"]},
    )
    queued = client.get("/v1/content/removal-requests", headers=auth(moderator)).json()
    assert [q["escalated"] for q in queued if q["requestRef"] == body["requestRef"]] == [True]


def test_blurring_replaces_the_files_and_tells_the_requester(client, db_session, auth, member_in, area, moderator, media_dir, published_album):
    member = member_in(area)
    phone = confirm_phone(db_session, member)
    album = published_album()
    photo_id = album["photos"][0]["id"]
    before = (media_dir / f"{photo_id}-display.webp").read_bytes()
    request = client.post(
        f"/v1/content/photos/{photo_id}/removal-requests", json={"reason": "appears_in_photo", "note": "I am at the front"}, headers=auth(member)
    ).json()
    [queued] = [q for q in client.get("/v1/content/removal-requests", headers=auth(moderator)).json() if q["requestRef"] == request["requestRef"]]

    decided = client.post(
        f"/v1/content/removal-requests/{queued['id']}/decision", json={"decision": "blur", "reason": "Face visible"}, headers=auth(moderator)
    )
    again = client.post(
        f"/v1/content/removal-requests/{queued['id']}/decision", json={"decision": "keep", "reason": "Changed mind"}, headers=auth(moderator)
    )

    assert (decided.json()["state"], decided.json()["decisionReason"]) == ("blurred", "Face visible")
    assert (media_dir / f"{photo_id}-display.webp").read_bytes() != before
    shown = client.get(f"/v1/content/albums/{album['id']}", headers=auth(member)).json()["photos"]
    assert [p["blurred"] for p in shown if p["id"] == photo_id] == [True]
    outbox: DevelopmentSms = client.app.state.sms
    assert any(m.phone == phone and request["requestRef"] in m.text for m in outbox.sent)
    assert (again.status_code, again.json()) == (409, {"detail": "already_decided"})
    with pytest.raises(DBAPIError), db_session.begin_nested():
        db_session.execute(text("UPDATE content.removal_request SET state = 'kept' WHERE id = :id"), {"id": queued["id"]})


def test_removing_hides_the_photo_deletes_its_files_and_answers_every_request(client, db_session, auth, member_in, area, moderator, media_dir, published_album):
    first, second = member_in(area), member_in(area)
    phones = [confirm_phone(db_session, person) for person in (first, second)]
    album = published_album()
    photo_id = album["photos"][1]["id"]
    refs = [
        client.post(f"/v1/content/photos/{photo_id}/removal-requests", json={"reason": "safety"}, headers=auth(person)).json()["requestRef"]
        for person in (first, second)
    ]
    [queued] = [q for q in client.get("/v1/content/removal-requests", headers=auth(moderator)).json() if q["requestRef"] == refs[0]]

    client.post(f"/v1/content/removal-requests/{queued['id']}/decision", json={"decision": "remove", "reason": "Safety risk"}, headers=auth(moderator))

    detail = client.get(f"/v1/content/albums/{album['id']}", headers=auth(first)).json()
    assert [p["id"] for p in detail["photos"]] == [album["photos"][0]["id"]] and detail["photoCount"] == 1
    assert not (media_dir / f"{photo_id}-display.webp").exists()
    assert client.get(f"/v1/content/photos/{photo_id}/thumb", headers=auth(first)).json() == {"detail": "not_found"}
    states = {r["requestRef"]: r["state"] for person in (first, second)
              for r in client.get("/v1/content/removal-requests/mine", headers=auth(person)).json()}
    assert states == {refs[0]: "removed", refs[1]: "removed"}
    outbox: DevelopmentSms = client.app.state.sms
    assert {(m.phone, ref) for m in outbox.sent for ref in refs if ref in m.text} == set(zip(phones, refs))


def test_people_who_are_not_members_can_ask_too_within_a_limit(client, auth, moderator, published_album):
    album = published_album()
    body = {"albumRef": album["albumRef"], "photoNumber": 2, "reason": "appears_in_photo", "contact": "0771234567"}

    receipts = [client.post("/v1/content/removal-requests/public", json=body) for _ in range(4)]
    unknown = client.post("/v1/content/removal-requests/public", json={**body, "photoNumber": 9})

    assert [r.status_code for r in receipts] == [201, 201, 201, 429]
    queued = client.get("/v1/content/removal-requests", headers=auth(moderator)).json()
    public = [q for q in queued if q["requestRef"] == receipts[0].json()["requestRef"]]
    assert (public[0]["fromMember"], public[0]["contact"], public[0]["photoId"]) == (False, "0771234567", album["photos"][1]["id"])
    assert unknown.status_code == 429  # the limit counts before anything is looked up
