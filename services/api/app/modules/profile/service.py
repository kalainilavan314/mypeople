"""The member's own profile (BRD P01 to P04, P06; FR-PROF-001 to 004, 006, 009, 010, 017).

The profile shows what is recorded and what can change. Display name and
gender are the member's to edit; the legal name, date of birth and ID number
are locked, and a change to them is a new identity review (BR-073, BR-074).
The mobile number is shown masked; it changes only through a code sent to
the new number (/v1/identity/me/phone, FR-PROF-004). My Activity lists every
receipt the member holds, newest first (FR-PROF-010). Optional joining-survey
answers can be seen, changed or deleted, and deleting them is logged
(FR-PROF-017, BR-019).

Not built yet: the versioned request to change verified legal details
(FR-PROF-008, identity batch), notification channel choices (FR-PROF-012,
messaging batch), volunteer-skill audience (volunteering batch), and the
settings the app keeps on the device (language, appearance, sign-out
clean-up: FR-PROF-011, 013, 016).
"""

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.audit import service as audit
from app.modules.identity.recovery import repository as contacts
from app.modules.identity.reviews import repository as reviews
from app.modules.membership import repository as membership
from app.modules.profile import repository, rules
from app.modules.profile.area_changes import repository as area_changes
from app.modules.profile.area_changes.repository import StoredChange
from app.modules.profile.repository import ActivityItem


@dataclass(frozen=True)
class Profile:
    member_code: str
    legal_name: str
    display_name: str | None
    date_of_birth: object | None
    gender: str | None
    language: str
    tier: str  # as assigned; no control changes it (FR-PROF-002)
    identity_state: str
    membership_state: str
    district_name: str | None
    ds_name: str | None
    gn_name: str | None
    mobile_masked: str | None
    verified_at: datetime | None
    verification_valid_until: datetime | None
    open_area_change: StoredChange | None


def profile(db: Session, member_id: uuid.UUID) -> Profile:
    row = membership.find_member_profile(db, member_id)
    status = access_repository.find_member_status(db, member_id)
    assert row is not None and status is not None
    review = reviews.latest_review(db, member_id)
    contact = contacts.find_contact(db, member_id)
    verified_at = row["verified_at"] if status.identity_verified else None
    open_change = next((c for c in area_changes.of_member(db, member_id) if c.state in ("awaiting_proof", "submitted")), None)
    return Profile(
        member_code=row["member_code"],
        legal_name=row["full_name"],
        display_name=repository.display_name(db, member_id),
        date_of_birth=row["dob"],
        gender=row["gender"],
        language=row["language"] if row["language"] in ("ta", "en") else "ta",
        tier=row["tier"],
        identity_state="verified" if status.identity_verified else (review.state if review else "not_submitted"),
        membership_state=membership.current_state(db, member_id).state,
        district_name=row["district_name"],
        ds_name=row["ds_name"],
        gn_name=row["gs_name"],
        mobile_masked=rules.mask_phone(contact.phone if contact else row["phone"]),
        verified_at=verified_at,
        verification_valid_until=verified_at + rules.VERIFICATION_VALID_FOR if verified_at else None,
        open_area_change=open_change,
    )


def update(db: Session, member_id: uuid.UUID, changes: dict[str, str | None], ip: str) -> Profile:
    """Display name, gender and language preference; nothing else can be changed here."""
    if "display_name" in changes:
        name = changes["display_name"]
        repository.set_display_name(db, member_id, name.strip() if name and name.strip() else None)
    if "gender" in changes:
        repository.set_gender(db, member_id, changes["gender"])
    if "language" in changes and changes["language"] in ("ta", "en"):
        repository.set_language(db, member_id, str(changes["language"]))
    if changes:
        audit.record(
            db, actor_id=member_id, action="profile.updated", target_type="member", target_id=str(member_id),
            area_path=access_repository.member_area_path(db, member_id), details={"changed": sorted(changes)}, ip=ip,
        )
    db.commit()
    return profile(db, member_id)


def activity(db: Session, member_id: uuid.UUID, kind: str | None, limit: int) -> list[ActivityItem]:
    kinds = [kind] if kind else list(rules.ACTIVITY_KINDS)
    return repository.activity(db, member_id, kinds, limit)


def survey_answers(db: Session, member_id: uuid.UUID) -> dict[str, str]:
    return repository.survey_answers(db, member_id)


def replace_survey_answers(db: Session, member_id: uuid.UUID, answers: dict[str, str], ip: str) -> dict[str, str]:
    """An empty set deletes them all (FR-PROF-017). The answers stay out of the audit entry."""
    repository.replace_survey_answers(db, member_id, answers)
    audit.record(
        db, actor_id=member_id, action="profile.survey.deleted" if not answers else "profile.survey.changed",
        target_type="member", target_id=str(member_id), area_path=access_repository.member_area_path(db, member_id),
        details={"questions": len(answers)}, ip=ip,
    )
    db.commit()
    return repository.survey_answers(db, member_id)
