"""Periodic maintenance and cleanup jobs, run once:
- clean up expired and consumed/cancelled assignment previews.

Run from system timer or background worker:
    python -m app.tasks.cleanup
"""

import json
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.session import create_database_engine
from app.modules.access import service as access_service


def run_once(db: Session, now: datetime | None = None) -> dict[str, int]:
    cleaned_previews = access_service.cleanup_previews(db)
    return {"cleanedAssignmentPreviews": cleaned_previews}


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
