"""Time-based one-time codes for staff authenticator apps (RFC 6238; BRD NFR-SEC-04, FR-STF-001).

Six digits, 30-second steps, HMAC-SHA1: what Google Authenticator, Microsoft
Authenticator and similar apps use. One step either side is accepted for
clock drift, and a step already used is refused, so a code works only once.
"""

import base64
import hashlib
import hmac
import secrets
import struct
from urllib.parse import quote

STEP_SECONDS = 30
DIGITS = 6
DRIFT_STEPS = 1
ISSUER = "My People"


def new_secret() -> bytes:
    return secrets.token_bytes(20)


def secret_text(secret: bytes) -> str:
    """Base32 without padding, as authenticator apps expect it typed or scanned."""
    return base64.b32encode(secret).decode("ascii").rstrip("=")


def provisioning_uri(secret: bytes, account_label: str) -> str:
    label = quote(f"{ISSUER}:{account_label}")
    return (
        f"otpauth://totp/{label}?secret={secret_text(secret)}&issuer={quote(ISSUER)}"
        f"&algorithm=SHA1&digits={DIGITS}&period={STEP_SECONDS}"
    )


def step_at(unix_time: float) -> int:
    return int(unix_time // STEP_SECONDS)


def code_for_step(secret: bytes, step: int) -> str:
    digest = hmac.new(secret, struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    number = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(number % 10**DIGITS).zfill(DIGITS)


def matching_step(secret: bytes, code: str, unix_time: float, last_used_step: int | None) -> int | None:
    """The step the code belongs to, or None if it is wrong, too old or already used."""
    if not (len(code) == DIGITS and code.isdigit()):
        return None
    now = step_at(unix_time)
    for step in range(now - DRIFT_STEPS, now + DRIFT_STEPS + 1):
        if last_used_step is not None and step <= last_used_step:
            continue
        if hmac.compare_digest(code_for_step(secret, step), code):
            return step
    return None
