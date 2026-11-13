"""Community ideas (BRD H13, FR-IDEA-001 to 004, BR-044).

Short local ideas are moderated (content.moderate over the idea's area) before anyone else sees
them; a moderator may publish an edited (redacted) version, which everyone but the author sees
(D12). A member may support an idea once; support is shown as a count and never changes the idea's
status, and posting an idea never approves a project or budget.

"Local" means the member's own GN division, DS division and district: the province and platform
levels would put every idea in the Northern Province on the board (H13 "local ideas for the area").
"""

import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import rules as access_rules
from app.modules.access.rules import PLATFORM, area_from_key
from app.modules.access.service import Staff, refuse, visible_areas
from app.modules.audit import service as audit
from app.modules.community.ideas import repository
from app.modules.community.ideas.repository import Idea, IdeaAppeal
from app.modules.messaging.notifications import service as notifications

MODERATE = "content.moderate"
IDEAS_PER_DAY = 5  # [ASSUMPTION] enough for a genuine member, too few to flood the moderators
LOCAL_LEVELS = ("district", "ds", "gn")


class IdeaRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class IdeaNotFound(Exception):
    pass


@dataclass(frozen=True)
class IdeaBoard:
    local: list[Idea]
    mine: list[Idea]
    appeals: dict[uuid.UUID, IdeaAppeal]  # the author's appeals, by idea


def _local_keys(db: Session, member_id: uuid.UUID) -> list[str]:
    return [a.key for a in access_repository.member_area_path(db, member_id) if a.level in LOCAL_LEVELS]


def _is_local(idea: Idea, keys: list[str]) -> bool:
    """The board's test, used again before a member supports an idea."""
    return idea.state == "published" and any(key in idea.area_path for key in keys)


def board(db: Session, member_id: uuid.UUID) -> IdeaBoard:
    """FR-IDEA-001: published ideas in the member's area, and their own ideas in every state."""
    mine = repository.by_author(db, member_id)
    return IdeaBoard(
        local=repository.published_in(db, _local_keys(db, member_id), member_id),
        mine=mine,
        appeals=repository.appeals_for(db, [idea.id for idea in mine]),
    )


def _require_active(db: Session, member_id: uuid.UUID) -> None:
    status = access_repository.find_member_status(db, member_id)
    assert status is not None
    if not status.identity_verified:
        raise IdeaRefused("identity_not_verified")
    if not status.membership_active:
        raise IdeaRefused("membership_not_active")


def submit(db: Session, member_id: uuid.UUID, title: str, benefit: str, ip: str) -> Idea:
    _require_active(db, member_id)
    path = access_repository.member_area_path(db, member_id)
    if path == (PLATFORM,):
        raise IdeaRefused("no_area_on_profile")
    if repository.count_recent(db, member_id) >= IDEAS_PER_DAY:
        raise IdeaRefused("too_many_ideas_today")
    idea_id = repository.insert(db, member_id, title.strip(), benefit.strip(), path[-1].key, [a.key for a in path])
    audit.record(db, actor_id=member_id, action="idea.submitted", target_type="idea", target_id=str(idea_id),
                 area_path=path, ip=ip)
    db.commit()
    found = repository.find(db, idea_id, member_id)
    assert found is not None
    return found


def set_support(db: Session, member_id: uuid.UUID, idea_id: uuid.UUID, support: bool) -> Idea:
    """FR-IDEA-004: once per member; a count, never a change of status."""
    idea = repository.find(db, idea_id, member_id)
    if idea is None or not _is_local(idea, _local_keys(db, member_id)):
        raise IdeaNotFound()
    if idea.author_id == member_id:
        raise IdeaRefused("own_idea")
    _require_active(db, member_id)
    repository.set_support(db, idea_id, member_id, support)
    db.commit()
    found = repository.find(db, idea_id, member_id)
    assert found is not None
    return found


def withdraw(db: Session, member_id: uuid.UUID, idea_id: uuid.UUID, ip: str) -> Idea:
    idea = repository.find(db, idea_id, member_id)
    if idea is None or idea.author_id != member_id:
        raise IdeaNotFound()
    if idea.state != "withdrawn":
        repository.set_state(db, idea_id, "withdrawn")
        audit.record(db, actor_id=member_id, action="idea.withdrawn", target_type="idea", target_id=str(idea_id), ip=ip)
        db.commit()
    found = repository.find(db, idea_id, member_id)
    assert found is not None
    return found


# --- Moderation (D12) ----------------------------------------------------------------------------------


def pending(db: Session, staff: Staff, limit: int = 100) -> list[Idea]:
    return repository.pending(db, visible_areas(staff, MODERATE), staff.member_id, limit)


@dataclass(frozen=True)
class Edits:
    """A moderator's edited (redacted) title and benefit; None keeps the author's text."""

    title: str | None = None
    benefit: str | None = None


def _edited(original: str, edited: str | None, low: int, high: int, problem: str) -> str | None:
    """The edited text to publish, or None when it is missing or the same as the author's."""
    cleaned = edited.strip() if edited else ""
    if not cleaned or cleaned == original:
        return None
    if not low <= len(cleaned) <= high:
        raise IdeaRefused(problem)
    return cleaned


def moderate(db: Session, staff: Staff, idea_id: uuid.UUID, publish: bool, reason: str | None, ip: str,
             edits: Edits | None = None) -> Idea:
    """D12: approve (as written or edited), or reject with a reason. The author keeps their original."""
    idea = repository.find(db, idea_id, staff.member_id)
    if idea is None:
        raise IdeaNotFound()
    path = tuple(area_from_key(key) for key in idea.area_path)
    if not access_rules.holds(staff.rule_assignments(), MODERATE, path):
        refuse(db, staff, MODERATE, "outside_your_area", ip, target=("idea", str(idea_id)), area_path=path)
    if idea.author_id == staff.member_id:
        refuse(db, staff, MODERATE, "own_record", ip, target=("idea", str(idea_id)), area_path=path)
    if idea.state != "pending":
        raise IdeaRefused("already_moderated")
    if not publish and not (reason and reason.strip()):
        raise IdeaRefused("reason_required")
    edits = edits or Edits()
    if not publish and (edits.title or edits.benefit):
        raise IdeaRefused("edits_only_when_publishing")
    published_title = _edited(idea.title, edits.title, 5, 80, "edited_title_length")
    published_benefit = _edited(idea.benefit, edits.benefit, 10, 1000, "edited_benefit_length")
    redacted = published_title is not None or published_benefit is not None
    repository.set_state(db, idea_id, "published" if publish else "rejected", moderator=staff.member_id,
                         reason=reason.strip() if reason else None, published_title=published_title,
                         published_benefit=published_benefit)
    notifications.notify(db, idea.author_id, "idea_published" if publish else "idea_rejected", idea_id)
    audit.record(db, actor_id=staff.member_id, action="idea.published" if publish else "idea.rejected",
                 target_type="idea", target_id=str(idea_id), area_path=path,
                 details={"redacted": True} if redacted else None, ip=ip)
    db.commit()
    found = repository.find(db, idea_id, staff.member_id)
    assert found is not None
    return found
