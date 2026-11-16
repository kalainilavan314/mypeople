"""Stage time limits (BRD §4.3, FR-WEB-028, BR-039): alert the next tier once when a stage overruns.

Run each minute by the notifications task. A GN stage open past three working days alerts the
divisional coordinators of the area; a divisional stage alerts the district, and so on up to the
executive, whose overruns stay on the executive's own list. An overrunning implementation alerts
whoever approved it. Each overrun is alerted once and recorded in the case history; the alert
restarts only when the case moves to a new stage. The case itself is never moved automatically.
"""

import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.modules.community.issues import notices, repository, rules


def alert_breaches(db: Session, now: datetime) -> int:
    alerted = 0
    for issue in repository.overdue_unalerted(db, now):
        recipients = _recipients(db, issue)
        notices.overdue(db, issue, recipients)
        repository.update_issue(db, issue.id, breach_alerted_at=now)
        repository.insert_action(
            db, issue.id, "breach_alerted", actor_id=None,
            details={"stage": issue.stage, "dueAt": issue.stage_due_at.isoformat() if issue.stage_due_at else None,
                     "alerted": len(recipients)},
        )
        alerted += 1
    db.commit()
    return alerted


def _recipients(db: Session, issue: repository.StoredIssue) -> list[uuid.UUID]:
    if issue.stage == "implementation":
        approval = repository.last_action(db, issue.id, ("district_action", "executive_approved", "reopened"))
        return [approval.actor_id] if approval and approval.actor_id else []
    permission = rules.BREACH_ALERTS.get(issue.stage)
    if permission is None:
        return []
    return [holder.member_id for holder in repository.permission_holders(db, permission, issue.area_path)]
