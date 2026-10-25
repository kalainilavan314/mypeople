"""The member QR code (BRD FR-CARD-003, FR-CARD-004, BR-063, BR-064).

A C1 code carries only the member's opaque card reference; see
app/core/rotating_codes.py for the format, the 60-second life and the scan
leeway.
"""

from app.core.rotating_codes import (
    LIFETIME_SECONDS,
    SCAN_LEEWAY_SECONDS,
    CodeExpired,
    CodeInvalid,
    CodeKind,
    RotatingCode,
    new_reference,
)

VERSION = "C1"
CARD = CodeKind(version=VERSION, purpose=b"my-people member card v1")

# The names the card module and its tests use.
CardCodeExpired = CodeExpired
CardCodeInvalid = CodeInvalid
CardCode = RotatingCode
new_card_ref = new_reference

__all__ = ["LIFETIME_SECONDS", "SCAN_LEEWAY_SECONDS", "CardCode", "CardCodeExpired", "CardCodeInvalid", "key_id",
           "new_card_ref", "read", "sign"]


def key_id(jwt_secret: str) -> str:
    return CARD.key_id(jwt_secret)


def sign(card_ref: str, jwt_secret: str, now: int) -> CardCode:
    return CARD.sign(card_ref, jwt_secret, now)


def read(code: str, jwt_secret: str, now: int) -> str:
    """The card reference in a genuine, current code."""
    return CARD.read(code, jwt_secret, now)
