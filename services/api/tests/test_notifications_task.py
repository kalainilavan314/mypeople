"""Unit tests for app.tasks.notifications task runner, CLI flags, and structured reporting."""

from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.integrations.push import NoPush
from app.modules.messaging.notifications.service import Dispatched
from app.tasks.notifications import check, dry_run, main, run_once


def test_run_once_coordinates_all_four_subsystems():
    db = MagicMock(spec=Session)
    push = NoPush()
    now = datetime(2026, 10, 26, 12, 0, tzinfo=UTC)

    with (
        patch("app.modules.messaging.broadcasts.service.send_due", return_value=3) as mock_send,
        patch("app.modules.content.gallery.service.escalate_overdue", return_value=1) as mock_escalate,
        patch("app.modules.community.issues.breaches.alert_breaches", return_value=2) as mock_breaches,
        patch("app.modules.community.promises.service.mark_delayed", return_value=1),
        patch("app.modules.community.townhalls.service.remind", return_value=4),
        patch(
            "app.modules.messaging.notifications.service.dispatch",
            return_value=Dispatched(sent=5, skipped=2, waiting=0),
        ) as mock_dispatch,
    ):
        result = run_once(db, push, now)

        assert mock_send.called
        assert mock_escalate.called
        mock_breaches.assert_called_once_with(db, now)
        assert mock_dispatch.called
        assert result == {
            "broadcastsSent": 3,
            "removalsEscalated": 1,
            "caseBreachesAlerted": 2,
            "promisesDelayed": 1,
            "townHallReminders": 4,
            "sent": 5,
            "skipped": 2,
            "waiting": 0,
        }


def test_dry_run_inspects_counts_without_mutating_or_dispatching():
    db = MagicMock(spec=Session)
    db.scalar.side_effect = [2, 1, 3]
    now = datetime(2026, 10, 26, 12, 0, tzinfo=UTC)

    with patch("app.modules.messaging.notifications.service.dispatch") as mock_dispatch:
        result = dry_run(db, now)

        assert not mock_dispatch.called
        assert db.scalar.call_count == 3
        assert all("FOR UPDATE" not in str(call.args[0]).upper() for call in db.scalar.call_args_list)
        assert not db.execute.called
        assert result == {
            "dryRun": True,
            "dueBroadcasts": 2,
            "overdueRemovals": 1,
            "pendingPushes": 3,
        }


def test_check_verifies_db_connectivity_and_push_fallback():
    engine = MagicMock()
    settings = MagicMock(spec=Settings)

    with (
        patch("app.tasks.notifications.Session") as mock_session_cls,
        patch("app.tasks.notifications.build_push", return_value=NoPush()),
    ):
        mock_session = MagicMock()
        mock_session_cls.return_value.__enter__.return_value = mock_session

        health = check(engine, settings)

        assert mock_session.execute.called
        assert health["status"] == "ready"
        assert health["database"] == "connected"
        assert health["push"] == "inbox_fallback"


def test_cli_flags_dry_run_and_check(capsys):
    with (
        patch("app.tasks.notifications.create_database_engine"),
        patch("app.tasks.notifications.Settings"),
        patch("app.tasks.notifications.Session"),
        patch("app.tasks.notifications.check", return_value={"status": "ready", "database": "connected"}),
        patch("app.tasks.notifications.dry_run", return_value={"dryRun": True, "pendingPushes": 0}),
    ):
        exit_code_check = main(["--check"])
        assert exit_code_check == 0
        captured_check = capsys.readouterr()
        assert '"status": "ready"' in captured_check.out

        exit_code_dry = main(["--dry-run"])
        assert exit_code_dry == 0
        captured_dry = capsys.readouterr()
        assert '"dryRun": true' in captured_dry.out


def test_cli_handles_errors_gracefully_with_exit_code_1():
    with patch("app.tasks.notifications.Settings", side_effect=RuntimeError("missing DB")):
        exit_code = main([])
        assert exit_code == 1
