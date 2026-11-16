"""Quarterly privileged-access reviews (FR-AUTH-027, NFR-SEC-13, KPI-42) against a real database.
Skipped without DATABASE_URL. Everything is rolled back afterwards."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import Row, text

from app.modules.access.rules import quarter_end, quarter_of, review_due

NOW = datetime.now(UTC)
DUE_THIS_QUARTER = quarter_end(NOW) - timedelta(hours=1)
OVERDUE = NOW - timedelta(days=1)


@pytest.fixture
def regional_reviewer(create_member, assign, super_admin, area) -> Row:
    member = create_member(verified=True, active=True)
    assign(member, "4", "province", area.province, ["audit.view", "members.verify"], granted_by=super_admin,
           review_due_at=quarter_end(quarter_end(NOW)))
    return member


@pytest.fixture
def coordinator(create_member) -> Row:
    return create_member(verified=True, active=True)


def due_ids(client, headers) -> list[str]:
    return [item["id"] for item in client.get("/v1/access/reviews", headers=headers).json()["items"]]


def review(client, assignment_id, headers, decision="confirmed", reason="Still runs the district office"):
    return client.post(f"/v1/access/reviews/{assignment_id}", json={"decision": decision, "reason": reason}, headers=headers)


def test_the_list_holds_grants_due_this_quarter_that_the_reviewer_may_review(
    db_client, auth, assign, super_admin, regional_reviewer, coordinator, create_member, area
):
    due = assign(coordinator, "3A", "district", area.district, ["members.verify"], granted_by=super_admin,
                 review_due_at=DUE_THIS_QUARTER)
    later = create_member(verified=True, active=True)
    assign(later, "3A", "district", area.district, ["members.verify"], granted_by=super_admin,
           review_due_at=quarter_end(quarter_end(NOW)))

    listed = db_client.get("/v1/access/reviews", headers=auth(regional_reviewer)).json()

    assert listed["quarter"] == quarter_of(NOW)
    assert [item["id"] for item in listed["items"]] == [due]
    assert listed["items"][0]["overdue"] is False and listed["items"][0]["memberCode"]
    assert db_client.get("/v1/access/reviews", headers=auth(coordinator)).json() == {"detail": "forbidden"}


def test_confirming_keeps_the_grant_for_another_quarter(db_client, db_session, auth, assign, super_admin, regional_reviewer, coordinator, area):
    due = assign(coordinator, "3A", "district", area.district, ["members.verify"], granted_by=super_admin,
                 review_due_at=DUE_THIS_QUARTER)
    before = db_client.get("/v1/access/reviews", headers=auth(regional_reviewer)).json()["reviewedThisQuarter"]

    confirmed = review(db_client, due, auth(regional_reviewer))
    again = review(db_client, due, auth(regional_reviewer))

    assert confirmed.status_code == 200, confirmed.text
    assert datetime.fromisoformat(confirmed.json()["reviewDueAt"]) == review_due("3A", NOW)
    assert (again.status_code, again.json()) == (409, {"detail": "not_due"})
    listed = db_client.get("/v1/access/reviews", headers=auth(regional_reviewer)).json()
    assert due not in [item["id"] for item in listed["items"]] and listed["reviewedThisQuarter"] == before + 1
    stored = db_session.execute(
        text("SELECT quarter, decision, reason, reviewed_by FROM access.assignment_review WHERE assignment_id = :id"),
        {"id": due},
    ).one()
    assert (stored.quarter, stored.decision, stored.reviewed_by) == (quarter_of(NOW), "confirmed", regional_reviewer.id)
    entry = db_session.execute(text("SELECT action, details FROM ops.audit_log ORDER BY id DESC LIMIT 1")).one()
    assert entry.action == "access.review.confirmed" and "reason" not in entry.details


def test_an_overdue_grant_is_suspended_until_someone_confirms_it(db_client, auth, assign, super_admin, regional_reviewer, coordinator, area):
    overdue = assign(coordinator, "3A", "district", area.district, ["members.verify"], granted_by=super_admin,
                     review_due_at=OVERDUE)
    assert db_client.get("/v1/access/me", headers=auth(coordinator)).json() == []
    listed = db_client.get("/v1/access/reviews", headers=auth(regional_reviewer)).json()["items"]
    assert [(item["id"], item["overdue"]) for item in listed] == [(overdue, True)]

    review(db_client, overdue, auth(regional_reviewer))

    assert [a["id"] for a in db_client.get("/v1/access/me", headers=auth(coordinator)).json()] == [overdue]


def test_revoking_ends_the_grant_and_needs_a_reason(db_client, db_session, auth, assign, super_admin, regional_reviewer, coordinator, area):
    due = assign(coordinator, "3A", "district", area.district, ["members.verify"], granted_by=super_admin,
                 review_due_at=DUE_THIS_QUARTER)

    no_reason = review(db_client, due, auth(regional_reviewer), decision="revoked", reason="")
    revoked = review(db_client, due, auth(regional_reviewer), decision="revoked", reason="Left the district office")

    assert no_reason.status_code == 422
    assert revoked.json()["state"] == "revoked"
    assert db_client.get("/v1/access/me", headers=auth(coordinator)).json() == []
    ended = db_session.execute(text("SELECT ended_by, end_reason FROM access.staff_assignment WHERE id = :id"), {"id": due}).one()
    assert (ended.ended_by, ended.end_reason) == (regional_reviewer.id, "Left the district office")


def test_reviewers_stay_in_their_area_below_their_tier_and_off_their_own_grant(
    db_client, db_session, auth, assign, super_admin, regional_reviewer, create_member, area
):
    peer = create_member(verified=True, active=True)
    peer_grant = assign(peer, "4", "province", area.province, ["audit.view"], granted_by=super_admin,
                        review_due_at=DUE_THIS_QUARTER)
    own = db_session.scalar(
        text("SELECT id FROM access.staff_assignment WHERE member_id = :id"), {"id": regional_reviewer.id}
    )
    db_session.execute(text("UPDATE access.staff_assignment SET review_due_at = :due WHERE id = :id"),
                       {"due": DUE_THIS_QUARTER, "id": own})
    # Only the Northern Province is seeded, so the test adds a district in another one (rolled back).
    db_session.execute(text("INSERT INTO geo.province (province_code, name_en) VALUES ('ZZ9', 'Test province')"))
    db_session.execute(text("INSERT INTO geo.district (district_code, province_code, name_en) VALUES ('ZZ91', 'ZZ9', 'Test district')"))
    stranger = create_member(verified=True, active=True)
    elsewhere = assign(stranger, "3A", "district", "ZZ91", ["members.verify"], granted_by=super_admin,
                       review_due_at=DUE_THIS_QUARTER)
    plain_member = create_member(verified=True, active=True)

    assert due_ids(db_client, auth(regional_reviewer)) == []
    assert review(db_client, peer_grant, auth(regional_reviewer)).json() == {"detail": "tier_not_below_yours"}
    assert review(db_client, own, auth(regional_reviewer)).json() == {"detail": "own_assignment"}
    assert review(db_client, elsewhere, auth(regional_reviewer)).json() == {"detail": "outside_your_area"}
    assert review(db_client, peer_grant, auth(plain_member)).json() == {"detail": "forbidden"}
    unknown = review(db_client, "00000000-0000-0000-0000-000000000000", auth(regional_reviewer))
    assert (unknown.status_code, unknown.json()) == (404, {"detail": "not_found"})
    # The Super Administrator reviews Tier 4 grants.
    assert set(due_ids(db_client, auth(super_admin))) >= {peer_grant, str(own), elsewhere}
    assert review(db_client, peer_grant, auth(super_admin)).status_code == 200
    refusal = db_session.execute(
        text("SELECT details FROM ops.audit_log WHERE action = 'access.denied' AND actor_id = :id ORDER BY id LIMIT 1"),
        {"id": regional_reviewer.id},
    ).scalar_one()
    assert (refusal["permission"], refusal["reason"]) == ("audit.view", "tier_not_below_yours")


def test_new_grants_are_due_at_the_end_of_the_next_quarter(db_client, auth, super_admin, create_member, area):
    member = create_member(verified=True, active=True)
    body = {
        "memberId": str(member.id),
        "tier": "3A",
        "area": {"level": "district", "code": area.district},
        "permissions": ["cases.decide_district"],  # default-only grants are reviewed too
    }

    preview = db_client.post("/v1/access/assignment-previews", json=body, headers=auth(super_admin))
    assert preview.status_code == 201
    created = db_client.post(
        f"/v1/access/assignment-previews/{preview.json()['id']}/confirm", headers=auth(super_admin)
    ).json()

    assert datetime.fromisoformat(created["reviewDueAt"]) == review_due("3A", NOW)
