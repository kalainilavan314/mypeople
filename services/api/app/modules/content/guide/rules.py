"""Livelihood guide rules (BRD FR-LIV-001 to 006, BR-142, BR-001) as plain functions.

Content editors (guide.edit) draft entries; a second person with guide.review publishes them
(FR-LIV-003). A published entry is complete in Tamil and English and carries its source link,
the source's publication date and the date someone last checked it (FR-LIV-002, 005). Every
entry is shown with the same eligibility disclaimer, and no entry may say that a person
qualifies (FR-LIV-004): the guide points people to the provider, it never decides.
"""

from datetime import date
from typing import Literal

EDIT = "guide.edit"  # [ASSUMPTION] FR-LIV-002: the content editor role (FR-ADM-013)
REVIEW = "guide.review"  # [ASSUMPTION] FR-LIV-003: content review before publication

Category = Literal[
    "assistance_programme", "scholarship", "job", "vocational_training", "agriculture", "fisheries",
    "enterprise_grant", "course", "public_service_contact",
]
CATEGORIES: tuple[Category, ...] = (
    "assistance_programme", "scholarship", "job", "vocational_training", "agriculture", "fisheries",
    "enterprise_grant", "course", "public_service_contact",
)
State = Literal["draft", "in_review", "published", "withdrawn"]
ReportReason = Literal["outdated", "closed", "broken_link", "wrong_details", "other"]
ReportOutcome = Literal["fixed", "dismissed"]

# FR-LIV-004: "check eligibility with the provider", in both languages, on every entry.
DISCLAIMER_EN = (
    "This guide does not decide who qualifies. Check eligibility with the provider before you apply, "
    "and apply only through the provider's own channels."
)
DISCLAIMER_TA = (
    "யார் தகுதியானவர் என்பதை இந்த வழிகாட்டி தீர்மானிப்பதில்லை. விண்ணப்பிக்க முன் வழங்குநரிடம் தகுதியை "
    "உறுதிப்படுத்துங்கள்; வழங்குநரின் சொந்த வழிகளில் மட்டுமே விண்ணப்பியுங்கள்."
)

# [ASSUMPTION] Wording that states or implies that the reader qualifies (FR-LIV-004, BR-142). The
# check is a guard against slips, not a filter of every phrasing; the reviewer still reads it all.
QUALIFYING_CLAIMS = (
    "you qualify", "you are eligible", "you're eligible", "you will receive", "you will get", "guaranteed",
    "everyone qualifies", "all are eligible", "you are entitled", "you're entitled",
    "நீங்கள் தகுதியானவர்", "நீங்கள் தகுதியுடையவர்", "உங்களுக்குக் கிடைக்கும்", "உங்களுக்கு கிடைக்கும்", "உத்தரவாதம்",
    "அனைவரும் தகுதியானவர்கள்",
)

# [ASSUMPTION] An entry not checked for this long is flagged to editors as needing a fresh check.
REVERIFY_AFTER_DAYS = 180

TEXT_FIELDS = ("title", "summary", "body", "provider")


def claims_qualification(text: str | None) -> bool:
    lowered = (text or "").casefold()
    return any(phrase.casefold() in lowered for phrase in QUALIFYING_CLAIMS)


def check_wording(values: dict[str, object]) -> list[str]:
    """FR-LIV-004, checked on every save, so a draft can never carry such a claim either."""
    fields = [f"{name}_{lang}" for name in TEXT_FIELDS for lang in ("en", "ta")]
    return ["states_eligibility"] if any(claims_qualification(str(values.get(f) or "")) for f in fields) else []


def check_publishable(values: dict[str, object], today: date) -> list[str]:
    """FR-LIV-002, 005: what an entry needs before review and publication."""
    problems = []
    for name in TEXT_FIELDS:
        for lang in ("en", "ta"):
            if not str(values.get(f"{name}_{lang}") or "").strip():
                problems.append(f"{name}_{lang}_required")
    if not values.get("source_url"):
        problems.append("source_url_required")
    published_on = values.get("published_on")
    verified_on = values.get("verified_on")
    expires_on = values.get("expires_on")
    if published_on is None:
        problems.append("published_on_required")
    elif isinstance(published_on, date) and published_on > today:
        problems.append("published_on_in_future")
    if verified_on is None:
        problems.append("verified_on_required")
    elif isinstance(verified_on, date):
        if verified_on > today:
            problems.append("verified_on_in_future")
        if isinstance(published_on, date) and verified_on < published_on:
            problems.append("verified_before_published")
    if isinstance(expires_on, date) and expires_on < today:
        problems.append("already_expired")
    return problems + check_wording(values)


def check_reviewer(reviewer: object, *others: object) -> str | None:
    """FR-LIV-003: neither the person who last changed the entry nor the one who asked may approve."""
    return "own_entry" if reviewer in others else None


def is_expired(expires_on: date | None, today: date) -> bool:
    """FR-LIV-003: an entry leaves the active list the day after its end date."""
    return expires_on is not None and expires_on < today


def needs_reverification(verified_on: date | None, today: date) -> bool:
    return verified_on is None or (today - verified_on).days > REVERIFY_AFTER_DAYS


def search_pattern(query: str | None) -> str | None:
    """A LIKE pattern for the search box, with the wildcards typed by the member taken literally."""
    words = (query or "").strip()
    if not words:
        return None
    escaped = words.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"
