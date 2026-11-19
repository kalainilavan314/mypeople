"""The assistant's knowledge base (BRD D20, ENT-62, FR-AIA-003, 15B.6, PRM-47).

Knowledge Editors draft sources; a second Knowledge Editor approves each version, which makes its
passages searchable and supersedes the version before. Drafts can be edited until approved and
are returned with a reason when not. An approved source past its review date drops out of the
search until someone reviews it again. ai.kb.manage is platform-wide whatever the tier, so there
is no area to check (BRD §9.7).
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.modules.access import rules as access_rules
from app.modules.access.rules import PLATFORM
from app.modules.access.service import Staff, refuse
from app.modules.ai.knowledge import repository, rules
from app.modules.ai.knowledge.repository import Hit, Source, SourceCounts
from app.modules.audit import service as audit


class SourceRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class SourceNotFound(Exception):
    pass


def _today() -> date:
    return datetime.now(UTC).date()


def _require(db: Session, staff: Staff, ip: str, target: str) -> None:
    if not access_rules.holds(staff.rule_assignments(), rules.MANAGE):
        refuse(db, staff, rules.MANAGE, "forbidden", ip, target=("kb_source", target), area_path=(PLATFORM,))


def _found(db: Session, source_id: uuid.UUID, *, lock: bool = False) -> Source:
    source = repository.find(db, source_id, lock=lock)
    if source is None:
        raise SourceNotFound()
    return source


def _audit(db: Session, staff: Staff, action: str, source: Source | uuid.UUID, ip: str, **details: object) -> None:
    source_id = source if isinstance(source, uuid.UUID) else source.id
    audit.record(db, actor_id=staff.member_id, action=action, target_type="kb_source", target_id=str(source_id),
                 area_path=(PLATFORM,), details=dict(details) or None, ip=ip)


def _clean(values: dict[str, Any]) -> dict[str, Any]:
    cleaned = {k: (v.strip() if isinstance(v, str) else v) for k, v in values.items()}
    for name in ("body_ta", "body_en", "source_url", "change_note"):
        if cleaned.get(name) == "":
            cleaned[name] = None
    return cleaned


@dataclass(frozen=True)
class SourceFile:
    source: Source
    versions: list[Source]


def sources(db: Session, staff: Staff, state: str | None, kind: str | None) -> list[Source]:
    """Drafts, approved and retired sources (superseded versions are in each source's history)."""
    states = [state] if state else ["draft", "approved", "retired"]
    return repository.search_sources(db, states=states, kind=kind)


def source_file(db: Session, staff: Staff, source_id: uuid.UUID) -> SourceFile:
    source = _found(db, source_id)
    return SourceFile(source, repository.family(db, source.family_id))


def draft(db: Session, staff: Staff, values: dict[str, Any], ip: str) -> Source:
    _require(db, staff, ip, "new")
    values = _clean(values)
    problems = rules.check_source(body_ta=values.get("body_ta"), body_en=values.get("body_en"),
                                  review_due=values["review_due"], today=_today())
    if problems:
        raise SourceRefused(problems)
    source_id = repository.insert(db, values, family_id=None, version=1, drafted_by=staff.member_id)
    _audit(db, staff, "kb.source.drafted", source_id, ip)
    db.commit()
    return _found(db, source_id)


def edit_draft(db: Session, staff: Staff, source_id: uuid.UUID, values: dict[str, Any], ip: str) -> Source:
    _require(db, staff, ip, str(source_id))
    source = _found(db, source_id, lock=True)
    if source.state != "draft":
        raise SourceRefused(f"not_allowed_from:{source.state}")
    values = _clean(values)
    problems = rules.check_source(body_ta=values.get("body_ta"), body_en=values.get("body_en"),
                                  review_due=values["review_due"], today=_today())
    if problems:
        raise SourceRefused(problems)
    repository.update(db, source_id, {**{k: values.get(k) for k in repository.FIELDS}, "return_reason": None})
    _audit(db, staff, "kb.source.draft_edited", source, ip)
    db.commit()
    return _found(db, source_id)


def new_version(db: Session, staff: Staff, source_id: uuid.UUID, ip: str) -> Source:
    """A draft of the next version, starting from the approved text; the approved one stays in use."""
    _require(db, staff, ip, str(source_id))
    source = _found(db, source_id, lock=True)
    if source.state != "approved":
        raise SourceRefused(f"not_allowed_from:{source.state}")
    if repository.has_draft(db, source.family_id):
        raise SourceRefused("draft_exists")
    values = {name: getattr(source, name) for name in repository.FIELDS}
    values["change_note"] = None  # the editor says what changed in this version
    draft_id = repository.insert(db, values, family_id=source.family_id, version=repository.next_version(db, source.family_id),
                                 drafted_by=staff.member_id)
    _audit(db, staff, "kb.source.version_drafted", draft_id, ip, familyId=str(source.family_id))
    db.commit()
    return _found(db, draft_id)


def _passage_rows(source: Source) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for language, body, title in (("ta", source.body_ta, source.title_ta), ("en", source.body_en, source.title_en)):
        if not body:
            continue
        title_terms = rules.terms(title)
        for position, passage in enumerate(rules.passages(body)):
            rows.append({"language": language, "position": position, "body": passage, "terms": rules.terms(passage),
                         "title_terms": title_terms})
    return rows


def decide(db: Session, staff: Staff, source_id: uuid.UUID, approve: bool, reason: str | None, ip: str) -> Source:
    """A second Knowledge Editor approves (the drafter cannot), or returns the draft with a reason."""
    _require(db, staff, ip, str(source_id))
    source = _found(db, source_id, lock=True)
    if source.state != "draft":
        raise SourceRefused(f"not_allowed_from:{source.state}")
    if not rules.is_second_person(source.drafted_by, staff.member_id):
        refuse(db, staff, rules.MANAGE, "own_draft", ip, target=("kb_source", str(source_id)), area_path=(PLATFORM,))
    if approve:
        if rules.review_overdue(source.review_due, _today()) or source.review_due == _today():
            raise SourceRefused("review_date_must_be_ahead")
        repository.supersede_approved(db, source.family_id)
        repository.update(db, source_id, {"state": "approved", "approved_by": staff.member_id,
                                          "approved_at": datetime.now(UTC), "return_reason": None})
        repository.replace_passages(db, source_id, _passage_rows(source))
        _audit(db, staff, "kb.source.approved", source, ip, version=source.version)
    else:
        if not (reason and len(reason.strip()) >= 3):
            raise SourceRefused("reason_required")
        repository.update(db, source_id, {"return_reason": reason.strip()})
        _audit(db, staff, "kb.source.returned", source, ip)
    db.commit()
    return _found(db, source_id)


def mark_reviewed(db: Session, staff: Staff, source_id: uuid.UUID, review_due: date, ip: str) -> Source:
    """The periodic review: the text still stands, with the next review date. Any Knowledge Editor."""
    _require(db, staff, ip, str(source_id))
    source = _found(db, source_id, lock=True)
    if source.state != "approved":
        raise SourceRefused(f"not_allowed_from:{source.state}")
    problems = rules.check_review(review_due, _today())
    if problems:
        raise SourceRefused(problems)
    repository.update(db, source_id, {"review_due": review_due, "reviewed_by": staff.member_id,
                                      "reviewed_at": datetime.now(UTC)})
    _audit(db, staff, "kb.source.reviewed", source, ip)
    db.commit()
    return _found(db, source_id)


def retire(db: Session, staff: Staff, source_id: uuid.UUID, reason: str, ip: str) -> Source:
    """An approved source stops being used at once; a draft is set aside. Nothing is deleted."""
    _require(db, staff, ip, str(source_id))
    source = _found(db, source_id, lock=True)
    if source.state not in ("draft", "approved"):
        raise SourceRefused(f"not_allowed_from:{source.state}")
    repository.update(db, source_id, {"state": "retired", "retired_by": staff.member_id, "retired_at": datetime.now(UTC),
                                      "retire_reason": reason.strip()})
    repository.delete_passages(db, source_id)
    _audit(db, staff, "kb.source.retired", source, ip, was=source.state)
    db.commit()
    return _found(db, source_id)


def counts(db: Session) -> SourceCounts:
    return repository.counts(db, _today())


# --- For the assistant ---------------------------------------------------------------------------------


def search(db: Session, question_terms: list[str], *, excluded_kinds: list[str], limit: int) -> list[Hit]:
    return repository.search(db, question_terms, excluded_kinds=excluded_kinds, today=_today(), limit=limit)
