"""Removing personal identifiers from a member's words before they are kept or sent to a model
(BRD FR-AIA-009, BR-128, 15B.6 "Redaction", 15B.8).

NIC numbers (old 9 digits and a letter, new 12 digits), phone numbers, the app's case and record
references (AS-, VR-, CI- and the like) and e-mail addresses are replaced by a plain marker in the
member's language. It errs on the side of removing too much: a long number that is not a phone
number is still removed, because the assistant never needs one to answer from approved sources.
"""

import re
from dataclasses import dataclass
from typing import Literal

Kind = Literal["nic", "phone", "case_reference", "email"]
KINDS: tuple[Kind, ...] = ("nic", "phone", "case_reference", "email")

MARKERS: dict[str, dict[Kind, str]] = {
    "ta": {
        "nic": "[அடையாள அட்டை இலக்கம் நீக்கப்பட்டது]",
        "phone": "[தொலைபேசி இலக்கம் நீக்கப்பட்டது]",
        "case_reference": "[குறிப்பு இலக்கம் நீக்கப்பட்டது]",
        "email": "[மின்னஞ்சல் நீக்கப்பட்டது]",
    },
    "en": {
        "nic": "[ID number removed]",
        "phone": "[phone number removed]",
        "case_reference": "[reference removed]",
        "email": "[email removed]",
    },
}

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
# Old NIC: nine digits and V or X.
_NIC_OLD = re.compile(r"(?<![0-9A-Za-z])\d{9}[VvXx](?![0-9A-Za-z])")
# References the app gives out: two to four letters, a dash and a code with a digit in it
# (VR-00421, CI-00012, MP-1A2B3C4D), and the random base-32 ones that may have no digit.
_REFERENCE = re.compile(r"(?<![0-9A-Za-z])[A-Za-z]{2,4}-(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{4,12}(?![0-9A-Za-z])")
_RANDOM_REFERENCE = re.compile(r"(?<![0-9A-Za-z])(?:AS-[A-Z2-7]{8}|INV-[A-Z2-7]{12}|HH-[A-Z2-7]{6,12})(?![0-9A-Za-z])")
# Nine or more digits, optionally with spaces, dashes or dots between them, and an optional + or 00.
_LONG_NUMBER = re.compile(r"(?<![\d+])(?:\+|00)?\d(?:[ \-.]?\d){8,14}(?!\d)")


@dataclass(frozen=True)
class Redacted:
    text: str
    kinds: list[Kind]


def _number_kind(match: str) -> Kind:
    digits = re.sub(r"\D", "", match)
    # New NIC numbers are 12 digits beginning with the birth year.
    if len(digits) == 12 and digits[:2] in ("19", "20") and not match.startswith(("+", "00")):
        return "nic"
    return "phone"


def redact(text: str, language: str = "ta") -> Redacted:
    markers = MARKERS["en" if language == "en" else "ta"]
    found: set[Kind] = set()

    def replace(kind: Kind):  # type: ignore[no-untyped-def]
        def apply(_match: re.Match[str]) -> str:
            found.add(kind)
            return markers[kind]

        return apply

    def replace_number(match: re.Match[str]) -> str:
        kind = _number_kind(match.group(0))
        found.add(kind)
        return markers[kind]

    result = _EMAIL.sub(replace("email"), text)
    result = _NIC_OLD.sub(replace("nic"), result)
    result = _RANDOM_REFERENCE.sub(replace("case_reference"), result)
    result = _REFERENCE.sub(replace("case_reference"), result)
    result = _LONG_NUMBER.sub(replace_number, result)
    return Redacted(result, [kind for kind in KINDS if kind in found])
