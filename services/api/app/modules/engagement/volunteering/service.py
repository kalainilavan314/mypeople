"""Volunteering for members and coordinators (BRD H10 to H12, S10, FR-VOL-001 to 008).

Members keep a skills profile only with consent, offer to help with an opportunity in their area
and talk to the coordinators through the app. Coordinators (volunteers.manage over the
opportunity's area) publish opportunities, confirm or decline offers with a role and meeting
point, and answer messages. A volunteer's phone number is never shown and nobody is ranked.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import rules as access_rules
from app.modules.access.rules import Area, AreaPath, area_from_key
from app.modules.access.service import AccessRefused, Staff, refuse, visible_areas
from app.modules.audit import service as audit
from app.modules.engagement.volunteering import repository, rules
from app.modules.engagement.volunteering.repository import Contact, Offer, Opportunity
from app.modules.messaging.notifications import service as notifications


class VolunteerRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class NotFound(Exception):
    pass


def _path(keys: list[str]) -> AreaPath:
    return tuple(area_from_key(key) for key in keys)


# --- Skills profile (H10) ------------------------------------------------------------------------------


def profile(db: Session, member_id: uuid.UUID) -> repository.Profile | None:
    return repository.find_profile(db, member_id)


def save_profile(db: Session, member_id: uuid.UUID, *, skills: list[str], availability: list[str], travel_area: str,
                 consent: bool, ip: str) -> repository.Profile:
    known = {skill.key for skill in repository.skills(db)}
    problems = rules.check_profile(consent=consent, skills=skills, known_skills=known)
    if problems:
        raise VolunteerRefused(problems)
    repository.save_profile(db, member_id, sorted(set(skills)), sorted(set(availability)), travel_area, rules.CONSENT_VERSION)
    audit.record(db, actor_id=member_id, action="volunteer.profile.saved", target_type="volunteer_profile",
                 target_id=str(member_id), details={"skills": len(skills), "consent": rules.CONSENT_VERSION}, ip=ip)
    db.commit()
    saved = repository.find_profile(db, member_id)
    assert saved is not None
    return saved


def withdraw_profile(db: Session, member_id: uuid.UUID, ip: str) -> None:
    """Withdrawing consent deletes the profile; coordinators no longer see it."""
    if repository.delete_profile(db, member_id):
        audit.record(db, actor_id=member_id, action="volunteer.profile.withdrawn", target_type="volunteer_profile",
                     target_id=str(member_id), ip=ip)
    db.commit()


# --- Opportunities and offers (H11, H12) -----------------------------------------------------------------


def _member_area_keys(db: Session, member_id: uuid.UUID) -> list[str]:
    return [area.key for area in access_repository.member_area_path(db, member_id)]


@dataclass(frozen=True)
class OpportunityView:
    opportunity: Opportunity
    my_offer: Offer | None
    saved: bool


def opportunities(db: Session, member_id: uuid.UUID) -> list[OpportunityView]:
    keys = _member_area_keys(db, member_id)
    saved = repository.bookmarked(db, member_id)
    found = repository.open_opportunities_for(db, keys, datetime.now(UTC))
    return [OpportunityView(o, repository.offer_for(db, o.id, member_id), o.id in saved) for o in found]


def opportunity(db: Session, member_id: uuid.UUID, opportunity_id: uuid.UUID) -> OpportunityView:
    found = repository.find_opportunity(db, opportunity_id)
    mine = repository.offer_for(db, opportunity_id, member_id) if found else None
    # Visible while open in the member's area, and always to someone who offered.
    if found is None or (mine is None and not (found.state == "open" and rules.visible_to(found.area_key, _member_area_keys(db, member_id)))):
        raise NotFound()
    return OpportunityView(found, mine, opportunity_id in repository.bookmarked(db, member_id))


def offer_to_help(db: Session, member_id: uuid.UUID, opportunity_id: uuid.UUID, ip: str) -> Offer:
    """FR-VOL-005: an offer with a receipt; the coordinator decides."""
    view = opportunity(db, member_id, opportunity_id)
    status = access_repository.find_member_status(db, member_id)
    assert status is not None
    problem = rules.check_offer(
        identity_verified=status.identity_verified, membership_active=status.membership_active,
        state=view.opportunity.state, starts_at=view.opportunity.starts_at, now=datetime.now(UTC),
        existing_state=view.my_offer.state if view.my_offer else None,
    )
    if problem:
        raise VolunteerRefused(problem)
    offer_id = repository.upsert_offer(db, opportunity_id, member_id)
    repository.record_offer_event(db, offer_id, view.my_offer.state if view.my_offer else None, "offered", member_id)
    audit.record(db, actor_id=member_id, action="volunteer.offer.made", target_type="volunteer_offer",
                 target_id=str(offer_id), area_path=_path(view.opportunity.area_path), ip=ip)
    db.commit()
    found = repository.find_offer(db, offer_id)
    assert found is not None
    return found


def withdraw_offer(db: Session, member_id: uuid.UUID, opportunity_id: uuid.UUID, ip: str) -> None:
    """Before a coordinator decides, an offer can be taken back; after that, ask for a change."""
    offer = repository.offer_for(db, opportunity_id, member_id)
    if offer is None:
        raise NotFound()
    if offer.state != "offered":
        raise VolunteerRefused("request_a_change_instead" if offer.state == "confirmed" else "not_awaiting_decision")
    repository.set_offer_state(db, offer.id, "withdrawn")
    repository.record_offer_event(db, offer.id, "offered", "withdrawn", member_id)
    audit.record(db, actor_id=member_id, action="volunteer.offer.withdrawn", target_type="volunteer_offer",
                 target_id=str(offer.id), ip=ip)
    db.commit()


def set_saved(db: Session, member_id: uuid.UUID, opportunity_id: uuid.UUID, saved: bool) -> OpportunityView:
    opportunity(db, member_id, opportunity_id)  # visible to them, or 404
    repository.set_bookmark(db, opportunity_id, member_id, saved)
    db.commit()
    return opportunity(db, member_id, opportunity_id)


@dataclass(frozen=True)
class Assignment:
    offer: Offer
    opportunity: Opportunity
    history: list[repository.OfferEvent]
    contacts: list[Contact]


def my_assignments(db: Session, member_id: uuid.UUID) -> list[Assignment]:
    """H12: offers and confirmed assignments, newest first, with the history kept (FR-VOL-008)."""
    result = []
    for offer in repository.member_offers(db, member_id):
        found = repository.find_opportunity(db, offer.opportunity_id)
        assert found is not None
        result.append(Assignment(offer, found, repository.offer_history(db, offer.id), repository.offer_contacts(db, offer.id)))
    return result


def contact_coordinator(db: Session, member_id: uuid.UUID, offer_id: uuid.UUID, kind: str, body: str, ip: str) -> Contact:
    """FR-VOL-007, 008: a message or a change request through the app; the coordinators are told
    and the volunteer's number is never shown. A change request keeps the assignment as it is."""
    offer = repository.find_offer(db, offer_id)
    if offer is None or offer.member_id != member_id:
        raise NotFound()
    if offer.state not in ("offered", "confirmed"):
        raise VolunteerRefused("offer_closed")
    if kind == "change_request" and offer.state != "confirmed":
        raise VolunteerRefused("not_confirmed")
    found = repository.find_opportunity(db, offer.opportunity_id)
    assert found is not None
    contact_id = repository.insert_contact(db, offer.id, member_id, kind, body.strip())
    for coordinator in repository.coordinators(db, found.area_path):
        if coordinator != member_id:
            notifications.notify(db, coordinator, "volunteer_contact_received", contact_id)
    audit.record(db, actor_id=member_id, action=f"volunteer.{kind}", target_type="volunteer_offer",
                 target_id=str(offer.id), area_path=_path(found.area_path), ip=ip)
    db.commit()
    saved = repository.find_contact(db, contact_id)
    assert saved is not None
    return saved


# --- Coordinators (S10) --------------------------------------------------------------------------------


def _require_area(db: Session, staff: Staff, area_path: list[str], ip: str, target: tuple[str, str]) -> None:
    path = _path(area_path)
    if not access_rules.holds(staff.rule_assignments(), rules.PERMISSION, path):
        refuse(db, staff, rules.PERMISSION, "outside_your_area", ip, target=target, area_path=path)


def managed(db: Session, staff: Staff, states: list[str] | None, limit: int) -> list[Opportunity]:
    return repository.managed_opportunities(db, visible_areas(staff, rules.PERMISSION), states, limit)


def create_opportunity(db: Session, staff: Staff, values: dict[str, Any], area: Area, ip: str) -> Opportunity:
    path = access_repository.area_path(db, area)
    if path is None:
        raise VolunteerRefused("unknown_area")
    keys = [a.key for a in path]
    _require_area(db, staff, keys, ip, ("volunteer_opportunity", "new"))
    problems = rules.check_opportunity_times(values["starts_at"], values["ends_at"], datetime.now(UTC))
    known = {skill.key for skill in repository.skills(db)}
    if any(skill not in known for skill in values["skills"]):
        problems.append("unknown_skill")
    if problems:
        raise VolunteerRefused(problems)
    opportunity_id = repository.insert_opportunity(db, values, area_key=area.key, area_path=keys, created_by=staff.member_id)
    audit.record(db, actor_id=staff.member_id, action="volunteer.opportunity.created", target_type="volunteer_opportunity",
                 target_id=str(opportunity_id), area_path=path, ip=ip)
    db.commit()
    found = repository.find_opportunity(db, opportunity_id)
    assert found is not None
    return found


def _managed_opportunity(db: Session, staff: Staff, opportunity_id: uuid.UUID, ip: str, *, lock: bool = False) -> Opportunity:
    found = repository.find_opportunity(db, opportunity_id, lock=lock)
    if found is None:
        raise NotFound()
    _require_area(db, staff, found.area_path, ip, ("volunteer_opportunity", str(opportunity_id)))
    return found


def update_opportunity(db: Session, staff: Staff, opportunity_id: uuid.UUID, values: dict[str, Any], ip: str) -> Opportunity:
    found = _managed_opportunity(db, staff, opportunity_id, ip, lock=True)
    if found.state == "cancelled":
        raise VolunteerRefused("not_allowed_from:cancelled")
    starts, ends = values.get("starts_at", found.starts_at), values.get("ends_at", found.ends_at)
    if "starts_at" in values or "ends_at" in values:
        problems = rules.check_opportunity_times(starts, ends, datetime.now(UTC))
        if problems:
            raise VolunteerRefused(problems)
    repository.update_opportunity(db, found.id, values)
    audit.record(db, actor_id=staff.member_id, action="volunteer.opportunity.updated", target_type="volunteer_opportunity",
                 target_id=str(found.id), area_path=_path(found.area_path), details={"fields": sorted(values)}, ip=ip)
    db.commit()
    updated = repository.find_opportunity(db, found.id)
    assert updated is not None
    return updated


def move_opportunity(db: Session, staff: Staff, opportunity_id: uuid.UUID, state: str, reason: str | None, ip: str) -> Opportunity:
    found = _managed_opportunity(db, staff, opportunity_id, ip, lock=True)
    problem = rules.check_move(found.state, state, reason)
    if problem:
        raise VolunteerRefused(problem)
    repository.update_opportunity(db, found.id, {"state": state, "cancel_reason": reason.strip() if state == "cancelled" and reason else None})
    if state == "cancelled":
        for offer in repository.opportunity_offers(db, found.id):
            if offer.state in ("offered", "confirmed"):
                repository.set_offer_state(db, offer.id, "cancelled", decision_reason=reason)
                repository.record_offer_event(db, offer.id, offer.state, "cancelled", staff.member_id, reason)
                notifications.notify(db, offer.member_id, "volunteer_cancelled", offer.id)
    audit.record(db, actor_id=staff.member_id, action=f"volunteer.opportunity.{state}", target_type="volunteer_opportunity",
                 target_id=str(found.id), area_path=_path(found.area_path), ip=ip)
    db.commit()
    moved = repository.find_opportunity(db, found.id)
    assert moved is not None
    return moved


@dataclass(frozen=True)
class OfferCard:
    offer: Offer
    profile: repository.Profile | None  # only with the volunteer's consent


def offers(db: Session, staff: Staff, opportunity_id: uuid.UUID, ip: str) -> list[OfferCard]:
    found = _managed_opportunity(db, staff, opportunity_id, ip)
    return [OfferCard(offer, repository.find_profile(db, offer.member_id)) for offer in repository.opportunity_offers(db, found.id)]


def decide_offer(db: Session, staff: Staff, offer_id: uuid.UUID, *, confirm: bool, role_en: str | None, role_ta: str | None,
                 meeting_point_en: str | None, meeting_point_ta: str | None, reason: str | None, ip: str) -> Offer:
    """FR-VOL-006: confirm with role and meeting point, or decline with a reason."""
    offer = repository.find_offer(db, offer_id, lock=True)
    if offer is None:
        raise NotFound()
    found = _managed_opportunity(db, staff, offer.opportunity_id, ip, lock=True)
    if offer.member_id == staff.member_id:
        refuse(db, staff, rules.PERMISSION, "own_record", ip, target=("volunteer_offer", str(offer.id)),
               area_path=_path(found.area_path))
    problem = rules.check_decision(
        offer_state=offer.state, confirm=confirm, confirmed=found.confirmed, places=found.places, reason=reason,
        meeting_point_en=meeting_point_en, meeting_point_ta=meeting_point_ta,
    )
    if problem:
        raise VolunteerRefused(problem)
    now = datetime.now(UTC)
    if confirm:
        repository.set_offer_state(
            db, offer.id, "confirmed", role_en=(role_en or found.role_en).strip(), role_ta=(role_ta or found.role_ta).strip(),
            meeting_point_en=meeting_point_en.strip(), meeting_point_ta=meeting_point_ta.strip(),  # type: ignore[union-attr]
            decided_by=staff.member_id, decided_at=now,
        )
        notifications.notify(db, offer.member_id, "volunteer_confirmed", offer.id)
    else:
        repository.set_offer_state(db, offer.id, "declined", decided_by=staff.member_id, decided_at=now,
                                   decision_reason=reason.strip())  # type: ignore[union-attr]
        notifications.notify(db, offer.member_id, "volunteer_declined", offer.id)
    repository.record_offer_event(db, offer.id, offer.state, "confirmed" if confirm else "declined", staff.member_id, reason)
    audit.record(db, actor_id=staff.member_id, action="volunteer.offer.confirmed" if confirm else "volunteer.offer.declined",
                 target_type="volunteer_offer", target_id=str(offer.id), area_path=_path(found.area_path), ip=ip)
    db.commit()
    decided = repository.find_offer(db, offer.id)
    assert decided is not None
    return decided


def open_contacts(db: Session, staff: Staff) -> list[Contact]:
    return repository.open_contacts(db, visible_areas(staff, rules.PERMISSION))


def answer_contact(db: Session, staff: Staff, contact_id: uuid.UUID, answer: str, ip: str) -> Contact:
    contact = repository.find_contact(db, contact_id)
    if contact is None:
        raise NotFound()
    _require_area(db, staff, contact.area_path, ip, ("volunteer_contact", str(contact_id)))
    if contact.state != "open":
        raise VolunteerRefused("already_answered")
    repository.answer_contact(db, contact.id, answer.strip(), staff.member_id)
    if contact.kind == "change_request":
        repository.record_offer_event(db, contact.offer_id, "confirmed", "confirmed", staff.member_id,
                                      f"Change request answered: {answer.strip()}"[:1000])
    notifications.complete_action(db, "volunteer_contact", contact.id)
    notifications.notify(db, contact.member_id, "volunteer_answered", contact.offer_id)
    audit.record(db, actor_id=staff.member_id, action="volunteer.contact.answered", target_type="volunteer_contact",
                 target_id=str(contact.id), area_path=_path(contact.area_path), ip=ip)
    db.commit()
    answered = repository.find_contact(db, contact.id)
    assert answered is not None
    return answered


def volunteers(db: Session, staff: Staff, skill: str | None, limit: int) -> list[repository.VolunteerCard]:
    """Consented skills profiles in the coordinator's areas, by name: no phone numbers, no ranking."""
    if not access_rules.holds(staff.rule_assignments(), rules.PERMISSION):
        raise AccessRefused("forbidden")
    return repository.consented_volunteers(db, visible_areas(staff, rules.PERMISSION), skill, limit)
