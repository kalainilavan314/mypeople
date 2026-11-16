"""SQL for registration.

New members are written to npm.member exactly as the Express sign-up writes
them (server/src/index.js), so they can sign in through either API and the
live member app shows them correctly. identity.identity_record (Alembic 0008)
adds the route and passport country, which Express does not have.
"""

import secrets
import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.membership.invitations import repository as invitations


class IdNumberTaken(Exception):
    """Another active account already has this NIC or passport (BR-007)."""


def id_number_taken(db: Session, id_hash: str) -> bool:
    return bool(
        db.scalar(
            text("SELECT EXISTS (SELECT 1 FROM npm.member WHERE nic_hash = :hash AND deleted_at IS NULL)"),
            {"hash": id_hash},
        )
    )


def _member_code() -> str:
    # The Express format (lib.js memberCode): WTL-<two-digit year>-<seven digits>.
    year = str(date.today().year)[2:]
    return f"WTL-{year}-{secrets.randbelow(9_000_000) + 1_000_000}"


def _referral_code(full_name: str) -> str:
    # The Express format (lib.js referralCode): up to four Latin letters of the name, or WTL.
    letters = "".join(c for c in full_name.upper() if "A" <= c <= "Z")[:4] or "WTL"
    return f"{letters}-{secrets.randbelow(9000) + 1000}"


@dataclass(frozen=True)
class NewMember:
    full_name: str
    id_hash: str
    verification_status: str
    password_hash: str
    language: str
    dob: date | None
    gender: str | None
    district_code: str | None
    ds_code: str | None
    gs_code: str | None
    referred_by: uuid.UUID | None


def insert_member(db: Session, new: NewMember) -> uuid.UUID:
    """Insert the member, retrying when a generated code collides. A collision on the
    ID-number hash is the caller's input, not bad luck, and is never retried."""
    for _ in range(6):
        try:
            with db.begin_nested():
                return db.scalar(
                    text(
                        """
                        INSERT INTO npm.member
                            (member_code, full_name, nic_hash, nic_status, verification_status, password_hash,
                             dob, gender, gs_code, ds_code, district_code, referral_code, referred_by, language)
                        VALUES (:member_code, :full_name, :id_hash, 'pending', :verification_status, :password_hash,
                                :dob, :gender, :gs_code, :ds_code, :district_code, :referral_code, :referred_by,
                                :language)
                        RETURNING id
                        """
                    ),
                    {
                        "member_code": _member_code(),
                        "referral_code": _referral_code(new.full_name),
                        "full_name": new.full_name,
                        "id_hash": new.id_hash,
                        "verification_status": new.verification_status,
                        "password_hash": new.password_hash,
                        "dob": new.dob,
                        "gender": new.gender,
                        "gs_code": new.gs_code,
                        "ds_code": new.ds_code,
                        "district_code": new.district_code,
                        "referred_by": new.referred_by,
                        "language": new.language,
                    },
                )
        except IntegrityError as error:
            if "member_nic_hash_active_key" in str(error.orig):
                raise IdNumberTaken() from None
    raise RuntimeError("could not allocate a member code")


def insert_identity_record(db: Session, member_id: uuid.UUID, route: str, passport_country: str | None) -> None:
    db.execute(
        text(
            """
            INSERT INTO identity.identity_record (member_id, route, passport_country)
            VALUES (:member_id, :route, :country)
            """
        ),
        {"member_id": member_id, "route": route, "country": passport_country},
    )


def account_route(db: Session, member_id: uuid.UUID) -> str:
    """The route the account registered with; Express sign-ups are NIC accounts."""
    route = db.scalar(text("SELECT route FROM identity.identity_record WHERE member_id = :id"), {"id": member_id})
    return route or "nic"


def identity_confirmed(db: Session, member_id: uuid.UUID) -> bool:
    """True once the member's identity is confirmed, by a /v1 review or earlier in the Express app."""
    status = db.scalar(text("SELECT verification_status FROM npm.member WHERE id = :id"), {"id": member_id})
    return status == "identity_confirmed"


def record_initial_verification(db: Session, member_id: uuid.UUID, status: str) -> None:
    # The same first row the Express sign-up writes to its verification trail.
    db.execute(
        text(
            """
            INSERT INTO npm.verification_audit (member_id, from_status, to_status, method, notes)
            VALUES (:id, NULL, :status, 'signup_format_check', 'Initial state at sign-up')
            """
        ),
        {"id": member_id, "status": status},
    )


def find_referrer(db: Session, referral_code: str) -> uuid.UUID | None:
    """The member behind a referral code, or behind an unused invitation token (INV-, FR-REF-004)."""
    code = referral_code.strip().upper()
    if code.startswith("INV-"):
        return invitations.inviter_for_token(db, code)
    return db.scalar(
        text("SELECT id FROM npm.member WHERE referral_code = :code AND deleted_at IS NULL"),
        {"code": code},
    )


def record_referral(db: Session, referrer_id: uuid.UUID, member_id: uuid.UUID) -> None:
    """The referral ledger and count the live app shows. Unlike the Express sign-up, this
    never promotes the referrer's tier: referral counts must not reward anyone (SG-03)."""
    db.execute(
        text(
            """
            INSERT INTO npm.referral_event (referrer_id, referred_id) VALUES (:referrer, :member)
            ON CONFLICT (referred_id) DO NOTHING
            """
        ),
        {"referrer": referrer_id, "member": member_id},
    )
    db.execute(text("UPDATE npm.member SET recruit_count = recruit_count + 1 WHERE id = :id"), {"id": referrer_id})


def save_survey_answers(db: Session, member_id: uuid.UUID, answers: dict[str, str]) -> None:
    """Optional joining-survey answers (FR-REG-032), classified Sensitive (FR-REG-033, BR-090)."""
    for question_id, answer in answers.items():
        db.execute(
            text(
                """
                INSERT INTO npm.onboarding_answer (member_id, question_id, answer) VALUES (:member, :question, :answer)
                ON CONFLICT (member_id, question_id) DO UPDATE SET answer = EXCLUDED.answer
                """
            ),
            {"member": member_id, "question": question_id, "answer": answer},
        )


def area_exists(db: Session, district: str | None, ds: str | None, gn: str | None) -> bool:
    """Each chosen level exists and sits inside the level above it (BR-017)."""
    if district and not db.scalar(
        text("SELECT EXISTS (SELECT 1 FROM geo.district WHERE district_code = :code)"), {"code": district}
    ):
        return False
    if ds and not db.scalar(
        text("SELECT EXISTS (SELECT 1 FROM geo.ds_division WHERE ds_code = :ds AND district_code = :district)"),
        {"ds": ds, "district": district},
    ):
        return False
    if gn and not db.scalar(
        text("SELECT EXISTS (SELECT 1 FROM geo.gn_division WHERE gn_code = :gn AND ds_code = :ds)"),
        {"gn": gn, "ds": ds},
    ):
        return False
    return True
