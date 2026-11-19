"""Knowledge base rules (BRD D20, ENT-62, FR-AIA-003, 15B.6) as plain functions.

Approved sources only: organisational policies, published manifesto material, app help and
public-service guides. Each version has a drafter, a second person who approves it, and a review
date; a version past its review date is not used until someone reviews it again. Approving a new
version supersedes the one before; nothing is deleted, a source is retired with a reason.

The text is split into passages and each passage gets search terms from a light stemmer, so
"வீதிகளை", "வீதியில்" and "வீதி" (and "roads" and "road") find the same passages. [ASSUMPTION]
15B.6 asks for multilingual embeddings in pgvector, which the servers do not have yet; the monthly
evaluation (NFR-AI-05) shows whether this search is good enough.
"""

import re
import uuid
from datetime import date, timedelta
from typing import Literal

MANAGE = "ai.kb.manage"  # PRM-47 Knowledge Editor

Kind = Literal["policy", "manifesto", "app_help", "public_service_guide"]
KINDS: tuple[Kind, ...] = ("policy", "manifesto", "app_help", "public_service_guide")
State = Literal["draft", "approved", "superseded", "retired"]
STATES: tuple[State, ...] = ("draft", "approved", "superseded", "retired")

PASSAGE_CHARS = 1200
REVIEW_WITHIN_DAYS = 2 * 366  # [ASSUMPTION] a review date at most two years ahead


def check_source(*, body_ta: str | None, body_en: str | None, review_due: date, today: date) -> list[str]:
    problems = []
    if not (body_ta and body_ta.strip()) and not (body_en and body_en.strip()):
        problems.append("source_text_required")
    if review_due <= today:
        problems.append("review_date_must_be_ahead")
    elif review_due > today + timedelta(days=REVIEW_WITHIN_DAYS):
        problems.append("review_date_too_far")
    return problems


def check_review(review_due: date, today: date) -> list[str]:
    if review_due <= today:
        return ["review_date_must_be_ahead"]
    if review_due > today + timedelta(days=REVIEW_WITHIN_DAYS):
        return ["review_date_too_far"]
    return []


def is_second_person(drafted_by: uuid.UUID, approver: uuid.UUID) -> bool:
    return drafted_by != approver


def review_overdue(review_due: date, today: date) -> bool:
    return review_due < today


# --- Passages --------------------------------------------------------------------------------------------

_SENTENCE_END = re.compile(r"(?<=[.!?।])\s+")


def _pieces(paragraph: str) -> list[str]:
    """A paragraph longer than a passage, cut at sentence ends (or between words when a sentence is too long)."""
    if len(paragraph) <= PASSAGE_CHARS:
        return [paragraph]
    out: list[str] = []
    current = ""
    for sentence in _SENTENCE_END.split(paragraph):
        while len(sentence) > PASSAGE_CHARS:
            cut = sentence.rfind(" ", 0, PASSAGE_CHARS)
            cut = cut if cut > PASSAGE_CHARS // 2 else PASSAGE_CHARS
            if current:
                out.append(current)
                current = ""
            out.append(sentence[:cut].strip())
            sentence = sentence[cut:].strip()
        if current and len(current) + 1 + len(sentence) > PASSAGE_CHARS:
            out.append(current)
            current = sentence
        else:
            current = f"{current} {sentence}".strip()
    if current:
        out.append(current)
    return [piece for piece in out if piece]


def passages(text: str) -> list[str]:
    """The text in passages of up to about 1,200 characters, keeping paragraphs together where they fit."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text.replace("\r\n", "\n")) if p.strip()]
    out: list[str] = []
    for paragraph in paragraphs:
        for piece in _pieces(paragraph):
            if out and len(out[-1]) + 2 + len(piece) <= PASSAGE_CHARS:
                out[-1] = f"{out[-1]}\n\n{piece}"
            else:
                out.append(piece)
    return out


# --- Search terms ----------------------------------------------------------------------------------------

_WORD = re.compile(r"[0-9A-Za-z஀-௿]+")
_TAMIL = re.compile(r"[஀-௿]")
VIRAMA = "்"

ENGLISH_STOPWORDS = frozenset(
    "a about all am an and any are as at be been but by can could did do does for from get got had has have how i if in "
    "into is it its me my no not of on or our please should so tell than that the their them there these they this to "
    "us was we were what when where which who why will with would you your".split()
)
TAMIL_STOPWORDS = frozenset({
    "என்ன", "எப்படி", "எப்போது", "எங்கே", "எங்கு", "யார்", "ஏன்", "எது", "எந்த", "நான்", "என்", "எனக்கு", "என்னை",
    "நாங்கள்", "நீங்கள்", "உங்கள்", "உங்களுக்கு", "இது", "அது", "இந்த", "அந்த", "ஒரு", "மற்றும்", "பற்றி", "தயவுசெய்து",
    "சொல்லுங்கள்", "என்று", "உள்ளது", "உள்ளன", "இருக்கிறது", "இருக்கும்", "முடியுமா", "வேண்டும்", "தான்", "கூட",
})

# Endings stripped from Tamil words, longest first; a word may lose up to three, as in
# கொள்கைகளையும் -> கொள்கைகளை -> கொள்கை -> கொள்க.
TAMIL_SUFFIXES = tuple(sorted({
    suffix.rstrip("்") for suffix in (
        "களுக்கான", "களுக்கு", "களிடம்", "களுடன்", "களால்", "களின்", "களில்", "களை", "கள்",
        "ுக்கான", "க்கான", "ுக்கு", "க்கு", "யுடன்", "ுடன்", "யிடம்", "ிடம்", "யால்", "ால்", "யில்", "ில்", "யின்", "ின்",
        "யும்", "ும்", "யான", "ான", "யாக", "ாக", "யை", "ை", "த்தை", "த்தில்", "த்தின்", "த்துக்கு", "த்திற்கு", "ிற்கு",
    )
}, key=len, reverse=True))
MIN_STEM = 3  # code points left after an ending is taken off


def _tamil_stem(word: str) -> str:
    """Endings are compared without a final virama, so மக்கள், மக்களும் and மக்களுக்கு share one stem."""
    word = word.rstrip(VIRAMA)
    for _ in range(3):
        for suffix in TAMIL_SUFFIXES:
            if word.endswith(suffix) and len(word) - len(suffix) >= MIN_STEM:
                word = word[: -len(suffix)].rstrip(VIRAMA)
                break
        else:
            break
    return word


def _english_stem(word: str) -> str:
    if word.endswith("'s"):
        word = word[:-2]
    for suffix, replacement, keep in (("ies", "y", 3), ("sses", "ss", 3), ("ing", "", 4), ("ed", "", 4), ("es", "", 4),
                                      ("s", "", 3)):
        if word.endswith(suffix) and len(word) - len(suffix) >= keep and not word.endswith("ss"):
            return word[: -len(suffix)] + replacement
    return word


def terms(text: str) -> list[str]:
    """Distinct search terms of a text, in the order they first appear."""
    seen: dict[str, None] = {}
    for raw in _WORD.findall(text.replace("‌", "").replace("‍", "")):
        word = raw.lower()
        if word in ENGLISH_STOPWORDS or word in TAMIL_STOPWORDS:
            continue
        stem = _tamil_stem(word) if _TAMIL.search(word) else _english_stem(word)
        if len(stem) >= 2:
            seen.setdefault(stem, None)
    return list(seen)
