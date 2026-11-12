"""Issue reporting and case escalation rules (BRD §4.3, §10.2(b), FR-RPT, FR-WEB-014 to 029)."""

from datetime import UTC, datetime, timedelta

import pytest

from app.modules.community.issues import rules

FRIDAY_NOON_COLOMBO = datetime(2026, 11, 13, 6, 30, tzinfo=UTC)  # 12:00 in Sri Lanka


def test_working_days_skip_the_weekend():
    assert rules.add_working_days(FRIDAY_NOON_COLOMBO, 1) == FRIDAY_NOON_COLOMBO + timedelta(days=3)  # Monday
    assert rules.add_working_days(FRIDAY_NOON_COLOMBO, 3) == FRIDAY_NOON_COLOMBO + timedelta(days=5)  # Wednesday
    monday = FRIDAY_NOON_COLOMBO + timedelta(days=3)
    assert rules.add_working_days(monday, 3) == monday + timedelta(days=3)  # Thursday


def test_a_late_evening_counts_in_sri_lankan_time():
    # 20:00 UTC on Friday is already 01:30 on Saturday in Colombo: one working day lands on Monday.
    late = datetime(2026, 11, 13, 20, 0, tzinfo=UTC)
    assert rules.add_working_days(late, 1).astimezone(rules.LOCAL_ZONE).weekday() == 0


@pytest.mark.parametrize(("stage", "days"), [("gn", 3), ("ds", 7), ("district", 10), ("regional", 15), ("executive", 10)])
def test_each_stage_has_the_proposed_time_limit(stage, days):
    assert rules.stage_due(stage, FRIDAY_NOON_COLOMBO) == rules.add_working_days(FRIDAY_NOON_COLOMBO, days)


def test_implementation_runs_to_the_plan_and_a_returned_case_waits_for_the_reporter():
    due = FRIDAY_NOON_COLOMBO + timedelta(days=40)
    assert rules.stage_due("implementation", FRIDAY_NOON_COLOMBO, due) == due
    assert rules.stage_due("returned", FRIDAY_NOON_COLOMBO) is None
    assert rules.is_overdue("resolved", FRIDAY_NOON_COLOMBO, FRIDAY_NOON_COLOMBO + timedelta(days=1)) is False
    assert rules.is_overdue("gn", FRIDAY_NOON_COLOMBO, FRIDAY_NOON_COLOMBO + timedelta(seconds=1)) is True


@pytest.mark.parametrize(
    ("verified", "active", "expected"),
    [(False, False, "identity_not_verified"), (True, False, "membership_not_active"), (True, True, None)],
)
def test_only_verified_and_active_members_report(verified, active, expected):
    assert rules.check_may_report(identity_verified=verified, membership_active=active) == expected


def test_a_report_needs_a_real_description_and_a_place():
    assert rules.check_report(description="Too short", location_kind="my_gn", location_text=None, has_area=True, photos=0) == [
        "description_too_short"
    ]
    long = "The water pipe near the school has been broken for a week."
    assert rules.check_report(description=long, location_kind="landmark", location_text=" ", has_area=True, photos=0) == [
        "location_required"
    ]
    assert rules.check_report(description=long, location_kind="text", location_text="Nallur bus stop junction",
                              has_area=True, photos=0) == []
    assert "too_many_photos" in rules.check_report(description=long, location_kind="my_gn", location_text=None,
                                                    has_area=True, photos=4)


def test_the_member_sees_four_stages_and_a_linked_report_follows_its_parent():
    assert [rules.MEMBER_STAGE[s] for s in ("gn", "ds", "district", "regional", "executive", "implementation")] == [
        1, 2, 3, 3, 3, 4,
    ]
    assert rules.member_view_stage("linked", "district") == "district"
    assert rules.member_view_stage("gn", None) == "gn"
    assert rules.RESPONSIBLE["ds"] == "divisional_coordinator"


def test_forwarding_needs_a_fact_and_the_whole_completeness_check():
    assert rules.check_forward(facts=0, location_confirmed=True, description_clear=True, evidence_reviewed=True) == [
        "facts_required"
    ]
    assert rules.check_forward(facts=2, location_confirmed=True, description_clear=False, evidence_reviewed=True) == [
        "completeness_check_incomplete"
    ]
    assert rules.check_forward(facts=1, location_confirmed=True, description_clear=True, evidence_reviewed=True) == []


def test_a_closing_report_needs_evidence_and_both_languages():
    assert rules.check_closing(evidence_refs=[" "], evidence_photos=0, summary_en="Done", summary_ta="முடிந்தது") == [
        "evidence_required"
    ]
    assert rules.check_closing(evidence_refs=["RDA letter 114"], evidence_photos=0, summary_en="Repaired", summary_ta="") == [
        "bilingual_summary_required"
    ]
    assert rules.check_closing(evidence_refs=[], evidence_photos=1, summary_en="Repaired", summary_ta="சீரமைக்கப்பட்டது") == []


def test_a_closure_is_rated_or_challenged_once_within_thirty_days():
    closed = FRIDAY_NOON_COLOMBO
    check = rules.check_closure_response
    assert check(stage="resolved", closed_at=closed, now=closed + timedelta(days=29), already_responded=False,
                 resolved=True, note=None) is None
    assert check(stage="resolved", closed_at=closed, now=closed + timedelta(days=31), already_responded=False,
                 resolved=False, note="Still broken") == "challenge_window_closed"
    assert check(stage="resolved", closed_at=closed, now=closed, already_responded=True, resolved=True,
                 note=None) == "already_responded"
    assert check(stage="resolved", closed_at=closed, now=closed, already_responded=False, resolved=False,
                 note="  ") == "note_required"
    assert check(stage="implementation", closed_at=None, now=closed, already_responded=False, resolved=True,
                 note=None) == "not_closed"


def test_the_next_step_is_said_in_the_members_words():
    now = FRIDAY_NOON_COLOMBO
    assert rules.next_step("returned", closed_at=None, responded=False, now=now) == "add_details"
    assert rules.next_step("resolved", closed_at=now, responded=False, now=now) == "rate_closure"
    assert rules.next_step("resolved", closed_at=now, responded=True, now=now) is None
    assert rules.next_step("declined", closed_at=now, responded=False, now=now) is None


def test_district_closures_are_told_apart_from_executive_ones():
    assert rules.closed_level("district_action") == "district"
    assert rules.closed_level("executive_approved") == "executive"


def test_assisting_tiers_never_decide():
    assert rules.ASSISTING_TIERS == {"2B", "3B"}
    assert set(rules.STAGE_PERMISSION.values()) <= rules.CASE_PERMISSIONS
