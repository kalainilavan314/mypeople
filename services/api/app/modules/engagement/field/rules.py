"""Field visit rules (BRD FR-FLD-001 to 009, BR-133 to 135, OD-38) as plain functions.

Consent first; a declined visit keeps nothing but the place and time. Notes are community-service
notes only: there is no field for voting intention, political preference or persuasion (FR-FLD-006).
Words that record how a person votes, which party they back or an attempt to persuade them are always
refused, whatever the coordinator confirms; words that are only sometimes political ("supporter",
"election") are refused until the coordinator removes them or confirms they are not. Visits are
deleted after 12 months [OD-38], leaving monthly counts.
"""

import re
from typing import Literal

PERMISSION = "field.collect"  # PRM-51
RETENTION_MONTHS = 12  # [ASSUMPTION; OD-38 recommendation]

Concern = Literal[
    "water", "roads", "health", "education", "livelihood", "housing", "electricity", "waste", "safety",
    "elderly_care", "disability", "other",
]

# Always refused (BR-134): a person's vote, voting intention, party allegiance or persuasion, in
# English and Tamil. Tamil words are matched as stems, without \b, because Tamil vowel signs are not
# word characters to the regex engine.
_PROFILING = re.compile(
    r"\bvot(?:e|es|ed|ing)\s+(?:for|against)\b"
    r"|\b(?:will|would|shall|going\s+to|plans?\s+to|intends?\s+to|wants?\s+to)\s+vote\b"
    r"|\b(?:won[’']?t|wont|will\s+not|would\s*n[’']?t|would\s+not|did\s*n[’']?t|did\s+not|does\s*n[’']?t|does\s+not"
    r"|never|not\s+going\s+to)\s+vote\b"
    r"|\bhow\s+(?:he|she|they|the\s+family|people)\s+vot"
    r"|\bvot(?:e|ing)\s+(?:intention|choice|preference)"
    r"|\b(?:swing|undecided|floating)\s+voters?\b"
    r"|\bpersua[ds]"
    r"|\b(?:which|what)\s+party\b"
    r"|\bparty\s+(?:supporters?|loyal(?:ist)?s?|members?)\b"
    r"|\bsupports?\s+(?:the\s+|our\s+|their\s+)?(?:party|opposition|candidate)\b"
    r"|\bopposition\s+supporters?\b"
    # A Tamil consonant with its virama is two code points, so an optional one is a group, (?:ப்)?.
    r"|வாக்களி"  # to vote: வாக்களிப்பேன், வாக்களித்தார், வாக்களிக்கவில்லை
    r"|வாக்கு(?:ப்)?\s*போட|ஓட்டு(?:ப்)?\s*போட"  # casting a vote, formal and spoken
    r"|வாக்கு(?:க்)?\s*கேட்|ஓட்டு(?:க்)?\s*கேட்"  # asking for votes
    r"|எந்த(?:க்)?\s*கட்சி"  # which party
    r"|கட்சி\S*\s*ஆதரவ",  # party support, party supporter
    re.IGNORECASE,
)

# Sometimes political, sometimes not ("a supporter of the school committee", "voter registration
# help"): refused until the coordinator removes them or confirms the note is not political.
_POSSIBLY_POLITICAL = re.compile(
    r"\bsupporters?\b|\bpolitic|\bparty\b|\bcandidates?\b|\belections?\b|\bvoters?\b|\bvot(?:e|es|ed|ing)\b|\bcampaign"
    r"|ஆதரவாளர்|அரசியல்|கட்சி|வேட்பாளர்|தேர்தல்|வாக்காளர்|பிரசார|பிரச்சார",
    re.IGNORECASE,
)


def records_political_profile(*texts: str | None) -> bool:
    """True when a text records a vote, voting intention, party allegiance or persuasion."""
    return any(t and _PROFILING.search(t) for t in texts)


def looks_political(*texts: str | None) -> bool:
    """True when a text may be political: either always-refused words or ambiguous ones."""
    return records_political_profile(*texts) or any(t and _POSSIBLY_POLITICAL.search(t) for t in texts)


def check_visit(*, consent: str, concerns: list[str], notes: str | None, place_text: str | None, follow_up: str | None,
                case_number: str | None, confirmed_not_political: bool) -> list[str]:
    """The service has already emptied a declined visit's fields: nothing is kept (FR-FLD-004)."""
    problems = []
    if consent == "given" and not concerns:
        problems.append("concerns_required")
    if records_political_profile(notes, follow_up, place_text):
        problems.append("political_profiling")  # no confirmation can save these words
    elif looks_political(notes, follow_up, place_text) and not confirmed_not_political:
        problems.append("political_content")
    return problems


SyncOutcome = Literal["created", "updated", "unchanged", "conflict", "refused"]


def sync_outcome(*, exists: bool, same_values: bool, server_version: int | None, base_version: int | None) -> SyncOutcome:
    """Server-authoritative: an edit made from an older version than the server's is a conflict.

    A resend of exactly what the server holds (the phone missed the answer) is unchanged, whatever
    version it started from: nothing is written and nothing conflicts.
    """
    if not exists:
        return "created"
    if same_values:
        return "unchanged"
    if base_version is None or base_version != server_version:
        return "conflict"
    return "updated"
