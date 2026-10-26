"""Data-subject request rules (BRD P06; FR-PROF-018, 019, BR-079) as plain functions.

A member may ask for a copy of their personal data or to close their account.
Both are requests with a receipt and a due date, handled by the DPO; closing
is a reviewed request under the retention rules, never an instant deletion
(BR-079).
"""

from datetime import datetime, timedelta
from typing import Literal

HANDLE = "privacy.requests.handle"  # [ASSUMPTION] see app/core/permissions.py

Kind = Literal["copy", "closure"]
Outcome = Literal["completed", "refused"]

# [UNVERIFIED] The Personal Data Protection Act No. 9 of 2022 asks for a reply within 21 working
# days of a request; the DPO confirms the period. Weekends are skipped; public holidays are not
# known to the system, so the date can only be early, never late.
RESPONSE_WORKING_DAYS = 21


def due_date(made_at: datetime) -> datetime:
    """The same time of day, after the given number of Monday-to-Friday days."""
    due = made_at
    remaining = RESPONSE_WORKING_DAYS
    while remaining:
        due += timedelta(days=1)
        if due.weekday() < 5:
            remaining -= 1
    return due


# What closing keeps and for how long, shown on the receipt (FR-PROF-018). The BRD's proposals
# (§13.4), waiting on the DPO (OD-03).
CLOSURE_RETENTION = (
    {
        "data_en": "Your profile",
        "data_ta": "உங்கள் சுயவிவரம்",
        "kept_en": "Anonymised 30 days after the closure is approved.",
        "kept_ta": "மூடல் அங்கீகரிக்கப்பட்ட 30 நாட்களுக்குப் பின் அடையாளமற்றதாக்கப்படும்.",
    },
    {
        "data_en": "Identity decisions",
        "data_ta": "அடையாள முடிவுகள்",
        "kept_en": "Kept 7 years after closure.",
        "kept_ta": "மூடலுக்குப் பின் 7 ஆண்டுகள் வைக்கப்படும்.",
    },
    {
        "data_en": "ID number hash",
        "data_ta": "அடையாள எண் குறியாக்கம்",
        "kept_en": "Kept 2 years to prevent a duplicate registration, longer only with the DPO's approval.",
        "kept_ta": "இரட்டைப் பதிவைத் தடுக்க 2 ஆண்டுகள்; DPO அனுமதியுடன் மட்டுமே அதற்கு மேல்.",
    },
    {
        "data_en": "Contributions",
        "data_ta": "பங்களிப்புகள்",
        "kept_en": "Kept as long as political-finance and tax law require (at least 7 years proposed).",
        "kept_ta": "அரசியல் நிதி மற்றும் வரிச் சட்டங்கள் கோரும் வரை (குறைந்தது 7 ஆண்டுகள் முன்மொழிவு).",
    },
    {
        "data_en": "Audit records",
        "data_ta": "தணிக்கைப் பதிவுகள்",
        "kept_en": "Kept 7 years.",
        "kept_ta": "7 ஆண்டுகள் வைக்கப்படும்.",
    },
)
