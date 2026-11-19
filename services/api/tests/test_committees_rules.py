"""Wings, committees and diaspora rules, without a database (BRD FR-COM-001 to 009, FR-DSP-001, 002, 006, OD-15)."""

from datetime import UTC, date, datetime

import pytest

from app.modules.diaspora import rules as diaspora
from app.modules.engagement.committees import rules

TODAY = date(2026, 11, 19)


def application(**overrides):
    values = dict(
        committee_state="active", committee_kind="committee", wing_type="farmers", in_scope=True,
        identity_verified=True, membership_active=True, diaspora_registered=False, birth_date=date(1990, 1, 1),
        today=TODAY, existing_state=None,
    )
    return rules.check_application(**{**values, **overrides})


@pytest.mark.parametrize(
    ("overrides", "expected"),
    [
        ({}, None),
        ({"committee_state": "proposed"}, "committee_not_open"),  # FR-COM-001: exists only after approval
        ({"committee_kind": "wing"}, "committee_not_open"),  # members join committees, not wings
        ({"existing_state": "applied"}, "already_applied"),
        ({"existing_state": "approved"}, "already_member"),
        ({"existing_state": "removed"}, "removed_by_coordinator"),
        ({"existing_state": "declined"}, None),  # may apply again
        ({"identity_verified": False}, "identity_not_verified"),
        ({"membership_active": False}, "membership_not_active"),
        ({"in_scope": False}, "outside_committee_area"),
        # FR-DSP-005: a registered overseas supporter may apply to a diaspora committee without verification.
        ({"wing_type": "diaspora", "identity_verified": False, "membership_active": False, "in_scope": False,
          "diaspora_registered": True}, None),
        ({"wing_type": "diaspora", "identity_verified": False, "diaspora_registered": False}, "identity_not_verified"),
        # OD-15: the youth wing is 18 and over; an unknown age is not assumed to be enough.
        ({"wing_type": "youth", "birth_date": date(2008, 11, 20)}, "below_minimum_age"),
        ({"wing_type": "youth", "birth_date": date(2008, 11, 19)}, None),
        ({"wing_type": "youth", "birth_date": None}, "age_not_confirmed"),
    ],
)
def test_who_may_apply_to_a_committee(overrides, expected):
    assert application(**overrides) == expected


def test_minutes_and_member_threads_wait_and_the_rest_publish():
    assert rules.initial_state("secretary", "minutes") == "awaiting_approval"
    assert rules.initial_state("coordinator", "minutes") == "awaiting_approval"
    assert rules.initial_state("member", "thread") == "awaiting_approval"
    assert rules.initial_state("secretary", "thread") == "published"
    assert rules.initial_state("coordinator", "announcement") == "published"


def test_what_each_role_may_post():
    assert rules.can_post("member", "thread") and not rules.can_post("member", "announcement")
    assert rules.can_post("secretary", "minutes") and not rules.can_post("secretary", "task")
    assert all(rules.can_post("coordinator", kind) for kind in ("task", "volunteer", "document", "meeting"))
    assert not rules.can_post(None, "thread")


def test_items_need_their_own_details():
    base = dict(starts_at_given=False, ends_before_start=False, meeting_given=False, due_on=None, today=TODAY,
                assignee_given=False, places=None, access_roles=["coordinator", "member"])
    assert rules.check_item(item_type="meeting", **base) == ["meeting_time_required"]
    assert rules.check_item(item_type="minutes", **base) == ["meeting_required"]
    assert rules.check_item(item_type="task", **base) == ["due_date_required", "assignee_required"]
    assert rules.check_item(item_type="volunteer", **{**base, "due_on": date(2026, 11, 1)}) == ["due_date_past",
                                                                                               "places_required"]
    assert rules.check_item(item_type="document", **{**base, "access_roles": ["member"]}) == ["coordinator_must_have_access"]
    assert rules.check_item(item_type="announcement", **base) == []


def test_documents_open_only_for_named_roles():
    assert rules.can_open_document("secretary", ["coordinator", "secretary"])
    assert not rules.can_open_document("member", ["coordinator", "secretary"])
    assert not rules.can_open_document(None, ["coordinator", "secretary", "member"])


def test_minutes_are_approved_by_another_coordinator():
    assert rules.check_minutes_decision(author="a", approver="a", approver_role="coordinator") == "own_minutes"
    assert rules.check_minutes_decision(author="a", approver="b", approver_role="secretary") == "coordinator_only"
    assert rules.check_minutes_decision(author="a", approver="b", approver_role="coordinator") is None


def test_a_committee_always_keeps_a_coordinator():
    assert rules.check_role_change(new_role="member", current_role="coordinator", coordinators=1) == "last_coordinator"
    assert rules.check_role_change(new_role="member", current_role="coordinator", coordinators=2) is None
    assert rules.check_removal(current_role="coordinator", coordinators=1) == "last_coordinator"
    assert rules.check_removal(current_role="member", coordinators=1) is None


def test_a_committee_needs_an_active_wing_of_its_type():
    assert rules.check_proposal(kind="wing", wing_state=None, wing_type_matches=False) == []
    assert rules.check_proposal(kind="committee", wing_state=None, wing_type_matches=False) == ["wing_required"]
    assert rules.check_proposal(kind="committee", wing_state="proposed", wing_type_matches=True) == ["wing_not_active"]
    assert rules.check_proposal(kind="committee", wing_state="active", wing_type_matches=False) == ["wing_type_mismatch"]


def test_eighteen_hundred_in_sri_lanka_is_half_past_eight_in_toronto_in_summer():
    # FR-DSP-002's acceptance example: 18:00 Sri Lanka time is 08:30 in Toronto (daylight saving time).
    start = datetime(2026, 7, 15, 12, 30, tzinfo=UTC)
    assert diaspora.local_time(start, "Asia/Colombo") == ("2026-07-15", "18:00", "+05:30")
    assert diaspora.local_time(start, "America/Toronto") == ("2026-07-15", "08:30", "-04:00")
    # In winter Toronto is an hour further behind.
    assert diaspora.local_time(datetime(2026, 12, 15, 12, 30, tzinfo=UTC), "America/Toronto")[1] == "07:30"


def test_registration_needs_consent_and_a_listed_country_and_its_zone():
    ok = dict(country_code="CA", time_zone="America/Toronto", topics=["international_events"], skills=["teaching"],
              known_skills={"teaching"}, consent=True)
    assert diaspora.check_registration(**ok) == []
    assert diaspora.check_registration(**{**ok, "consent": False}) == ["consent_required"]
    assert diaspora.check_registration(**{**ok, "country_code": "LK"}) == ["country_not_listed"]
    assert diaspora.check_registration(**{**ok, "time_zone": "Europe/London"}) == ["time_zone_not_in_country"]
    assert diaspora.check_registration(**{**ok, "skills": ["juggling"]}) == ["unknown_skill"]


def test_contributions_from_abroad_stay_off_until_od_40():
    assert diaspora.FOREIGN_CONTRIBUTIONS_ENABLED is False
    assert diaspora.contribution_status() == (False, "foreign_contributions_disabled")


def test_every_listed_time_zone_exists():
    from zoneinfo import ZoneInfo

    for zones in diaspora.COUNTRY_ZONES.values():
        for zone in zones:
            ZoneInfo(zone)


def test_small_numbers_are_hidden():
    assert diaspora.hide_small(4) is None and diaspora.hide_small(5) == 5
