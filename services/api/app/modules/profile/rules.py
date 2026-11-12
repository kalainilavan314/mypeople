"""Profile rules (BRD P01 to P06; FR-PROF-002 to 006, 009, 010, 017, BR-073 to BR-076).

A member edits only their display name and gender. The legal name, date of
birth and ID number are locked: changing them needs a new identity review
(BR-073), and a display name never replaces the legal name (BR-074). A move
to another GN division is a request with proof of residence; the current
area stays until a reviewer in the new area approves it (BR-076).
"""

from datetime import timedelta
from typing import Literal

GENDERS = ("male", "female", "other")  # as the Express sign-up records them

# Fields shown with a padlock (FR-PROF-003): a change needs a formal re-review.
LOCKED_FIELDS = ("legal_name", "date_of_birth", "id_number")

# OD-17 [ASSUMPTION, open]: a verification is valid for a year, then a light re-confirmation.
VERIFICATION_VALID_FOR = timedelta(days=365)

# [ASSUMPTION] Area changes are decided by identity reviewers (members.verify) in the requested
# area, who check the proof of residence; the BRD names no permission for it.
AREA_REVIEW = "members.verify"

AreaDecision = Literal["approve", "decline"]
ActivityKind = Literal[
    "identity_review", "appeal", "event", "removal_request", "area_change", "privacy_request", "issue_report",
    "volunteer_offer",
]
ACTIVITY_KINDS: tuple[ActivityKind, ...] = (
    "identity_review",
    "appeal",
    "event",
    "removal_request",
    "area_change",
    "privacy_request",
    "issue_report",  # FR-RPT-014: a report's case appears in My Activity
    "volunteer_offer",  # FR-VOL-005: "Offered, awaiting coordinator"
)


def mask_phone(phone: str | None) -> str | None:
    """The number with all but its last two digits hidden (FR-PROF-004), e.g. +9477*****67."""
    if not phone:
        return None
    if len(phone) <= 6:
        return "*" * len(phone)
    return phone[:5] + "*" * (len(phone) - 7) + phone[-2:]


def check_area_request(current_gn: str | None, requested_gn: str, has_open_request: bool) -> str | None:
    if has_open_request:
        return "request_open"
    if current_gn == requested_gn:
        return "same_area"
    return None


# FR-PROF-017: what identity data is kept, why and for how long. The periods are the BRD's
# proposals (§13.4) and wait on the DPO (OD-03).
IDENTITY_DATA_NOTICE = (
    {
        "data_en": "NIC or passport images and selfie",
        "data_ta": "அடையாள அட்டை அல்லது கடவுச்சீட்டுப் படங்களும் செல்ஃபியும்",
        "purpose_en": "To confirm your identity once, by an authorised reviewer.",
        "purpose_ta": "அங்கீகரிக்கப்பட்ட மதிப்பாய்வாளர் ஒருமுறை உங்கள் அடையாளத்தை உறுதிப்படுத்த.",
        "retention_en": "Proposed: 90 days after the final decision, then erased.",
        "retention_ta": "முன்மொழிவு: இறுதி முடிவுக்குப் பின் 90 நாட்கள், பின்னர் அழிக்கப்படும்.",
    },
    {
        "data_en": "ID number, kept only as a keyed hash",
        "data_ta": "அடையாள எண், குறியாக்கப்பட்ட வடிவில் மட்டும்",
        "purpose_en": "To sign you in and stop a second account for the same person.",
        "purpose_ta": "உங்களை உள்நுழைய வைக்கவும், ஒருவருக்கு இரண்டாவது கணக்கைத் தடுக்கவும்.",
        "retention_en": "Proposed: the life of the account plus 2 years.",
        "retention_ta": "முன்மொழிவு: கணக்கு இருக்கும் வரை மேலும் 2 ஆண்டுகள்.",
    },
    {
        "data_en": "Identity decisions",
        "data_ta": "அடையாள முடிவுகள்",
        "purpose_en": "To show who decided, when and why, and to handle appeals.",
        "purpose_ta": "யார், எப்போது, ஏன் முடிவு செய்தார் என்பதைக் காட்டவும் மேல்முறையீடுகளைக் கையாளவும்.",
        "retention_en": "Proposed: the life of the account plus 7 years.",
        "retention_ta": "முன்மொழிவு: கணக்கு இருக்கும் வரை மேலும் 7 ஆண்டுகள்.",
    },
    {
        "data_en": "Optional joining-survey answers",
        "data_ta": "விருப்பத்தேர்வு இணைவுக் கணக்கெடுப்புப் பதில்கள்",
        "purpose_en": "Only to plan community work; never used for verification.",
        "purpose_ta": "சமூகப் பணிகளைத் திட்டமிட மட்டும்; சரிபார்ப்புக்கு ஒருபோதும் பயன்படுத்தப்படாது.",
        "retention_en": "Until you delete them or close your account.",
        "retention_ta": "நீங்கள் நீக்கும் வரை அல்லது கணக்கை மூடும் வரை.",
    },
)
