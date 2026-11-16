"""Service layer for the My Household module (BRD v1.1 FR-HH-001 to 010, screens M06 to M10, D02)."""

import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.access.repository import member_area_path
from app.modules.access.service import Staff
from app.modules.audit import service as audit_service
from app.modules.auth.dependencies import SessionMember
from app.modules.households import repository, rules
from app.modules.households.schemas import (
    ConsentLogOut,
    ConsentNoticeOut,
    HouseholdCreateIn,
    HouseholdInvitationOut,
    HouseholdMemberOut,
    HouseholdOut,
    HouseholdUpdateIn,
    InvitationRespondIn,
    InvitationsListOut,
    InviteAdultIn,
    StaffHouseholdViewOut,
)


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
    )


def _row_to_invitation_out(row: Any) -> HouseholdInvitationOut:
    return HouseholdInvitationOut(
        id=row["id"],
        household_id=row["household_id"],
        household_name=row.get("household_name"),
        inviter_member_id=row["inviter_member_id"],
        inviter_name=row["inviter_name"],
        invitee_member_id=row["invitee_member_id"],
        invitee_name=row["invitee_name"],
        invitee_code=row.get("invitee_code"),
        relationship=row["relationship"],
        status=row["status"],
        created_at=row["created_at"],
        expires_at=row["expires_at"],
        responded_at=row.get("responded_at"),
    )


def _row_to_consent_out(row: Any) -> ConsentLogOut:
    return ConsentLogOut(
        id=row["id"],
        household_id=row["household_id"],
        action=row["action"],
        member_id=row.get("member_id"),
        actor_id=row["actor_id"],
        actor_name=row.get("actor_name"),
        details=row.get("details"),
        created_at=row["created_at"],
    )


def get_my_household(db: Session, member_id: uuid.UUID) -> HouseholdOut | None:
    repository.set_rls_context(db, member_id)
    membership = repository.find_active_membership(db, member_id)
    if not membership:
        return None

    household_id = membership["household_id"]
    hh = repository.get_household(db, household_id)
    if not hh or hh["dissolved_at"] is not None:
        return None

    members = repository.list_members(db, household_id)
    invitations = repository.list_sent_invitations(db, household_id) if membership["role"] == "head" else []

    return HouseholdOut(
        id=hh["id"],
        created_by=hh["created_by"],
        name=hh["name"],
        created_at=hh["created_at"],
        updated_at=hh["updated_at"],
        dissolved_at=hh["dissolved_at"],
        members=[_row_to_member_out(m) for m in members],
        pending_invitations=[_row_to_invitation_out(i) for i in invitations],
        my_role=membership["role"],
        is_head=membership["role"] == "head",
    )


def create_household(db: Session, member: SessionMember, data: HouseholdCreateIn) -> HouseholdOut:
    repository.set_rls_context(db, member.id)
    existing = repository.find_active_membership(db, member.id)
    problem = rules.check_can_create_household(existing["id"] if existing else None)
    if problem:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=problem)

    profile = repository.member_profile_summary(db, member.id)
    head_display_name = profile["display_name"] if profile else "Family Head"

    household_id = repository.create_household_with_head(
        db,
        creator_id=member.id,
        name=data.name,
        head_display_name=head_display_name,
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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="household_creation_failed")
    return hh


def update_household(db: Session, member: SessionMember, data: HouseholdUpdateIn) -> HouseholdOut:
    repository.set_rls_context(db, member.id)
    membership = repository.find_active_membership(db, member.id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="no_active_household")
    if membership["role"] != "head":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="only_head_can_update")

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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="household_not_found")
    return hh


def invite_adult(db: Session, member: SessionMember, data: InviteAdultIn) -> HouseholdInvitationOut:
    repository.set_rls_context(db, member.id)
    membership = repository.find_active_membership(db, member.id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="no_active_household")

    target = repository.resolve_member_by_code(db, data.member_code)
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unknown_member_code")

    household_id = membership["household_id"]
    repository.lock_household(db, household_id)
    active_count = repository.count_active_members(db, household_id)
    invitee_has_hh = repository.find_active_membership(db, target["id"]) is not None
    has_pending = repository.has_pending_invitation(db, household_id, target["id"])

    problem = rules.check_can_invite_adult(
        caller_role=membership["role"],
        active_member_count=active_count,
        inviter_member_id=member.id,
        invitee_member_id=target["id"],
        invitee_has_active_household=invitee_has_hh,
        invitee_has_pending_invitation=has_pending,
    )
    if problem:
        code = status.HTTP_400_BAD_REQUEST if "cannot_invite" in problem else status.HTTP_409_CONFLICT
        if problem == "only_head_can_invite":
            code = status.HTTP_403_FORBIDDEN
        raise HTTPException(status_code=code, detail=problem)

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

    inv_row = repository.get_invitation(db, inv_id)
    if not inv_row:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="invitation_creation_failed")
    return _row_to_invitation_out(inv_row)


def list_invitations(db: Session, member_id: uuid.UUID) -> InvitationsListOut:
    repository.set_rls_context(db, member_id)
    received = repository.list_received_invitations(db, member_id)
    membership = repository.find_active_membership(db, member_id)
    sent: list[Any] = []
    if membership and membership["role"] == "head":
        sent = repository.list_sent_invitations(db, membership["household_id"])
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="invitation_not_found")

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
        raise HTTPException(status_code=code, detail=problem)

    if data.action == "accept":
        repository.lock_household(db, inv["household_id"])
        if repository.count_active_members(db, inv["household_id"]) >= rules.MAX_MEMBERS_PER_HOUSEHOLD:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="household_size_limit_reached")
        repository.update_invitation_status(db, invitation_id, "accepted")
        profile = repository.member_profile_summary(db, member.id)
        display_name = profile["display_name"] if profile else "Household Member"
        repository.add_member(
            db,
            household_id=inv["household_id"],
            member_id=member.id,
            role="adult",
            display_name=display_name,
            relationship=inv["relationship"],
        )
        repository.record_consent_log(
            db,
            household_id=inv["household_id"],
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
            target_id=str(inv["household_id"]),
        )
        db.commit()
        return get_my_household(db, member.id)

    # action == "decline"
    repository.update_invitation_status(db, invitation_id, "declined")
    repository.record_consent_log(
        db,
        household_id=inv["household_id"],
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="invitation_not_found")

    membership = repository.find_active_membership(db, member.id)
    caller_role = membership["role"] if membership else None

    problem = rules.check_can_revoke_invitation(
        caller_member_id=member.id,
        inviter_member_id=inv["inviter_member_id"],
        caller_role=caller_role,
        invitation_status=inv["status"],
    )
    if problem:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=problem)

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


def remove_member(db: Session, member: SessionMember, member_record_id: uuid.UUID) -> None:
    repository.set_rls_context(db, member.id)
    caller_membership = repository.find_active_membership(db, member.id)
    if not caller_membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="no_active_household")

    target_rec = repository.find_member_record(db, member_record_id)
    if not target_rec or target_rec["household_id"] != caller_membership["household_id"]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="member_record_not_found")

    problem = rules.check_can_remove_member(
        caller_member_id=member.id,
        caller_role=caller_membership["role"],
        target_member_id=target_rec["member_id"],
        target_role=target_rec["role"],
    )
    if problem:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=problem)

    household_id = caller_membership["household_id"]
    if target_rec["role"] == "head":
        # If head leaves, dissolve household
        repository.dissolve_household(db, household_id)
        repository.record_consent_log(
            db,
            household_id=household_id,
            action="dissolve_household",
            actor_id=member.id,
            member_id=member.id,
        )
    else:
        repository.remove_member(db, member_record_id)
        act = "leave_household" if target_rec["member_id"] == member.id else "remove_member"
        repository.record_consent_log(
            db,
            household_id=household_id,
            action=act,
            actor_id=member.id,
            member_id=target_rec["member_id"],
            details=None,
        )

    db.commit()


def leave_household(db: Session, member: SessionMember) -> None:
    repository.set_rls_context(db, member.id)
    membership = repository.find_active_membership(db, member.id)
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="no_active_household")
    remove_member(db, member, membership["id"])


def get_privacy_notice() -> ConsentNoticeOut:
    return ConsentNoticeOut(
        title_ta="குடும்பத் தகவல் மற்றும் ஒப்புதல் அறிவிப்பு",
        title_en="Household Information and Consent Notice",
        notice_ta="எனது குடும்பம் தொகுதி முற்றிலும் விருப்பத்தின் அடிப்படையிலானது. எந்தவொரு சேவையையும் அல்லது உறுப்பினர் அந்தஸ்தையும் பெறுவதற்கு குடும்பத் தகவல்களைப் பகிர்வது கட்டாயமில்லை.",
        notice_en="The My Household feature is entirely voluntary. Sharing household information is never a condition for receiving a service or membership status.",
        voluntary_clause_ta="வயதுவந்த குடும்ப உறுப்பினர்கள் அழைப்பை ஏற்றுக்கொள்வதன் மூலம் மட்டுமே சேர்க்கப்படுவார்கள். எந்த நேரத்திலும் குடும்பத்திலிருந்து வெளியேறலாம் அல்லது குடும்பத்தை கலைக்கலாம்.",
        voluntary_clause_en="Adult household members can only be added by explicit mutual consent through an invitation. You can leave or dissolve the household at any time.",
        is_voluntary=True,
        purpose_limitation_ta="குடும்பத் தகவல்கள் தீவிர தரவுப் பாதுகாப்பின் கீழ் பாதுகாக்கப்படுகின்றன, மேலும் இவை அரசியல் நோக்கங்களுக்கோ அல்லது பிற மூன்றாம் தரப்பினருடனோ பகிரப்படாது (BR-101).",
        purpose_limitation_en="Household data is protected and kept separate from unrelated records. It is never used for political profiling.",
    )


def staff_view_household(
    db: Session,
    staff: Staff,
    target: str | uuid.UUID,
) -> StaffHouseholdViewOut:
    # 0. Resolve target UUID if code was supplied
    if isinstance(target, uuid.UUID):
        target_member_id = target
    else:
        try:
            target_member_id = uuid.UUID(target)
        except ValueError:
            target_row = repository.resolve_member_by_code(db, target.strip().upper())
            if not target_row:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="target_member_not_found")
            target_member_id = target_row["id"]

    # 1. PRM-33: household.view_for_case
    target_area = member_area_path(db, target_member_id)
    if not rules.staff_can_view_household(staff.rule_assignments(), target_area):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

    target_profile = repository.member_profile_summary(db, target_member_id)
    if not target_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="target_member_not_found")

    # 2. Set RLS context for staff view
    repository.set_rls_context(db, staff.member_id, staff_view=True, staff_target_member_id=target_member_id)

    membership = repository.find_active_membership(db, target_member_id)
    hh_out: HouseholdOut | None = None
    consent_logs: list[ConsentLogOut] = []

    if membership:
        household_id = membership["household_id"]
        repository.set_rls_context(
            db,
            staff.member_id,
            staff_view=True,
            staff_household_id=household_id,
        )
        hh = repository.get_household(db, household_id)
        if hh and hh["dissolved_at"] is None:
            members = repository.list_members(db, household_id)
            hh_out = HouseholdOut(
                id=hh["id"],
                created_by=hh["created_by"],
                name=hh["name"],
                created_at=hh["created_at"],
                updated_at=hh["updated_at"],
                dissolved_at=hh["dissolved_at"],
                members=[_row_to_member_out(m) for m in members],
                pending_invitations=[],
                my_role=None,
                is_head=False,
            )
            # Record audit log & consent log for staff view
            repository.record_consent_log(
                db,
                household_id=household_id,
                action="staff_view",
                actor_id=staff.member_id,
                member_id=target_member_id,
            )
            audit_service.record(
                db,
                actor_id=staff.member_id,
                action="household.view",
                target_type="household",
                target_id=str(household_id),
                details={"target_member_id": str(target_member_id)},
            )
            raw_logs = repository.list_consent_logs(db, household_id)
            consent_logs = [_row_to_consent_out(cl) for cl in raw_logs]
            db.commit()

    return StaffHouseholdViewOut(
        permitted=True,
        target_member_id=target_member_id,
        target_member_code=target_profile["member_code"],
        target_member_name=target_profile["display_name"],
        household=hh_out,
        consent_logs=consent_logs,
    )
