"""Election-period and feature-flag rules, without a database (BRD NFR-ELC-01, 05, 06, 08; FR-ELX-001, 004;
FR-ARCH-011; FR-VOI-007)."""

from datetime import UTC, date, datetime, timedelta

from app.modules.election import rules
from app.modules.events import rules as events
from app.modules.features import rules as features

NOW = datetime(2026, 10, 26, 6, 0, tzinfo=UTC)
POLLING_DAY = date(2026, 11, 14)
POLL_START, POLL_END = rules.local_day_bounds(POLLING_DAY)


def check(**overrides):
    values = {
        "starts_at": NOW - timedelta(days=1),
        "ends_at": POLL_END + timedelta(days=7),
        "silence_starts_at": POLL_START - timedelta(days=2),
        "silence_ends_at": POLL_END,
        "polling_day": POLLING_DAY,
        "source_published_at": NOW - timedelta(days=2),
        "now": NOW,
    }
    return rules.check_period(**(values | overrides))


def test_a_polling_day_is_a_sri_lankan_calendar_day():
    assert POLL_START == datetime(2026, 11, 13, 18, 30, tzinfo=UTC)
    assert POLL_END - POLL_START == timedelta(days=1)


def test_a_period_needs_its_silence_inside_it_and_over_the_whole_polling_day():
    assert check() == []
    assert check(ends_at=NOW - timedelta(days=2)) == ["ends_before_start", "already_over", "silence_outside_period"]
    assert check(silence_starts_at=NOW - timedelta(days=3)) == ["silence_outside_period"]
    assert check(silence_ends_at=POLL_END - timedelta(hours=1)) == ["silence_must_cover_polling_day"]  # NFR-ELC-08
    assert check(silence_starts_at=POLL_START + timedelta(hours=6)) == ["silence_must_cover_polling_day"]
    assert check(silence_ends_at=POLL_START - timedelta(days=3)) == [
        "silence_ends_before_start",
        "silence_must_cover_polling_day",
    ]


def test_the_source_must_already_be_published():
    assert check(source_published_at=NOW + timedelta(minutes=1)) == ["source_in_future"]


def test_election_commission_information_names_its_document_link_and_time():
    assert rules.check_notice("election_commission", "https://e.example", "Gazette 1", NOW) == []
    assert rules.check_notice("election_commission", "https://e.example", None, NOW) == ["official_source_required"]
    assert rules.check_notice("election_commission", None, "Gazette 1", NOW) == ["official_source_required"]
    assert rules.check_notice("party", None, None, None) == []


def test_every_election_item_carries_exactly_one_of_two_labels():
    assert set(rules.LABELS) == {"election_commission", "party"}  # FR-ELX-004
    assert rules.LABELS["election_commission"][0] == "Election Commission information"
    assert rules.LABELS["party"][0] == "Party information"


def test_only_a_declared_period_can_be_closed():
    assert rules.check_close("declared") is None
    assert rules.check_close("ended") == "not_allowed_from:ended"
    assert rules.check_close("withdrawn") == "not_allowed_from:withdrawn"


def test_the_countdown_counts_sri_lankan_days_and_stops_at_zero():
    late_evening = datetime(2026, 11, 12, 19, 0, tzinfo=UTC)  # 00:30 on 13 November in Sri Lanka
    assert rules.days_to_polling(POLLING_DAY, late_evening) == 1
    assert rules.days_to_polling(POLLING_DAY, late_evening - timedelta(hours=1)) == 2
    assert rules.days_to_polling(POLLING_DAY, POLL_END + timedelta(days=3)) == 0


# --- Feature flags (FR-ARCH-011) ----------------------------------------------------------------------------


def test_a_module_belongs_to_the_gate_that_closes_its_phase():
    assert features.FEATURES["identity_appeals"].gate == "G1"
    assert features.FEATURES["election_mode"].gate == "G2"
    assert features.check_gate(features.FEATURES["identity_appeals"], "G1") is None
    assert features.check_gate(features.FEATURES["identity_appeals"], "G0") == "gate_must_be:G1"


def test_a_module_is_turned_on_only_after_its_gate_is_recorded():
    assert features.check_enable(gate_recorded=False) == "gate_not_recorded"
    assert features.check_enable(gate_recorded=True) is None


# --- Manual check-in (FR-VOI-007) ---------------------------------------------------------------------------


def manual(**overrides):
    values = {"member_found": True, "within_window": True, "already_attended": False, "pass_problem": None}
    return events.manual_result(**(values | overrides))


def test_a_typed_member_id_is_held_to_the_same_rules_as_a_pass():
    assert manual() == "checked_in"
    assert manual(member_found=False) == "not_valid"
    assert manual(within_window=False) == "outside_window"
    assert manual(already_attended=True) == "already_checked_in"
    assert manual(pass_problem="not_going") == "not_eligible"
    assert manual(pass_problem="membership_not_active") == "not_eligible"
