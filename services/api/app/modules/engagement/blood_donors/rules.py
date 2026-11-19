"""Blood donor network rules (BRD v1.1 FR-BLD-001 to 008, BR-139 to 141, OS-15, OD-39) as plain functions.

Donors enrol only by explicit opt-in with a self-declared blood group, a broad service area (a District
or DS division), contact preferences and availability; they withdraw and their donor data is deleted at
once. Only authorised partner accounts (hospitals and the blood transfusion service) raise requests;
matching is by blood group and broad area, the donors are told privately, and the partner sees only
how many were told until a donor accepts and consents to share their contact. There is no list or
search of donors anywhere. The app never judges medical eligibility or compatibility: qualified
health professionals do (OS-15, BR-141).
"""

from datetime import date, datetime, timedelta
from typing import Literal

# [ASSUMPTION] OD-39: PRM-55 is held by partner accounts, which are not staff tiers; the Tier 5 oversight
# the BRD gives it (read-only, plus the approval of requests over the hourly limit and the authorisation of
# partners and their requesters) is this explicit Tier 5 grant.
OVERSIGHT = "donor.oversight"

BloodGroup = Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
BLOOD_GROUPS: tuple[BloodGroup, ...] = ("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")
Urgency = Literal["routine", "urgent", "critical"]
ContactMethod = Literal["call", "sms", "whatsapp"]
Outcome = Literal["fulfilled", "partly_fulfilled", "not_needed", "unfulfilled"]
PartnerKind = Literal["hospital", "blood_bank"]
RequestState = Literal["awaiting_approval", "open", "closed", "refused"]
ResponseState = Literal["notified", "accepted", "declined"]

CONSENT_VERSION = "blood-donor-2026-11"  # what the donor agreed to (FR-BLD-001)
REQUESTS_PER_HOUR = 10  # FR-BLD-008 [ASSUMPTION]: more per partner per hour need Tier 5 approval
NOTICES_PER_REQUEST = 25  # [ASSUMPTION] OD-39: enough donors for a request without telling a whole district
NOTICE_GAP = timedelta(hours=24)  # [ASSUMPTION] OD-39: a donor is asked at most once a day (RSK-37)
KEEP_REQUESTS = timedelta(days=365)  # [ASSUMPTION] OD-39: requests and answers are kept 12 months
LONGEST_WAIT = timedelta(days=14)  # a request is for blood needed within 14 days
LONGEST_PAUSE = timedelta(days=366)

MEDICAL_STATEMENT_EN = (
    "Whether you can give blood, and whose blood yours suits, is decided only by qualified health professionals "
    "at the hospital or blood bank. This app never decides it."
)
MEDICAL_STATEMENT_TA = (
    "நீங்கள் இரத்த தானம் செய்ய முடியுமா, உங்கள் இரத்தம் யாருக்குப் பொருந்தும் என்பதை வைத்தியசாலை அல்லது இரத்த வங்கியின் "
    "தகுதிவாய்ந்த சுகாதார நிபுணர்கள் மட்டுமே தீர்மானிப்பார்கள். இந்தச் செயலி ஒருபோதும் அதைத் தீர்மானிக்காது."
)


def check_donor(*, consent: bool, area_level: str, methods: list[str], paused_until: date | None, today: date) -> list[str]:
    """FR-BLD-001: explicit opt-in, a broad area (never a GN division or an address), a way to be contacted."""
    problems = []
    if not consent:
        problems.append("consent_required")
    if area_level not in ("district", "ds"):
        problems.append("broad_area_required")
    if not methods:
        problems.append("contact_method_required")
    if paused_until is not None and (paused_until < today or paused_until - today > LONGEST_PAUSE):
        problems.append("pause_date")
    return problems


def check_request(*, area_level: str, needed_by: datetime, now: datetime) -> list[str]:
    problems = []
    if area_level not in ("district", "ds"):
        problems.append("broad_area_required")
    if needed_by <= now:
        problems.append("needed_by_in_past")
    elif needed_by - now > LONGEST_WAIT:
        problems.append("needed_by_too_far")
    return problems


def needs_approval(requests_in_last_hour: int) -> bool:
    """FR-BLD-008: past 10 requests from one partner within an hour, each further one waits for Tier 5."""
    return requests_in_last_hour >= REQUESTS_PER_HOUR


def is_open(state: str, needed_by: datetime, now: datetime) -> bool:
    return state == "open" and needed_by > now


def check_answer(*, request_state: str, needed_by: datetime, response_state: str, accept: bool, consent: bool,
                 now: datetime) -> str | None:
    """M38, FR-BLD-005: once, while the request is open; accepting needs consent to pass on the contact."""
    if response_state != "notified":
        return "already_answered"
    if not is_open(request_state, needed_by, now):
        return "request_closed"
    if accept and not consent:
        return "consent_required"
    return None


def check_decider(raised_by: object, decider: object) -> str | None:
    """Nobody approves a request they raised themselves."""
    return "own_request" if raised_by == decider else None


def notice_state(request_state: str, needed_by: datetime, now: datetime) -> Literal["open", "closed", "expired"]:
    """What a donor sees of a request: still open, closed by the partner, or past the time it was needed by."""
    if request_state == "open":
        return "open" if needed_by > now else "expired"
    return "closed"
