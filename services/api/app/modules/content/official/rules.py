"""Official content rules (BRD FR-AUT-001 to 005, BR-148, BR-150, INT-22) as plain functions.

Only content with a verifiable publisher signature is labelled "Official statement" (BR-148): a
statement is published by signing it, and every signature is checked again whenever it is shown,
so a record changed in the database stops verifying instead of keeping its label. A correction
is a new signed revision; the original stays (BR-150). Anyone may check a statement by its code.
"""

import json
import re
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

SIGN_PUBLISH = "content.sign_publish"  # PRM-57, platform scope whatever the tier (BRD §9.8)
# [ASSUMPTION] FR-AUT-001 says Tier 5 registers publishers without naming a permission; system.configure
# (PRM-26) is held only by Tier 5, over the whole platform.
REGISTER = "system.configure"

PAYLOAD_FORMAT = "tmk-official-statement/1"

TITLE_MAX = 200
BODY_MAX_EN = 5000
BODY_MAX_TA = 6000  # Tamil takes more characters for the same text
REASON_MAX_EN = 1000
REASON_MAX_TA = 1200

# Crockford base32 without I, L, O and U: a code read aloud or retyped is not misread.
CHECK_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
_CONFUSABLE = str.maketrans({"O": "0", "I": "1", "L": "1"})
_PREFIXED = re.compile(r"TMK[\s\-]*([0-9A-Z]{4})[\s\-]*([0-9A-Z]{4})(?![0-9A-Z])")
_BARE = re.compile(r"([0-9A-Z]{4})[\s\-]?([0-9A-Z]{4})")

# INT-22 [ASSUMPTION]: public checks per client address. Generous, because many phones on one mobile
# network share an address; enough to stop anyone walking through the code space.
CHECKS_PER_WINDOW = 60
CHECK_WINDOW_SECONDS = 600

StatementState = Literal["draft", "published", "withdrawn"]
CheckStatus = Literal["verified", "withdrawn", "not_verified"]
CheckProblem = Literal["no_matching_record", "signature_invalid"]


def new_check_code() -> str:
    """A random public code such as TMK-7K3M-QX9P (32^8 possibilities)."""
    chars = "".join(secrets.choice(CHECK_ALPHABET) for _ in range(8))
    return f"TMK-{chars[:4]}-{chars[4:]}"


def normalise_check_code(raw: str) -> str | None:
    """The code in what someone typed or pasted: the code itself, with or without dashes, or a
    check link that contains it. None when there is no code in it."""
    text = raw.strip().upper()
    if not text or len(text) > 500:
        return None
    match = _PREFIXED.search(text) or _BARE.fullmatch(text)
    if match is None:
        return None
    chars = (match.group(1) + match.group(2)).translate(_CONFUSABLE)
    if any(char not in CHECK_ALPHABET for char in chars):
        return None
    return f"TMK-{chars[:4]}-{chars[4:]}"


@dataclass(frozen=True)
class StatementText:
    title_en: str
    title_ta: str
    body_en: str
    body_ta: str


def check_publishable(text: StatementText) -> list[str]:
    """Both languages are required before anything is signed."""
    problems = []
    if not text.title_ta.strip():
        problems.append("title_ta_required")
    if not text.title_en.strip():
        problems.append("title_en_required")
    if not text.body_ta.strip():
        problems.append("body_ta_required")
    if not text.body_en.strip():
        problems.append("body_en_required")
    return problems


def check_draftable(state: str) -> str | None:
    return None if state == "draft" else f"not_allowed_from:{state}"


def check_correctable(state: str) -> str | None:
    """Corrections and withdrawal apply to a published statement only; a withdrawn one stays withdrawn."""
    return None if state == "published" else f"not_allowed_from:{state}"


def timestamp(moment: datetime) -> str:
    """The publication time as it is signed: UTC with microseconds, so it survives the database exactly."""
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%S.%fZ")


@dataclass(frozen=True)
class SignedFields:
    """Everything a signature covers. The image is covered by its SHA-256."""

    statement_ref: str
    check_code: str
    revision: int
    text: StatementText
    image_sha256: str | None
    correction_reason_en: str | None
    correction_reason_ta: str | None
    publisher_id: str
    publisher_name_en: str
    publisher_name_ta: str
    key_id: str
    published_at: datetime


def signed_payload(fields: SignedFields) -> str:
    """The exact text that is signed: sorted-key JSON without spaces, UTF-8 when encoded. Anyone holding
    the published key can verify it with any Ed25519 library."""
    return json.dumps(
        {
            "format": PAYLOAD_FORMAT,
            "statementRef": fields.statement_ref,
            "checkCode": fields.check_code,
            "revision": fields.revision,
            "titleEn": fields.text.title_en,
            "titleTa": fields.text.title_ta,
            "bodyEn": fields.text.body_en,
            "bodyTa": fields.text.body_ta,
            "imageSha256": fields.image_sha256,
            "correctionReasonEn": fields.correction_reason_en,
            "correctionReasonTa": fields.correction_reason_ta,
            "publisherId": fields.publisher_id,
            "publisherNameEn": fields.publisher_name_en,
            "publisherNameTa": fields.publisher_name_ta,
            "keyId": fields.key_id,
            "publishedAt": timestamp(fields.published_at),
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def check_status(state: str | None, signatures_valid: bool) -> tuple[CheckStatus, CheckProblem | None]:
    """FR-AUT-005: a draft or an unknown code has no official record; a record whose signature does not
    verify is not official, withdrawn or not."""
    if state is None or state == "draft":
        return "not_verified", "no_matching_record"
    if not signatures_valid:
        return "not_verified", "signature_invalid"
    if state == "withdrawn":
        return "withdrawn", None
    return "verified", None
