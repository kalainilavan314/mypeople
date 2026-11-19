"""Periodic maintenance and cleanup jobs, run once:
- clean up expired and consumed/cancelled assignment previews;
- delete appointments with a representative two years after the meeting (ENT-58).
- delete assistant messages older than 30 days (OD-48), hand-overs 30 days after they are answered or
  closed, and resolved assistant error reports after a year.

Run from system timer or background worker:
    python -m app.tasks.cleanup
"""

import json
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.session import create_database_engine
from app.modules.access import service as access_service
from app.modules.events.appointments import service as appointments
from app.modules.ai.assistant import service as assistant_service


def run_once(db: Session, now: datetime | None = None) -> dict[str, int]:
    cleaned_previews = access_service.cleanup_previews(db)
    moment = now or datetime.now(UTC)
    purged_appointments = appointments.purge(db, moment)
    assistant = assistant_service.purge_expired(db, now)
    return {
        "cleanedAssignmentPreviews": cleaned_previews,
        "appointmentsPurged": purged_appointments,
        "assistantMessagesDeleted": assistant.messages,
        "assistantConversationsDeleted": assistant.conversations,
        "assistantHandoversDeleted": assistant.handovers,
        "assistantErrorReportsDeleted": assistant.error_reports,
    }


def main() -> None:
    settings = Settings()
    engine = create_database_engine(settings.database_url.get_secret_value())
    try:
        with Session(engine) as db:
            print(json.dumps(run_once(db)))
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
