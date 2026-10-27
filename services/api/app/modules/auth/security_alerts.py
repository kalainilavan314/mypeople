"""Security alerts to the member (BRD FR-AUTH-018, BR-151, ENT-68, M50).

An alert is raised when the risk rules flag a sign-in, or when a refresh
token is used a second time. The member is told in the inbox (Action needed,
pushed by the dispatcher within the minute) and on the confirmed number, and
answers it: "it was me" closes it; "this wasn't me" ends the flagged session
and every other one except the one they are using, and they are asked to
change the password. The alert holds the signals and a coarse device label,
never an address or a location.
"""

import uuid
from dataclasses import dataclass
from typing import Literal

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.audit import service as audit
from app.modules.auth import repository
from app.modules.auth.repository import SessionMember, StoredAlert
from app.modules.messaging.notifications import service as notifications

Kind = Literal["suspicious_sign_in", "refresh_reuse"]
Answer = Literal["it_was_me", "not_me"]

TARGET_KIND = "security_alert"


class AlertNotFound(Exception):
    pass


class AlertAnswered(Exception):
    pass


def raise_alert(
    db: Session, member_id: uuid.UUID, session_id: uuid.UUID | None, kind: Kind, signals: list[str], device_label: str
) -> StoredAlert:
    """Record the alert and its inbox notice in the caller's transaction."""
    alert = repository.insert_alert(db, member_id, session_id, kind, signals, device_label)
    notifications.notify(db, member_id, kind, alert.id)
    audit.record(
        db,
        actor_id=None,
        action=f"auth.alert.{kind}",
        target_type=TARGET_KIND,
        target_id=str(alert.id),
        area_path=access_repository.member_area_path(db, member_id),
        details={"memberId": str(member_id), "sessionId": str(session_id) if session_id else None, "signals": signals},
    )
    return alert


def my_alerts(db: Session, member_id: uuid.UUID, limit: int = 50) -> list[StoredAlert]:
    return repository.member_alerts(db, member_id, limit)


@dataclass(frozen=True)
class Answered:
    alert: StoredAlert
    sessions_ended: bool


def answer(db: Session, member: SessionMember, alert_id: uuid.UUID, reply: Answer, ip: str) -> Answered:
    alert = repository.find_alert(db, alert_id, for_update=True)
    if alert is None or alert.member_id != member.id:
        raise AlertNotFound()
    if alert.answer is not None:
        raise AlertAnswered()
    ended = False
    if reply == "not_me":
        # Secure the account: end the flagged session and every other one but this. Answering
        # "not me" from the flagged session itself ends that one too.
        keep = None if member.session_id == alert.session_id else member.session_id
        repository.revoke_member_sessions(db, member.id, "not_me", keep=keep)
        ended = True
    repository.answer_alert(db, alert.id, reply)
    notifications.complete_action(db, TARGET_KIND, alert.id, member.id)
    audit.record(
        db,
        actor_id=member.id,
        action="auth.alert.answered",
        target_type=TARGET_KIND,
        target_id=str(alert.id),
        details={"answer": reply},
        ip=ip,
    )
    db.commit()
    answered = repository.find_alert(db, alert.id)
    assert answered is not None
    return Answered(answered, ended)
