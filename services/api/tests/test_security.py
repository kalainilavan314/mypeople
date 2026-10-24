"""The Python auth primitives against fixed vectors generated from server/src/lib.js."""

import json
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import jwt
import pytest

from app.core.security import (
    InvalidSessionToken,
    hash_password,
    nic_hash,
    read_session_token,
    sign_session_token,
    verify_password,
)

VECTORS = json.loads((Path(__file__).parent / "express" / "auth_vectors.json").read_text(encoding="utf-8"))
JWT_SECRET = VECTORS["secrets"]["jwtSecret"]
NIC_PEPPER = VECTORS["secrets"]["nicPepper"]
TOKENS = VECTORS["tokens"]
MEMBER_ID = uuid.UUID(TOKENS["memberId"])


# --- NIC hash --------------------------------------------------------------


@pytest.mark.parametrize("vector", VECTORS["nicHashes"], ids=lambda v: repr(v["nic"]))
def test_nic_hash_matches_express(vector):
    assert nic_hash(vector["nic"], NIC_PEPPER) == vector["hash"]


# --- Passwords -------------------------------------------------------------


@pytest.mark.parametrize("vector", VECTORS["passwords"], ids=lambda v: f"{len(v['password'].encode())}-bytes")
def test_password_check_matches_express(vector):
    assert verify_password(vector["password"], vector["hash"]) is vector["matches"]


def test_password_hash_round_trip():
    stored = hash_password("correct horse battery")

    assert verify_password("correct horse battery", stored)
    assert not verify_password("correct horse batterY", stored)


def test_passwords_longer_than_72_bytes_are_accepted():
    long_tamil = "தமிழ்" * 12  # 180 UTF-8 bytes

    assert verify_password(long_tamil, hash_password(long_tamil))


def test_a_stored_value_that_is_not_a_bcrypt_hash_never_matches():
    assert verify_password("anything", "not-a-bcrypt-hash") is False


# --- Session tokens ----------------------------------------------------------


@pytest.mark.parametrize("vector", TOKENS["signed"], ids=lambda v: f"sv{v['sessionVersion']}")
def test_signed_token_is_identical_to_express(vector):
    issued_at = datetime.fromtimestamp(TOKENS["issuedAt"], UTC)

    token = sign_session_token(MEMBER_ID, vector["sessionVersion"], JWT_SECRET, issued_at=issued_at)

    assert token == vector["token"]


def test_fresh_token_is_read_back():
    claims = read_session_token(sign_session_token(MEMBER_ID, 4, JWT_SECRET), JWT_SECRET)

    assert claims.member_id == MEMBER_ID
    assert claims.session_version == 4


def test_token_is_valid_for_30_days():
    almost_expired = datetime.now(UTC) - timedelta(days=29, hours=23)
    expired = datetime.now(UTC) - timedelta(days=30, minutes=1)

    read_session_token(sign_session_token(MEMBER_ID, 0, JWT_SECRET, issued_at=almost_expired), JWT_SECRET)
    with pytest.raises(InvalidSessionToken):
        read_session_token(sign_session_token(MEMBER_ID, 0, JWT_SECRET, issued_at=expired), JWT_SECRET)


def test_token_without_session_version_reads_as_version_0():
    now = int(datetime.now(UTC).timestamp())
    token = jwt.encode({"sub": str(MEMBER_ID), "iat": now, "exp": now + 60}, JWT_SECRET, algorithm="HS256")

    assert read_session_token(token, JWT_SECRET).session_version == 0


def test_token_signed_with_another_secret_is_rejected():
    token = sign_session_token(MEMBER_ID, 0, "a-different-secret-the-api-never-uses")

    with pytest.raises(InvalidSessionToken):
        read_session_token(token, JWT_SECRET)


# Signing with HS384/HS512 here is the attack being tested, so PyJWT's warning
# that the key is short for those algorithms is expected.
@pytest.mark.filterwarnings("ignore::jwt.warnings.InsecureKeyLengthWarning")
@pytest.mark.parametrize("algorithm", ["HS384", "HS512", "none"])
def test_token_cannot_choose_its_own_algorithm(algorithm):
    now = int(datetime.now(UTC).timestamp())
    payload = {"sub": str(MEMBER_ID), "sv": 0, "iat": now, "exp": now + 60}
    key = None if algorithm == "none" else JWT_SECRET
    token = jwt.encode(payload, key, algorithm=algorithm)

    with pytest.raises(InvalidSessionToken):
        read_session_token(token, JWT_SECRET)


@pytest.mark.parametrize("subject", ["not-a-uuid", "", "1234"])
def test_token_whose_subject_is_not_a_member_id_is_rejected(subject):
    now = int(datetime.now(UTC).timestamp())
    token = jwt.encode({"sub": subject, "sv": 0, "iat": now, "exp": now + 60}, JWT_SECRET, algorithm="HS256")

    with pytest.raises(InvalidSessionToken):
        read_session_token(token, JWT_SECRET)


@pytest.mark.parametrize("token", ["", "not-a-token", "a.b.c"])
def test_garbage_is_rejected(token):
    with pytest.raises(InvalidSessionToken):
        read_session_token(token, JWT_SECRET)
