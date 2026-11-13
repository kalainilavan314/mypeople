"""Field visit rules (BRD FR-FLD-001 to 009, BR-133 to 135, OD-38) as plain functions.

Consent first; a declined visit keeps nothing but the place and time. Notes are community-service
notes only: there is no field for voting intention, political preference or persuasion, and notes
that look like such content are refused until the coordinator removes it or confirms it is not
(FR-FLD-006). Visits are deleted after 12 months [OD-38], leaving monthly counts.
"""

import re
from typing import Literal

PERMISSION = "field.collect"  # PRM-51
RETENTION_MONTHS = 12  # [ASSUMPTION; OD-38 recommendation]

Concern = Literal[
    "water", "roads", "health", "education", "livelihood", "housing", "electricity", "waste", "safety",
    "elderly_care", "disability", "other",
]

# Words that suggest political profiling in a note, in English and Tamil. A match asks the coordinator
# to remove it; it is a guard against mistakes, not a judgement of the person visited.
_POLITICAL = re.compile(
    r"(vote[sd]?\s+for|will\s+vote|voting\s+for|won'?t\s+vote|party\s+supporter|supports?\s+the\s+party|swing\s+voter|"
    r"persuad|opposition\s+supporter|வாக்களி|வாக்கு\s*போட|கட்சி\s*ஆதரவ|ஆதரவாளர்)",
    re.IGNORECASE,
)


def looks_political(*texts: str | None) -> bool:
    return any(t and _POLITICAL.search(t) for t in texts)


def check_visit(*, consent: str, concerns: list[str], notes: str | None, place_text: str | None, follow_up: str | None,
                case_number: str | None, confirmed_not_political: bool) -> list[str]:
    """The service has already emptied a declined visit's fields: nothing is kept (FR-FLD-004)."""
    problems = []
    if consent == "given" and not concerns:
        problems.append("concerns_required")
    if looks_political(notes, follow_up, place_text) and not confirmed_not_political:
        problems.append("political_content")
    return problems


SyncOutcome = Literal["created", "updated", "unchanged", "conflict", "refused"]


def sync_outcome(*, exists: bool, server_version: int | None, base_version: int | None) -> SyncOutcome:
    """Server-authoritative: an edit made from an older version than the server's is a conflict."""
    if not exists:
        return "created"
    if base_version is None or base_version != server_version:
        return "conflict"
    return "updated"
