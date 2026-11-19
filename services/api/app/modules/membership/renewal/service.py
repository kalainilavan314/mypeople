"""Membership renewal (BRD M33, D25, FR-RNW-001 to 003, 009, BR-136, OD-43).

Each Active member has one open yearly cycle. From 30 days before its due date the member confirms
that their mobile number and area are still right (M33); no ID image or selfie is ever asked for
(BR-136). A changed number is confirmed by a code before it is on record (FR-PROF-004), so a
renewal can only ever confirm a number that was checked by code (FR-RNW-003). A changed area goes
through the area-change request, which counts as the member's answer while it is reviewed.

The notifications task opens cycles, sends the 30- and 7-day notices and, when the 60-day grace
period ends without a confirmation, makes the membership Inactive (reason renewal_lapsed); its card
codes stop working and its membership certificate is revoked. Confirming afterwards makes it Active
again (OD-43's simple reactivation). The task does nothing at all until the renewal module is
switched on, so no member can lapse while renewal is closed.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access.service import Staff, visible_areas
from app.modules.audit import service as audit
from app.modules.community.issues.rules import LOCAL_ZONE
from app.modules.features import repository as features_repository
from app.modules.identity.recovery import repository as contacts
from app.modules.membership import repository as membership_repository
from app.modules.membership.card import repository as card_repository
from app.modules.membership.certificates import service as certificates
from app.modules.membership.renewal import repository, rules
from app.modules.membership.renewal.repository import Cycle, DueMember
from app.modules.membership.renewal.rules import MANAGE, Phase
from app.modules.messaging.notifications import service as notifications
from app.modules.profile import rules as profile_rules
from app.modules.profile.area_changes import repository as area_changes

TASK_BATCH = 500


class RenewalRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


def today(now: datetime | None = None) -> date:
    return (now or datetime.now(UTC)).astimezone(LOCAL_ZONE).date()


def _open_cycle(db: Session, member_id: uuid.UUID, day: date, *, lock: bool = False) -> Cycle:
    """The member's open cycle, opened now if the nightly task has not reached them yet."""
    cycle = repository.find_open(db, member_id, lock=lock)
    if cycle is None:
        since = repository.active_since(db, member_id) or day
        repository.insert(db, member_id, rules.first_due_on(since, day), day)
        cycle = repository.find_open(db, member_id, lock=lock)
    assert cycle is not None
    return cycle


def _area_change_open(db: Session, member_id: uuid.UUID) -> bool:
    return any(change.state in ("awaiting_proof", "submitted") for change in area_changes.of_member(db, member_id))


@dataclass(frozen=True)
class MyRenewal:
    applies: bool
    reason: str | None  # why renewal does not apply: membership_pending, membership_suspended, membership_inactive
    membership_state: str
    cycle: Cycle | None
    phase: Phase | None
    reactivation: bool  # OD-43: confirming makes a lapsed membership Active again
    mobile_masked: str | None
    contact_on_record: bool
    district_name: str | None
    ds_name: str | None
    gn_name: str | None
    area_change_open: bool
    history: list[Cycle]


def my_renewal(db: Session, member_id: uuid.UUID, now: datetime | None = None) -> MyRenewal:
    day = today(now)
    status = access_repository.find_member_status(db, member_id)
    profile = membership_repository.find_member_profile(db, member_id)
    assert status is not None and profile is not None
    current = membership_repository.current_state(db, member_id)
    cycle: Cycle | None = None
    current_phase: Phase | None = None
    reactivation = False
    if current.state == "active":
        cycle = repository.find_open(db, member_id)
        if cycle is None:
            cycle = _open_cycle(db, member_id, day)
            db.commit()
        current_phase = rules.phase(cycle.due_on, day)
    elif rules.may_reactivate(current.state, current.reason_code, status.identity_verified):
        cycle = repository.last_lapsed(db, member_id)
        current_phase, reactivation = "lapsed", True
    contact = contacts.find_contact(db, member_id)
    applies = cycle is not None
    return MyRenewal(
        applies=applies,
        reason=None if applies else f"membership_{current.state}",
        membership_state=current.state,
        cycle=cycle,
        phase=current_phase,
        reactivation=reactivation,
        mobile_masked=profile_rules.mask_phone(contact.phone) if contact else None,
        contact_on_record=contact is not None,
        district_name=profile["district_name"],
        ds_name=profile["ds_name"],
        gn_name=profile["gs_name"],
        area_change_open=_area_change_open(db, member_id),
        history=[c for c in repository.history(db, member_id) if c.state != "open"],
    )


def confirm(db: Session, member_id: uuid.UUID, *, contact_confirmed: bool, area_confirmed: bool, ip: str,
            now: datetime | None = None) -> MyRenewal:
    """FR-RNW-001: the member confirms contact and area; nothing else is asked (BR-136)."""
    day = today(now)
    membership_repository.lock_member(db, member_id)
    status = access_repository.find_member_status(db, member_id)
    assert status is not None
    current = membership_repository.current_state(db, member_id)
    contact_on_record = contacts.find_contact(db, member_id) is not None
    area_change_open = _area_change_open(db, member_id)
    area_answer = "confirmed" if area_confirmed else "change_requested"
    area_path = access_repository.member_area_path(db, member_id)

    if current.state == "active":
        cycle = _open_cycle(db, member_id, day, lock=True)
        problems = rules.check_confirmation(
            current_phase=rules.phase(cycle.due_on, day), contact_on_record=contact_on_record,
            contact_confirmed=contact_confirmed, area_confirmed=area_confirmed, area_change_open=area_change_open,
        )
        if problems:
            raise RenewalRefused(problems)
        repository.confirm(db, cycle.id, area_answer)
        repository.insert(db, member_id, rules.next_due_on(cycle.due_on), day)
        notifications.complete_action(db, "renewal", cycle.id, member_id)
        audit.record(
            db, actor_id=member_id, action="membership.renewal.confirmed", target_type="renewal", target_id=str(cycle.id),
            area_path=area_path, details={"dueOn": cycle.due_on.isoformat(), "area": area_answer}, ip=ip,
        )
    elif rules.may_reactivate(current.state, current.reason_code, status.identity_verified):
        problems = rules.check_confirmation(
            current_phase="lapsed", contact_on_record=contact_on_record, contact_confirmed=contact_confirmed,
            area_confirmed=area_confirmed, area_change_open=area_change_open,
        )
        if problems:
            raise RenewalRefused(problems)
        lapsed = repository.last_lapsed(db, member_id)
        # OD-43 simple reactivation: recorded like any membership change, by the system, with its reason.
        membership_repository.record_change(
            db, member_id=member_id, action="activate", from_state="inactive", to_state="active",
            reason_code=rules.REACTIVATED_REASON, note=None, changed_by=None,
        )
        repository.insert(db, member_id, rules.add_years(day), day)
        if lapsed is not None:
            notifications.complete_action(db, "renewal", lapsed.id, member_id)
        notifications.notify(db, member_id, "membership_changed", member_id)
        audit.record(
            db, actor_id=member_id, action="membership.renewal.reactivated", target_type="membership",
            target_id=str(member_id), area_path=area_path,
            details={"memberId": str(member_id), "from": "inactive", "to": "active", "reasonCode": rules.REACTIVATED_REASON,
                     "area": area_answer},
            ip=ip,
        )
    else:
        raise RenewalRefused(f"membership_{current.state}")
    db.commit()
    return my_renewal(db, member_id, now)


# --- D25 ---------------------------------------------------------------------------------------------------------


def due_list(db: Session, staff: Staff, phase: str | None, limit: int, now: datetime | None = None) -> list[DueMember]:
    return repository.due_list(db, areas=visible_areas(staff, MANAGE), phase=phase, today=today(now), limit=limit)


def summary(db: Session, staff: Staff, now: datetime | None = None) -> dict[str, int]:
    """How many members are in each phase, in the caller's areas (a count, never a list export)."""
    areas, day = visible_areas(staff, MANAGE), today(now)
    return {
        phase: len(repository.due_list(db, areas=areas, phase=phase, today=day, limit=10_000))
        for phase in ("upcoming", "due", "grace", "lapsed")
    }


# --- The notifications task --------------------------------------------------------------------------------------


@dataclass(frozen=True)
class RenewalRun:
    opened: int = 0
    notices: int = 0
    lapsed: int = 0


def run(db: Session, now: datetime) -> RenewalRun:
    """Open cycles, send notices and record lapses. Nothing happens while the module is off: no
    member may lapse because of a renewal they could not see."""
    if not features_repository.is_enabled(db, "renewal"):
        return RenewalRun()
    day = today(now)
    opened = 0
    for member_id in repository.active_members_without_cycle(db, TASK_BATCH):
        _open_cycle(db, member_id, day)
        opened += 1
    db.commit()

    notices = 0
    for cycle in repository.open_cycles_for_notices(db, day, TASK_BATCH):
        which = rules.notice_to_send(cycle.due_on, day, cycle.notice_30_at is not None, cycle.notice_7_at is not None)
        if which is None:
            continue
        notifications.notify(db, cycle.member_id, which, cycle.id)
        repository.mark_notice(db, cycle.id, 7 if which == "renewal_due_7" else 30, now)
        notices += 1
    db.commit()

    lapsed = 0
    for cycle in repository.open_cycles_past_grace(db, day, TASK_BATCH):
        membership_repository.lock_member(db, cycle.member_id)
        if membership_repository.current_state(db, cycle.member_id).state != "active":
            continue
        membership_repository.record_change(
            db, member_id=cycle.member_id, action="inactivate", from_state="active", to_state="inactive",
            reason_code=rules.LAPSED_REASON, note=None, changed_by=None,
        )
        # Codes shown before now must name nobody (FR-CARD-015), as for any inactivation.
        card_repository.replace_card_ref(db, cycle.member_id)
        certificates.revoke_membership_certificates(db, cycle.member_id, "inactive")
        repository.mark_lapsed(db, cycle.id, now)
        notifications.complete_action(db, "renewal", cycle.id, cycle.member_id)
        notifications.notify(db, cycle.member_id, "renewal_lapsed", cycle.id)
        audit.record(
            db, actor_id=None, action="membership.renewal.lapsed", target_type="renewal", target_id=str(cycle.id),
            area_path=access_repository.member_area_path(db, cycle.member_id),
            details={"memberId": str(cycle.member_id), "dueOn": cycle.due_on.isoformat(), "reasonCode": rules.LAPSED_REASON},
        )
        lapsed += 1
    db.commit()
    return RenewalRun(opened=opened, notices=notices, lapsed=lapsed)
