"""Community Support / சமூக உதவி (BRD M11 to M14, S11, S12, D13, D14, FR-AST-001 to 013).

Confidential help for anyone in need, member or not, kept apart from politics. Requests come from
the app (any signed-in account, no membership needed), the public form, the hotline or a partner;
each starts with the official emergency numbers and needs consent to collect the case details.
A caseworker is assigned; only they and the decision-makers can open the case, and every opening
is audited (FR-AST-007). Decisions cite the published criteria version; one appeal or complaint
per decision is decided by someone else. Nothing about membership, donations, events or campaigns
is ever read or returned here (FR-AST-009), and the tables are behind a database firewall.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core import small_numbers
from app.modules.access import repository as access_repository
from app.modules.access import rules as access_rules
from app.modules.access.rules import PLATFORM, Area, AreaPath, area_from_key
from app.modules.access.service import AccessRefused, Staff, refuse, visible_areas
from app.modules.assistance import repository, rules
from app.modules.assistance.repository import Appeal, Case, Decision
from app.modules.audit import service as audit
from app.modules.community.issues.rules import add_working_days
from app.modules.messaging.notifications import service as notifications

PUBLIC_REQUESTS_PER_HOUR = 5  # per address, for the form that needs no account [ASSUMPTION]


class SupportRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class SupportNotFound(Exception):
    pass


def _path(keys: list[str]) -> AreaPath:
    return tuple(area_from_key(k) for k in keys) or (PLATFORM,)


# --- Requests (M12, public form, S11) ----------------------------------------------------------------------


@dataclass(frozen=True)
class NewRequest:
    category: str
    summary: str
    emergency: bool
    consent: bool
    full_name: str
    phone: str | None
    household: str | None
    area: Area | None


def _create(db: Session, request: NewRequest, *, member_id: uuid.UUID | None, channel: str, partner_id: uuid.UUID | None,
            area_path: AreaPath, ip: str | None, created_by: uuid.UUID | None) -> Case:
    if not request.consent:
        raise SupportRefused("consent_required")  # FR-AST-004: consent to collect the case details first
    keys = [a.key for a in area_path]
    applicant_id = repository.insert_applicant(
        db, member_id=member_id, full_name=request.full_name.strip(), phone=request.phone,
        household=request.household.strip() if request.household else None, area_key=keys[-1], area_path=keys,
    )
    case_id = repository.insert_case(
        db, case_ref=rules.new_case_ref(), applicant_id=applicant_id, category=request.category,
        emergency=request.emergency, summary=request.summary.strip(), channel=channel, partner_id=partner_id,
        area_key=keys[-1], area_path=keys, source_ip=ip if channel == "web_form" else None, created_by=created_by,
    )
    # Emergencies reach the people who screen requests at once (FR-AST-003).
    if request.emergency:
        for holder, _ in repository.staff_holders(db, rules.INTAKE, keys):
            notifications.notify(db, holder, "assistance_emergency", case_id)
    # Ids only: never the person's name, phone or the request text.
    audit.record(db, actor_id=created_by or member_id, action="assistance.case.created", target_type="assistance_case",
                 target_id=str(case_id), area_path=area_path, details={"channel": channel, "emergency": request.emergency}, ip=ip)
    db.commit()
    found = repository.find_case(db, case_id)
    assert found is not None
    return found


def _area_path(db: Session, area: Area | None) -> AreaPath:
    if area is None:
        return (PLATFORM,)
    path = access_repository.area_path(db, area)
    if path is None:
        raise SupportRefused("unknown_area")
    return path


def request_in_app(db: Session, member_id: uuid.UUID, request: NewRequest, ip: str) -> Case:
    """M12: any signed-in person may ask; membership and verification are never checked (BR-102)."""
    path = _area_path(db, request.area) if request.area else access_repository.member_area_path(db, member_id)
    return _create(db, request, member_id=member_id, channel="app", partner_id=None, area_path=path, ip=ip, created_by=None)


def request_public(db: Session, request: NewRequest, ip: str) -> Case:
    """The public web form for people without an account (FR-AST-001)."""
    if repository.count_from_ip(db, ip) >= PUBLIC_REQUESTS_PER_HOUR:
        raise SupportRefused("too_many_requests")
    if not request.phone:
        raise SupportRefused("phone_required")
    return _create(db, request, member_id=None, channel="web_form", partner_id=None, area_path=_area_path(db, request.area),
                   ip=ip, created_by=None)


def intake(db: Session, staff: Staff, request: NewRequest, channel: str, partner_id: uuid.UUID | None, ip: str) -> Case:
    """S11: a hotline call or a partner referral, recorded by intake staff in their area."""
    path = _area_path(db, request.area)
    if not access_rules.holds(staff.rule_assignments(), rules.INTAKE, path):
        refuse(db, staff, rules.INTAKE, "outside_your_area", ip, target=("assistance_case", "new"), area_path=path)
    if channel == "partner":
        partner = repository.find_partner(db, partner_id) if partner_id else None
        if partner is None or not partner.active:
            raise SupportRefused("partner_not_found")
    return _create(db, request, member_id=None, channel=channel, partner_id=partner_id if channel == "partner" else None,
                   area_path=path, ip=ip, created_by=staff.member_id)


# --- The applicant's view (M11, M13, M14) ---------------------------------------------------------------


@dataclass(frozen=True)
class ApplicantView:
    case: Case
    decisions: list[Decision]
    deliveries: list[dict[str, Any]]
    appeals: list[Appeal]


def my_requests(db: Session, member_id: uuid.UUID) -> list[Case]:
    return repository.member_cases(db, member_id)


def my_request(db: Session, member_id: uuid.UUID, case_id: uuid.UUID) -> ApplicantView:
    case = repository.find_case(db, case_id)
    if case is None or case.applicant_member_id != member_id:
        raise SupportNotFound()
    return ApplicantView(case, repository.decisions(db, case_id), repository.deliveries(db, case_id),
                         repository.appeals(db, case_id))


def appeal(db: Session, member_id: uuid.UUID, case_id: uuid.UUID, decision_id: uuid.UUID, kind: str, body: str, ip: str) -> Appeal:
    """FR-AST-011: one complaint or appeal per decision, decided by a different person."""
    view = my_request(db, member_id, case_id)
    if not any(d.id == decision_id for d in view.decisions):
        raise SupportNotFound()
    if repository.appeal_for(db, decision_id) is not None:
        raise SupportRefused("already_appealed")
    appeal_id = repository.insert_appeal(db, decision_id, case_id, kind, body.strip(),
                                         add_working_days(datetime.now(UTC), rules.APPEAL_WORKING_DAYS))
    for holder, _ in repository.staff_holders(db, rules.DECIDE, view.case.area_path):
        notifications.notify(db, holder, "assistance_appeal_received", case_id)
    audit.record(db, actor_id=member_id, action=f"assistance.{kind}.made", target_type="assistance_case",
                 target_id=str(case_id), area_path=_path(view.case.area_path), ip=ip)
    db.commit()
    found = repository.find_appeal(db, appeal_id)
    assert found is not None
    return found


# --- Staff (S11, S12, D13) -----------------------------------------------------------------------------


def _decides(staff: Staff, case: Case) -> bool:
    return access_rules.holds(staff.rule_assignments(), rules.DECIDE, _path(case.area_path))


def _may_read(staff: Staff, case: Case) -> bool:
    path = _path(case.area_path)
    assigned = case.caseworker_id == staff.member_id and access_rules.holds(staff.rule_assignments(), rules.CASEWORK, path)
    screening = case.state == "screening" and case.caseworker_id is None and access_rules.holds(
        staff.rule_assignments(), rules.INTAKE, path
    )
    return rules.may_read(assigned=assigned, decides=_decides(staff, case), intake_while_screening=screening)


def _load(db: Session, staff: Staff, case_id: uuid.UUID, ip: str, *, lock: bool = False) -> Case:
    case = repository.find_case(db, case_id, lock=lock)
    if case is None:
        raise SupportNotFound()
    if not _may_read(staff, case):
        # FR-AST-007: refused and logged, even for staff of the same area.
        refuse(db, staff, "assistance.case", "not_assigned", ip, target=("assistance_case", str(case_id)),
               area_path=_path(case.area_path))
    return case


def queue(db: Session, staff: Staff, states: list[str] | None) -> list[Case]:
    """Cases the viewer may open: unassigned ones waiting for screening (intake), their own (casework),
    and every case in their areas (decision-makers)."""
    if not any(access_rules.holds(staff.rule_assignments(), p) for p in (rules.INTAKE, rules.CASEWORK, rules.DECIDE)):
        raise AccessRefused("forbidden")
    if access_rules.holds(staff.rule_assignments(), rules.DECIDE):
        return repository.staff_cases(db, areas=visible_areas(staff, rules.DECIDE), caseworker=None, states=states,
                                      screening_or_assigned_to=None, limit=300)
    keys: set[str] = set()
    platform = False
    for permission in (rules.INTAKE, rules.CASEWORK):
        areas = visible_areas(staff, permission)
        if areas is None:
            platform = True
        else:
            keys.update(areas)
    return repository.staff_cases(db, areas=None if platform else sorted(keys), caseworker=None, states=states,
                                  screening_or_assigned_to=staff.member_id, limit=300)


@dataclass(frozen=True)
class CaseFile:
    case: Case
    notes: list[dict[str, Any]]
    decisions: list[Decision]
    deliveries: list[dict[str, Any]]
    referrals: list[dict[str, Any]]
    appeals: list[Appeal]
    duplicates: list[Case]
    may_decide: bool
    may_work: bool


def case_file(db: Session, staff: Staff, case_id: uuid.UUID, ip: str, *, audited: bool = True) -> CaseFile:
    case = _load(db, staff, case_id, ip)
    if audited:
        audit.record(db, actor_id=staff.member_id, action="assistance.case.opened", target_type="assistance_case",
                     target_id=str(case_id), area_path=_path(case.area_path), ip=ip)
        db.commit()
    may_work = case.caseworker_id == staff.member_id
    return CaseFile(
        case=case, notes=repository.notes(db, case_id), decisions=repository.decisions(db, case_id),
        deliveries=repository.deliveries(db, case_id), referrals=repository.referrals(db, case_id),
        appeals=repository.appeals(db, case_id), duplicates=repository.possible_duplicates(db, case),
        may_decide=_decides(staff, case), may_work=may_work,
    )


def caseworkers(db: Session, staff: Staff, case_id: uuid.UUID, ip: str) -> list[tuple[uuid.UUID, str]]:
    case = _load(db, staff, case_id, ip)
    return repository.staff_holders(db, rules.CASEWORK, case.area_path)


def assign(db: Session, staff: Staff, case_id: uuid.UUID, caseworker_id: uuid.UUID, ip: str) -> None:
    case = _load(db, staff, case_id, ip, lock=True)
    if not (_decides(staff, case) or case.caseworker_id is None):
        refuse(db, staff, rules.DECIDE, "forbidden", ip, target=("assistance_case", str(case_id)), area_path=_path(case.area_path))
    if caseworker_id not in {member for member, _ in repository.staff_holders(db, rules.CASEWORK, case.area_path)}:
        raise SupportRefused("caseworker_not_eligible")
    repository.update_case(db, case_id, {"caseworker_id": caseworker_id,
                                         "state": "assessment" if case.state == "screening" else case.state})
    notifications.notify(db, caseworker_id, "assistance_assigned", case_id)
    audit.record(db, actor_id=staff.member_id, action="assistance.case.assigned", target_type="assistance_case",
                 target_id=str(case_id), area_path=_path(case.area_path), ip=ip)
    db.commit()


def link(db: Session, staff: Staff, case_id: uuid.UUID, other_id: uuid.UUID, ip: str) -> None:
    """FR-AST-006: a suggested duplicate is linked, never rejected."""
    case = _load(db, staff, case_id, ip, lock=True)
    if other_id == case_id or other_id not in {c.id for c in repository.possible_duplicates(db, case)}:
        raise SupportRefused("not_a_suggested_duplicate")
    repository.update_case(db, case_id, {"linked_case_id": other_id})
    audit.record(db, actor_id=staff.member_id, action="assistance.case.linked", target_type="assistance_case",
                 target_id=str(case_id), area_path=_path(case.area_path), ip=ip)
    db.commit()


def _require_worker(db: Session, staff: Staff, case: Case, ip: str) -> None:
    if case.caseworker_id != staff.member_id and not _decides(staff, case):
        refuse(db, staff, rules.CASEWORK, "not_assigned", ip, target=("assistance_case", str(case.id)),
               area_path=_path(case.area_path))


def add_note(db: Session, staff: Staff, case_id: uuid.UUID, body: str, ip: str) -> None:
    case = _load(db, staff, case_id, ip)
    _require_worker(db, staff, case, ip)
    repository.add_note(db, case_id, staff.member_id, body.strip())
    audit.record(db, actor_id=staff.member_id, action="assistance.case.note", target_type="assistance_case",
                 target_id=str(case_id), area_path=_path(case.area_path), ip=ip)
    db.commit()


def decide(db: Session, staff: Staff, case_id: uuid.UUID, outcome: str, criteria_version_id: uuid.UUID, reason_en: str,
           reason_ta: str, ip: str) -> None:
    """FR-AST-008: against the published criteria version, with reasons and the decision-maker."""
    case = _load(db, staff, case_id, ip, lock=True)
    if not _decides(staff, case):
        refuse(db, staff, rules.DECIDE, "forbidden", ip, target=("assistance_case", str(case_id)), area_path=_path(case.area_path))
    problems = rules.check_decision(state=case.state, reason_en=reason_en, reason_ta=reason_ta)
    if not repository.criteria_exists(db, criteria_version_id):
        problems.append("criteria_version_required")
    if problems:
        raise SupportRefused(problems)
    repository.insert_decision(db, case_id, outcome, criteria_version_id, reason_en.strip(), reason_ta.strip(), staff.member_id)
    repository.update_case(db, case_id, {"state": "decided"})
    if case.applicant_member_id:
        notifications.notify(db, case.applicant_member_id, "assistance_decided", case_id)
    audit.record(db, actor_id=staff.member_id, action="assistance.case.decided", target_type="assistance_case",
                 target_id=str(case_id), area_path=_path(case.area_path), details={"outcome": outcome}, ip=ip)
    db.commit()


def record_delivery(db: Session, staff: Staff, case_id: uuid.UUID, kind: str, amount: str, delivered_on: date, provider: str,
                    evidence: str, ip: str) -> None:
    """FR-AST-010: type, quantity or value, date, provider and evidence; the applicant is told."""
    case = _load(db, staff, case_id, ip)
    _require_worker(db, staff, case, ip)
    if case.state != "decided":
        raise SupportRefused(f"not_allowed_from:{case.state}")
    repository.add_delivery(db, case_id, kind.strip(), amount.strip(), delivered_on, provider.strip(), evidence.strip(),
                            staff.member_id)
    if case.applicant_member_id:
        notifications.notify(db, case.applicant_member_id, "assistance_delivered", case_id)
    audit.record(db, actor_id=staff.member_id, action="assistance.case.delivery", target_type="assistance_case",
                 target_id=str(case_id), area_path=_path(case.area_path), ip=ip)
    db.commit()


def refer(db: Session, staff: Staff, case_id: uuid.UUID, partner_id: uuid.UUID, consent: bool, ip: str) -> None:
    """FR-AST-004: consent for this partner first, then the referral."""
    case = _load(db, staff, case_id, ip)
    _require_worker(db, staff, case, ip)
    if not consent:
        raise SupportRefused("partner_consent_required")
    partner = repository.find_partner(db, partner_id)
    if partner is None or not partner.active:
        raise SupportRefused("partner_not_found")
    repository.add_referral(db, case_id, partner_id, staff.member_id)
    audit.record(db, actor_id=staff.member_id, action="assistance.case.referred", target_type="assistance_case",
                 target_id=str(case_id), area_path=_path(case.area_path), details={"partner": str(partner_id)}, ip=ip)
    db.commit()


def update_referral(db: Session, staff: Staff, case_id: uuid.UUID, referral_id: uuid.UUID, state: str, outcome: str | None,
                    ip: str) -> None:
    case = _load(db, staff, case_id, ip)
    _require_worker(db, staff, case, ip)
    if not repository.update_referral(db, referral_id, case_id, state, outcome.strip() if outcome else None):
        raise SupportNotFound()
    db.commit()


def close(db: Session, staff: Staff, case_id: uuid.UUID, note: str, ip: str) -> None:
    case = _load(db, staff, case_id, ip, lock=True)
    _require_worker(db, staff, case, ip)
    if case.state == "closed":
        raise SupportRefused("not_allowed_from:closed")
    repository.add_note(db, case_id, staff.member_id, f"Closed: {note.strip()}")
    repository.update_case(db, case_id, {"state": "closed", "closed_at": datetime.now(UTC)})
    audit.record(db, actor_id=staff.member_id, action="assistance.case.closed", target_type="assistance_case",
                 target_id=str(case_id), area_path=_path(case.area_path), ip=ip)
    db.commit()


def decide_appeal(db: Session, staff: Staff, appeal_id: uuid.UUID, change: bool, reason: str, outcome: str | None,
                  criteria_version_id: uuid.UUID | None, reason_ta: str | None, ip: str) -> None:
    """FR-AST-011: never by the person whose decision is appealed. Changing the outcome records a
    new decision that replaces the earlier one, which stays in the record."""
    found = repository.find_appeal(db, appeal_id)
    if found is None:
        raise SupportNotFound()
    case = _load(db, staff, found.case_id, ip, lock=True)
    if not _decides(staff, case):
        refuse(db, staff, rules.DECIDE, "forbidden", ip, target=("assistance_case", str(case.id)), area_path=_path(case.area_path))
    original = next(d for d in repository.decisions(db, case.id) if d.id == found.decision_id)
    if rules.check_appeal_decider(original.decided_by, staff.member_id):
        refuse(db, staff, rules.DECIDE, "original_decider", ip, target=("assistance_case", str(case.id)),
               area_path=_path(case.area_path))
    if found.state != "open":
        raise SupportRefused("already_decided")
    if change:
        if outcome is None or criteria_version_id is None or not reason_ta:
            raise SupportRefused("new_decision_required")
        repository.insert_decision(db, case.id, outcome, criteria_version_id, reason.strip(), reason_ta.strip(),
                                   staff.member_id, replaces_id=original.id)
    repository.decide_appeal(db, appeal_id, "changed" if change else "upheld", staff.member_id, reason.strip())
    if case.applicant_member_id:
        notifications.notify(db, case.applicant_member_id, "assistance_appeal_decided", case.id)
    audit.record(db, actor_id=staff.member_id, action="assistance.appeal.decided", target_type="assistance_case",
                 target_id=str(case.id), area_path=_path(case.area_path), details={"changed": change}, ip=ip)
    db.commit()


def open_appeals(db: Session, staff: Staff) -> list[Appeal]:
    if not access_rules.holds(staff.rule_assignments(), rules.DECIDE):
        raise AccessRefused("forbidden")
    return repository.open_appeals(db, visible_areas(staff, rules.DECIDE))


# --- Programmes and statistics (D14) --------------------------------------------------------------------


def _require_programmes(staff: Staff) -> None:
    if not access_rules.holds(staff.rule_assignments(), rules.PROGRAMMES):
        raise AccessRefused("forbidden")


def create_programme(db: Session, staff: Staff, values: dict[str, Any], ip: str) -> repository.Programme:
    _require_programmes(staff)
    programme_id = repository.insert_programme(db, values, staff.member_id)
    audit.record(db, actor_id=staff.member_id, action="assistance.programme.created", target_type="assistance_programme",
                 target_id=str(programme_id), ip=ip)
    db.commit()
    found = repository.find_programme(db, programme_id)
    assert found is not None
    return found


def publish_criteria(db: Session, staff: Staff, programme_id: uuid.UUID, criteria_en: str, criteria_ta: str, ip: str) -> repository.Programme:
    """A new version; decisions keep pointing at the version they were made against."""
    _require_programmes(staff)
    if repository.find_programme(db, programme_id) is None:
        raise SupportNotFound()
    repository.publish_criteria(db, programme_id, criteria_en.strip(), criteria_ta.strip(), staff.member_id)
    audit.record(db, actor_id=staff.member_id, action="assistance.criteria.published", target_type="assistance_programme",
                 target_id=str(programme_id), ip=ip)
    db.commit()
    found = repository.find_programme(db, programme_id)
    assert found is not None
    return found


def set_programme_active(db: Session, staff: Staff, programme_id: uuid.UUID, active: bool, ip: str) -> None:
    _require_programmes(staff)
    if repository.find_programme(db, programme_id) is None:
        raise SupportNotFound()
    repository.set_programme_active(db, programme_id, active)
    audit.record(db, actor_id=staff.member_id, action="assistance.programme.active" if active else "assistance.programme.retired",
                 target_type="assistance_programme", target_id=str(programme_id), ip=ip)
    db.commit()


def add_partner(db: Session, staff: Staff, name: str, kind: str, contact: str, ip: str) -> repository.Partner:
    _require_programmes(staff)
    partner_id = repository.insert_partner(db, name.strip(), kind, contact.strip(), staff.member_id)
    audit.record(db, actor_id=staff.member_id, action="assistance.partner.added", target_type="assistance_partner",
                 target_id=str(partner_id), ip=ip)
    db.commit()
    found = repository.find_partner(db, partner_id)
    assert found is not None
    return found


def statistics(db: Session, staff: Staff) -> list[tuple[str, str, str, int | None]]:
    """FR-AST-012: counts by area, category and state; a DS division with fewer than 10 is merged into
    its district, and any figure under 10 is hidden."""
    if not any(access_rules.holds(staff.rule_assignments(), p) for p in (rules.DECIDE, rules.PROGRAMMES)):
        raise AccessRefused("forbidden")
    keys: set[str] = set()
    scope: list[str] | None = []
    for permission in (rules.DECIDE, rules.PROGRAMMES):
        areas = visible_areas(staff, permission)
        if areas is None:
            scope = None
            break
        keys.update(areas)
    if scope is not None:
        scope = sorted(keys)
    # Category and state travel together as one key through the small-number table.
    rows = [(district or "none", ds, f"{category}|{state}", count)
            for district, ds, category, state, count in repository.statistics(db, scope)]
    out = []
    for area, key, count in small_numbers.area_table(rows):
        category, state = key.split("|")
        out.append(("platform" if area == "district:none" else area, category, state, count))
    return out
