"""Evidence encryption, image checks, view links and the evidence settings. No database needed."""

import base64
import os
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.core.security import InvalidSessionToken, read_session_token, sign_session_token
from app.modules.identity.documents import links
from app.modules.identity.documents.images import image_type
from app.modules.identity.documents.vault import EvidenceUnreadable, EvidenceVault, FileStore, key_id, seal, unseal

SECRET = "test-only-jwt-secret-for-unit-tests"
KEY = bytes(range(32))
JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + os.urandom(256)


# --- Encryption (FR-ARCH-007, Sensitive class) -------------------------------------------


def test_sealed_evidence_opens_only_for_its_own_document_and_key():
    document_id = uuid.uuid4()
    sealed = seal(KEY, document_id, JPEG)

    assert JPEG not in sealed
    assert unseal(KEY, document_id, sealed) == JPEG
    with pytest.raises(EvidenceUnreadable):
        unseal(KEY, uuid.uuid4(), sealed)  # copied onto another document
    with pytest.raises(EvidenceUnreadable):
        unseal(bytes(32), document_id, sealed)  # another key


def test_a_changed_byte_is_detected():
    document_id = uuid.uuid4()
    sealed = bytearray(seal(KEY, document_id, JPEG))
    sealed[-20] ^= 1

    with pytest.raises(EvidenceUnreadable):
        unseal(KEY, document_id, bytes(sealed))


def test_each_file_gets_its_own_nonce():
    document_id = uuid.uuid4()
    assert seal(KEY, document_id, JPEG) != seal(KEY, document_id, JPEG)


def test_the_vault_writes_only_ciphertext(tmp_path):
    vault = EvidenceVault(FileStore(tmp_path), KEY)
    document_id = uuid.uuid4()

    assert vault.save(document_id, JPEG) == key_id(KEY)

    [stored] = [path for path in tmp_path.rglob("*") if path.is_file()]
    assert stored.name == f"{document_id}.bin"
    assert JPEG not in stored.read_bytes()
    assert vault.read(document_id, key_id(KEY)) == JPEG


def test_the_vault_refuses_missing_files_and_other_keys(tmp_path):
    vault = EvidenceVault(FileStore(tmp_path), KEY)
    document_id = uuid.uuid4()
    vault.save(document_id, JPEG)

    with pytest.raises(EvidenceUnreadable):
        vault.read(document_id, key_id(bytes(32)))
    with pytest.raises(EvidenceUnreadable):
        vault.read(uuid.uuid4(), key_id(KEY))


def test_the_key_id_does_not_reveal_the_key():
    assert len(key_id(KEY)) == 16
    assert key_id(KEY) != key_id(bytes(32))
    assert key_id(KEY) not in KEY.hex()


# --- Image types (FR-REG-010) --------------------------------------------------------------


@pytest.mark.parametrize(
    ("data", "expected"),
    [
        (JPEG, "image/jpeg"),
        (b"\x89PNG\r\n\x1a\n" + bytes(32), "image/png"),
        (b"\x00\x00\x00\x18ftypheic\x00\x00\x00\x00mif1heic", "image/heic"),
        (b"%PDF-1.7\n" + bytes(32), None),
        (b"GIF89a" + bytes(32), None),
        (b"<script>alert(1)</script>", None),
        (b"", None),
    ],
)
def test_image_type_is_read_from_the_bytes(data, expected):
    assert image_type(data) == expected


# --- View links (FR-ARCH-007: refused after 5 minutes) ------------------------------------------


def test_a_view_link_names_one_document_and_one_viewer():
    document_id, viewer_id = uuid.uuid4(), uuid.uuid4()
    token, link = links.sign_view_link(document_id, viewer_id, SECRET)

    assert links.read_view_link(token, SECRET) == link
    assert (link.document_id, link.viewer_id) == (document_id, viewer_id)
    assert timedelta(minutes=4) < link.expires_at - datetime.now(UTC) <= timedelta(minutes=5)


def test_a_link_older_than_five_minutes_is_refused():
    issued = datetime.now(UTC) - timedelta(minutes=5, seconds=1)
    token, _ = links.sign_view_link(uuid.uuid4(), uuid.uuid4(), SECRET, issued_at=issued)

    with pytest.raises(links.LinkExpired):
        links.read_view_link(token, SECRET)


def test_an_edited_or_foreign_link_is_refused():
    token, _ = links.sign_view_link(uuid.uuid4(), uuid.uuid4(), SECRET)
    header, payload, signature = token.split(".")
    other_payload = links.sign_view_link(uuid.uuid4(), uuid.uuid4(), SECRET)[0].split(".")[1]

    with pytest.raises(links.LinkInvalid):
        links.read_view_link(f"{header}.{other_payload}.{signature}", SECRET)
    with pytest.raises(links.LinkInvalid):
        links.read_view_link(token, "another-secret-of-the-same-length-xxxxx")
    with pytest.raises(links.LinkInvalid):
        links.read_view_link("not-a-token", SECRET)


def test_session_tokens_and_view_links_are_not_interchangeable():
    session = sign_session_token(uuid.uuid4(), 0, SECRET)
    with pytest.raises(links.LinkInvalid):
        links.read_view_link(session, SECRET)

    link, _ = links.sign_view_link(uuid.uuid4(), uuid.uuid4(), SECRET)
    with pytest.raises(InvalidSessionToken):
        read_session_token(link, SECRET)


# --- Settings -----------------------------------------------------------------------------


def _settings(**evidence: str) -> Settings:
    return Settings(
        _env_file=None,
        database_url="postgresql://nobody@127.0.0.1:1/unreachable",
        jwt_secret=SECRET,
        nic_pepper="test-only-nic-pepper-for-unit-tests",
        **evidence,
    )


def test_evidence_settings_are_optional_but_come_together():
    assert _settings().evidence_key is None
    with pytest.raises(ValidationError):
        _settings(evidence_storage_dir="evidence")
    with pytest.raises(ValidationError):
        _settings(evidence_encryption_key=base64.b64encode(KEY).decode())


@pytest.mark.parametrize("key", [base64.b64encode(bytes(16)).decode(), "not base64!", KEY.hex()])
def test_the_evidence_key_must_be_32_bytes_in_base64(key):
    with pytest.raises(ValidationError):
        _settings(evidence_storage_dir="evidence", evidence_encryption_key=key)


def test_a_valid_evidence_key_is_decoded():
    settings = _settings(evidence_storage_dir="evidence", evidence_encryption_key=base64.b64encode(KEY).decode())
    assert settings.evidence_key == KEY
    assert "evidence_encryption_key=SecretStr('**********')" in repr(settings)
