"""Invite a member and My referrals (BRD H19, H20, FR-REF-001 to 006, BR-053 to 056).

An invitation link carries only an opaque random token (FR-REF-004); the app shares it through the
phone's share sheet and never asks for contacts (FR-REF-002). Each invitation is listed with a
neutral label ("Invitation 01") and one of three statuses, Shared, Pending or Active, with nothing
about the person who used it (FR-REF-005, OD-24). Referral counts never become permissions,
rewards, rankings or priority (FR-REF-006): nothing here is read by any other module.
"""

import secrets
import uuid
from dataclasses import dataclass
from typing import Literal

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.audit import service as audit
from app.modules.membership.invitations import repository

INVITATIONS_PER_DAY = 20  # [ASSUMPTION] plenty for a member, too few to spam with
TOKEN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

Status = Literal["shared", "pending", "active"]

PREVIEW = {
    "en": (
        "You are invited to join My People (என் மக்கள்), the Northern Province People's Movement app. "
        "Register with your own NIC or passport; a reviewer checks every identity. Join here: {url}"
    ),
    "ta": (
        "என் மக்கள் (My People) — வடமாகாண மக்கள் இயக்கச் செயலியில் இணைய உங்களுக்கு அழைப்பு. "
        "உங்கள் சொந்த தேசிய அடையாள அட்டை அல்லது கடவுச்சீட்டுடன் பதிவுசெய்யுங்கள்; ஒவ்வொரு அடையாளமும் "
        "சரிபார்க்கப்படும். இங்கே இணையுங்கள்: {url}"
    ),
}


class InvitationRefused(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def new_token() -> str:
    return "INV-" + "".join(secrets.choice(TOKEN_ALPHABET) for _ in range(12))


def link(app_url: str, token: str) -> str:
    return f"{app_url.rstrip('/')}/join/{token}"


def status_of(invitation: repository.Invitation) -> Status:
    if invitation.active:
        return "active"
    return "pending" if invitation.joined else "shared"


@dataclass(frozen=True)
class MyReferrals:
    referral_code: str
    invitations: list[repository.Invitation]


def my_referrals(db: Session, member_id: uuid.UUID) -> MyReferrals:
    return MyReferrals(repository.referral_code(db, member_id), repository.by_inviter(db, member_id))


@dataclass(frozen=True)
class NewInvitation:
    token: str
    number: int
    url: str
    preview: str


def create(db: Session, member_id: uuid.UUID, language: str, app_url: str, ip: str) -> NewInvitation:
    status = access_repository.find_member_status(db, member_id)
    assert status is not None
    if not (status.identity_verified and status.membership_active):
        raise InvitationRefused("membership_not_active")
    if repository.count_recent(db, member_id) >= INVITATIONS_PER_DAY:
        raise InvitationRefused("too_many_invitations_today")
    token = new_token()
    repository.insert(db, member_id, token, language)
    audit.record(db, actor_id=member_id, action="invitation.created", target_type="member", target_id=str(member_id), ip=ip)
    db.commit()
    number = next(i.number for i in repository.by_inviter(db, member_id) if i.token == token)
    url = link(app_url, token)
    return NewInvitation(token=token, number=number, url=url, preview=PREVIEW[language].format(url=url))
