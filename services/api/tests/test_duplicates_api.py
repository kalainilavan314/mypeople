"""/v1/identity/duplicates against a real database. Skipped without DATABASE_URL.

Database changes are rolled back afterwards; images go to a temporary evidence store.
"""

import uuid
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Row, text
from sqlalchemy.exc import DBAPIError

INVESTIGATE = "idv.duplicate.investigate"
VIEW = "members.view_identity_evidence"


@pytest.fixture
def client(identity_client) -> TestClient:
    return identity_client


@pytest.fixture
def person(db_session, member_in, area) -> Callable[..., Row]:
    """A member in the area with the given name and date of birth."""

    def create(name: str, dob: str = "1990-04-12") -> Row:
        member = member_in(area)
        db_session.execute(
            text("UPDATE npm.member SET full_name = :name, dob = :dob WHERE id = :id"),
            {"name": name, "dob": dob, "id": member.id},
        )
        return member

    return create


@pytest.fixture
def unique_name() -> str:
    # Unlike any real member's name, so only this test's accounts can match.
    return f"Test Person {uuid.uuid4().hex[:10]}"


@pytest.fixture
def reviewer(make_reviewer, area) -> Row:
    return make_reviewer(area.district)


@pytest.fixture
def investigator(make_reviewer, area) -> Row:
    """A regional coordinator (Tier 4) who investigates duplicates across the province."""
    return make_reviewer(area.province, permissions=(INVESTIGATE, VIEW), tier="4", level="province")


def cases_between(db_session, first: Row, second: Row) -> list[Row]:
    a, b = sorted([first.id, second.id])
    return db_session.execute(
        text("SELECT id, case_ref, signal, state FROM identity.duplicate_case WHERE member_a = :a AND member_b = :b"),
        {"a": a, "b": b},
    ).all()


def last_audit(db_session) -> Row:
    return db_session.execute(
        text("SELECT action, actor_id, target_id, details FROM ops.audit_log ORDER BY id DESC LIMIT 1")
    ).one()


# --- Opening a case ------------------------------------------------------------------------------


def test_the_same_name_and_birth_date_opens_a_case_on_submission(
    client, db_session, auth, submitted, person, reviewer, unique_name
):
    first = person(unique_name)
    second = person(f"  {unique_name.upper()}  ")

    review = submitted(second)

    [case] = cases_between(db_session, first, second)
    assert (case.signal, case.state) == ("profile_match", "open")
    opened = db_session.execute(
        text("SELECT actor_id, details FROM ops.audit_log WHERE action = 'identity.duplicate.opened' ORDER BY id DESC LIMIT 1")
    ).one()
    assert opened.actor_id is None and opened.details["caseRef"] == case.case_ref

    [found] = client.get("/v1/identity/reviews", params={"ref": review["reviewRef"]}, headers=auth(reviewer)).json()
    flags = client.get(f"/v1/identity/reviews/{found['id']}", headers=auth(reviewer)).json()["duplicateFlags"]
    assert flags == [{"caseRef": case.case_ref, "state": "open", "signal": "profile_match", "otherMemberId": str(first.id)}]

    # A flag only: the review goes ahead and neither account changes (BR-094).
    assert review["state"] == "submitted"
    state = db_session.scalar(text("SELECT verification_status FROM npm.member WHERE id = :id"), {"id": first.id})
    assert state == "unverified"


def test_different_birth_dates_do_not_match(db_session, submitted, person, unique_name):
    first = person(unique_name, "1990-04-12")
    second = person(unique_name, "1991-04-12")

    submitted(second)

    assert cases_between(db_session, first, second) == []


def test_a_reviewer_reports_a_suspected_duplicate(client, db_session, auth, person, reviewer, unique_name):
    first = person(unique_name)
    second = person("Someone Else")
    body = {"memberId": str(first.id), "otherMemberId": str(second.id), "reason": "The same NIC photo on both."}

    reported = client.post("/v1/identity/duplicates", json=body, headers=auth(reviewer))
    again = client.post("/v1/identity/duplicates", json=body, headers=auth(reviewer))

    assert reported.status_code == 200
    assert (reported.json()["signal"], reported.json()["state"]) == ("reported", "open")
    assert again.json()["caseRef"] == reported.json()["caseRef"]  # one case per pair
    entry = last_audit(db_session)
    assert (entry.action, entry.actor_id, entry.details["signal"]) == ("identity.duplicate.opened", reviewer.id, "reported")
    assert "NIC photo" not in str(entry.details)

    same = client.post("/v1/identity/duplicates", json={**body, "otherMemberId": str(first.id)}, headers=auth(reviewer))
    assert (same.status_code, same.json()["detail"]["problems"]) == (422, ["same_member"])


# --- Investigating (D04, PRM-28) ------------------------------------------------------------------


@pytest.fixture
def case_id(client, auth, upload, person, reviewer, investigator, unique_name) -> Callable[[], tuple[str, Row, Row]]:
    def open_case() -> tuple[str, Row, Row]:
        first, second = person(unique_name), person("Another Name")
        upload(first)
        upload(second)
        body = {"memberId": str(first.id), "otherMemberId": str(second.id), "reason": "Same face on both accounts."}
        client.post("/v1/identity/duplicates", json=body, headers=auth(reviewer))
        [listed] = client.get("/v1/identity/duplicates", headers=auth(investigator)).json()
        return listed["id"], first, second

    return open_case


def test_claiming_opens_both_accounts_evidence_to_the_investigator(client, auth, case_id, investigator, reviewer):
    cid, first, second = case_id()
    file = client.get(f"/v1/identity/duplicates/{cid}", headers=auth(investigator)).json()
    images = [m["documents"][0]["id"] for m in file["members"]]
    assert {m["memberId"] for m in file["members"]} == {str(first.id), str(second.id)}
    assert client.post(f"/v1/identity/documents/{images[0]}/view-link", headers=auth(investigator)).json() == {
        "detail": "no_open_review"
    }

    claimed = client.post(f"/v1/identity/duplicates/{cid}/claim", headers=auth(investigator)).json()

    assert (claimed["state"], claimed["claimedBy"]) == ("in_review", str(investigator.id))
    for image in images:
        assert client.post(f"/v1/identity/documents/{image}/view-link", headers=auth(investigator)).status_code == 200
    assert client.get("/v1/identity/duplicates", headers=auth(reviewer)).json() == {"detail": "forbidden"}


def test_the_finding_changes_neither_account_and_is_final(client, db_session, auth, case_id, investigator):
    cid, first, second = case_id()
    client.post(f"/v1/identity/duplicates/{cid}/claim", headers=auth(investigator))

    decided = client.post(
        f"/v1/identity/duplicates/{cid}/decision",
        json={"outcome": "duplicate_confirmed", "reason": "The same person registered twice."},
        headers=auth(investigator),
    ).json()

    assert (decided["state"], decided["decidedBy"], decided["outcomeReason"]) == (
        "duplicate_confirmed", str(investigator.id), "The same person registered twice."
    )
    assert {m["membershipState"] for m in decided["members"]} == {"pending"}  # BR-094: no automatic action
    entry = last_audit(db_session)
    assert (entry.action, entry.details["outcome"]) == ("identity.duplicate.decided", "duplicate_confirmed")
    with pytest.raises(DBAPIError), db_session.begin_nested():
        db_session.execute(text("UPDATE identity.duplicate_case SET state = 'not_duplicate' WHERE id = :id"), {"id": cid})


def test_only_the_investigator_holding_the_case_decides(client, auth, case_id, investigator, make_reviewer, area):
    cid, _, _ = case_id()
    colleague = make_reviewer(area.province, permissions=(INVESTIGATE, VIEW), tier="4", level="province")
    body = {"outcome": "not_duplicate", "reason": "Different people."}

    unclaimed = client.post(f"/v1/identity/duplicates/{cid}/decision", json=body, headers=auth(investigator))
    client.post(f"/v1/identity/duplicates/{cid}/claim", headers=auth(investigator))
    taken = client.post(f"/v1/identity/duplicates/{cid}/claim", headers=auth(colleague))
    by_colleague = client.post(f"/v1/identity/duplicates/{cid}/decision", json=body, headers=auth(colleague))
    released = client.post(f"/v1/identity/duplicates/{cid}/release", headers=auth(investigator)).json()

    assert (unclaimed.status_code, unclaimed.json()) == (409, {"detail": "not_open"})
    assert (taken.status_code, taken.json()) == (409, {"detail": "claimed_by_another"})
    assert (by_colleague.status_code, by_colleague.json()) == (409, {"detail": "not_claimed_by_you"})
    assert (released["state"], released["claimedBy"]) == ("open", None)


def test_nobody_investigates_their_own_account(client, auth, person, reviewer, assign, super_admin, area, unique_name):
    investigator = person(unique_name)
    assign(investigator, "4", "province", area.province, [INVESTIGATE, VIEW], granted_by=super_admin)
    other = person("Unrelated Name")
    body = {"memberId": str(other.id), "otherMemberId": str(investigator.id), "reason": "Looks like the same person."}
    client.post("/v1/identity/duplicates", json=body, headers=auth(reviewer))
    [listed] = client.get("/v1/identity/duplicates", headers=auth(investigator)).json()

    response = client.post(f"/v1/identity/duplicates/{listed['id']}/claim", headers=auth(investigator))

    assert (response.status_code, response.json()) == (403, {"detail": "own_record"})
