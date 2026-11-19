"""Relief logistics (BRD S16, D26; FR-DIS-005, BR-102): supplies received into a store and relief handed out.

A Relief Logistics Officer (relief.logistics, Tier 2B for a DS division or 3B for a district) records
stock received and what was handed out, from a store in their area to places inside it. A recipient
is a Community Support case, given by its AS- reference, or a group at a site with how many
households: never a name. A case outside the officer's area reads as not found, so the reference
cannot be used to learn about other areas' cases. Nothing about membership, donations or political
support is read or stored (FR-DIS-005), and the records cannot be changed afterwards.
"""

import re
import uuid
from dataclasses import dataclass
from datetime import date, datetime

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import rules as access_rules
from app.modules.access.rules import LOCAL_ZONE, Area, AreaPath, area_from_key
from app.modules.access.service import AccessRefused, Staff, refuse, visible_areas
from app.modules.assistance import repository as support_repository
from app.modules.assistance.alerts import repository as alerts_repository
from app.modules.assistance.relief import repository, rules
from app.modules.assistance.relief.repository import Distribution, StockLine, Supply
from app.modules.audit import service as audit


class ReliefRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class ReliefNotFound(Exception):
    pass


def _today(now: datetime) -> date:
    return now.astimezone(LOCAL_ZONE).date()


def _require_any(staff: Staff) -> None:
    if not access_rules.holds(staff.rule_assignments(), rules.PERMISSION):
        raise AccessRefused("forbidden")


def _area(db: Session, area: Area) -> AreaPath:
    path = access_repository.area_path(db, area)
    if path is None:
        raise ReliefRefused("unknown_area")
    return path


def _in_scope(db: Session, staff: Staff, path: AreaPath, ip: str, target: str) -> None:
    if not access_rules.holds(staff.rule_assignments(), rules.PERMISSION, path):
        refuse(db, staff, rules.PERMISSION, "outside_your_area", ip, target=("relief", target), area_path=path)


def _check_alert(db: Session, alert_id: uuid.UUID | None) -> None:
    if alert_id is not None and alerts_repository.find(db, alert_id) is None:
        raise ReliefRefused("alert_not_found")


def stock(db: Session, staff: Staff) -> list[StockLine]:
    _require_any(staff)
    return repository.stock(db, visible_areas(staff, rules.PERMISSION))


def supplies(db: Session, staff: Staff) -> list[Supply]:
    _require_any(staff)
    return repository.supplies(db, visible_areas(staff, rules.PERMISSION))


def record_supply(db: Session, staff: Staff, *, store: Area, item: str, quantity: int, supplier: str, received_on: date,
                  alert_id: uuid.UUID | None, ip: str, now: datetime) -> Supply:
    """D26: stock received into a District or DS store."""
    problems = rules.check_store(store.level) + rules.check_dates(received_on, _today(now))
    if problems:
        raise ReliefRefused(problems)
    path = _area(db, store)
    _in_scope(db, staff, path, ip, "new_supply")
    _check_alert(db, alert_id)
    supply_id = repository.insert_supply(db, store_key=path[-1].key, store_path=[a.key for a in path], item=item,
                                         quantity=quantity, supplier=supplier.strip(), received_on=received_on,
                                         alert_id=alert_id, by=staff.member_id)
    audit.record(db, actor_id=staff.member_id, action="relief.supply.recorded", target_type="relief_supply",
                 target_id=str(supply_id), area_path=path, details={"item": item, "quantity": quantity}, ip=ip)
    db.commit()
    return next(s for s in repository.supplies(db, [path[-1].key], limit=20) if s.id == supply_id)


@dataclass(frozen=True)
class Recipient:
    kind: str  # case or group
    case_ref: str | None
    group_site: str | None
    households: int | None


def _case_id(db: Session, staff: Staff, case_ref: str | None) -> uuid.UUID | None:
    """The case behind an AS- reference, only when it is open and in the officer's area; otherwise None."""
    if not case_ref or not re.fullmatch(rules.CASE_REF, case_ref.strip().upper()):
        return None
    found = support_repository.find_case_reference(db, case_ref)
    if found is None or not found.open:
        return None
    path = tuple(area_from_key(k) for k in found.area_path)
    return found.id if access_rules.holds(staff.rule_assignments(), rules.PERMISSION, path) else None


def record_distribution(db: Session, staff: Staff, *, store_key: str, area: Area, item: str, quantity: int,
                        recipient: Recipient, evidence: str, delivered_on: date, alert_id: uuid.UUID | None, ip: str,
                        now: datetime) -> Distribution:
    """S16: relief handed out from a store, with a quantity check against what the store holds."""
    try:
        store = area_from_key(store_key)
    except ValueError:
        raise ReliefRefused("unknown_area") from None
    problems = rules.check_store(store.level) + rules.check_dates(delivered_on, _today(now))
    if problems:
        raise ReliefRefused(problems)
    store_path = _area(db, store)
    delivered_path = _area(db, area)
    _in_scope(db, staff, store_path, ip, "new_distribution")
    _in_scope(db, staff, delivered_path, ip, "new_distribution")
    case_id = _case_id(db, staff, recipient.case_ref) if recipient.kind == "case" else None
    problems = rules.check_delivery(store_key=store_path[-1].key, delivered_path_keys=[a.key for a in delivered_path],
                                    delivered_level=area.level)
    problems += rules.check_recipient(kind=recipient.kind, case_found=case_id is not None, group_site=recipient.group_site,
                                      households=recipient.households)
    if problems:
        raise ReliefRefused(problems)
    _check_alert(db, alert_id)
    repository.lock_store_item(db, store_path[-1].key, item)
    if problems := rules.check_quantity(quantity, repository.balance(db, store_path[-1].key, item)):
        raise ReliefRefused(problems)
    distribution_id = repository.insert_distribution(db, {
        "store_key": store_path[-1].key, "store_path": [a.key for a in store_path], "area_key": delivered_path[-1].key,
        "area_path": [a.key for a in delivered_path], "item": item, "quantity": quantity, "recipient_kind": recipient.kind,
        "case_id": case_id, "group_site": recipient.group_site.strip() if recipient.kind == "group" and recipient.group_site else None,
        "households": recipient.households if recipient.kind == "group" else None, "evidence": evidence.strip(),
        "delivered_on": delivered_on, "alert_id": alert_id,
    }, staff.member_id)
    # Ids, the item and the count only: never the recipient (FR-DIS-005).
    audit.record(db, actor_id=staff.member_id, action="relief.distribution.recorded", target_type="relief_distribution",
                 target_id=str(distribution_id), area_path=delivered_path,
                 details={"item": item, "quantity": quantity, "recipient": recipient.kind}, ip=ip)
    db.commit()
    found = repository.find_distribution(db, distribution_id)
    assert found is not None
    return found


def distributions(db: Session, staff: Staff) -> list[Distribution]:
    _require_any(staff)
    return repository.distributions(db, visible_areas(staff, rules.PERMISSION))


def case_refs(db: Session, items: list[Distribution]) -> dict[uuid.UUID, str]:
    """The AS- references of the cases these distributions went to, for the officer who may see them."""
    return support_repository.case_refs(db, [d.case_id for d in items if d.case_id])
