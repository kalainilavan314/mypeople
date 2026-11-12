"""Who is told about a change to an issue (FR-RPT-005, 015, FR-WEB-016, 018, 022, 028, BR-027).

Every notice is written in the caller's transaction, so it exists only if the change does. The
reporter of a report linked to a parent case hears the parent's stage changes on their own
report (FR-WEB-018). Notice titles name no person, place or case number.
"""

import uuid

from sqlalchemy.orm import Session

from app.modules.community.issues import repository
from app.modules.community.issues.repository import StoredIssue
from app.modules.messaging.notifications import service as notifications

CLOSURE_FOR_FOLLOWERS_EN = "Open it to see the outcome."
CLOSURE_FOR_FOLLOWERS_TA = "முடிவைக் காண அதைத் திறக்கவும்."


def _linked_reporters(db: Session, issue: StoredIssue) -> list[tuple[uuid.UUID, uuid.UUID]]:
    """(reporter, their own report) for each report linked to this case."""
    return [(child.reporter_id, child.id) for child in repository.linked_children(db, issue.id)]


def stage_changed(db: Session, issue: StoredIssue) -> None:
    notifications.notify(db, issue.reporter_id, "issue_progress", issue.id)
    for reporter, own in _linked_reporters(db, issue):
        notifications.notify(db, reporter, "issue_progress", own)
    for follower in repository.followers(db, issue.id):
        if follower != issue.reporter_id:
            notifications.notify(db, follower, "issue_followed_progress", issue.id)


def returned(db: Session, issue: StoredIssue) -> None:
    notifications.notify(db, issue.reporter_id, "issue_returned", issue.id)


def closed(db: Session, issue: StoredIssue, *, at_district: bool, area_path: list[str]) -> None:
    notifications.notify(db, issue.reporter_id, "issue_closed", issue.id)
    for reporter, own in _linked_reporters(db, issue):
        notifications.notify(db, reporter, "issue_closed", own)
    for follower in repository.followers(db, issue.id):
        if follower != issue.reporter_id:
            notifications.notify(
                db, follower, "issue_closed", issue.id, body_en=CLOSURE_FOR_FOLLOWERS_EN, body_ta=CLOSURE_FOR_FOLLOWERS_TA
            )
    if at_district:
        # FR-WEB-022: Tiers 4 and 5 receive a resolution report for every district closure.
        told: set[uuid.UUID] = set()
        for permission in ("cases.plan_regional", "cases.approve_executive"):
            for holder in repository.permission_holders(db, permission, area_path):
                if holder.member_id not in told:
                    told.add(holder.member_id)
                    notifications.notify(db, holder.member_id, "case_district_closure", issue.id)


def reporter_replied(db: Session, issue: StoredIssue) -> None:
    notifications.complete_action(db, "issue", issue.id, issue.reporter_id)
    if issue.owner_id is not None:
        notifications.notify(db, issue.owner_id, "case_reporter_replied", issue.id)


def closure_challenged(db: Session, issue: StoredIssue) -> None:
    """The challenge reaches the closing tier (FR-RPT-016): the person who closed it and the district."""
    told: set[uuid.UUID] = set()
    closing = repository.last_action(db, issue.id, ("closed",))
    if closing and closing.actor_id:
        told.add(closing.actor_id)
    for holder in repository.permission_holders(db, "cases.decide_district", issue.area_path):
        told.add(holder.member_id)
    for member_id in told:
        notifications.notify(db, member_id, "case_challenged", issue.id)


def challenge_decided(db: Session, issue: StoredIssue) -> None:
    notifications.complete_action(db, "case", issue.id)
    notifications.notify(db, issue.reporter_id, "issue_challenge_decided", issue.id)


def assigned(db: Session, issue_id: uuid.UUID, previous_owner: uuid.UUID | None, new_owner: uuid.UUID | None) -> None:
    if previous_owner is not None and previous_owner != new_owner:
        notifications.complete_action(db, "case", issue_id, previous_owner)
    if new_owner is not None and new_owner != previous_owner:
        notifications.notify(db, new_owner, "case_assigned", issue_id)


def overdue(db: Session, issue: StoredIssue, recipients: list[uuid.UUID]) -> None:
    for member_id in recipients:
        notifications.notify(db, member_id, "case_overdue", issue.id)
