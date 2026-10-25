"""Registration, consent and registration progress (BRD A03 to A18).

A new account starts with Identity "Draft" (the Express states
"nic_format" for a well-formed NIC, otherwise "unverified") and a Pending
membership. Format checks never verify anyone (FR-AUTH-011, FR-REG-016).
The phone number, and the one-time code that confirms it, come with the
account-security batch (FR-REG-028, FR-AUTH-014).
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime

from sqlalchemy.orm import Session

from app.core.security import hash_password, nic_hash, passport_hash
from app.modules.audit import service as audit
from app.modules.identity.documents import repository as documents_repository
from app.modules.identity.registration import repository, rules
from app.modules.identity.registration.repository import NewMember
from app.modules.identity.registration.rules import Route
from app.modules.identity.reviews import repository as reviews_repository
from app.modules.identity.reviews.rules import REQUIRED_DOCUMENTS
from app.modules.membership import repository as membership_repository
from app.modules.membership.rules import NOTICE_VERSIONS, ConsentType


class RegistrationRefused(Exception):
    def __init__(self, problems: list[str]) -> None:
        super().__init__(", ".join(problems))
        self.problems = problems


class AlreadyRegistered(Exception):
    """The ID number belongs to an account already; the app offers sign-in and recovery (FR-AUTH-012)."""


class NoticeOutdated(Exception):
    """The member was shown an older version of the notice than the current one."""


@dataclass(frozen=True)
class Registration:
    route: Route
    id_number: str
    passport_country: str | None
    full_name: str
    password: str
    language: str
    dob: date | None
    gender: str | None
    district_code: str | None
    ds_code: str | None
    gs_code: str | None
    referral_code: str | None
    survey_answers: dict[str, str]


@dataclass(frozen=True)
class Registered:
    member_id: uuid.UUID
    referral_accepted: bool | None  # None when no code was given


def id_hash(route: Route, id_number: str, passport_country: str | None, pepper: str) -> str:
    if route == "nic":
        return nic_hash(id_number, pepper)
    assert passport_country is not None
    return passport_hash(id_number, passport_country, pepper)


def register(db: Session, form: Registration, *, pepper: str, passport_pattern: str, ip: str) -> Registered:
    id_number = rules.normalise_id_number(form.id_number)
    country = form.passport_country.strip().upper() if form.passport_country else None
    problems = [
        *rules.check_name(form.full_name),
        *rules.check_id_number(form.route, id_number, country, passport_pattern),
        *rules.check_password(form.password, id_number),
        *rules.check_birth_date(form.dob, datetime.now(UTC).date()),
        *rules.check_area(form.district_code, form.ds_code, form.gs_code),
    ]
    if not problems and not repository.area_exists(db, form.district_code, form.ds_code, form.gs_code):
        problems.append("unknown_area")
    if problems:
        raise RegistrationRefused(problems)

    hashed_id = id_hash(form.route, id_number, country, pepper)
    if repository.id_number_taken(db, hashed_id):
        raise AlreadyRegistered()

    referrer = repository.find_referrer(db, form.referral_code) if form.referral_code else None
    # A NIC in a valid format is all sign-up can attest; it is not identity verification.
    status = "nic_format" if form.route == "nic" else "unverified"
    try:
        member_id = repository.insert_member(
            db,
            NewMember(
                full_name=form.full_name.strip(),
                id_hash=hashed_id,
                verification_status=status,
                password_hash=hash_password(form.password),
                language=form.language,
                dob=form.dob,
                gender=form.gender,
                district_code=form.district_code,
                ds_code=form.ds_code,
                gs_code=form.gs_code,
                referred_by=referrer,
            ),
        )
    except repository.IdNumberTaken:
        raise AlreadyRegistered() from None

    repository.insert_identity_record(db, member_id, form.route, country)
    repository.record_initial_verification(db, member_id, status)
    membership_repository.record_consent(db, member_id, "terms_and_privacy", NOTICE_VERSIONS["terms_and_privacy"])
    if referrer:
        repository.record_referral(db, referrer, member_id)
    if form.survey_answers:
        repository.save_survey_answers(db, member_id, form.survey_answers)
    # Ids and the route only: never the ID number, its hash or survey answers.
    audit.record(
        db,
        actor_id=member_id,
        action="identity.account.registered",
        target_type="member",
        target_id=str(member_id),
        details={"memberId": str(member_id), "route": form.route},
        ip=ip,
    )
    db.commit()
    return Registered(member_id=member_id, referral_accepted=(referrer is not None) if form.referral_code else None)


def give_consent(db: Session, member_id: uuid.UUID, consent_type: ConsentType, notice_version: str, ip: str) -> None:
    """Record consent to the notice the member was shown (BR-008); it must be the current one."""
    current = NOTICE_VERSIONS[consent_type]
    if notice_version != current:
        raise NoticeOutdated()
    if membership_repository.has_consent(db, member_id, consent_type, current):
        return
    membership_repository.record_consent(db, member_id, consent_type, current)
    audit.record(
        db,
        actor_id=member_id,
        action="membership.consent.given",
        target_type="member",
        target_id=str(member_id),
        details={"memberId": str(member_id), "consentType": consent_type, "noticeVersion": current},
        ip=ip,
    )
    db.commit()


def has_identity_consent(db: Session, member_id: uuid.UUID) -> bool:
    return membership_repository.has_consent(db, member_id, "identity_review", NOTICE_VERSIONS["identity_review"])


@dataclass(frozen=True)
class Step:
    name: str
    done: bool


@dataclass(frozen=True)
class Progress:
    route: str
    steps: list[Step]
    review_state: str | None

    @property
    def next_step(self) -> str | None:
        return next((step.name for step in self.steps if not step.done), None)


def progress(db: Session, member_id: uuid.UUID) -> Progress:
    """Where the member is in registration (FR-AUTH-009, FR-REG-017): consent, each image
    the route needs, then submission. Accepted items are never asked for again."""
    route = repository.account_route(db, member_id)
    received = {d.kind for d in documents_repository.current_documents(db, member_id)}
    review = reviews_repository.latest_review(db, member_id)
    steps = [
        Step("identity_consent", has_identity_consent(db, member_id)),
        *(Step(kind, kind in received) for kind in REQUIRED_DOCUMENTS[route]),  # type: ignore[index]
        Step("submit", review is not None),
    ]
    return Progress(route=route, steps=steps, review_state=review.state if review else None)
