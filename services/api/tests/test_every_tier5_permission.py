"""The server command that gives the Super Administrator every Tier 5 permission (owner's decision, 12 November 2026)."""

import io

import pytest
from sqlalchemy import text

from app.core.permissions import MATRIX
from app.modules.access import every_tier5_permission
from app.modules.access import service as access
from app.modules.access.rules import PLATFORM

EVERY_TIER5 = frozenset(code for code, tiers in MATRIX.items() if "5" in tiers)


@pytest.fixture
def no_super_administrator(db_session):
    # This test's transaction is rolled back afterwards, so any real Super Administrator returns.
    db_session.execute(text("UPDATE access.staff_assignment SET state = 'revoked', ended_at = now() WHERE tier = '5' AND state = 'active'"))


def last_audit(db_session):
    return db_session.execute(text("SELECT action, target_id, details FROM ops.audit_log ORDER BY id DESC LIMIT 1")).one()


def test_tier_five_may_hold_forty_of_the_permissions():
    assert len(EVERY_TIER5) == 40
    assert "events.checkin_scan" not in EVERY_TIER5  # kept for the tiers that do the work (BRD §9.8)


def test_with_nobody_in_the_position_it_creates_the_super_administrator_with_every_permission(
    db_session, create_member, no_super_administrator
):
    member = create_member(verified=True)

    assignment = access.grant_every_tier5_permission(db_session, member.id)

    assert (assignment.tier, assignment.area, assignment.permissions) == ("5", PLATFORM, EVERY_TIER5)
    assert assignment.granted_by is None
    assert last_audit(db_session).action == "access.assignment.bootstrapped"


def test_the_super_administrator_is_widened_and_the_old_assignment_kept_as_history(
    db_session, create_member, no_super_administrator
):
    member = create_member(verified=True)
    first = access.bootstrap_super_administrator(db_session, member.id, ["members.verify"])
    assert len(first.permissions) < len(EVERY_TIER5)

    widened = access.grant_every_tier5_permission(db_session, member.id)

    assert widened.id != first.id and widened.permissions == EVERY_TIER5 and widened.area == PLATFORM
    old = db_session.execute(
        text("SELECT state, ended_by, end_reason FROM access.staff_assignment WHERE id = :id"), {"id": first.id}
    ).one()
    assert (old.state, old.ended_by) == ("revoked", None) and "every Tier 5 permission" in old.end_reason
    entry = last_audit(db_session)
    assert (entry.action, entry.target_id) == ("access.assignment.widened", str(widened.id))
    assert entry.details["replaced"] == [str(first.id)] and len(entry.details["permissions"]) == 40
    active = db_session.scalar(text("SELECT count(*) FROM access.staff_assignment WHERE tier = '5' AND state = 'active'"))
    assert active == 1


def test_someone_else_in_the_position_is_not_replaced(db_session, create_member, no_super_administrator):
    holder = create_member(verified=True)
    access.bootstrap_super_administrator(db_session, holder.id, [])

    with pytest.raises(access.AssignmentRefused) as refused:
        access.grant_every_tier5_permission(db_session, create_member(verified=True, active=True).id)

    assert refused.value.problems == ["super_administrator_exists"]


def test_an_unverified_identity_is_refused(db_session, create_member, no_super_administrator):
    with pytest.raises(access.AssignmentRefused) as refused:
        access.grant_every_tier5_permission(db_session, create_member().id)

    assert refused.value.problems == ["identity_not_verified"]


def test_the_command_needs_the_nic_on_standard_input(monkeypatch, capsys):
    monkeypatch.setattr("sys.stdin", io.StringIO(""))

    assert every_tier5_permission.main() == 2
    assert "standard input" in capsys.readouterr().err
