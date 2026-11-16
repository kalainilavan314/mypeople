"""Service layer for the My Household module (MP-FEA-002 §4.1: screens M06 to M10, D02).

Household data stays in the `household` schema: it is never joined with membership, finance,
election or campaign records. Names shown to a household come from its own rows.
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import RowMapping
from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access.repository import member_area_path
from app.modules.access.rules import area_from_key
from app.modules.access.service import Staff, refuse
from app.modules.audit import service as audit_service
from app.modules.auth.dependencies import SessionMember
from app.modules.geography import repository as geography_repository
from app.modules.households import repository, rules
from app.modules.households.schemas import (
    ConsentNoticeOut,
    DependantIn,
    DependantUpdateIn,
    HouseholdCreateIn,
    HouseholdInvitationOut,
    HouseholdInvitationSentOut,
    HouseholdLogEntryOut,
    HouseholdMemberOut,
    HouseholdOut,
    HouseholdPlaceOut,
    HouseholdUpdateIn,
    InvitationRespondIn,
    InvitationsListOut,
    InviteAdultIn,
    MemberRelationshipIn,
    MyHouseholdDetailsIn,
    StaffHouseholdViewOut,
)

PLACE_LEVELS = ("district", "ds", "gn")


def _refuse(code: int, problem: str) -> HTTPException:
    return HTTPException(status_code=code, detail=problem)


def _row_to_member_out(row: Any) -> HouseholdMemberOut:
    return HouseholdMemberOut(
        id=row["id"],
        household_id=row["household_id"],
        member_id=row["member_id"],
        member_code=row.get("member_code"),
        role=row["role"],
        display_name=row["display_name"],
        relationship=row["relationship"],
        status=row["status"],
        joined_at=row["joined_at"],
        removed_at=row.get("removed_at"),
        age_band=row.get("age_band"),
        occupation_category=row.get("occupation_category"),
        birth_year=row.get("birth_year"),
        guardian_member_id=row.get("guardian_member_id"),
    )


def _row_to_invitation_out(row: Any) -> HouseholdInvitationOut:
    return HouseholdInvitationOut(
        id=row["id"],
        household_id=row["household_id"],
        household_name=row.get("household_name"),
        inviter_member_id=row["inviter_member_id"],
        inviter_name=row["inviter_name"],
        invitee_member_id=row["invitee_member_id"],
        invitee_code=row.get("invitee_code"),
        relationship=row["relationship"],
        status=row["status"],
        created_at=row["created_at"],
        expires_at=row["expires_at"],
        responded_at=row.get("responded_at"),
    )


def _places(db: Session, area_path: list[str] | None) -> list[HouseholdPlaceOut]:
    """M06: the household's District, DS and GN names (geography reference data only)."""
    codes: dict[str, str] = {}
    for key in area_path or []:
        area = area_from_key(key)
        if area.level in PLACE_LEVELS and area.code:
            codes[area.level] = area.code
    if not codes:
        return []
    names = geography_repository.area_names(db, {level: [code] for level, code in codes.items()})
    places = []
    for level in PLACE_LEVELS:
        if level not in codes:
            continue
        place = names.get((level, codes[level]))
        places.append(
            HouseholdPlaceOut(
                level=level,  # type: ignore[arg-type]
                code=codes[level],
                name_en=place.name_en if place else None,
                name_ta=place.name_ta if place else None,
            )
        )
    return places


def _household_out(
    db: Session,
    hh: RowMapping,
    *,
    my_role: Any = None,
    my_member_id: uuid.UUID | None = None,
    invitations: list[RowMapping] | None = None,
) -> HouseholdOut:
    members = repository.list_members(db, hh["id"])
    return HouseholdOut(
        id=hh["id"],
        household_code=rules.household_code(hh["id"]),
        created_by=hh["created_by"],
        name=hh["name"],
        created_at=hh["created_at"],
        updated_at=hh["updated_at"],
        dissolved_at=hh["dissolved_at"],
        places=_places(db, hh["area_path"]),
        caseworker_consent_at=hh["caseworker_consent_at"],
        caseworker_consent_by=hh["caseworker_consent_by"],
        members=[_row_to_member_out(m) for m in members],
        pending_invitations=[_row_to_invitation_out(i) for i in invitations or []],
        my_role=my_role,
        my_member_id=my_member_id,
        is_head=my_role == "head",
    )


def _identity_verified(db: Session, member_id: uuid.UUID) -> bool:
    found = access_repository.find_member_status(db, member_id)
    return found is not None and found.identity_verified


def _require_membership(db: Session, member_id: uuid.UUID) -> RowMapping:
    membership = repository.find_active_membership(db, member_id)
    if not membership:
        raise _refuse(status.HTTP_404_NOT_FOUND, "no_active_household")
    return membership


def _require_record(db: Session, membership: RowMapping, record_id: uuid.UUID) -> RowMapping:
    record = repository.find_member_record(db, record_id)
    if not record or record["household_id"] != membership["household_id"] or record["status"] != "active":
        raise _refuse(status.HTTP_404_NOT_FOUND, "member_record_not_found")
    return record


def get_my_household(db: Session, member_id: uuid.UUID) -> HouseholdOut | None:
    repository.set_rls_context(db, member_id)
    membership = repository.find_active_membership(db, member_id)
    if not membership:
        return None

    household_id = membership["household_id"]
    hh = repository.get_household(db, household_id)
    if not hh or hh["dissolved_at"] is not None:
        return None

    invitations = repository.list_sent_invitations(db, household_id) if membership["role"] == "head" else []
    return _household_out(db, hh, my_role=membership["role"], my_member_id=member_id, invitations=invitations)


def create_household(db: Session, member: SessionMember, data: HouseholdCreateIn) -> HouseholdOut:
    repository.set_rls_context(db, member.id)
    repository.lock_member(db, member.id)
    existing = repository.find_active_membership(db, member.id)
    problem = rules.check_can_create_household(existing["id"] if existing else None, _identity_verified(db, member.id))
    if problem:
        code = status.HTTP_403_FORBIDDEN if problem == "identity_not_verified" else status.HTTP_409_CONFLICT
        raise _refuse(code, problem)

    profile = repository.member_profile_summary(db, member.id)
    head_display_name = profile["display_name"] if profile else "Family Head"
    # M06: the household carries the creator's area (their GN, or the closest level they gave).
    area_path = [area.key for area in member_area_path(db, member.id)]

    household_id = repository.create_household_with_head(
        db,
        creator_id=member.id,
        name=data.name,
        head_display_name=head_display_name,
        area_path=area_path,
    )

    audit_service.record(
        db,
        actor_id=member.id,
        action="household.create",
        target_type="household",
        target_id=str(household_id),
    )
    db.commit()

    hh = get_my_household(db, member.id)
    if not hh:
        raise _refuse(status.HTTP_500_INTERNAL_SERVER_ERROR, "household_creation_failed")
    return hh


def update_household(db: Session, member: SessionMember, data: HouseholdUpdateIn) -> HouseholdOut:
    repository.set_rls_context(db, member.id)
    membership = _require_membership(db, member.id)
    if membership["role"] != "head":
        raise _refuse(status.HTTP_403_FORBIDDEN, "only_head_can_update")

    household_id = membership["household_id"]
    repository.update_household_name(db, household_id, data.name)
    repository.record_consent_log(
        db,
        household_id=household_id,
        action="update_name",
        actor_id=member.id,
        member_id=member.id,
        details=None,
    )
    db.commit()

    hh = get_my_household(db, member.id)
    if not hh:
        raise _refuse(status.HTTP_404_NOT_FOUND, "household_not_found")
    return hh


def invite_adult(db: Session, member: SessionMember, data: InviteAdultIn) -> HouseholdInvitationSentOut:
    repository.set_rls_context(db, member.id)
    membership = _require_membership(db, member.id)
    # Only the head may look a code up here, so other adults cannot probe member codes.
    if membership["role"] != "head":
        raise _refuse(status.HTTP_403_FORBIDDEN, "only_head_can_invite")
    if not _identity_verified(db, member.id):
        raise _refuse(status.HTTP_403_FORBIDDEN, "identity_not_verified")

    target = repository.resolve_member_by_code(db, data.member_code)
    if not target:
        raise _refuse(status.HTTP_404_NOT_FOUND, "unknown_member_code")

    household_id = membership["household_id"]
    repository.lock_household(db, household_id)
    problem = rules.check_can_invite_adult(
        caller_role=membership["role"],
        active_member_count=repository.count_active_members(db, household_id),
        inviter_member_id=member.id,
        invitee_member_id=target["id"],
        invitee_has_pending_invitation=repository.has_pending_invitation(db, household_id, target["id"]),
    )
    if problem:
        code = status.HTTP_400_BAD_REQUEST if problem == "cannot_invite_self" else status.HTTP_409_CONFLICT
        raise _refuse(code, problem)

    inv_id = repository.create_invitation(
        db,
        household_id=household_id,
        inviter_id=member.id,
        invitee_id=target["id"],
        relationship=data.relationship,
    )
    repository.record_consent_log(
        db,
        household_id=household_id,
        action="invite_adult",
        actor_id=member.id,
        member_id=target["id"],
        details={"relationship": data.relationship},
    )
    db.commit()

    repository.set_rls_context(db, member.id)
    inv_row = repository.get_invitation(db, inv_id)
    if not inv_row:
        raise _refuse(status.HTTP_500_INTERNAL_SERVER_ERROR, "invitation_creation_failed")
    # M08: a neutral confirmation; the invitee's name is shown only once they have accepted.
    return HouseholdInvitationSentOut(
        id=inv_row["id"],
        relationship=inv_row["relationship"],
        status=inv_row["status"],
        expires_at=inv_row["expires_at"],
    )


def list_invitations(db: Session, member_id: uuid.UUID) -> InvitationsListOut:
    repository.set_rls_context(db, member_id)
    with repository.system_access(db, member_id):
        received = repository.list_received_invitations(db, member_id)
    membership = repository.find_active_membership(db, member_id)
    sent: list[Any] = []
    if membership and membership["role"] == "head":
        sent = repository.list_sent_invitations(db, membership["household_id"])
    db.commit()
    return InvitationsListOut(
        received=[_row_to_invitation_out(r) for r in received],
        sent=[_row_to_invitation_out(s) for s in sent],
    )


def respond_invitation(
    db: Session,
    member: SessionMember,
    invitation_id: uuid.UUID,
    data: InvitationRespondIn,
) -> HouseholdOut | None:
    repository.set_rls_context(db, member.id)
    repository.lock_member(db, member.id)
    inv = repository.get_invitation(db, invitation_id, lock=True)
    if not inv:
        raise _refuse(status.HTTP_404_NOT_FOUND, "invitation_not_found")

    active_membership = repository.find_active_membership(db, member.id)
    problem = rules.check_can_respond_invitation(
        invitee_member_id=inv["invitee_member_id"],
        caller_member_id=member.id,
        invitation_status=inv["status"],
        expires_at=inv["expires_at"],
        caller_has_active_household=active_membership is not None,
    )
    if problem:
        code = status.HTTP_403_FORBIDDEN if "not_your" in problem else status.HTTP_409_CONFLICT
        raise _refuse(code, problem)

    household_id = inv["household_id"]
    if data.action == "accept":
        # M06: only an identity-verified member belongs to a household.
        if not _identity_verified(db, member.id):
            raise _refuse(status.HTTP_403_FORBIDDEN, "identity_not_verified")
        profile = repository.member_profile_summary(db, member.id)
        display_name = profile["display_name"] if profile else "Household Member"
        repository.lock_household(db, household_id)
        # The invitee is not yet in the household, so the policies hide it from them: the checks
        # and their own new row run with system access, scoped to this one household.
        with repository.system_access(db, member.id):
            hh = repository.get_household(db, household_id)
            if not hh or hh["dissolved_at"] is not None:
                raise _refuse(status.HTTP_409_CONFLICT, "invitation_revoked")
            if repository.count_active_members(db, household_id) >= rules.MAX_MEMBERS_PER_HOUSEHOLD:
                raise _refuse(status.HTTP_409_CONFLICT, "household_size_limit_reached")
            repository.add_member(
                db,
                household_id=household_id,
                member_id=member.id,
                role="adult",
                display_name=display_name,
                relationship=inv["relationship"],
            )
        repository.update_invitation_status(db, invitation_id, "accepted")
        repository.record_consent_log(
            db,
            household_id=household_id,
            action="accept_invitation",
            actor_id=member.id,
            member_id=member.id,
            details={"invitation_id": str(invitation_id)},
        )
        audit_service.record(
            db,
            actor_id=member.id,
            action="household.join",
            target_type="household",
            target_id=str(household_id),
        )
        db.commit()
        return get_my_household(db, member.id)

    repository.update_invitation_status(db, invitation_id, "declined")
    repository.record_consent_log(
        db,
        household_id=household_id,
        action="decline_invitation",
        actor_id=member.id,
        member_id=member.id,
        details={"invitation_id": str(invitation_id)},
    )
    db.commit()
    return None


def revoke_invitation(db: Session, member: SessionMember, invitation_id: uuid.UUID) -> None:
    repository.set_rls_context(db, member.id)
    inv = repository.get_invitation(db, invitation_id)
    if not inv:
        raise _refuse(status.HTTP_404_NOT_FOUND, "invitation_not_found")

    membership = repository.find_active_membership(db, member.id)
    in_household = membership is not None and membership["household_id"] == inv["household_id"]
    problem = rules.check_can_revoke_invitation(
        caller_member_id=member.id,
        inviter_member_id=inv["inviter_member_id"],
        caller_role=membership["role"] if in_household and membership else None,
        invitation_status=inv["status"],
    )
    if problem:
        raise _refuse(status.HTTP_403_FORBIDDEN, problem)

    with repository.system_access(db, member.id):
        repository.update_invitation_status(db, invitation_id, "revoked")
    repository.record_consent_log(
        db,
        household_id=inv["household_id"],
        action="revoke_invitation",
        actor_id=member.id,
        member_id=inv["invitee_member_id"],
        details={"invitation_id": str(invitation_id)},
    )
    db.commit()


def _depart(db: Session, actor_id: uuid.UUID, hh: RowMapping, record: RowMapping, action: str) -> None:
    """An adult leaves or is removed. The children they manage leave the record with them (nobody
    else is their guardian), caseworker consent they gave ends, and their invitations lapse. When
    the head leaves, the adult who joined first becomes head."""
    household_id = hh["id"]
    departing = record["member_id"]
    successor = repository.longest_standing_adult(db, household_id) if record["role"] == "head" else None
    consent_ends = hh["caseworker_consent_by"] is not None and hh["caseworker_consent_by"] == departing
    with repository.system_access(db, actor_id):
        children = repository.delete_dependants_of(db, household_id, departing)
        if consent_ends:
            repository.set_caseworker_consent(db, household_id, None)
        repository.revoke_invitations_from(db, household_id, departing)
        repository.remove_member(db, record["id"])
        if successor is not None:
            repository.make_head(db, successor["id"])

    for _ in range(children):
        repository.record_consent_log(
            db, household_id=household_id, action="remove_dependent", actor_id=actor_id, details={"reason": "guardian_left"}
        )
    if consent_ends:
        repository.record_consent_log(
            db,
            household_id=household_id,
            action="caseworker_consent_withdrawn",
            actor_id=actor_id,
            member_id=departing,
            details={"reason": "giver_left"},
        )
    repository.record_consent_log(db, household_id=household_id, action=action, actor_id=actor_id, member_id=departing)
    if successor is not None:
        repository.record_consent_log(
            db,
            household_id=household_id,
            action="update_member",
            actor_id=actor_id,
            member_id=successor["member_id"],
            details={"change": "became_head"},
        )


def _dissolve(db: Session, actor_id: uuid.UUID, household_id: uuid.UUID) -> None:
    with repository.system_access(db, actor_id):
        repository.dissolve_household(db, household_id)
    repository.record_consent_log(
        db, household_id=household_id, action="dissolve_household", actor_id=actor_id, member_id=actor_id
    )


def remove_member(db: Session, member: SessionMember, member_record_id: uuid.UUID) -> None:
    repository.set_rls_context(db, member.id)
    caller_membership = _require_membership(db, member.id)
    household_id = caller_membership["household_id"]
    repository.lock_household(db, household_id)
    target_rec = _require_record(db, caller_membership, member_record_id)
    if target_rec["role"] == "dependent":
        remove_dependant(db, member, member_record_id)
        return

    problem = rules.check_can_remove_member(
        caller_member_id=member.id,
        caller_role=caller_membership["role"],
        target_member_id=target_rec["member_id"],
        target_role=target_rec["role"],
    )
    if problem:
        raise _refuse(status.HTTP_403_FORBIDDEN, problem)

    hh = repository.get_household(db, household_id)
    assert hh is not None
    leaving_head = target_rec["role"] == "head"
    # M06: the household ends only when no adult remains.
    if leaving_head and repository.longest_standing_adult(db, household_id) is None:
        _dissolve(db, member.id, household_id)
    else:
        action = "leave_household" if target_rec["member_id"] == member.id else "remove_member"
        _depart(db, member.id, hh, target_rec, action)
    db.commit()


def leave_household(db: Session, member: SessionMember) -> None:
    repository.set_rls_context(db, member.id)
    membership = _require_membership(db, member.id)
    remove_member(db, member, membership["id"])


def add_dependant(db: Session, member: SessionMember, data: DependantIn) -> HouseholdOut:
    """M07 / OD-31: a verified confirmed adult adds a child and becomes the child's guardian."""
    repository.set_rls_context(db, member.id)
    membership = _require_membership(db, member.id)
    if not _identity_verified(db, member.id):
        raise _refuse(status.HTTP_403_FORBIDDEN, "identity_not_verified")
    problem = rules.check_dependant_birth_year(data.birth_year, datetime.now(UTC).year)
    if problem:
        raise _refuse(status.HTTP_422_UNPROCESSABLE_CONTENT, problem)

    household_id = membership["household_id"]
    repository.lock_household(db, household_id)
    if repository.count_active_members(db, household_id) >= rules.MAX_MEMBERS_PER_HOUSEHOLD:
        raise _refuse(status.HTTP_409_CONFLICT, "household_size_limit_reached")
    record_id = repository.add_dependant(
        db,
        household_id=household_id,
        guardian_id=member.id,
        first_name=data.first_name.strip(),
        relationship=data.relationship,
        birth_year=data.birth_year,
    )
    repository.record_consent_log(
        db, household_id=household_id, action="add_dependent", actor_id=member.id, details={"record_id": str(record_id)}
    )
    db.commit()
    return _mine_or_missing(db, member.id)


def _dependant_for_change(db: Session, member: SessionMember, record_id: uuid.UUID) -> tuple[RowMapping, RowMapping]:
    membership = _require_membership(db, member.id)
    record = _require_record(db, membership, record_id)
    if record["role"] != "dependent":
        raise _refuse(status.HTTP_404_NOT_FOUND, "member_record_not_found")
    problem = rules.check_can_manage_dependant(member.id, membership["role"], record["guardian_member_id"])
    if problem:
        raise _refuse(status.HTTP_403_FORBIDDEN, problem)
    return membership, record


def update_dependant(db: Session, member: SessionMember, record_id: uuid.UUID, data: DependantUpdateIn) -> HouseholdOut:
    """M10 correction of a child's record by its guardian or the head."""
    repository.set_rls_context(db, member.id)
    membership, record = _dependant_for_change(db, member, record_id)
    if not _identity_verified(db, member.id):
        raise _refuse(status.HTTP_403_FORBIDDEN, "identity_not_verified")
    changes: dict[str, Any] = {}
    if data.first_name is not None:
        changes["display_name"] = data.first_name.strip()
    if data.relationship is not None:
        changes["relationship"] = data.relationship
    if data.birth_year is not None:
        problem = rules.check_dependant_birth_year(data.birth_year, datetime.now(UTC).year)
        if problem:
            raise _refuse(status.HTTP_422_UNPROCESSABLE_CONTENT, problem)
        changes["birth_year"] = data.birth_year
    if changes:
        repository.update_dependant(db, record_id, changes)
        repository.record_consent_log(
            db,
            household_id=membership["household_id"],
            action="update_member",
            actor_id=member.id,
            details={"record_id": str(record_id), "fields": sorted(changes)},
        )
        db.commit()
    return _mine_or_missing(db, member.id)


def remove_dependant(db: Session, member: SessionMember, record_id: uuid.UUID) -> None:
    """M10 deletion of a child's record by its guardian or the head: the row is deleted, not hidden."""
    repository.set_rls_context(db, member.id)
    membership, _record = _dependant_for_change(db, member, record_id)
    household_id = membership["household_id"]
    # The policies let only the head delete rows; a guardian who is not the head needs system access.
    with repository.system_access(db, member.id):
        repository.delete_dependant(db, household_id, record_id)
    repository.record_consent_log(
        db, household_id=household_id, action="remove_dependent", actor_id=member.id, details={"record_id": str(record_id)}
    )
    db.commit()


def update_my_details(db: Session, member: SessionMember, data: MyHouseholdDetailsIn) -> HouseholdOut:
    """OD-30: each adult sets their own age band and occupation category, and nobody else does."""
    repository.set_rls_context(db, member.id)
    membership = _require_membership(db, member.id)
    changes = {field: getattr(data, field) for field in ("age_band", "occupation_category") if field in data.model_fields_set}
    if changes:
        repository.update_adult_details(db, membership["id"], changes)
        repository.record_consent_log(
            db,
            household_id=membership["household_id"],
            action="update_member",
            actor_id=member.id,
            member_id=member.id,
            details={"fields": sorted(changes)},
        )
        db.commit()
    return _mine_or_missing(db, member.id)


def correct_relationship(db: Session, member: SessionMember, record_id: uuid.UUID, data: MemberRelationshipIn) -> HouseholdOut:
    """M10: the head corrects an adult's relationship."""
    repository.set_rls_context(db, member.id)
    membership = _require_membership(db, member.id)
    record = _require_record(db, membership, record_id)
    problem = rules.check_can_correct_relationship(membership["role"], record["role"])
    if problem:
        code = status.HTTP_403_FORBIDDEN if problem == "only_head_can_correct" else status.HTTP_409_CONFLICT
        raise _refuse(code, problem)
    if record["relationship"] != data.relationship:
        repository.update_adult_details(db, record_id, {"relationship": data.relationship})
        repository.record_consent_log(
            db,
            household_id=membership["household_id"],
            action="update_member",
            actor_id=member.id,
            member_id=record["member_id"],
            details={"fields": ["relationship"]},
        )
        db.commit()
    return _mine_or_missing(db, member.id)


def household_log(db: Session, member_id: uuid.UUID) -> list[HouseholdLogEntryOut]:
    """M10: every change to the household, for its confirmed adults: what, who and when."""
    repository.set_rls_context(db, member_id)
    membership = _require_membership(db, member_id)
    rows = repository.list_household_log(db, membership["household_id"])
    entries = []
    for row in rows:
        actor = rules.log_actor(
            action=row["action"],
            actor_id=row["actor_id"],
            viewer_id=member_id,
            actor_is_current_adult=row["actor_name"] is not None,
        )
        entries.append(
            HouseholdLogEntryOut(
                id=row["id"],
                action=row["action"],
                actor=actor,  # type: ignore[arg-type]
                actor_name=row["actor_name"] if actor == "household_member" else None,
                created_at=row["created_at"],
            )
        )
    return entries


def give_caseworker_consent(db: Session, member: SessionMember) -> HouseholdOut:
    """The household lets a caseworker in its area open its record (rule: with recorded consent)."""
    repository.set_rls_context(db, member.id)
    membership = _require_membership(db, member.id)
    problem = rules.check_can_give_caseworker_consent(membership["role"])
    if problem:
        raise _refuse(status.HTTP_403_FORBIDDEN, problem)
    household_id = membership["household_id"]
    hh = repository.get_household(db, household_id)
    if hh is not None and hh["caseworker_consent_at"] is None:
        repository.set_caseworker_consent(db, household_id, member.id)
        repository.record_consent_log(
            db, household_id=household_id, action="caseworker_consent_given", actor_id=member.id, member_id=member.id
        )
        audit_service.record(
            db,
            actor_id=member.id,
            action="household.caseworker_consent_given",
            target_type="household",
            target_id=str(household_id),
        )
        db.commit()
    return _mine_or_missing(db, member.id)


def withdraw_caseworker_consent(db: Session, member: SessionMember) -> HouseholdOut:
    """Any confirmed adult can withdraw caseworker access at any time."""
    repository.set_rls_context(db, member.id)
    membership = _require_membership(db, member.id)
    household_id = membership["household_id"]
    hh = repository.get_household(db, household_id)
    if hh is not None and hh["caseworker_consent_at"] is not None:
        # The policies let only the head update the household's row; withdrawing is every adult's right.
        with repository.system_access(db, member.id):
            repository.set_caseworker_consent(db, household_id, None)
        repository.record_consent_log(
            db, household_id=household_id, action="caseworker_consent_withdrawn", actor_id=member.id, member_id=member.id
        )
        audit_service.record(
            db,
            actor_id=member.id,
            action="household.caseworker_consent_withdrawn",
            target_type="household",
            target_id=str(household_id),
        )
        db.commit()
    return _mine_or_missing(db, member.id)


def _mine_or_missing(db: Session, member_id: uuid.UUID) -> HouseholdOut:
    hh = get_my_household(db, member_id)
    if not hh:
        raise _refuse(status.HTTP_404_NOT_FOUND, "no_active_household")
    return hh


def get_privacy_notice() -> ConsentNoticeOut:
    return ConsentNoticeOut(
        title_ta="குடும்பத் தகவல் மற்றும் ஒப்புதல் அறிவிப்பு",
        title_en="Household Information and Consent Notice",
        notice_ta="எனது குடும்பம் தொகுதி முற்றிலும் விருப்பத்தின் அடிப்படையிலானது. எந்தவொரு சேவையையும் அல்லது உறுப்பினர் அந்தஸ்தையும் பெறுவதற்கு குடும்பத் தகவல்களைப் பகிர்வது கட்டாயமில்லை.",
        notice_en="The My Household feature is entirely voluntary. Sharing household information is never a condition for receiving a service or membership status.",
        voluntary_clause_ta="வயதுவந்த குடும்ப உறுப்பினர்கள் அழைப்பை ஏற்றுக்கொள்வதன் மூலம் மட்டுமே சேர்க்கப்படுவார்கள். எந்த நேரத்திலும் குடும்பத்திலிருந்து வெளியேறலாம் அல்லது குடும்பத்தை கலைக்கலாம்.",
        voluntary_clause_en="Adult household members can only be added by explicit mutual consent through an invitation. You can leave or dissolve the household at any time.",
        is_voluntary=True,
        purpose_limitation_ta="குடும்பத் தகவல்கள் இக்குடும்பத்தின் உறுதிசெய்யப்பட்ட வயதுவந்தவர்களுக்கு மட்டுமே தெரியும்; நீங்கள் ஒப்புதல் அளித்தால் மட்டுமே உங்கள் பகுதியின் சமூகப் பணியாளருக்குத் தெரியும். அவை அரசியல், பிரசார அல்லது நிதி சேகரிப்புப் பணிகளுக்கு ஒருபோதும் பயன்படுத்தப்படாது.",
        purpose_limitation_en="Household information is visible only to the household's confirmed adults and, if you give consent, to a caseworker in your area. It is never used for political, campaign or fundraising work.",
    )


def staff_view_household(
    db: Session,
    staff: Staff,
    target: str | uuid.UUID,
    ip: str,
) -> StaffHouseholdViewOut:
    """D02 read-only caseworker view (PRM-33): within the staff member's area, and only when the
    household has given caseworker consent. Every opening and every refusal is audited."""
    if isinstance(target, uuid.UUID):
        target_member_id = target
    else:
        try:
            target_member_id = uuid.UUID(target)
        except ValueError:
            target_row = repository.resolve_member_by_code(db, target.strip().upper())
            if not target_row:
                raise _refuse(status.HTTP_404_NOT_FOUND, "target_member_not_found") from None
            target_member_id = target_row["id"]

    permission = rules.PERMISSION_VIEW_FOR_CASE
    member_target = ("member", str(target_member_id))
    target_area = member_area_path(db, target_member_id)
    if not rules.staff_can_view_household(staff.rule_assignments(), target_area):
        refuse(db, staff, permission, "outside_your_area", ip, target=member_target, area_path=target_area)

    target_profile = repository.member_profile_summary(db, target_member_id)
    if not target_profile:
        raise _refuse(status.HTTP_404_NOT_FOUND, "target_member_not_found")

    repository.set_rls_context(db, staff.member_id, staff_view=True, staff_target_member_id=target_member_id)
    household_id = repository.staff_find_household_id(db, target_member_id)
    hh = None
    if household_id is not None:
        repository.set_rls_context(db, staff.member_id, staff_view=True, staff_household_id=household_id)
        hh = repository.get_household(db, household_id)
    # Whether the member has a household at all is household data too: without consent the answer
    # is the same refusal either way.
    if hh is None or hh["dissolved_at"] is not None or hh["caseworker_consent_at"] is None:
        refuse(db, staff, permission, "no_caseworker_consent", ip, target=member_target, area_path=target_area)
    assert hh is not None
    household_area = tuple(area_from_key(key) for key in hh["area_path"] or [])
    if household_area and not rules.staff_can_view_household(staff.rule_assignments(), household_area):
        refuse(db, staff, permission, "outside_your_area", ip, target=("household", str(hh["id"])), area_path=household_area)

    household = _household_out(db, hh)
    repository.record_consent_log(
        db,
        household_id=hh["id"],
        action="staff_view",
        actor_id=staff.member_id,
        member_id=target_member_id,
    )
    audit_service.record(
        db,
        actor_id=staff.member_id,
        action="household.view",
        target_type="household",
        target_id=str(hh["id"]),
        area_path=household_area or target_area,
        details={"target_member_id": str(target_member_id)},
    )
    db.commit()

    return StaffHouseholdViewOut(
        permitted=True,
        target_member_id=target_member_id,
        target_member_code=target_profile["member_code"],
        target_member_name=target_profile["display_name"],
        household=household,
    )
