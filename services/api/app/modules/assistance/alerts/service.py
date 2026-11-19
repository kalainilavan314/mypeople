"""Alerts and safety (BRD M35, M36, D26; FR-DIS-001 to 004, 006 to 008, BR-138, OS-14).

Staff with disaster.relay copy official warnings into the app: the source, its own link and issue time,
its end time, and the District, DS or GN divisions it is for. Members in those divisions are told at
once (unless they turned emergency notices off) and see it on M35 by their home area, with the
official emergency numbers and the statement that the app is not an emergency dispatch service. An
alert past the source's end time moves to history; one nobody has checked against its source for 6
hours is flagged on D26 and raised once with the relayers. Shelters come only from authorised sources.
M36 turns an urgent request into a Community Support case, open to anyone signed in (BR-102), and
members who are Verified and Active may offer to help in relief work.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import rules as access_rules
from app.modules.access.rules import LOCAL_ZONE, PLATFORM, Area, AreaPath, area_from_key
from app.modules.access.service import AccessRefused, Staff, refuse, visible_areas
from app.modules.assistance import service as support
from app.modules.assistance.alerts import repository, rules
from app.modules.assistance.alerts.repository import Alert, Revision, Shelter
from app.modules.assistance.repository import Case
from app.modules.audit import service as audit
from app.modules.features import repository as features_repository
from app.modules.messaging.notifications import service as notifications


class SafetyRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class SafetyNotFound(Exception):
    pass


def _today(now: datetime) -> date:
    return now.astimezone(LOCAL_ZONE).date()


def _path(keys: list[str]) -> AreaPath:
    return tuple(area_from_key(k) for k in keys) or (PLATFORM,)


# --- Members (M35, M36) ------------------------------------------------------------------------------------


@dataclass(frozen=True)
class SafetyView:
    area_keys: list[str]  # the area the alerts are for: the member's home area or the one they chose
    current: list[Alert]
    shelters: list[Shelter]
    volunteer: repository.Volunteer | None
    volunteer_lock: str | None  # why the member cannot offer relief help yet, or None


def _member_area(db: Session, member_id: uuid.UUID, area_key: str | None) -> AreaPath:
    """FR-DIS-002: the member's home area, never their location; or a District, DS or GN they chose."""
    if area_key is None:
        return access_repository.member_area_path(db, member_id)
    try:
        area = area_from_key(area_key)
    except ValueError:
        raise SafetyRefused("unknown_area") from None
    if area.level not in ("district", "ds", "gn"):
        raise SafetyRefused("unknown_area")
    path = access_repository.area_path(db, area)
    if path is None:
        raise SafetyRefused("unknown_area")
    return path


def _local_keys(path: AreaPath) -> list[str]:
    """Alerts may target the district, the DS division or the GN division of the area."""
    return [a.key for a in path if a.level in ("district", "ds", "gn")]


def _shelter_keys(path: AreaPath) -> list[str]:
    """Shelters nearby: in the member's GN and DS division, or their district when that is all we know."""
    near = [a.key for a in path if a.level in ("ds", "gn")]
    return near or [a.key for a in path if a.level == "district"]


def _volunteer_lock(db: Session, member_id: uuid.UUID) -> str | None:
    status = access_repository.find_member_status(db, member_id)
    if status is None or not status.identity_verified:
        return "identity_not_verified"
    if not status.membership_active:
        return "membership_not_active"
    return None


def safety(db: Session, member_id: uuid.UUID, area_key: str | None, now: datetime) -> SafetyView:
    path = _member_area(db, member_id, area_key)
    keys = _local_keys(path)
    return SafetyView(
        area_keys=keys,
        current=repository.for_areas(db, keys, current=True, now=now),
        shelters=repository.shelters_near(db, _shelter_keys(path)) if keys else [],
        volunteer=repository.find_volunteer(db, member_id),
        volunteer_lock=_volunteer_lock(db, member_id),
    )


def history(db: Session, member_id: uuid.UUID, area_key: str | None, now: datetime) -> list[Alert]:
    """FR-DIS-008: expired and withdrawn alerts for the area, from the last 90 days."""
    keys = _local_keys(_member_area(db, member_id, area_key))
    return repository.for_areas(db, keys, current=False, now=now, since=now - timedelta(days=rules.HISTORY_DAYS))


def alert(db: Session, alert_id: uuid.UUID) -> Alert:
    """Official warnings are public: any signed-in person may open one, current or past."""
    found = repository.find(db, alert_id)
    if found is None:
        raise SafetyNotFound()
    return found


@dataclass(frozen=True)
class HelpRequest:
    need: str
    people: int
    details: str
    full_name: str
    phone: str | None
    area: Area | None
    alert_id: uuid.UUID | None
    consent: bool


def request_help(db: Session, member_id: uuid.UUID, request: HelpRequest, ip: str, *, flags_enforced: bool) -> Case:
    """M36, FR-DIS-007: the request becomes an urgent Community Support case, which the people who
    screen requests in the area are told about at once. Nobody is dispatched (OS-14); membership,
    donations and political support are never asked or checked (BR-102)."""
    if flags_enforced and not features_repository.is_enabled(db, "community_support"):
        # The case could not be followed up where the member reads it: fail closed instead.
        raise SafetyRefused("support_not_open")
    alert_ref = None
    if request.alert_id is not None:
        found = repository.find(db, request.alert_id)
        if found is None:
            raise SafetyRefused("alert_not_found")
        alert_ref = found.alert_ref
    summary = rules.help_summary(need=request.need, people=request.people, details=request.details, alert_ref=alert_ref)
    try:
        return support.request_in_app(
            db, member_id,
            support.NewRequest(category="emergency_needs", summary=summary, emergency=True, consent=request.consent,
                               full_name=request.full_name, phone=request.phone, household=None, area=request.area),
            ip,
        )
    except support.SupportRefused as error:
        raise SafetyRefused(error.problems) from None


def save_volunteer(db: Session, member_id: uuid.UUID, *, tasks: list[str], available_until: date, consent: bool, ip: str,
                   now: datetime) -> repository.Volunteer:
    """FR-DIS-004: a Verified, Active member offers relief help in their home area until a date."""
    if lock := _volunteer_lock(db, member_id):
        raise SafetyRefused(lock)
    problems = rules.check_volunteer(consent=consent, tasks=tasks, available_until=available_until, today=_today(now))
    path = access_repository.member_area_path(db, member_id)
    if path[-1].level not in ("district", "ds", "gn"):
        problems.append("home_area_required")
    if problems:
        raise SafetyRefused(problems)
    repository.save_volunteer(db, member_id, sorted(set(tasks)), available_until, path[-1].key, [a.key for a in path],
                              rules.VOLUNTEER_CONSENT_VERSION)
    audit.record(db, actor_id=member_id, action="disaster.volunteer.saved", target_type="member", target_id=str(member_id),
                 area_path=path, ip=ip)
    db.commit()
    found = repository.find_volunteer(db, member_id)
    assert found is not None
    return found


def withdraw_volunteer(db: Session, member_id: uuid.UUID, ip: str) -> None:
    if not repository.remove_volunteer(db, member_id):
        raise SafetyNotFound()
    audit.record(db, actor_id=member_id, action="disaster.volunteer.withdrawn", target_type="member", target_id=str(member_id),
                 ip=ip)
    db.commit()


# --- Relayers (D26, PRM-53) ---------------------------------------------------------------------------------


def _require(db: Session, staff: Staff, permission: str, path: AreaPath, ip: str, target: str) -> None:
    if not access_rules.holds(staff.rule_assignments(), permission, path):
        refuse(db, staff, permission, "outside_your_area", ip, target=("disaster_alert", target), area_path=path)


@dataclass(frozen=True)
class ManagedAlert:
    alert: Alert
    stale: bool


def managed(db: Session, staff: Staff, *, current: bool, now: datetime) -> list[ManagedAlert]:
    if not access_rules.holds(staff.rule_assignments(), rules.RELAY):
        raise AccessRefused("forbidden")
    found = repository.managed(db, visible_areas(staff, rules.RELAY), current=current, now=now)
    return [ManagedAlert(a, rules.is_stale(a.state, a.source_ends_at, a.refreshed_at, now)) for a in found]


@dataclass(frozen=True)
class StaffAlertView:
    alert: Alert
    stale: bool
    revisions: list[Revision]


def staff_alert(db: Session, staff: Staff, alert_id: uuid.UUID, now: datetime) -> StaffAlertView:
    """Relayers over any of the targeted areas may read it; changing it needs all of them."""
    found = repository.find(db, alert_id)
    if found is None or not any(access_rules.holds(staff.rule_assignments(), rules.RELAY, path)
                                for path in _target_paths(db, found)):
        raise SafetyNotFound()
    return StaffAlertView(found, rules.is_stale(found.state, found.source_ends_at, found.refreshed_at, now),
                          repository.revisions(db, alert_id))


def _target_paths(db: Session, alert: Alert) -> list[AreaPath]:
    paths = [access_repository.area_path(db, area_from_key(key)) for key in alert.target_keys]
    return [path for path in paths if path is not None]


def _common(paths: list[AreaPath]) -> AreaPath:
    """The deepest area above every one of these, for the audit log's area."""
    shared: list[Area] = []
    for areas in zip(*paths, strict=False):
        if any(area != areas[0] for area in areas):
            break
        shared.append(areas[0])
    return tuple(shared) or (PLATFORM,)


def _require_all(db: Session, staff: Staff, alert: Alert, ip: str) -> AreaPath:
    """Changing an alert needs the permission over every area it targets. Returns the audit area."""
    paths = _target_paths(db, alert)
    for path in paths:
        _require(db, staff, rules.RELAY, path, ip, str(alert.id))
    return _common(paths)


def _targets_in_scope(db: Session, staff: Staff, targets: list[Area], ip: str) -> list[AreaPath]:
    if problems := rules.check_targets([t.level for t in targets]):
        raise SafetyRefused(problems)
    paths = []
    for target in targets:
        path = access_repository.area_path(db, target)
        if path is None:
            raise SafetyRefused("unknown_area")
        _require(db, staff, rules.RELAY, path, ip, "new")
        paths.append(path)
    return paths


def relay(db: Session, staff: Staff, values: dict[str, Any], targets: list[Area], ip: str, now: datetime) -> Alert:
    """FR-DIS-001, 002: relay an official warning to the members of the targeted areas."""
    problems = rules.check_alert(source_key=values["source_key"], source_url=values["source_url"],
                                 issued_at=values["source_issued_at"], ends_at=values["source_ends_at"], now=now)
    if problems:
        raise SafetyRefused(problems)
    paths = _targets_in_scope(db, staff, targets, ip)
    target_keys = sorted({path[-1].key for path in paths})
    scope_keys = sorted({area.key for path in paths for area in path})
    alert_id = repository.insert(db, {**values, "source_url": values["source_url"].strip()}, target_keys, scope_keys,
                                 staff.member_id)
    created = repository.find(db, alert_id)
    assert created is not None
    repository.add_revision(db, created, "relayed", staff.member_id, None)
    reached = notifications.notify_home_areas(db, target_keys, "disaster_alert", alert_id)
    repository.update(db, alert_id, {"recipients": reached})
    # Ids, the source and the areas only: the text is public anyway, and is in the revision.
    audit.record(db, actor_id=staff.member_id, action="disaster.alert.relayed", target_type="disaster_alert",
                 target_id=str(alert_id), area_path=_common(paths),
                 details={"source": values["source_key"], "targets": target_keys, "recipients": reached}, ip=ip)
    db.commit()
    found = repository.find(db, alert_id)
    assert found is not None
    return found


def refresh(db: Session, staff: Staff, alert_id: uuid.UUID, values: dict[str, Any], note: str | None, ip: str,
            now: datetime) -> Alert:
    """FR-DIS-008: someone checked the source again: the alert takes the source's latest text, link,
    issue time and end time, and is no longer stale. A raised severity tells the members again."""
    found = repository.find(db, alert_id, lock=True)
    if found is None:
        raise SafetyNotFound()
    area = _require_all(db, staff, found, ip)
    if not rules.is_current(found.state, found.source_ends_at, now):
        raise SafetyRefused("alert_not_current")
    problems = rules.check_alert(source_key=found.source_key, source_url=values["source_url"],
                                 issued_at=values["source_issued_at"], ends_at=values["source_ends_at"], now=now)
    if values["source_issued_at"] < found.source_issued_at:
        problems.append("issued_before_current")
    if problems:
        raise SafetyRefused(problems)
    raised = rules.severity_raised(found.severity, values["severity"])
    repository.update(db, alert_id, {**{name: values[name] for name in repository.ALERT_TEXT},
                                     "refreshed_by": staff.member_id, "refreshed_at": now, "stale_alerted_at": None})
    updated = repository.find(db, alert_id)
    assert updated is not None
    repository.add_revision(db, updated, "refreshed", staff.member_id, note.strip() if note else None)
    if raised:
        reached = notifications.notify_home_areas(db, found.target_keys, "disaster_alert_raised", alert_id)
        repository.update(db, alert_id, {"recipients": found.recipients + reached})
    notifications.complete_action(db, "disaster_alert_staff", alert_id)
    audit.record(db, actor_id=staff.member_id, action="disaster.alert.refreshed", target_type="disaster_alert",
                 target_id=str(alert_id), area_path=area, details={"severityRaised": raised}, ip=ip)
    db.commit()
    result = repository.find(db, alert_id)
    assert result is not None
    return result


def withdraw(db: Session, staff: Staff, alert_id: uuid.UUID, reason: str, ip: str, now: datetime) -> Alert:
    """The source cancelled the warning, or it was relayed by mistake: it moves to history with the reason."""
    found = repository.find(db, alert_id, lock=True)
    if found is None:
        raise SafetyNotFound()
    area = _require_all(db, staff, found, ip)
    if not rules.is_current(found.state, found.source_ends_at, now):
        raise SafetyRefused("alert_not_current")
    if len(reason.strip()) < 5:
        raise SafetyRefused("reason_required")
    repository.update(db, alert_id, {"state": "withdrawn", "withdrawn_reason": reason.strip()})
    repository.add_revision(db, found, "withdrawn", staff.member_id, reason.strip())
    notifications.complete_action(db, "disaster_alert_staff", alert_id)
    audit.record(db, actor_id=staff.member_id, action="disaster.alert.withdrawn", target_type="disaster_alert",
                 target_id=str(alert_id), area_path=area, ip=ip)
    db.commit()
    result = repository.find(db, alert_id)
    assert result is not None
    return result


# --- Shelters (FR-DIS-006) ----------------------------------------------------------------------------------


def managed_shelters(db: Session, staff: Staff) -> list[Shelter]:
    if not access_rules.holds(staff.rule_assignments(), rules.RELAY):
        raise AccessRefused("forbidden")
    return repository.managed_shelters(db, visible_areas(staff, rules.RELAY))


def _check_shelter(values: dict[str, Any], now: datetime) -> None:
    problems = rules.check_shelter(source_key=values["source_key"], source_url=values.get("source_url"),
                                   reported_at=values["source_reported_at"], now=now)
    if problems:
        raise SafetyRefused(problems)


def add_shelter(db: Session, staff: Staff, values: dict[str, Any], area: Area, ip: str, now: datetime) -> Shelter:
    _check_shelter(values, now)
    if area.level not in ("ds", "gn"):
        raise SafetyRefused("shelter_area_level")
    path = access_repository.area_path(db, area)
    if path is None:
        raise SafetyRefused("unknown_area")
    if not access_rules.holds(staff.rule_assignments(), rules.RELAY, path):
        refuse(db, staff, rules.RELAY, "outside_your_area", ip, target=("disaster_shelter", "new"), area_path=path)
    shelter_id = repository.insert_shelter(db, values, path[-1].key, [a.key for a in path], staff.member_id)
    audit.record(db, actor_id=staff.member_id, action="disaster.shelter.added", target_type="disaster_shelter",
                 target_id=str(shelter_id), area_path=path, details={"source": values["source_key"]}, ip=ip)
    db.commit()
    found = repository.find_shelter(db, shelter_id)
    assert found is not None
    return found


def update_shelter(db: Session, staff: Staff, shelter_id: uuid.UUID, values: dict[str, Any], ip: str, now: datetime) -> Shelter:
    """A new report from the source: status, capacity and the time it reported."""
    found = repository.find_shelter(db, shelter_id, lock=True)
    if found is None:
        raise SafetyNotFound()
    path = _path(found.area_path)
    if not access_rules.holds(staff.rule_assignments(), rules.RELAY, path):
        refuse(db, staff, rules.RELAY, "outside_your_area", ip, target=("disaster_shelter", str(shelter_id)), area_path=path)
    _check_shelter(values, now)
    repository.update_shelter(db, shelter_id, values, staff.member_id)
    audit.record(db, actor_id=staff.member_id, action="disaster.shelter.updated", target_type="disaster_shelter",
                 target_id=str(shelter_id), area_path=path, details={"status": values["status"]}, ip=ip)
    db.commit()
    result = repository.find_shelter(db, shelter_id)
    assert result is not None
    return result


# --- Relief coordinators (D26, PRM-54) ----------------------------------------------------------------------


def relief_volunteers(db: Session, staff: Staff, now: datetime) -> list[repository.ListedVolunteer]:
    """FR-DIS-004: who offered relief help in the coordinator's areas, still available today."""
    if not access_rules.holds(staff.rule_assignments(), rules.LOGISTICS):
        raise AccessRefused("forbidden")
    return repository.available_volunteers(db, visible_areas(staff, rules.LOGISTICS), _today(now))


# --- Run by the tasks ----------------------------------------------------------------------------------------


def flag_stale(db: Session, now: datetime) -> int:
    """FR-DIS-008: run by the notifications task. A current alert nobody has checked for 6 hours is raised
    once with the relayers over its areas; checking it again clears the flag."""
    count = 0
    for stale in repository.newly_stale(db, now - rules.STALE_AFTER, now):
        for holder in repository.holders(db, rules.RELAY, stale.scope_keys):
            notifications.notify(db, holder, "disaster_alert_stale", stale.id)
        repository.update(db, stale.id, {"stale_alerted_at": now})
        audit.record(db, actor_id=None, action="disaster.alert.stale", target_type="disaster_alert", target_id=str(stale.id))
        count += 1
    db.commit()
    return count


def purge(db: Session, now: datetime | None = None) -> int:
    """ENT-54: alerts are deleted 2 years after the source's end time."""
    removed = repository.purge_before(db, (now or datetime.now(UTC)) - rules.KEEP_ALERTS)
    db.commit()
    return removed
