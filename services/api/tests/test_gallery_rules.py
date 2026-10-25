"""Gallery rules and photo processing, without a database (BRD FR-GAL-004 to 006, FR-ADM-005, 006,
BR-069 to BR-072)."""

import io
from datetime import UTC, datetime, timedelta

import pytest
from PIL import Image, ImageStat

from app.modules.content.gallery import images, rules


def submission(**overrides):
    values = {
        "summary_en": "Volunteers cleaned the beach.",
        "summary_ta": "தன்னார்வலர்கள் கடற்கரையைச் சுத்தம் செய்தனர்.",
        "category": "community",
        "event_state": None,
        "captions": [("The team at work", "பணியில் குழு")],
    }
    return rules.check_submission(**(values | overrides))


def test_a_missing_tamil_caption_blocks_submission():
    assert submission() == []
    assert submission(captions=[("The team at work", "  ")]) == ["tamil_caption_missing"]
    assert submission(captions=[("", "பணியில் குழு")]) == ["english_caption_missing"]
    assert submission(summary_ta="") == ["tamil_summary_missing"]
    assert submission(captions=[]) == ["no_photos"]


def test_an_event_album_links_a_published_event():
    assert submission(category="events") == ["event_required"]
    assert submission(category="events", event_state="cancelled") == ["event_not_published"]
    assert submission(category="events", event_state="published") == []


@pytest.mark.parametrize(
    ("action", "state", "expected"),
    [
        ("edit", "draft", None),
        ("edit", "published", "not_allowed_from:published"),
        ("submit", "draft", None),
        ("publish", "submitted", None),
        ("publish", "draft", "not_allowed_from:draft"),
        ("return", "submitted", None),
    ],
)
def test_albums_go_from_draft_to_submitted_to_published(action, state, expected):
    assert rules.check_transition(action, state) == expected


def test_whoever_submitted_an_album_does_not_publish_it():
    assert rules.check_publisher("a", "a") == "own_submission"
    assert rules.check_publisher("b", "a") is None


def test_a_request_open_18_hours_is_escalated():
    made = datetime(2026, 10, 25, 9, 0, tzinfo=UTC)
    assert rules.escalated(made, made + timedelta(hours=17, minutes=59)) is False
    assert rules.escalated(made, made + timedelta(hours=18)) is True


def test_the_requester_is_told_the_outcome_in_both_languages():
    message = rules.outcome_message("RR-000001", "kept")
    assert "RR-000001" in message and "kept" in message and "என் மக்கள்" in message


def jpeg_with_location(width: int = 3000, height: int = 2000) -> bytes:
    image = Image.new("RGB", (width, height), (40, 90, 160))
    exif = Image.Exif()
    exif[0x010F] = "Camera maker"  # Make
    exif[0x8825] = {1: "N", 2: (9.0, 40.0, 0.0), 3: "E", 4: (80.0, 0.0, 0.0)}  # GPSInfo: Jaffna
    out = io.BytesIO()
    image.save(out, format="JPEG", exif=exif)
    return out.getvalue()


def test_uploads_are_re_encoded_as_webp_without_metadata():
    original = jpeg_with_location()
    with Image.open(io.BytesIO(original)) as check:
        assert check.getexif().get(0x8825)  # the test photo really carries a location

    prepared = images.prepare(original)

    for data, edge in ((prepared.display, images.DISPLAY_EDGE), (prepared.thumb, images.THUMB_EDGE)):
        with Image.open(io.BytesIO(data)) as result:
            assert result.format == "WEBP"
            assert max(result.size) == edge
            assert not result.getexif() and "exif" not in result.info and "xmp" not in result.info
    assert (prepared.width, prepared.height) == (1600, 1067)


def test_files_that_are_not_photos_or_too_large_are_refused(monkeypatch):
    with pytest.raises(images.ImageRejected) as not_a_photo:
        images.prepare(b"%PDF-1.7 not an image")
    monkeypatch.setattr(images, "MAX_PIXELS", 1000)
    with pytest.raises(images.ImageRejected) as too_big:
        images.prepare(jpeg_with_location(100, 100))

    assert (not_a_photo.value.code, too_big.value.code) == ("unsupported_type", "too_many_pixels")


def test_a_blurred_photo_keeps_its_size_but_not_its_detail():
    image = Image.new("RGB", (400, 300), "white")
    for x in range(0, 400, 20):
        image.paste((0, 0, 0), (x, 0, x + 10, 300))  # sharp stripes
    out = io.BytesIO()
    image.save(out, format="WEBP")

    with Image.open(io.BytesIO(images.blurred(out.getvalue()))) as result:
        assert result.size == (400, 300)
        middle = result.convert("L").crop((100, 75, 300, 225))
        sharp = image.convert("L").crop((100, 75, 300, 225))
        # The stripes are gone: almost no contrast left where it was strongest.
        assert ImageStat.Stat(middle).stddev[0] < ImageStat.Stat(sharp).stddev[0] / 5
