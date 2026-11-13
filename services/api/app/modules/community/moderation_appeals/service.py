"""One appeal against a moderation decision (D12, BR-032, BR-044).

The author of a rejected idea or of rejected added information may appeal once. A moderator over the
item's area who did not make the first decision, and is not the author, decides it: uphold the
rejection, or change it, which publishes the idea or approves the added information. The author is
told the outcome and the reason. Ideas sit behind the ideas_surveys switch and added information
behind community_issues, so each kind of appeal is open only while its module is.
"""

import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.modules.access import rules as access_rules
from app.modules.access.rules import PLATFORM, AreaPath, area_from_key
from app.modules.access.service import Staff, refuse, visible_areas
from app.modules.audit import service as audit
from app.modules.community.issues import repository as issues
from app.modules.community.moderation_appeals import repository
from app.modules.community.moderation_appeals.repository import ListedAppeal, ModeratedItem, StoredAppeal
from app.modules.features import repository as features
from app.modules.messaging.notifications import service as notifications

MODERATE = "content.moderate"
FEATURE_FOR_KIND = {"idea": "ideas_surveys", "addition": "community_issues"}
DECIDED_NOTICE = {"idea": "idea_appeal_decided", "addition": "addition_appeal_decided"}


class FeatureUnavailable(Exception):
    """The item's module is switched off: answered as 404 feature_unavailable, like require_feature."""


class AppealNotFound(Exception):
    pass


class AppealRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


def _open_kinds(db: Session, enforced: bool) -> list[str]:
    return [kind for kind, key in FEATURE_FOR_KIND.items() if not enforced or features.is_enabled(db, key)]


def _require_feature(db: Session, kind: str, enforced: bool) -> None:
    if kind not in _open_kinds(db, enforced):
        raise FeatureUnavailable()


def _item(db: Session, kind: str, item_id: uuid.UUID, *, lock: bool = False) -> ModeratedItem | None:
    if kind == "idea":
        return repository.find_idea(db, item_id, lock=lock)
    return repository.find_addition(db, item_id, lock=lock)


def _path(area_path: list[str]) -> AreaPath:
    return tuple(area_from_key(key) for key in area_path) or (PLATFORM,)


# --- The author -----------------------------------------------------------------------------------------


def appeal(
    db: Session, member_id: uuid.UUID, kind: str, item_id: uuid.UUID, body: str, ip: str, *, enforced: bool
) -> StoredAppeal:
    """Only the author of a rejected item, once per decision."""
    _require_feature(db, kind, enforced)
    if len(body.strip()) < 10:
        raise AppealRefused("appeal_too_short")
    item = _item(db, kind, item_id, lock=True)
    if item is None or item.author_id != member_id:
        raise AppealNotFound()  # someone else's item is indistinguishable from a missing one
    if item.state != "rejected" or item.moderated_by is None:
        raise AppealRefused("not_rejected")
    appeal_id = repository.insert(
        db, item_kind=kind, item_id=item.id, member_id=member_id, body=body.strip(),
        original_moderator=item.moderated_by, area_path=item.area_path,
    )
    if appeal_id is None:
        raise AppealRefused("already_appealed")
    audit.record(
        db, actor_id=member_id, action="moderation_appeal.submitted", target_type="moderation_appeal",
        target_id=str(appeal_id), area_path=_path(item.area_path), details={"itemKind": kind, "itemId": str(item.id)}, ip=ip,
    )
    db.commit()
    found = repository.find(db, appeal_id)
    assert found is not None
    return found


def mine(db: Session, member_id: uuid.UUID, kind: str, item_id: uuid.UUID, *, enforced: bool) -> StoredAppeal | None:
    """The member's appeal on their own item, if they made one."""
    _require_feature(db, kind, enforced)
    found = repository.for_item(db, kind, item_id)
    return found if found is not None and found.member_id == member_id else None


def mine_for_items(db: Session, member_id: uuid.UUID, kind: str, item_ids: list[uuid.UUID]) -> dict[uuid.UUID, StoredAppeal]:
    """The member's appeals on several of their own items (for views that list them)."""
    return {item: a for item, a in repository.for_items(db, kind, item_ids).items() if a.member_id == member_id}


# --- The deciding moderator -----------------------------------------------------------------------------


@dataclass(frozen=True)
class ManagedAppeal:
    listed: ListedAppeal
    can_decide: bool


def _can_decide(staff: Staff, appeal_row: StoredAppeal) -> bool:
    return (
        appeal_row.state == "open"
        and appeal_row.original_moderator != staff.member_id
        and appeal_row.member_id != staff.member_id
        and access_rules.holds(staff.rule_assignments(), MODERATE, _path(appeal_row.area_path))
    )


def manage_list(db: Session, staff: Staff, *, enforced: bool) -> list[ManagedAppeal]:
    """Appeals in the moderator's areas, open ones first, oldest first."""
    found = repository.listed(db, visible_areas(staff, MODERATE), _open_kinds(db, enforced))
    return [ManagedAppeal(listed=row, can_decide=_can_decide(staff, row.appeal)) for row in found]


def _managed(db: Session, staff: Staff, appeal_id: uuid.UUID, enforced: bool) -> ManagedAppeal:
    found = repository.listed(db, visible_areas(staff, MODERATE), _open_kinds(db, enforced), appeal_id=appeal_id)
    if not found:
        raise AppealNotFound()
    return ManagedAppeal(listed=found[0], can_decide=_can_decide(staff, found[0].appeal))


def decide(
    db: Session, staff: Staff, appeal_id: uuid.UUID, change: bool, reason: str, ip: str, *, enforced: bool
) -> ManagedAppeal:
    found = repository.find(db, appeal_id, lock=True)
    if found is None:
        raise AppealNotFound()
    _require_feature(db, found.item_kind, enforced)
    path = _path(found.area_path)
    target = ("moderation_appeal", str(found.id))
    if not access_rules.holds(staff.rule_assignments(), MODERATE, path):
        refuse(db, staff, MODERATE, "outside_your_area", ip, target=target, area_path=path)
    if found.member_id == staff.member_id:
        refuse(db, staff, MODERATE, "own_record", ip, target=target, area_path=path)
    if found.original_moderator == staff.member_id:
        # The first decision is reviewed by someone else; the table refuses it too.
        refuse(db, staff, MODERATE, "original_moderator", ip, target=target, area_path=path)
    if found.state != "open":
        raise AppealRefused("already_decided")
    if len(reason.strip()) < 3:
        raise AppealRefused("reason_required")
    item = _item(db, found.item_kind, found.item_id, lock=True)
    if item is None:
        raise AppealNotFound()
    if change:
        if found.item_kind == "idea":
            repository.publish_idea(db, item.id, staff.member_id)
        else:
            repository.approve_addition(db, item.id, staff.member_id)
            assert item.issue_id is not None
            issues.insert_action(
                db, item.issue_id, "addition_moderated", actor_id=staff.member_id, note=reason.strip(),
                details={"addition": str(item.id), "approved": True, "appeal": str(found.id)},
            )
    repository.decide(db, found.id, state="changed" if change else "upheld", reason=reason.strip(), decided_by=staff.member_id)
    notice_target = item.id if found.item_kind == "idea" else item.issue_id
    notifications.notify(db, found.member_id, DECIDED_NOTICE[found.item_kind], notice_target)
    audit.record(
        db, actor_id=staff.member_id, action="moderation_appeal.decided", target_type="moderation_appeal",
        target_id=str(found.id), area_path=path,
        details={"itemKind": found.item_kind, "itemId": str(item.id), "outcome": "changed" if change else "upheld"}, ip=ip,
    )
    db.commit()
    return _managed(db, staff, found.id, enforced)
