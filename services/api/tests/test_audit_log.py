"""The append-only, hash-chained audit log, and the bootstrap command's service.

Against a real database; skipped when DATABASE_URL is not set. Everything is
rolled back afterwards.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.modules.access import service as access
from app.modules.access.rules import PLATFORM, Area
from app.modules.audit import service as audit


def record_three(db_session, actor_id) -> list[int]:
    for action in ("test.first", "test.second", "test.third"):
        audit.record(db_session, actor_id=actor_id, action=action, details={"n": action}, ip="127.0.0.1")
    return list(db_session.scalars(text("SELECT id FROM ops.audit_log ORDER BY id DESC LIMIT 3")))[::-1]


def test_entries_form_a_chain_that_verifies(db_session, create_member):
    member = create_member()
    ids = record_three(db_session, member.id)

    rows = db_session.execute(
        text("SELECT id, prev_hash, entry_hash FROM ops.audit_log WHERE id = ANY(:ids) ORDER BY id"), {"ids": ids}
    ).all()
    assert rows[1].prev_hash == rows[0].entry_hash
    assert rows[2].prev_hash == rows[1].entry_hash

    result = audit.verify_chain(db_session)
    assert result.ok
    assert result.checked >= 3


@pytest.mark.parametrize(
    "statement",
    [
        "UPDATE ops.audit_log SET action = 'changed' WHERE id = :id",
        "DELETE FROM ops.audit_log WHERE id = :id",
        "TRUNCATE ops.audit_log",
    ],
    ids=["update", "delete", "truncate"],
)
def test_the_database_refuses_to_change_entries(db_session, create_member, statement):
    entry_id = record_three(db_session, create_member().id)[0]

    with pytest.raises(DBAPIError, match="append-only"):
        with db_session.begin_nested():
            db_session.execute(text(statement), {"id": entry_id})


def test_verification_finds_an_altered_entry(db_session, create_member):
    first, middle, last = record_three(db_session, create_member().id)
    # Only an owner with the trigger switched off could do this; the chain still shows it.
    db_session.execute(text("ALTER TABLE ops.audit_log DISABLE TRIGGER audit_log_no_update_or_delete"))
    db_session.execute(text("UPDATE ops.audit_log SET details = '{\"n\": \"forged\"}' WHERE id = :id"), {"id": middle})

    result = audit.verify_chain(db_session)

    assert not result.ok
    assert result.first_broken_id == middle


def test_area_path_lets_regional_auditors_find_entries(db_session, create_member):
    path = (PLATFORM, Area("province", "LK4"), Area("district", "LK41"))
    audit.record(db_session, actor_id=create_member().id, action="test.area", area_path=path)

    stored = db_session.execute(
        text("SELECT area_level, area_code, area_path FROM ops.audit_log ORDER BY id DESC LIMIT 1")
    ).one()
    assert (stored.area_level, stored.area_code) == ("district", "LK41")
    assert stored.area_path == ["platform", "province:LK4", "district:LK41"]


# --- Bootstrap ------------------------------------------------------------------------


def test_bootstrap_creates_the_first_super_administrator_once(db_session, create_member):
    if db_session.scalar(text("SELECT EXISTS (SELECT 1 FROM access.staff_assignment WHERE tier = '5' AND state = 'active')")):
        pytest.skip("this database already has a Super Administrator")
    first = create_member(verified=True)

    assignment = access.bootstrap_super_administrator(db_session, first.id, ["members.verify"])

    assert assignment.tier == "5" and assignment.area == PLATFORM
    assert {"roles.assign", "members.verify"} <= assignment.permissions
    assert assignment.granted_by is None
    last = db_session.execute(text("SELECT action, target_id FROM ops.audit_log ORDER BY id DESC LIMIT 1")).one()
    assert (last.action, last.target_id) == ("access.assignment.bootstrapped", str(assignment.id))

    with pytest.raises(access.AssignmentRefused) as refused:
        access.bootstrap_super_administrator(db_session, create_member(verified=True).id, [])
    assert refused.value.problems == ["super_administrator_exists"]


def test_bootstrap_needs_a_verified_identity_and_tier_five_permissions(db_session, create_member):
    with pytest.raises(access.AssignmentRefused) as unverified:
        access.bootstrap_super_administrator(db_session, create_member().id, [])
    assert unverified.value.problems == ["identity_not_verified"]

    with pytest.raises(access.AssignmentRefused) as wrong:
        access.bootstrap_super_administrator(db_session, create_member(verified=True).id, ["cases.collect"])
    assert wrong.value.problems in (["permission_not_for_tier:cases.collect"], ["super_administrator_exists"])
