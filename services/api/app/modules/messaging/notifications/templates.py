"""The fixed, approved wording of system notifications (FR-MSG-007).

Titles are what a push shows, so they name no person, number or case
(INT-02, BR-145); details stay in the app behind the deep link.
"""

from dataclasses import dataclass

from app.modules.messaging.notifications.rules import Topic


@dataclass(frozen=True)
class Template:
    topic: Topic
    title_en: str
    title_ta: str
    body_en: str
    body_ta: str
    target_kind: str  # what the notification opens (BR-027)
    action_required: bool = False  # stays under "Action needed" until the task is done
    urgent: bool = False  # sent during quiet hours too


TEMPLATES: dict[str, Template] = {
    "identity_needs_update": Template(
        "review",
        "Your identity review needs an update",
        "உங்கள் அடையாள மதிப்பாய்வுக்குத் திருத்தம் தேவை",
        "Open the review to see what to correct.",
        "எதைத் திருத்த வேண்டும் என்பதைக் காண மதிப்பாய்வைத் திறக்கவும்.",
        "identity_review",
        action_required=True,
    ),
    "identity_verified": Template(
        "review",
        "Your identity has been verified",
        "உங்கள் அடையாளம் சரிபார்க்கப்பட்டது",
        "Your membership is decided separately.",
        "உங்கள் உறுப்புரிமை தனியாக முடிவு செய்யப்படும்.",
        "identity_review",
    ),
    "identity_unable": Template(
        "review",
        "Your identity could not be verified",
        "உங்கள் அடையாளத்தைச் சரிபார்க்க முடியவில்லை",
        "Open the review for the reason. You can appeal once.",
        "காரணத்தைக் காண மதிப்பாய்வைத் திறக்கவும். ஒருமுறை மேல்முறையீடு செய்யலாம்.",
        "identity_review",
    ),
    "appeal_decided": Template(
        "review",
        "Your appeal has been decided",
        "உங்கள் மேல்முறையீடு முடிவு செய்யப்பட்டது",
        "Open it for the outcome and the reason.",
        "முடிவையும் காரணத்தையும் காண அதைத் திறக்கவும்.",
        "appeal",
    ),
    "membership_changed": Template(
        "account",
        "Your membership status has changed",
        "உங்கள் உறுப்புரிமை நிலை மாறியுள்ளது",
        "Open your membership for the details.",
        "விவரங்களுக்கு உங்கள் உறுப்புரிமையைத் திறக்கவும்.",
        "membership",
    ),
    "event_cancelled": Template(
        "events",
        "An event you responded to is cancelled",
        "நீங்கள் பதிலளித்த நிகழ்வு ரத்து செய்யப்பட்டது",
        "",
        "",
        "event",
    ),
    "event_changed": Template(
        "events",
        "An event's time or place has changed",
        "ஒரு நிகழ்வின் நேரம் அல்லது இடம் மாறியுள்ளது",
        "",
        "",
        "event",
    ),
    "area_change_decided": Template(
        "review",
        "Your area-change request has been decided",
        "உங்கள் பகுதி மாற்றக் கோரிக்கை முடிவு செய்யப்பட்டது",
        "Open the request for the decision and the reason.",
        "முடிவையும் காரணத்தையும் காண கோரிக்கையைத் திறக்கவும்.",
        "area_change",
    ),
    "removal_decided": Template(
        "review",
        "Your photo removal request has been decided",
        "உங்கள் படம் அகற்றும் கோரிக்கை முடிவு செய்யப்பட்டது",
        "Open the receipt for what was done and why.",
        "என்ன செய்யப்பட்டது, ஏன் என்பதைக் காண ரசீதைத் திறக்கவும்.",
        "removal_request",
    ),
    "privacy_answered": Template(
        "account",
        "Your data request has been answered",
        "உங்கள் தரவுக் கோரிக்கைக்குப் பதில் அளிக்கப்பட்டது",
        "Open the receipt for the outcome.",
        "முடிவைக் காண ரசீதைத் திறக்கவும்.",
        "privacy_request",
    ),
    "removal_escalated": Template(
        "review",
        "A photo removal request is near its 24-hour limit",
        "ஒரு படம் அகற்றும் கோரிக்கை 24 மணி நேர வரம்பை நெருங்குகிறது",
        "It has been open 18 hours. Open the removal queue.",
        "இது 18 மணி நேரமாகத் திறந்துள்ளது. அகற்றும் வரிசையைத் திறக்கவும்.",
        "removal_request",
        action_required=True,
        urgent=True,
    ),
}
