"""Synthetic people for the staging copy, so testers can try every Phase 1 flow without real data
(Gate G1, candidate verification step 3: "synthetic accounts").

Creates members at each step (registered, verified and waiting for activation, active) and staff at
every tier in one Jaffna district area, each holding every permission their tier may hold. RB-12 still
applies: nobody gets assistance decisions together with finance or election-roster rights.

    APP_ENV=staging python scripts/seed_staging.py --credentials /path/to/new-file

Refuses to run unless APP_ENV is staging (or development) and the database name ends in "_staging"
(or, in development, the database is on this computer). The ID numbers are synthetic, the passwords
are generated here and written only to the --credentials file (mode 0600), never printed. Re-running
skips people who already exist, so their passwords and data stay as they are.
"""

import argparse
import os
import secrets
import sys
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from sqlalchemy import text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings
from app.core.permissions import ASSISTANCE_DECISIONS, MATRIX, POLITICAL_RIGHTS, Tier
from app.core.security import hash_password, nic_hash
from app.db.session import create_database_engine
from app.modules.access import repository as access_repository
from app.modules.access import rules as access_rules
from app.modules.audit import service as audit
from app.modules.identity.registration import repository as registration_repository
from app.modules.membership import repository as membership_repository
from app.modules.membership.rules import NOTICE_VERSIONS

State = Literal["registered", "verified", "active"]
Level = Literal["gn", "ds", "district", "province", "platform"]


@dataclass(frozen=True)
class Persona:
    key: str  # the handle testers see in the credentials file
    full_name: str
    nic: str  # synthetic (born 1990, day 301 onwards); staging holds no real people to collide with
    state: State
    tier: Tier | None = None
    level: Level | None = None


PERSONAS = [
    Persona("member-registered", "Uat Member Registered", "199030110001", "registered"),
    Persona("member-verified", "Uat Member Verified", "199030210002", "verified"),
    Persona("member-active", "Uat Member Active", "199030310003", "active"),
    Persona("member-household", "Uat Member Household", "199030410004", "active"),
    Persona("staff-tier5", "Uat Staff Platform", "199031210012", "active", "5", "platform"),
    Persona("staff-tier4", "Uat Staff Province", "199031110011", "active", "4", "province"),
    Persona("staff-tier3a", "Uat Staff District Reviewer", "199030810008", "active", "3A", "district"),
    Persona("staff-tier3a-second", "Uat Staff District Second Reviewer", "199030910009", "active", "3A", "district"),
    Persona("staff-tier3b", "Uat Staff District Operations", "199031010010", "active", "3B", "district"),
    Persona("staff-tier2a", "Uat Staff Ds Research", "199030610006", "active", "2A", "ds"),
    Persona("staff-tier2b", "Uat Staff Ds Field", "199030710007", "active", "2B", "ds"),
    Persona("staff-tier1", "Uat Staff Gn Officer", "199030510005", "active", "1", "gn"),
]


def permissions_for(tier: Tier) -> frozenset[str]:
    """Everything the tier may hold (default and explicit), without breaking RB-12."""
    allowed = frozenset(permission for permission, tiers in MATRIX.items() if tier in tiers)
    if allowed & ASSISTANCE_DECISIONS and allowed & POLITICAL_RIGHTS:
        allowed -= ASSISTANCE_DECISIONS
    return allowed


def refuse_unless_staging(settings: Settings) -> None:
    url = urlsplit(settings.database_url.get_secret_value())
    database = url.path.lstrip("/")
    local = url.hostname in ("localhost", "127.0.0.1")
    if settings.app_env == "staging" and database.endswith("_staging"):
        return
    if settings.app_env == "development" and local:
        return
    sys.exit(f"refused: APP_ENV={settings.app_env}, database '{database}' is not a staging or local development database")


@dataclass(frozen=True)
class Place:
    province: str
    district: str
    ds: str
    gn: str


def jaffna_place(db: Session) -> Place:
    """The first GN division in Jaffna district, as the demo seed chooses."""
    row = db.execute(
        text(
            """
            SELECT d.province_code AS province, d.district_code AS district, ds.ds_code AS ds, g.gn_code AS gn
            FROM geo.district d
            JOIN geo.ds_division ds ON ds.district_code = d.district_code
            JOIN geo.gn_division g ON g.ds_code = ds.ds_code
            WHERE d.name_en = 'Jaffna' AND d.district_code LIKE 'LK%'
            ORDER BY ds.ds_code, g.gn_code LIMIT 1
            """
        )
    ).one_or_none()
    if row is None:
        sys.exit("refused: no Jaffna GN division in geo.*; run the Express migrations first")
    return Place(province=row.province, district=row.district, ds=row.ds, gn=row.gn)


def area_for(level: Level, place: Place) -> access_rules.Area:
    if level == "platform":
        return access_rules.PLATFORM
    return access_rules.Area(level, getattr(place, level))


def create_member(db: Session, persona: Persona, place: Place, password: str, pepper: str) -> uuid.UUID:
    """What sign-up writes (registration.service.register), then what a review and an activation add."""
    member_id = registration_repository.insert_member(
        db,
        registration_repository.NewMember(
            full_name=persona.full_name,
            id_hash=nic_hash(persona.nic, pepper),
            verification_status="nic_format",
            password_hash=hash_password(password),
            language="ta",
            dob=date(1990, 10, 28),
            gender=None,
            district_code=place.district,
            ds_code=place.ds,
            gs_code=place.gn,
            referred_by=None,
        ),
    )
    registration_repository.insert_identity_record(db, member_id, "nic", None)
    registration_repository.record_initial_verification(db, member_id, "nic_format")
    membership_repository.record_consent(db, member_id, "terms_and_privacy", NOTICE_VERSIONS["terms_and_privacy"])
    if persona.state in ("verified", "active"):
        db.execute(
            text(
                """
                UPDATE npm.member SET verification_status = 'identity_confirmed', nic_status = 'verified',
                       verified_at = now(), verification_method = 'staging_seed'
                WHERE id = :id
                """
            ),
            {"id": member_id},
        )
        db.execute(
            text(
                """
                INSERT INTO npm.verification_audit (member_id, from_status, to_status, method, notes)
                VALUES (:id, 'nic_format', 'identity_confirmed', 'staging_seed', 'Synthetic staging account')
                """
            ),
            {"id": member_id},
        )
    if persona.state == "active":
        membership_repository.record_change(
            db,
            member_id=member_id,
            action="activate",
            from_state="pending",
            to_state="active",
            reason_code="identity_verified",
            note="Synthetic staging account",
            changed_by=None,
        )
    audit.record(
        db,
        actor_id=None,
        action="staging.seed.member_created",
        target_type="member",
        target_id=str(member_id),
        details={"memberId": str(member_id), "state": persona.state},
    )
    return member_id


def assign_role(db: Session, persona: Persona, member_id: uuid.UUID, place: Place, granted_by: uuid.UUID | None) -> None:
    assert persona.tier is not None and persona.level is not None
    now = datetime.now(UTC)
    area = area_for(persona.level, place)
    assignment = access_repository.insert_assignment(
        db,
        member_id=member_id,
        tier=persona.tier,
        area=area,
        permissions=permissions_for(persona.tier),
        granted_by=granted_by,
        granted_at=now,
        review_due_at=access_rules.review_due(persona.tier, now),
        note="Synthetic staging account",
    )
    audit.record(
        db,
        actor_id=granted_by,
        action="staging.seed.assignment_created",
        target_type="staff_assignment",
        target_id=str(assignment.id),
        details={"memberId": str(member_id), "tier": persona.tier},
    )


def existing_member(db: Session, persona: Persona, pepper: str) -> uuid.UUID | None:
    return db.scalar(
        text("SELECT id FROM npm.member WHERE nic_hash = :hash AND deleted_at IS NULL"),
        {"hash": nic_hash(persona.nic, pepper)},
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--credentials", type=Path, required=True, help="new file for the sign-in details (mode 0600)")
    args = parser.parse_args()
    if args.credentials.exists():
        sys.exit(f"refused: {args.credentials} exists; choose a new file so no sign-in details are overwritten")

    settings = Settings()  # type: ignore[call-arg]
    refuse_unless_staging(settings)
    pepper = settings.nic_pepper.get_secret_value()
    engine = create_database_engine(settings.database_url.get_secret_value())
    created: list[tuple[Persona, str, str]] = []
    with sessionmaker(engine)() as db:
        place = jaffna_place(db)
        granter: uuid.UUID | None = None
        for persona in PERSONAS:  # the Tier 5 comes first and grants the other roles
            member_id = existing_member(db, persona, pepper)
            if member_id is None:
                password = secrets.token_urlsafe(12)
                member_id = create_member(db, persona, place, password, pepper)
                if persona.tier:
                    assign_role(db, persona, member_id, place, granter)
                code = db.scalar(text("SELECT member_code FROM npm.member WHERE id = :id"), {"id": member_id})
                created.append((persona, code, password))
                print(f"created {persona.key}: {code}")
            else:
                print(f"kept    {persona.key}: already exists")
            if persona.tier == "5":
                granter = member_id
        db.commit()

    if created:
        descriptor = os.open(args.credentials, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as out:
            out.write("# Synthetic staging accounts. Staging only; sign in with the NIC and password.\n")
            out.write("# Staff add their own authenticator at their first staff sign-in.\n")
            out.write("key\tmember_code\tnic\tpassword\ttier\tarea\n")
            for persona, code, password in created:
                area = area_for(persona.level, place).key if persona.level else ""
                out.write(f"{persona.key}\t{code}\t{persona.nic}\t{password}\t{persona.tier or ''}\t{area}\n")
        print(f"sign-in details for {len(created)} new accounts written to {args.credentials}")


if __name__ == "__main__":
    main()
