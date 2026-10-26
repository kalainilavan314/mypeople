"""The notification jobs, run once: send due broadcasts, alert Tier 5 about photo removal requests
open 18 hours, then push the pending notices.

Meant to run every minute from a systemd timer once the API is deployed:

    python -m app.tasks.notifications

Each job takes row locks with SKIP LOCKED, so two runs at once never send the same thing twice.
Prints counts only, never message text or recipients.
"""

import json
from dataclasses import asdict
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.session import create_database_engine
from app.integrations.push import PushSender, build_push
from app.modules.content.gallery import service as gallery
from app.modules.messaging.broadcasts import service as broadcasts
from app.modules.messaging.notifications import service as notifications


def run_once(db: Session, push: PushSender, now: datetime | None = None) -> dict[str, int]:
    moment = now or datetime.now(UTC)
    sent_broadcasts = broadcasts.send_due(db, moment)
    escalated = gallery.escalate_overdue(db)
    pushed = notifications.dispatch(db, push, moment)
    return {"broadcastsSent": sent_broadcasts, "removalsEscalated": escalated, **asdict(pushed)}


def main() -> None:
    settings = Settings()
    engine = create_database_engine(settings.database_url.get_secret_value())
    try:
        with Session(engine) as db:
            print(json.dumps(run_once(db, build_push(settings))))
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
