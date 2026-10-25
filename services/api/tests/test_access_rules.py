"""The access rules and the permission matrix, without a database."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.modules.access.permissions import MATRIX, TIER_AREA_LEVEL, TIERS, default_permissions, grant_for
from app.modules.access.rules import (
    PLATFORM,
    Area,
    Assignment,
    AssignmentRequest,
    Grantee,
    check_assignment,
    check_revocation,
    holds,
    review_due,
)

PROVINCE = Area("province", "LK4")
DISTRICT = Area("district", "LK41")
OTHER_DISTRICT = Area("district", "LK42")
DISTRICT_PATH = (PLATFORM, PROVINCE, DISTRICT)
OTHER_DISTRICT_PATH = (PLATFORM, PROVINCE, OTHER_DISTRICT)
ELSEWHERE_PATH = (PLATFORM, Area("province", "LK5"), Area("district", "LK51"))

ADMIN_ID = uuid.uuid4()
MEMBER_ID = uuid.uuid4()

SUPER_ADMIN = [Assignment("5", PLATFORM, frozenset(default_permissions("5")))]
REGIONAL_ADMIN = [Assignment("4", PROVINCE, frozenset({"roles.assign", "members.verify", "audit.view"}))]
VERIFIED = Grantee(member_id=MEMBER_ID, identity_verified=True, assignments=())


def district_coordinator(*permissions: str, member_id: uuid.UUID = MEMBER_ID) -> AssignmentRequest:
    return AssignmentRequest(member_id=member_id, tier="3A", area=DISTRICT, permissions=frozenset(permissions))


def check(request, *, granter=SUPER_ADMIN, grantee=VERIFIED, area_path=DISTRICT_PATH):
    return check_assignment(
        granter_id=ADMIN_ID, granter_assignments=granter, grantee=grantee, request=request, area_path=area_path
    )


# --- The matrix (BRD §9.4, §9.8) ------------------------------------------------


def test_every_permission_names_real_tiers():
    for permission, tiers in MATRIX.items():
        assert tiers, permission
        assert set(tiers) <= set(TIERS), permission
        assert set(tiers.values()) <= {"default", "explicit"}, permission


@pytest.mark.parametrize(
    ("permission", "tier", "expected"),
    [
        ("members.verify", "3A", "explicit"),  # PRM-04: Dt*
        ("members.verify", "5", "explicit"),  # P*: even the Super Administrator only by explicit grant
        ("members.verify", "1", None),  # never for a GN coordinator
        ("roles.assign", "5", "default"),
        ("roles.assign", "4", "explicit"),
        ("roles.assign", "3A", None),
        ("cases.collect", "1", "default"),
        ("finance.review", "3B", "explicit"),  # PRM-14: only District Operations / Finance
        ("finance.review", "5", None),
        ("assistance.decide", "3A", "explicit"),
        ("analytics.view", "2B", "default"),
    ],
)
def test_matrix_matches_the_brd(permission, tier, expected):
    assert grant_for(permission, tier) == expected


def test_each_tier_has_one_kind_of_area():
    assert TIER_AREA_LEVEL == {
        "1": "gn", "2A": "ds", "2B": "ds", "3A": "district", "3B": "district", "4": "province", "5": "platform",
    }


def test_defaults_never_include_explicit_only_permissions():
    assert "roles.assign" in default_permissions("5")
    assert "members.verify" not in default_permissions("5")


# --- Creating an assignment ----------------------------------------------------------


def test_a_valid_assignment_has_no_problems():
    assert check(district_coordinator("cases.decide_district", "analytics.view")) == []


def test_nobody_assigns_their_own_tier():  # BR-083
    assert "self_assignment" in check(district_coordinator("analytics.view", member_id=ADMIN_ID))


def test_staff_must_have_a_verified_identity():  # BR-097
    unverified = Grantee(member_id=MEMBER_ID, identity_verified=False, assignments=())
    assert "identity_not_verified" in check(district_coordinator("analytics.view"), grantee=unverified)


def test_unknown_member_and_area():
    assert check(district_coordinator("analytics.view"), grantee=None) == ["unknown_member"]
    assert "unknown_area" in check(district_coordinator("analytics.view"), area_path=None)


def test_tier_five_comes_only_from_the_bootstrap_command():
    request = AssignmentRequest(member_id=MEMBER_ID, tier="5", area=PLATFORM, permissions=frozenset({"analytics.view"}))
    assert "tier_5_by_bootstrap_only" in check(request, area_path=(PLATFORM,))


def test_area_must_match_the_tier():
    request = AssignmentRequest(member_id=MEMBER_ID, tier="1", area=DISTRICT, permissions=frozenset({"cases.collect"}))
    assert "area_does_not_match_tier" in check(request)


def test_permissions_must_exist_and_suit_the_tier():
    problems = check(district_coordinator("cases.collect", "made.up"))
    assert "permission_not_for_tier:cases.collect" in problems
    assert "unknown_permission:made.up" in problems
    assert "no_permissions" in check(district_coordinator())


def test_rb03_no_area_wider_than_your_own():
    assert "outside_your_area" in check(district_coordinator("analytics.view"), granter=REGIONAL_ADMIN, area_path=ELSEWHERE_PATH)


def test_rb03_only_tiers_below_your_own():
    regional_request = AssignmentRequest(member_id=MEMBER_ID, tier="4", area=PROVINCE, permissions=frozenset({"analytics.view"}))
    problems = check(regional_request, granter=REGIONAL_ADMIN, area_path=(PLATFORM, PROVINCE))
    assert "tier_not_below_yours" in problems


def test_rb03_no_permission_you_could_hold_but_do_not():
    # members.verify is explicit-only for Tier 5 too; this Super Administrator was not given it.
    assert "permission_not_held:members.verify" in check(district_coordinator("members.verify"))
    with_verify = [Assignment("5", PLATFORM, frozenset(default_permissions("5")) | {"members.verify"})]
    assert check(district_coordinator("members.verify"), granter=with_verify) == []


def test_rb03_lower_tier_work_can_be_assigned_by_those_who_never_do_it():
    # Tier 4 can never hold cases.decide_district, yet must be able to appoint district coordinators.
    assert check(district_coordinator("cases.decide_district"), granter=REGIONAL_ADMIN) == []


def test_without_roles_assign_nothing_can_be_granted():
    reviewer = [Assignment("4", PROVINCE, frozenset({"members.verify"}))]
    assert "outside_your_area" in check(district_coordinator("analytics.view"), granter=reviewer)


def test_rb12_assistance_decisions_never_sit_with_fundraising_in_the_same_area():
    treasurer = Grantee(
        member_id=MEMBER_ID,
        identity_verified=True,
        assignments=((Assignment("3B", DISTRICT, frozenset({"finance.review"})), DISTRICT_PATH),),
    )
    granter = [Assignment("4", PROVINCE, frozenset({"roles.assign", "assistance.decide"}))]

    assert "separation_of_duties" in check(district_coordinator("assistance.decide"), granter=granter, grantee=treasurer)
    elsewhere = check(district_coordinator("assistance.decide"), granter=granter, grantee=treasurer, area_path=OTHER_DISTRICT_PATH)
    assert "separation_of_duties" not in elsewhere


# --- Checks, revocation and review ------------------------------------------------------


def test_holds_checks_the_area():
    coordinator = [Assignment("3A", DISTRICT, frozenset({"cases.decide_district"}))]
    assert holds(coordinator, "cases.decide_district", DISTRICT_PATH + (Area("ds", "LK4103"),))
    assert not holds(coordinator, "cases.decide_district", OTHER_DISTRICT_PATH)
    assert holds(coordinator, "cases.decide_district")  # anywhere
    assert not holds(coordinator, "members.verify")


def test_revocation_rules():
    coordinator = Assignment("3A", DISTRICT, frozenset({"analytics.view"}))
    regional = Assignment("4", PROVINCE, frozenset({"analytics.view"}))

    def revoke(assignment, member_id=MEMBER_ID, granter=REGIONAL_ADMIN, path=DISTRICT_PATH):
        return check_revocation(granter_id=ADMIN_ID, granter_assignments=granter, member_id=member_id, assignment=assignment, area_path=path)

    assert revoke(coordinator) == []
    assert revoke(coordinator, member_id=ADMIN_ID) == ["own_assignment"]
    assert revoke(regional, path=(PLATFORM, PROVINCE)) == ["tier_not_below_yours"]
    assert revoke(coordinator, path=ELSEWHERE_PATH) == ["outside_your_area"]
    assert revoke(Assignment("5", PLATFORM, frozenset({"roles.assign"})), path=(PLATFORM,)) == ["tier_5_by_bootstrap_only"]


def test_explicit_grants_are_due_for_review_within_a_year():  # RB-05
    now = datetime(2026, 10, 25, tzinfo=UTC)
    assert review_due("3A", frozenset({"members.verify"}), now) == now + timedelta(days=365)
    assert review_due("3A", frozenset({"cases.decide_district"}), now) is None
