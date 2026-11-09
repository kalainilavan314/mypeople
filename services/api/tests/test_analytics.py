"""D32 operational analytics: small-group suppression (RR-02, MP-DEC-001 5.2) and area scope (PRM-24)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.modules.analytics.rules import funnel, share, shown

# --- Rules, no database ------------------------------------------------------------------------


def test_groups_of_one_to_nine_are_hidden_but_zero_and_ten_are_shown():
    assert [shown(n) for n in (0, 1, 9, 10, 250)] == [0, None, None, 10, 250]


def test_a_funnel_step_is_hidden_when_its_drop_would_reveal_a_small_group():
    # 50 registered and 45 sent: showing both would reveal the 5 who did not.
    assert funnel([50, 45, 30, 30]) == [50, None, 30, 30]
    assert funnel([20, 20, 10, 10]) == [20, 20, 10, 10]
    assert funnel([12, 5, 0, 0]) == [12, None, 0, 0]


def test_a_share_needs_both_figures_shown():
    assert share(10, 20) == 0.5
    assert share(None, 20) is None
    assert share(10, None) is None
    assert share(0, 0) is None


# --- The endpoint, with a database --------------------------------------------------------------


@pytest.fixture
def client(db_client) -> TestClient:
    return db_client


def _path(area) -> list[str]:
    return ["platform", f"province:{area.province}", f"district:{area.district}", f"ds:{area.ds}", f"gn:{area.gn}"]


def _review(db_session, member, area, state: str) -> None:
    db_session.execute(
        text(
            """
            INSERT INTO identity.identity_review (member_id, route, state, area_path, decided_at)
            VALUES (:member_id, 'nic', :state, :area_path,
                    CASE WHEN :state IN ('verified', 'unable_to_verify') THEN now() END)
            """
        ),
        {"member_id": member.id, "state": state, "area_path": _path(area)},
    )


@pytest.fixture
def viewer(create_member, assign, super_admin, area):
    person = create_member(verified=True)
    assign(person, "3A", "district", area.district, ["analytics.view"], granted_by=super_admin)
    return person


def test_figures_cover_the_viewers_area_and_hide_small_groups(client, db_session, auth, member_in, area, viewer):
    members = [member_in(area) for _ in range(20)]
    for index, member in enumerate(members):
        verified = index < 10
        _review(db_session, member, area, "verified" if verified else "submitted")
        if verified:
            db_session.execute(
                text(
                    "INSERT INTO membership.membership (member_id, state, reason_code) "
                    "VALUES (:id, 'active', 'identity_verified') ON CONFLICT (member_id) DO UPDATE SET state = 'active'"
                ),
                {"id": member.id},
            )

    answer = client.get("/v1/analytics/operations", headers=auth(viewer))
    assert answer.status_code == 200
    figures = answer.json()
    assert figures["platformWide"] is False
    assert (figures["started"], figures["submitted"], figures["verified"], figures["active"]) == (20, 20, 10, 10)
    assert figures["completionRate"] == 0.5
    assert figures["decided"] == 10
    assert figures["withinTargetRate"] == 1.0  # all decided the same day
    assert figures["waiting"] == 10 and figures["overTarget"] == 0
    assert figures["going"] == 0 and figures["attended"] == 0


def test_a_small_group_comes_back_hidden_not_as_a_number(client, db_session, auth, member_in, area, viewer):
    for member in [member_in(area) for _ in range(4)]:
        _review(db_session, member, area, "submitted")
    figures = client.get("/v1/analytics/operations?periodDays=7", headers=auth(viewer)).json()
    assert figures["periodDays"] == 7
    assert figures["started"] is None and figures["submitted"] is None
    assert figures["waiting"] is None
    assert figures["completionRate"] is None


def test_another_district_sees_none_of_these_members(client, db_session, auth, create_member, assign, super_admin, member_in, area):
    for member in [member_in(area) for _ in range(12)]:
        _review(db_session, member, area, "submitted")
    other = db_session.execute(
        text("SELECT district_code FROM geo.district WHERE district_code <> :code ORDER BY district_code LIMIT 1"),
        {"code": area.district},
    ).scalar_one()
    elsewhere = create_member(verified=True)
    assign(elsewhere, "3A", "district", other, ["analytics.view"], granted_by=super_admin)
    figures = client.get("/v1/analytics/operations", headers=auth(elsewhere)).json()
    assert (figures["started"], figures["waiting"]) == (0, 0)


def test_analytics_need_the_permission(client, auth, create_member):
    assert client.get("/v1/analytics/operations", headers=auth(create_member(verified=True, active=True))).status_code == 403
