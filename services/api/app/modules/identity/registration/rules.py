"""Registration rules (BRD FR-AUTH-010 to 013, FR-REG-026, 027, BR-003, BR-005, BR-006, BR-016)
as plain functions.

The service gathers the facts and these functions decide. Each problem is a
short code the apps can explain next to the field it concerns.
"""

import re
from datetime import date
from functools import cache
from pathlib import Path
from typing import Literal

Route = Literal["nic", "passport"]
Gender = Literal["male", "female", "other", "prefer_not_to_say"]  # FR-REG-026
Language = Literal["ta", "en"]  # BR-001

# FR-AUTH-011: old NIC (9 digits and V or X) and new NIC (12 digits).
NIC_PATTERN = re.compile(r"^(\d{9}[VX]|\d{12})$")
COUNTRY_PATTERN = re.compile(r"^[A-Z]{3}$")  # ISO 3166-1 alpha-3 (IdentityRecord.passport_country)

MIN_PASSWORD = 10  # FR-AUTH-013
MAX_PASSWORD = 128  # bcrypt uses the first 72 bytes; the limit stops oversized input
MINIMUM_AGE = 18  # [ASSUMPTION] OD-15 sets the minimum membership age; 18 is the BRD's example
EARLIEST_BIRTH_DATE = date(1900, 1, 2)  # Express's CHECK constraint on npm.member.dob

_COMMON_PASSWORDS_FILE = Path(__file__).with_name("common_passwords.txt")


@cache
def common_passwords() -> frozenset[str]:
    lines = _COMMON_PASSWORDS_FILE.read_text(encoding="utf-8").splitlines()
    return frozenset(line.strip().lower() for line in lines if line.strip() and not line.startswith("#"))


def normalise_id_number(number: str) -> str:
    """Upper case without spaces, so "123456789v" and "123456789 V" are the same NIC."""
    return re.sub(r"\s+", "", number).upper()


def check_id_number(route: Route, number: str, country: str | None, passport_pattern: str) -> list[str]:
    """FR-AUTH-011, BR-005. A valid format never means the identity is verified."""
    if route == "nic":
        return [] if NIC_PATTERN.fullmatch(number) else ["invalid_id_number"]
    problems = [] if re.fullmatch(passport_pattern, number) else ["invalid_id_number"]
    if not country or not COUNTRY_PATTERN.fullmatch(country):
        problems.append("invalid_passport_country")
    return problems


def check_password(password: str, id_number: str) -> list[str]:
    if len(password) < MIN_PASSWORD:
        return ["password_too_short"]
    if len(password) > MAX_PASSWORD:
        return ["password_too_long"]
    if password.lower() in common_passwords():
        return ["password_too_common"]
    if id_number and id_number.lower() in password.lower():
        return ["password_contains_id_number"]
    return []


def check_name(full_name: str) -> list[str]:
    """The full name as on the ID (FR-AUTH-010), within npm.member's limits."""
    return [] if 2 <= len(full_name.strip()) <= 150 else ["invalid_name"]


def age_on(birth_date: date, today: date) -> int:
    """Age is derived from the date of birth and never entered (BR-016)."""
    had_birthday = (today.month, today.day) >= (birth_date.month, birth_date.day)
    return today.year - birth_date.year - (0 if had_birthday else 1)


def check_birth_date(birth_date: date | None, today: date) -> list[str]:
    if birth_date is None:
        return []
    if birth_date > today:
        return ["dob_in_future"]
    if birth_date < EARLIEST_BIRTH_DATE:
        return ["dob_too_early"]
    if age_on(birth_date, today) < MINIMUM_AGE:
        return ["under_minimum_age"]  # FR-REG-027
    return []


def check_area(district: str | None, ds: str | None, gn: str | None) -> list[str]:
    """BR-017: an area is chosen from the top down, so a lower level needs the one above it."""
    if gn and not ds:
        return ["area_incomplete"]
    if ds and not district:
        return ["area_incomplete"]
    return []
