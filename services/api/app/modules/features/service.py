"""Recording phase gates and switching v1.1 modules on and off (BRD FR-ARCH-011, D34, PRM-26).

Every change is kept in ops.feature_flag_change with its reason and in the
audit log. A module can be turned off at any time; it can be turned on only
after its phase gate and approval are recorded.
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.modules.access.rules import PLATFORM
from app.modules.access.service import Staff
from app.modules.audit import service as audit
from app.modules.features import repository, rules
from app.modules.features.repository import StoredFlag
from app.modules.features.rules import FEATURES, Feature


class UnknownFeature(Exception):
    pass


class FlagRefused(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class FlagView:
    feature: Feature
    stored: StoredFlag | None

    @property
    def enabled(self) -> bool:
        return bool(self.stored and self.stored.enabled)


def registry(db: Session) -> list[FlagView]:
    stored = repository.flags(db)
    return [FlagView(feature, stored.get(key)) for key, feature in FEATURES.items()]


def enabled_keys(db: Session, enforced: bool) -> list[str]:
    """What the apps may show. Without enforcement (outside production) every module is on."""
    if not enforced:
        return list(FEATURES)
    return [view.feature.key for view in registry(db) if view.enabled]


def _feature(key: str) -> Feature:
    feature = FEATURES.get(key)
    if feature is None:
        raise UnknownFeature()
    return feature


def _change(db: Session, staff: Staff, key: str, action: str, gate: str | None, reason: str, ip: str) -> None:
    repository.add_change(db, key, action, gate, reason, staff.member_id)
    # The reason stays in the flag history; the audit entry holds codes only.
    audit.record(
        db, actor_id=staff.member_id, action=f"features.{action}", target_type="feature_flag", target_id=key,
        area_path=(PLATFORM,), details={"key": key, "gate": gate}, ip=ip,
    )


def record_gate(db: Session, staff: Staff, key: str, gate: str, approval_ref: str, reason: str, ip: str) -> FlagView:
    feature = _feature(key)
    problem = rules.check_gate(feature, gate)
    if problem:
        raise FlagRefused(problem)
    repository.lock(db, key)
    repository.record_gate(db, key, gate, approval_ref, staff.member_id)
    _change(db, staff, key, "gate_recorded", gate, reason, ip)
    db.commit()
    return FlagView(feature, repository.flags(db)[key])


def set_enabled(db: Session, staff: Staff, key: str, enabled: bool, reason: str, ip: str) -> FlagView:
    feature = _feature(key)
    flag = repository.lock(db, key)
    if enabled:
        problem = rules.check_enable(flag.gate is not None)
        if problem:
            db.commit()
            raise FlagRefused(problem)
    repository.set_enabled(db, key, enabled, staff.member_id)
    _change(db, staff, key, "enabled" if enabled else "disabled", flag.gate, reason, ip)
    db.commit()
    return FlagView(feature, repository.flags(db)[key])
