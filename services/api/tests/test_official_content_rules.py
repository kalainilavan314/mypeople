"""Official content rules and signing, without a database (BRD FR-AUT-001 to 005, BR-148, BR-150, INT-22, INT-24)."""

import base64
import os
import re
from datetime import UTC, datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.modules.content.official import rules, signing
from app.modules.content.official.check_limiter import CheckLimiter
from app.modules.content.official.rules import SignedFields, StatementText


def fields(**changes) -> SignedFields:
    values = dict(
        statement_ref="OS-00001", check_code="TMK-7K3M-QX9P", revision=1,
        text=StatementText("Flood relief update", "வெள்ள நிவாரணம் பற்றிய அறிவித்தல்", "Body", "உள்ளடக்கம்"),
        image_sha256=None, correction_reason_en=None, correction_reason_ta=None, publisher_id="p-1",
        publisher_name_en="TMK Media Office", publisher_name_ta="தமக ஊடகப் பணிமனை", key_id="ed25519:0123456789abcdef",
        published_at=datetime(2026, 11, 19, 4, 30, 0, 123456, tzinfo=UTC),
    )
    values.update(changes)
    return SignedFields(**values)


def test_check_codes_are_random_and_easy_to_read_aloud():
    codes = {rules.new_check_code() for _ in range(200)}
    assert len(codes) == 200
    assert all(re.fullmatch(r"TMK-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}", code) for code in codes)


@pytest.mark.parametrize(
    ("typed", "expected"),
    [
        ("TMK-7K3M-QX9P", "TMK-7K3M-QX9P"),
        ("  tmk 7k3m qx9p ", "TMK-7K3M-QX9P"),
        ("TMK7K3MQX9P", "TMK-7K3M-QX9P"),
        ("7K3M-QX9P", "TMK-7K3M-QX9P"),
        ("https://app.tmk.lk/check/TMK-7K3M-QX9P", "TMK-7K3M-QX9P"),
        ("Check this: https://app.tmk.lk/check/tmk-7k3m-qx9p?x=1", "TMK-7K3M-QX9P"),
        ("TMK-OIL0-0000", "TMK-0110-0000"),  # O, I and L read as 0, 1 and 1
        ("TMK-UUUU-0000", None),  # U is never used
        ("hello", None),
        ("", None),
        ("https://app.tmk.lk/", None),
    ],
)
def test_a_code_is_found_in_what_was_typed_or_pasted(typed, expected):
    assert rules.normalise_check_code(typed) == expected


def test_both_languages_are_needed_before_signing():
    assert rules.check_publishable(StatementText("", "", " ", "")) == [
        "title_ta_required", "title_en_required", "body_ta_required", "body_en_required"
    ]
    assert rules.check_publishable(StatementText("a", "b", "c", "d")) == []


def test_the_signed_payload_is_stable_utf8_json_with_utc_time():
    payload = rules.signed_payload(fields())
    same_moment = fields(published_at=datetime(2026, 11, 19, 10, 0, 0, 123456, tzinfo=timezone(timedelta(hours=5, minutes=30))))

    assert payload == rules.signed_payload(same_moment)
    assert '"publishedAt":"2026-11-19T04:30:00.123456Z"' in payload
    assert "வெள்ள" in payload and '"format":"tmk-official-statement/1"' in payload
    assert payload != rules.signed_payload(fields(revision=2))


def test_a_signature_verifies_only_for_the_same_payload_and_key():
    signer = signing.SettingKeySigner(os.urandom(32))
    other = signing.SettingKeySigner(os.urandom(32))
    payload = rules.signed_payload(fields(key_id=signer.key_id)).encode()
    signature = signer.sign(payload)

    assert re.fullmatch(r"ed25519:[0-9a-f]{16}", signer.key_id) and len(signer.public_key) == 44 and len(signature) == 88
    assert signing.verify(signer.public_key, payload, signature)
    assert not signing.verify(signer.public_key, payload.replace(b"Flood", b"Fl00d"), signature)
    assert not signing.verify(other.public_key, payload, signature)
    assert not signing.verify(signer.public_key, payload, "not base64!")


def test_without_a_key_there_is_no_signer():
    settings = Settings(_env_file=None, database_url="postgresql://x@127.0.0.1:1/x", jwt_secret="a", nic_pepper="b")
    assert signing.build_signer(settings) is None
    seed = base64.b64encode(os.urandom(32)).decode()
    keyed = Settings(_env_file=None, database_url="postgresql://x@127.0.0.1:1/x", jwt_secret="a", nic_pepper="b",
                     content_signing_key=seed)
    assert signing.build_signer(keyed) is not None
    with pytest.raises(ValidationError, match="CONTENT_SIGNING_KEY"):
        Settings(_env_file=None, database_url="postgresql://x@127.0.0.1:1/x", jwt_secret="a", nic_pepper="b",
                 content_signing_key=base64.b64encode(b"short").decode())


@pytest.mark.parametrize(
    ("state", "valid", "expected"),
    [
        (None, False, ("not_verified", "no_matching_record")),
        ("draft", True, ("not_verified", "no_matching_record")),
        ("published", True, ("verified", None)),
        ("published", False, ("not_verified", "signature_invalid")),
        ("withdrawn", True, ("withdrawn", None)),
        ("withdrawn", False, ("not_verified", "signature_invalid")),
    ],
)
def test_what_a_check_says(state, valid, expected):
    assert rules.check_status(state, valid) == expected


def test_corrections_and_withdrawal_apply_to_published_statements_only():
    assert rules.check_draftable("draft") is None and rules.check_draftable("published") == "not_allowed_from:published"
    assert rules.check_correctable("published") is None
    assert rules.check_correctable("withdrawn") == "not_allowed_from:withdrawn"


def test_public_checks_are_limited_per_address_and_window():
    now = [0.0]
    limiter = CheckLimiter(limit=2, window_seconds=600, clock=lambda: now[0])

    assert limiter.wait_needed("10.0.0.1") is None and limiter.wait_needed("10.0.0.1") is None
    assert limiter.wait_needed("10.0.0.1") == 601
    assert limiter.wait_needed("10.0.0.2") is None  # another address has its own count
    now[0] = 600.0
    assert limiter.wait_needed("10.0.0.1") is None  # a new window
