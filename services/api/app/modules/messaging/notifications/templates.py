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
    "suspicious_sign_in": Template(
        "account",
        "Was this you signing in?",
        "இது நீங்கள் செய்த உள்நுழைவா?",
        "A sign-in to your account looked unusual. Tell us whether it was you.",
        "உங்கள் கணக்கில் ஓர் உள்நுழைவு வழக்கத்துக்கு மாறாகத் தெரிந்தது. அது நீங்களா எனத் தெரிவியுங்கள்.",
        "security_alert",
        action_required=True,
        urgent=True,
    ),
    "refresh_reuse": Template(
        "account",
        "A device was signed out for your safety",
        "உங்கள் பாதுகாப்புக்காக ஒரு சாதனம் வெளியேற்றப்பட்டது",
        "Someone may have a copy of a sign-in. Check your devices and change your password.",
        "ஒருவரிடம் உள்நுழைவின் நகல் இருக்கலாம். உங்கள் சாதனங்களைச் சரிபார்த்துக் கடவுச்சொல்லை மாற்றவும்.",
        "security_alert",
        action_required=True,
        urgent=True,
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
    "contribution_submitted": Template(
        "review",
        "Your contribution was received",
        "உங்கள் நிதிப் பங்களிப்பு பெறப்பட்டது",
        "We have received your contribution details and bank slip for review.",
        "உங்கள் நிதிப் பங்களிப்பு விவரங்களும் வங்கிப் பற்றுச்சீட்டும் மதிப்பாய்வுக்காகப் பெறப்பட்டன.",
        "contribution",
    ),
    "contribution_needs_correction": Template(
        "review",
        "Your contribution slip needs an update",
        "உங்கள் பங்களிப்புச் சீட்டுக்குத் திருத்தம் தேவை",
        "Please open your contribution to see the reviewer notes and upload an updated slip.",
        "மதிப்பாய்வாளர் குறிப்புகளைப் பார்த்து புதுப்பிக்கப்பட்ட சீட்டைப் பதிவேற்ற உங்கள் பங்களிப்பைத் திறக்கவும்.",
        "contribution",
        action_required=True,
    ),
    "contribution_rejected": Template(
        "review",
        "Your contribution could not be accepted",
        "உங்கள் பங்களிப்பை ஏற்றுக்கொள்ள முடியவில்லை",
        "Open your contribution record to view the review outcome and reason.",
        "மதிப்பாய்வு முடிவையும் காரணத்தையும் காண உங்கள் பங்களிப்புப் பதிவைத் திறக்கவும்.",
        "contribution",
    ),
    "contribution_verified": Template(
        "review",
        "Your contribution has been verified",
        "உங்கள் பங்களிப்பு சரிபார்க்கப்பட்டது",
        "Your official contribution receipt is now available.",
        "உங்கள் அதிகாரப்பூர்வ பங்களிப்பு ரசீது இப்போது கிடைக்கிறது.",
        "contribution",
    ),
}
