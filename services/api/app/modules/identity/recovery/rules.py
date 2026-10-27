"""Recovery-contact and account-recovery rules (BRD FR-REG-028, FR-AUTH-014 to 017, BR-023, BR-024)
as plain functions and constants.

The limits on one-time codes are the Express API's (server/src/throttle.js),
because both APIs write the same npm.otp rows and must count them the same way.
"""

import re
import secrets
from dataclasses import dataclass
from datetime import timedelta

CONFIRM_PHONE = "confirm_phone"  # npm.otp purpose: confirming a new recovery number (FR-REG-028)
RECOVERY = "recovery"  # npm.otp purpose: a recovery code (FR-AUTH-014)
ACCOUNT_CLOSURE = "account_closure"  # npm.otp purpose: confirming an account-closure request (FR-PROF-018)

CODE_LIFETIME = {  # FR-AUTH-015
    CONFIRM_PHONE: timedelta(minutes=5),
    RECOVERY: timedelta(minutes=10),
    ACCOUNT_CLOSURE: timedelta(minutes=5),
}
MAX_CODE_ATTEMPTS = 5  # FR-AUTH-015; then the code is burnt

# [ASSUMPTION] Limits the BRD does not set: registrations and assisted-recovery
# requests from one address per hour.
MAX_REGISTRATIONS_PER_IP_PER_HOUR = 5
MAX_ASSISTED_REQUESTS_PER_IP_PER_HOUR = 3

# [ASSUMPTION] The BRD gives assisted recovery to "the authorised support team"
# without a permission; identity reviewers, who already verify people, handle it.
HANDLE_ASSISTED = "members.verify"


def normalise_phone(raw: str) -> str | None:
    """An E.164 number, or None. Sri Lankan numbers may be typed locally (0771234567)."""
    digits = re.sub(r"[\s\-()]", "", raw)
    if re.fullmatch(r"0\d{9}", digits):
        digits = "+94" + digits[1:]
    elif re.fullmatch(r"94\d{9}", digits):
        digits = "+" + digits
    return digits if re.fullmatch(r"\+[1-9]\d{7,14}", digits) else None


def new_code() -> str:
    """Six digits, as lib.js otpCode."""
    return str(secrets.randbelow(900_000) + 100_000)


@dataclass(frozen=True)
class CodeRequests:
    """One-time codes already sent, from npm.otp."""

    phone_last_minute: int
    phone_last_hour: int
    phone_last_day: int
    ip_last_ten_minutes: int


def code_request_wait(sent: CodeRequests) -> int | None:
    """Seconds to wait before another code, or None if one may be sent now (throttle.js checkOtpRequest)."""
    if sent.phone_last_minute >= 1:
        return 60
    if sent.phone_last_hour >= 5:
        return 3600
    if sent.phone_last_day >= 10:
        return 86400
    if sent.ip_last_ten_minutes >= 10:
        return 600
    return None


def code_message(code: str, lifetime: timedelta) -> str:
    minutes = int(lifetime.total_seconds() // 60)
    return (
        f"என் மக்கள் குறியீடு: {code}. {minutes} நிமிடங்களுக்கு மட்டும். யாருடனும் பகிர வேண்டாம்.\n"
        f"My People code: {code}. Valid for {minutes} minutes. Never share it."
    )


PASSWORD_CHANGED_MESSAGE = (
    "என் மக்கள்: உங்கள் கடவுச்சொல் மாற்றப்பட்டது. இது நீங்கள் இல்லையெனில் உதவியை அணுகவும்.\n"
    "My People: your password was changed. If this was not you, contact support."
)
CONTACT_CHANGED_MESSAGE = (
    "என் மக்கள்: உங்கள் மீட்பு தொலைபேசி எண் மாற்றப்பட்டது. இது நீங்கள் இல்லையெனில் உதவியை அணுகவும்.\n"
    "My People: your recovery number was changed. If this was not you, contact support."
)
MFA_LOCKED_MESSAGE = (
    "என் மக்கள்: பல தவறான அங்கீகாரக் குறியீடுகள் காரணமாக உங்கள் அங்கீகாரி தற்காலிகமாகப் பூட்டப்பட்டது. "
    "இது நீங்கள் இல்லையெனில் கடவுச்சொல்லை மாற்றவும்.\n"
    "My People: your authenticator is locked for a while after several wrong codes. "
    "If this was not you, reset your password."
)
SUSPICIOUS_SIGN_IN_MESSAGE = (
    "என் மக்கள்: உங்கள் கணக்கில் வழக்கத்துக்கு மாறான உள்நுழைவு. இது நீங்கள் இல்லையெனில் செயலியில் தெரிவித்துக் கடவுச்சொல்லை மாற்றவும்.\n"
    "My People: an unusual sign-in to your account. If this was not you, say so in the app and change your password."
)

NEW_DEVICE_MESSAGE = (
    "என் மக்கள்: புதிய சாதனத்தில் உங்கள் கணக்கில் உள்நுழைவு. இது நீங்கள் இல்லையெனில் கடவுச்சொல்லை மாற்றவும்.\n"
    "My People: a new device signed in to your account. If this was not you, reset your password."
)
