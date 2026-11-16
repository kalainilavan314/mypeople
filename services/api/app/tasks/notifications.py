"""The notification dispatcher and escalation task.
Run once every minute from a systemd timer (mypeople-notifications.timer):

    python -m app.tasks.notifications [--dry-run] [--check]

Jobs performed per cycle:
1. Send due staff broadcasts (with election silence holds and audit trails).
2. Escalate overdue photo removal requests (> 18h) to Tier 5 reviewers.
3. Dispatch pending push notifications respecting quiet hours and preferences.

Concurrency & Safety:
- Database queries use row locking with SKIP LOCKED. Multiple simultaneous
  runs never double-process or double-send items.
- Structured logs write to systemd journal. Zero message text, recipient phone
  numbers, or member personal information is ever logged.
"""

import argparse
import json
import logging
import sys
import time
from dataclasses import asdict
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.session import create_database_engine
from app.integrations.push import NoPush, PushSender, build_push
from app.modules.content.gallery import service as gallery
from app.modules.messaging.broadcasts import service as broadcasts
from app.modules.messaging.notifications import service as notifications

logger = logging.getLogger("mypeople.tasks.notifications")


def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%SZ",
        stream=sys.stdout,
    )


def run_once(db: Session, push: PushSender, now: datetime | None = None) -> dict[str, int]:
    """Execute one full notification and escalation cycle, returning counts of processed items."""
    moment = now or datetime.now(UTC)
    sent_broadcasts = broadcasts.send_due(db, moment)
    escalated = gallery.escalate_overdue(db)
    pushed = notifications.dispatch(db, push, moment)
    return {"broadcastsSent": sent_broadcasts, "removalsEscalated": escalated, **asdict(pushed)}


def dry_run(db: Session, now: datetime | None = None) -> dict[str, Any]:
    """Count pending work without mutating rows, taking row locks, or invoking push services."""
    moment = now or datetime.now(UTC)
    from app.modules.content.gallery import rules as gallery_rules

    # Dispatcher repository queries take row locks. A diagnostic run must not
    # compete with the live dispatcher or change which rows it can see.
    due_broadcasts = db.scalar(
        text("""SELECT count(*) FROM notifications.broadcast
                WHERE state = 'scheduled' AND COALESCE(send_at, :now) <= :now"""),
        {"now": moment},
    )
    overdue_removals = db.scalar(
        text("""SELECT count(*) FROM content.removal_request
                WHERE state = 'open' AND escalated_at IS NULL
                  AND created_at <= now() - CAST(:age AS interval)"""),
        {"age": gallery_rules.ESCALATE_AFTER},
    )
    pending_pushes = db.scalar(
        text("""SELECT count(*) FROM notifications.notification
                WHERE push_state = 'pending'"""),
    )

    return {
        "dryRun": True,
        "dueBroadcasts": int(due_broadcasts or 0),
        "overdueRemovals": int(overdue_removals or 0),
        "pendingPushes": int(pending_pushes or 0),
    }


def check(engine: Any, settings: Settings) -> dict[str, str]:
    """Verify database connectivity and push configuration readiness."""
    with Session(engine) as db:
        db.execute(text("SELECT 1"))

    push = build_push(settings)
    push_status = "inbox_fallback" if isinstance(push, NoPush) else "configured"

    return {
        "status": "ready",
        "database": "connected",
        "push": push_status,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="My People notification dispatcher and photo removal escalation runner."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Inspect and report pending items without sending notifications or mutating state.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Perform database and push configuration health check and exit.",
    )
    args = parser.parse_args(argv)

    setup_logging()
    start_time = time.perf_counter()

    try:
        settings = Settings()
        engine = create_database_engine(settings.database_url.get_secret_value())
    except Exception as err:
        logger.error(json.dumps({"event": "config_error", "error": type(err).__name__}))
        return 1

    try:
        if args.check:
            health = check(engine, settings)
            logger.info(json.dumps({"event": "health_check", **health}))
            print(json.dumps(health))
            return 0

        with Session(engine) as db:
            if args.dry_run:
                result = dry_run(db)
                elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
                logger.info(json.dumps({"event": "dry_run_complete", "durationMs": elapsed_ms, **result}))
                print(json.dumps(result))
                return 0

            # Normal execution
            push = build_push(settings)
            result = run_once(db, push)
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            logger.info(json.dumps({"event": "dispatch_complete", "durationMs": elapsed_ms, **result}))
            print(json.dumps(result))
            return 0

    except Exception as err:
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        logger.error(
            json.dumps({"event": "task_failed", "error": type(err).__name__, "durationMs": elapsed_ms})
        )
        return 1
    finally:
        engine.dispose()


if __name__ == "__main__":
    sys.exit(main())
