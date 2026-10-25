"""Member QR codes (FR-CARD-003, FR-CARD-004, BR-064). No database needed."""

import pytest

from app.modules.membership.card import tokens

SECRET = "test-only-jwt-secret-for-unit-tests"
REF = tokens.new_card_ref()
NOW = 1_800_000_000


def test_a_code_carries_only_a_reference_times_a_key_id_and_a_signature():
    code = tokens.sign(REF, SECRET, NOW)
    parts = code.code.split(".")

    assert parts[:5] == ["C1", REF, str(NOW), str(NOW + 60), tokens.key_id(SECRET)]
    assert (code.issued_at, code.expires_at) == (NOW, NOW + 60)
    assert tokens.read(code.code, SECRET, NOW) == REF
    assert "." not in REF


def test_a_code_is_accepted_up_to_15_seconds_after_it_expires():
    code = tokens.sign(REF, SECRET, NOW).code
    assert tokens.read(code, SECRET, NOW + 75) == REF
    with pytest.raises(tokens.CardCodeExpired):
        tokens.read(code, SECRET, NOW + 76)


@pytest.mark.parametrize(
    "make_bad",
    [
        lambda code: code[:-2] + ("AA" if not code.endswith("AA") else "BB"),  # signature changed
        lambda code: code.replace(REF, tokens.new_card_ref()),  # someone else's reference
        lambda code: code.replace("C1.", "C9.", 1),  # unknown version
        lambda code: "not a code",
    ],
    ids=["signature", "reference", "version", "garbage"],
)
def test_altered_codes_are_refused(make_bad):
    with pytest.raises(tokens.CardCodeInvalid):
        tokens.read(make_bad(tokens.sign(REF, SECRET, NOW).code), SECRET, NOW)


def test_codes_from_another_key_or_from_the_future_are_refused():
    with pytest.raises(tokens.CardCodeInvalid):
        tokens.read(tokens.sign(REF, "another-secret", NOW).code, SECRET, NOW)
    with pytest.raises(tokens.CardCodeInvalid):
        tokens.read(tokens.sign(REF, SECRET, NOW + 60).code, SECRET, NOW)
