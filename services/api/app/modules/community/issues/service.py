"""The member side of community issues: My Area, reporting, following, adding information and
responding to a closure (BRD H05 to H09, FR-RPT-001 to 017).

A member sees their own reports in full and other people's issues only as the public summary a
moderator published (BR-032), and only in their own GN division unless they follow the issue. The
reporter's name, contact details and photos never reach another member.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access.rules import PLATFORM, AreaPath, area_from_key
from app.modules.audit import service as audit
from app.modules.community.issues import evidence, notices, repository, rules
from app.modules.community.issues.repository import StoredIssue
from app.modules.community.moderation_appeals import service as moderation_appeals
from app.modules.community.moderation_appeals.repository import StoredAppeal
from app.modules.geography import repository as geography
from app.modules.identity.documents.vault import EvidenceVault

REPORTS_PER_DAY = 10  # [ASSUMPTION] enough for a genuine member, too few to flood a GN coordinator
UNATTACHED_PHOTOS_PER_DAY = 20


class IssueRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class IssueNotFound(Exception):
    pass


# --- Reporting -----------------------------------------------------------------------------------------


@dataclass(frozen=True)
class ReportingOptions:
    allowed: bool
    reason: str | None
    has_area: bool
    gn_name_en: str | None
    gn_name_ta: str | None


def _gn_names(db: Session, gn_code: str | None) -> tuple[str | None, str | None]:
    if not gn_code:
        return None, None
    place = geography.area_names(db, {"gn": [gn_code]}).get(("gn", gn_code))
    return (place.name_en, place.name_ta) if place else (None, None)


def _member_area(db: Session, member_id: uuid.UUID) -> tuple[repository.MemberPlace, AreaPath]:
    return repository.member_place(db, member_id), access_repository.member_area_path(db, member_id)


def _may_report(db: Session, member_id: uuid.UUID) -> str | None:
    status = access_repository.find_member_status(db, member_id)
    assert status is not None
    return rules.check_may_report(identity_verified=status.identity_verified, membership_active=status.membership_active)


def reporting_options(db: Session, member_id: uuid.UUID) -> ReportingOptions:
    reason = _may_report(db, member_id)
    place, path = _member_area(db, member_id)
    name_en, name_ta = _gn_names(db, place.gn_code)
    return ReportingOptions(
        allowed=reason is None, reason=reason, has_area=path != (PLATFORM,) and place.gn_code is not None,
        gn_name_en=name_en, gn_name_ta=name_ta,
    )


@dataclass(frozen=True)
class SavedPhoto:
    id: uuid.UUID
    width: int
    height: int


def save_photo(
    db: Session, vault: EvidenceVault, member_id: uuid.UUID, data: bytes, *, purpose: str, issue_id: uuid.UUID | None = None
) -> SavedPhoto:
    """Re-encode without metadata, seal and record; attached to a report or addition when it is sent.
    Only a member who may report sends photos at all (FR-RPT-017), so nobody else fills the store."""
    reason = _may_report(db, member_id)
    if reason:
        raise IssueRefused(reason)
    since = datetime.now(UTC) - timedelta(days=1)
    if repository.count_uploads_since(db, member_id, since) >= UNATTACHED_PHOTOS_PER_DAY:
        raise IssueRefused("too_many_photos_today")
    try:
        prepared = evidence.prepare(data)
    except evidence.EvidenceRejected as error:
        raise IssueRefused(error.code) from None
    evidence_id = uuid.uuid4()
    sealed_with = vault.save(evidence_id, prepared.data)
    repository.insert_evidence(
        db, evidence_id, uploader_id=member_id, purpose=purpose, issue_id=issue_id, sealed_with=sealed_with,
        byte_size=len(prepared.data), width=prepared.width, height=prepared.height,
    )
    db.commit()
    return SavedPhoto(id=evidence_id, width=prepared.width, height=prepared.height)


@dataclass(frozen=True)
class NewReport:
    client_reference: uuid.UUID
    category: str
    title: str
    description: str
    location_kind: str
    location_text: str | None
    visibility: str
    photo_ids: list[uuid.UUID]


def submit_report(db: Session, member_id: uuid.UUID, report: NewReport, ip: str) -> StoredIssue:
    """Create the case once per draft (FR-RPT-013): a repeated submit returns the first receipt."""
    existing = repository.find_by_reference(db, member_id, report.client_reference)
    if existing is not None:
        return existing

    reason = _may_report(db, member_id)
    if reason:
        raise IssueRefused(reason)
    place, path = _member_area(db, member_id)
    problems = rules.check_report(
        description=report.description,
        location_kind=report.location_kind,
        location_text=report.location_text,
        has_gn=path != (PLATFORM,) and place.gn_code is not None,
        photos=len(report.photo_ids),
    )
    now = datetime.now(UTC)
    if repository.count_reports_since(db, member_id, now - timedelta(days=1)) >= REPORTS_PER_DAY:
        problems.append("too_many_reports_today")
    photos = repository.unattached_evidence(db, member_id, report.photo_ids, "report", now - rules.UNATTACHED_PHOTO_LIFETIME)
    if len(photos) != len(set(report.photo_ids)):
        problems.append("photo_not_found")
    if problems:
        raise IssueRefused(problems)

    gn, ds, district = _codes(path)
    issue_id = repository.insert_issue(
        db,
        reporter_id=member_id,
        client_reference=report.client_reference,
        category=report.category,
        title=report.title.strip(),
        description=report.description.strip(),
        location_kind=report.location_kind,
        location_text=report.location_text.strip() if report.location_text else None,
        district_code=district,
        ds_code=ds,
        gn_code=gn,
        area_path=[area.key for area in path],
        visibility=report.visibility,
        entered_at=now,
        due_at=rules.stage_due("gn", now),
        public_state="pending" if report.visibility == "public" else "none",
    )
    if issue_id is None:  # a parallel submit of the same draft won
        db.rollback()
        found = repository.find_by_reference(db, member_id, report.client_reference)
        assert found is not None
        return found
    repository.attach_evidence(db, photos, issue_id)
    # The GN coordinator owns a new case when there is exactly one; otherwise it waits in the
    # area's queue until one of them takes it, and every one of them is told (FR-WEB-014).
    collectors = [h for h in repository.permission_holders(db, "cases.collect", [a.key for a in path]) if h.member_id != member_id]
    owner = collectors[0].member_id if len(collectors) == 1 else None
    if owner is not None:
        repository.update_issue(db, issue_id, owner_id=owner)
    repository.insert_action(
        db, issue_id, "submitted", actor_id=member_id, to_stage="gn", new_owner_id=owner, details={"photos": len(photos)}
    )
    if owner is not None:
        notices.assigned(db, issue_id, None, owner)
    else:
        notices.waiting(db, issue_id, [h.member_id for h in collectors])
    repository.follow(db, issue_id, member_id)
    issue = repository.find_issue(db, issue_id)
    assert issue is not None
    audit.record(
        db, actor_id=member_id, action="issue.reported", target_type="issue", target_id=str(issue_id),
        area_path=path, details={"category": report.category, "visibility": report.visibility, "photos": len(photos)}, ip=ip,
    )
    db.commit()
    return issue


def _codes(path: AreaPath) -> tuple[str | None, str | None, str | None]:
    by_level = {area.level: area.code for area in path}
    return by_level.get("gn"), by_level.get("ds"), by_level.get("district")


# --- Reading -------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class IssueView:
    issue: StoredIssue
    view_stage: str  # the parent's stage for a linked report
    steps: list[tuple[int, datetime | None]]
    mine: bool
    following: bool
    can_follow: bool
    can_add_information: bool
    community_updates: list[repository.StoredAddition]
    returned_question: str | None
    report_photos: int
    response: repository.StoredClosureResponse | None
    next_step: str | None
    challenge_until: datetime | None
    my_additions: list[repository.StoredAddition]  # what this member added, in every state
    addition_appeals: dict[uuid.UUID, StoredAppeal]  # their appeals against a rejection, open or decided (D12)


def _steps(db: Session, issue: StoredIssue, view_stage: str) -> list[tuple[int, datetime | None]]:
    source = issue.parent_id if issue.stage == "linked" and issue.parent_id else issue.id
    entries = repository.stage_entries(db, source)
    current = rules.MEMBER_STAGE.get(view_stage, 1)
    steps: list[tuple[int, datetime | None]] = [(1, issue.created_at)]
    for stage in (2, 3, 4):
        reached = [entries[name] for name in rules.STAGE_ENTRIES[stage] if name in entries]
        steps.append((stage, min(reached) if reached and stage <= current else None))
    return steps


def _visible(db: Session, issue: StoredIssue, member_id: uuid.UUID, member_gn: str | None) -> bool:
    if issue.reporter_id == member_id:
        return True
    if issue.public_state != "published":
        return False
    return issue.gn_code == member_gn or repository.is_following(db, issue.id, member_id)


def detail(db: Session, member_id: uuid.UUID, issue_id: uuid.UUID) -> IssueView:
    issue = repository.find_issue(db, issue_id)
    place = repository.member_place(db, member_id)
    if issue is None or not _visible(db, issue, member_id, place.gn_code):
        raise IssueNotFound()
    return _view(db, issue, member_id)


def _view(db: Session, issue: StoredIssue, member_id: uuid.UUID) -> IssueView:
    mine = issue.reporter_id == member_id
    view_stage = rules.member_view_stage(issue.stage, issue.parent_stage)
    status = access_repository.find_member_status(db, member_id)
    may_take_part = status is not None and status.identity_verified and status.membership_active
    now = datetime.now(UTC)
    response = repository.closure_response(db, issue.id, member_id, issue.closure_round) if mine else None
    returned = None
    if mine and issue.stage == "returned":
        last = repository.last_action(db, issue.id, ("returned",))
        returned = last.note if last else None
    open_stage = view_stage in rules.OPEN_STAGES
    my_additions = repository.additions_by(db, issue.id, member_id)
    return IssueView(
        issue=issue,
        view_stage=view_stage,
        steps=_steps(db, issue, view_stage),
        mine=mine,
        following=repository.is_following(db, issue.id, member_id),
        can_follow=not mine and issue.public_state == "published",
        can_add_information=may_take_part and open_stage and (mine or issue.public_state == "published"),
        community_updates=repository.additions(db, issue.id, approved_only=True) if issue.public_state == "published" else [],
        returned_question=returned,
        report_photos=repository.count_report_evidence(db, issue.id) if mine else 0,
        response=response,
        next_step=rules.next_step(issue.stage, closed_at=issue.closed_at, responded=response is not None, now=now)
        if mine
        else None,
        challenge_until=issue.closed_at + rules.CHALLENGE_WINDOW if mine and issue.closed_at else None,
        my_additions=my_additions,
        addition_appeals=moderation_appeals.mine_for_items(db, member_id, "addition", [a.id for a in my_additions]),
    )


def my_reports(db: Session, member_id: uuid.UUID) -> list[IssueView]:
    return [_view(db, issue, member_id) for issue in repository.list_mine(db, member_id)]


@dataclass(frozen=True)
class MyArea:
    has_area: bool
    gn_name_en: str | None
    gn_name_ta: str | None
    updates: list[repository.AreaUpdate]
    issues: list[StoredIssue]
    projects: list[StoredIssue]
    following: frozenset[uuid.UUID]


def my_area(db: Session, member_id: uuid.UUID) -> MyArea:
    """H05: Updates, Issues and Projects for the member's GN division (FR-RPT-001, 003)."""
    place = repository.member_place(db, member_id)
    name_en, name_ta = _gn_names(db, place.gn_code)
    if not place.gn_code:
        return MyArea(False, None, None, [], [], [], frozenset())
    issues = repository.list_public_in_gn(db, place.gn_code, ("gn", "returned", "ds", "district", "regional", "executive"))
    projects = repository.list_public_in_gn(db, place.gn_code, ("implementation", "resolved"))
    following = frozenset(
        issue.id for issue in [*issues, *projects] if repository.is_following(db, issue.id, member_id)
    )
    return MyArea(
        has_area=True,
        gn_name_en=name_en,
        gn_name_ta=name_ta,
        updates=repository.public_updates_in_gn(db, place.gn_code),
        issues=issues,
        projects=projects,
        following=following,
    )


# --- Taking part ---------------------------------------------------------------------------------------


def set_following(db: Session, member_id: uuid.UUID, issue_id: uuid.UUID, follow: bool) -> IssueView:
    issue = repository.find_issue(db, issue_id)
    place = repository.member_place(db, member_id)
    if issue is None or not _visible(db, issue, member_id, place.gn_code):
        raise IssueNotFound()
    if follow:
        if issue.public_state != "published" and issue.reporter_id != member_id:
            raise IssueRefused("not_public")
        repository.follow(db, issue_id, member_id)
    else:
        repository.unfollow(db, issue_id, member_id)
    db.commit()
    return _view(db, issue, member_id)


def add_information(
    db: Session, member_id: uuid.UUID, issue_id: uuid.UUID, body: str, photo_ids: list[uuid.UUID], ip: str
) -> repository.StoredAddition:
    """FR-RPT-006: held for moderation, seen by the case team at once. The reporter's answer to a
    "return for details" goes back to the GN stage with a fresh time limit (FR-WEB-016)."""
    issue = repository.find_issue(db, issue_id, lock=True)
    place = repository.member_place(db, member_id)
    if issue is None or not _visible(db, issue, member_id, place.gn_code):
        raise IssueNotFound()
    view = _view(db, issue, member_id)
    if not view.can_add_information:
        raise IssueRefused("cannot_add_information")
    now = datetime.now(UTC)
    photos = repository.unattached_evidence(db, member_id, photo_ids, "addition", now - rules.UNATTACHED_PHOTO_LIFETIME)
    if len(photos) != len(set(photo_ids)):
        raise IssueRefused("photo_not_found")
    is_reply = issue.reporter_id == member_id and issue.stage == "returned"
    addition_id = repository.insert_addition(db, issue_id, member_id, body.strip(), is_reply)
    repository.attach_evidence(db, photos, issue_id, addition_id=addition_id)
    if is_reply:
        repository.update_issue(
            db, issue_id, stage="gn", stage_entered_at=now, stage_due_at=rules.stage_due("gn", now), breach_alerted_at=None
        )
        repository.insert_action(db, issue_id, "reporter_replied", actor_id=member_id, from_stage="returned", to_stage="gn")
        notices.reporter_replied(db, issue)
    audit.record(
        db, actor_id=member_id, action="issue.information_added", target_type="issue", target_id=str(issue_id),
        area_path=issue_path(issue), details={"reply": is_reply, "photos": len(photos)}, ip=ip,
    )
    db.commit()
    found = repository.find_addition(db, addition_id)
    assert found is not None
    return found


def respond_to_closure(
    db: Session, member_id: uuid.UUID, issue_id: uuid.UUID, *, resolved: bool, rating: int | None, note: str | None, ip: str
) -> IssueView:
    """FR-RPT-016: rate the closure, or challenge it with a note within 30 days."""
    issue = repository.find_issue(db, issue_id, lock=True)
    if issue is None or issue.reporter_id != member_id:
        raise IssueNotFound()
    existing = repository.closure_response(db, issue_id, member_id, issue.closure_round)
    problem = rules.check_closure_response(
        stage=issue.stage, closed_at=issue.closed_at, now=datetime.now(UTC), already_responded=existing is not None,
        resolved=resolved, note=note,
    )
    if problem:
        raise IssueRefused(problem)
    repository.insert_closure_response(db, issue_id, member_id, issue.closure_round, resolved, rating, note.strip() if note else None)
    if not resolved:
        repository.insert_action(db, issue_id, "challenged", actor_id=member_id, note=note)
        notices.closure_challenged(db, issue)
    audit.record(
        db, actor_id=member_id, action="issue.closure_challenged" if not resolved else "issue.closure_rated",
        target_type="issue", target_id=str(issue_id), area_path=issue_path(issue), details={"rating": rating}, ip=ip,
    )
    db.commit()
    return _view(db, issue, member_id)


def issue_path(issue: StoredIssue) -> AreaPath:
    return tuple(area_from_key(key) for key in issue.area_path) or (PLATFORM,)
