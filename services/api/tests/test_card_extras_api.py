"""The card's photo and the member's drawn signature (owner's card design, 17 November 2026)."""

import io

import pytest
from PIL import Image
from sqlalchemy import text

CARD = "/v1/membership/me/card"


@pytest.fixture
def client(identity_client):
    return identity_client


@pytest.fixture
def member(member_in, area):
    return member_in(area, verified=True, active=True)


def jpeg_with_camera_details(colour: str = "steelblue") -> bytes:
    image = Image.new("RGB", (600, 750), colour)
    exif = Image.Exif()
    exif[0x010F] = "TestCam"  # Make
    out = io.BytesIO()
    image.save(out, format="JPEG", exif=exif)
    return out.getvalue()


def sealed_files(evidence_dir):
    folder = evidence_dir / "card-photos"
    return sorted(path.name for path in folder.rglob("*.bin")) if folder.exists() else []


def put_photo(client, auth, member, data: bytes, content_type: str = "image/jpeg"):
    return client.put(f"{CARD}/photo", content=data, headers={**auth(member), "Content-Type": content_type})


def test_a_member_adds_a_card_photo_without_metadata_and_replacing_it_removes_the_old_file(
    client, auth, member, evidence_dir, db_session
):
    first = put_photo(client, auth, member, jpeg_with_camera_details())
    shown = client.get(f"{CARD}/photo", headers=auth(member))
    files_after_first = sealed_files(evidence_dir)
    second = put_photo(client, auth, member, jpeg_with_camera_details("darkred"))
    card = client.get(CARD, headers=auth(member)).json()

    assert first.status_code == 200 and second.status_code == 200
    assert card["photoVersion"] == second.json()["photoVersion"] != first.json()["photoVersion"]
    assert shown.headers["content-type"] == "image/webp" and "no-store" in shown.headers["cache-control"]
    with Image.open(io.BytesIO(shown.content)) as image:
        assert image.format == "WEBP" and not image.getexif()  # nothing of the camera's details is kept
    assert len(files_after_first) == 1 and sealed_files(evidence_dir) != files_after_first
    assert len(sealed_files(evidence_dir)) == 1  # the replaced photo's file is gone
    actions = db_session.execute(
        text("SELECT action, details FROM ops.audit_log WHERE target_id = :m AND action LIKE 'membership.card.%'"),
        {"m": str(member.id)},
    ).all()
    assert [a for a, _ in actions] == ["membership.card.photo_set", "membership.card.photo_set"]
    assert all(not details for _, details in actions)  # ids only: no detail at all


def test_removing_the_photo_deletes_it(client, auth, member, evidence_dir):
    put_photo(client, auth, member, jpeg_with_camera_details())

    removed = client.delete(f"{CARD}/photo", headers=auth(member))
    after = client.get(f"{CARD}/photo", headers=auth(member))

    assert removed.status_code == 204 and after.status_code == 404
    assert client.get(CARD, headers=auth(member)).json()["photoVersion"] is None
    assert sealed_files(evidence_dir) == []


def test_only_real_images_are_accepted(client, auth, member):
    not_an_image = put_photo(client, auth, member, b"not a photo at all")
    wrong_type = put_photo(client, auth, member, b"plain text", content_type="text/plain")
    broken_jpeg = put_photo(client, auth, member, bytes([0xFF, 0xD8, 0xFF, 0xE0]) + b"broken" * 50)

    assert not_an_image.status_code == 415 and wrong_type.status_code == 415
    assert broken_jpeg.status_code == 422 and broken_jpeg.json()["detail"]["problems"] == ["unsupported_type"]


def test_a_card_photo_needs_a_signed_in_member(client):
    assert client.get(f"{CARD}/photo").status_code == 401


def test_the_signature_is_kept_as_strokes_and_can_be_removed(client, auth, member):
    strokes = [[[0.1, 0.5], [0.123456, 0.48], [0.2, 0.4]], [[0.5, 0.5], [0.6, 0.55]]]

    saved = client.put(f"{CARD}/signature", json={"strokes": strokes}, headers=auth(member))
    card = client.get(CARD, headers=auth(member)).json()
    removed = client.delete(f"{CARD}/signature", headers=auth(member))

    assert saved.status_code == 204
    assert card["signature"] == [[[0.1, 0.5], [0.1235, 0.48], [0.2, 0.4]], [[0.5, 0.5], [0.6, 0.55]]]
    assert removed.status_code == 204 and client.get(CARD, headers=auth(member)).json()["signature"] is None


@pytest.mark.parametrize(
    ("strokes", "problem"),
    [
        ([[[0.1, 0.5], [1.4, 0.5], [0.2, 0.2]]], "signature_point_outside"),
        ([[[0.1, 0.5]]], "signature_too_short"),
        ([[[0.1, 0.5], [0.2, 0.5], [0.3, 0.5, 0.9]]], "signature_point_outside"),
    ],
)
def test_a_signature_outside_the_pad_or_too_short_is_refused(client, auth, member, strokes, problem):
    response = client.put(f"{CARD}/signature", json={"strokes": strokes}, headers=auth(member))

    assert response.status_code == 422 and response.json()["detail"]["problems"] == [problem]


def test_the_card_shows_the_members_referral_code_only_when_it_is_available(client, auth, member, member_in, area, db_session):
    code = db_session.scalar(text("SELECT referral_code FROM npm.member WHERE id = :m"), {"m": member.id})
    pending = member_in(area, verified=True)

    assert client.get(CARD, headers=auth(member)).json()["referralCode"] == code
    assert client.get(CARD, headers=auth(pending)).json()["referralCode"] is None
