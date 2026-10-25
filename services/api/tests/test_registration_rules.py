"""Registration rules as plain functions (FR-AUTH-010 to 013, FR-REG-026, 027, BR-005, BR-016). No database needed."""

from datetime import date

import pytest

from app.core.security import nic_hash, passport_hash
from app.modules.identity.registration import rules

PASSPORT = r"^[A-Z0-9]{6,9}$"
PEPPER = "test-only-nic-pepper-for-unit-tests"


@pytest.mark.parametrize(
    ("number", "valid"),
    [("123456789V", True), ("123456789X", True), ("200012345678", True), ("12345", False), ("12345678V", False),
     ("123456789Z", False), ("2000123456789", False)],
)
def test_nic_formats(number, valid):  # FR-AUTH-011
    assert (rules.check_id_number("nic", number, None, PASSPORT) == []) is valid


def test_id_numbers_are_compared_without_case_or_spaces():
    assert rules.normalise_id_number(" 123456789 v ") == "123456789V"


def test_passports_need_a_number_in_the_pattern_and_a_country():  # BR-005
    assert rules.check_id_number("passport", "N1234567", "LKA", PASSPORT) == []
    assert rules.check_id_number("passport", "N1", "LKA", PASSPORT) == ["invalid_id_number"]
    assert rules.check_id_number("passport", "N1234567", "LK", PASSPORT) == ["invalid_passport_country"]
    assert rules.check_id_number("passport", "N1234567", None, PASSPORT) == ["invalid_passport_country"]


@pytest.mark.parametrize(
    ("password", "problem"),
    [
        ("short", "password_too_short"),
        ("x" * 129, "password_too_long"),
        ("Password123", "password_too_common"),
        ("my 123456789V card", "password_contains_id_number"),
        ("a long tamil passphrase", None),
    ],
)
def test_password_rules(password, problem):  # FR-AUTH-013
    assert rules.check_password(password, "123456789V") == ([problem] if problem else [])


def test_names_as_on_the_id():
    assert rules.check_name("Kumar Selvaraj") == []
    assert rules.check_name(" K ") == ["invalid_name"]
    assert rules.check_name("x" * 151) == ["invalid_name"]


def test_age_is_derived_from_the_birth_date():  # BR-016
    today = date(2026, 10, 25)
    assert rules.age_on(date(2008, 10, 25), today) == 18
    assert rules.age_on(date(2008, 10, 26), today) == 17
    assert rules.check_birth_date(date(2008, 10, 26), today) == ["under_minimum_age"]
    assert rules.check_birth_date(date(2027, 1, 1), today) == ["dob_in_future"]
    assert rules.check_birth_date(date(1899, 12, 31), today) == ["dob_too_early"]
    assert rules.check_birth_date(None, today) == []


def test_an_area_is_chosen_from_the_top_down():  # BR-017
    assert rules.check_area("LK41", "LK4103", "LK4103005") == []
    assert rules.check_area("LK41", None, None) == []
    assert rules.check_area(None, "LK4103", None) == ["area_incomplete"]
    assert rules.check_area("LK41", None, "LK4103005") == ["area_incomplete"]


def test_passport_hashes_never_equal_nic_hashes():
    assert passport_hash("200012345678", "LKA", PEPPER) != nic_hash("200012345678", PEPPER)
    assert passport_hash("N1234567", "LKA", PEPPER) != passport_hash("N1234567", "IND", PEPPER)
    assert passport_hash(" n1234567 ", "lka", PEPPER) == passport_hash("N1234567", "LKA", PEPPER)
