"""/v1/identity/me/review/appeal and /v1/identity/appeals against a real database. Skipped without DATABASE_URL.

Database changes are rolled back afterwards; images go to a temporary evidence store.
"""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Row, text
from sqlalchemy.exc import DBAPIError

APPEAL = "idv.appeal.decide"
VERIFY = "members.verify"
VIEW = "members.view_identity_evidence"
CHECKLIST = ["pages_present", "readable", "details_match_profile", "selfie_reviewable", "area_checked"]


@pytest.fixture
def client(identity_client) -> TestClient:
    return identity_client


@pytest.fixture
def member(member_in, area) -> Row:
    return member_in(area)


@pytest.fixture
def reviewer(make_reviewer, area) -> Row:
    return make_reviewer(area.district)


@pytest.fixture
def decider(make_reviewer, area) -> Row:
    """A regional coordinator (Tier 4) who decides appeals and can open evidence across the province."""
    return make_reviewer(area.province, permissions=(APPEAL, VIEW, VERIFY), tier="4", level="province")


@pytest.fixture
def decided(client, auth, submitted) -> Callable[..., dict]:
    """Submit the member's images and have a reviewer claim and decide; returns the review file."""

    def run(member: Row, reviewer: Row, **decision) -> dict:
        review_ref = submitted(member)["reviewRef"]
        [found] = client.get("/v1/identity/reviews", params={"ref": review_ref}, headers=auth(reviewer)).json()
        client.post(f"/v1/identity/reviews/{found['id']}/claim", headers=auth(reviewer))
        response = client.post(f"/v1/identity/reviews/{found['id']}/decision", json=decision, headers=auth(reviewer))
        assert response.status_code == 200, response.text
        return response.json()

    return run


UNABLE = {"decision": "unable_to_verify", "reasonCategory": "document_not_valid"}
UPDATE = {"decision": "request_update", "items": ["nic_back"], "reasonCategory": "image_unreadable"}


def appeal(client, auth, member: Row, statement: str = "The card is mine; please look again.") -> object:
    return client.post("/v1/identity/me/review/appeal", json={"statement": statement}, headers=auth(member))


def appeal_id(client, auth, decider: Row) -> str:
    [found] = client.get("/v1/identity/appeals", headers=auth(decider)).json()
    return found["id"]


def last_audit(db_session) -> Row:
    return db_session.execute(
        text("SELECT action, actor_id, target_id, details FROM ops.audit_log ORDER BY id DESC LIMIT 1")
    ).one()


# --- The member's appeal (M04) -------------------------------------------------------------------------


def test_a_member_appeals_an_adverse_decision_once(client, db_session, auth, decided, member, reviewer):
    decided(member, reviewer, **UNABLE)

    response = appeal(client, auth, member)

    assert response.status_code == 200
    filed = response.json()["history"][0]["appeal"]
    assert filed["appealRef"].startswith("VA-")
    assert (filed["state"], filed["statement"], filed["outcomeReason"]) == (
        "submitted", "The card is mine; please look again.", None
    )
    entry = last_audit(db_session)
    assert (entry.action, entry.actor_id, entry.details["appealedDecision"]) == (
        "identity.appeal.submitted", member.id, "unable_to_verify"
    )
    assert "statement" not in entry.details and "please look again" not in str(entry.details)

    again = appeal(client, auth, member)
    assert (again.status_code, again.json()["detail"]) == (409, {"code": "appeal_refused", "problems": ["appeal_used"]})


def test_only_adverse_decisions_can_be_appealed(client, auth, submitted, decided, member, member_in, area, reviewer):
    assert appeal(client, auth, member).json()["detail"]["problems"] == ["nothing_to_appeal"]  # no review yet
    submitted(member)
    assert appeal(client, auth, member).json()["detail"]["problems"] == ["nothing_to_appeal"]  # not decided yet

    for statement in ("", "   ", "x" * 1001):
        assert appeal(client, auth, member, statement).status_code == 422


def test_resubmitting_waits_for_the_appeal(client, auth, upload, decided, member, reviewer):
    decided(member, reviewer, **UPDATE)
    appeal(client, auth, member)
    upload(member, "nic_back")

    response = client.post("/v1/identity/me/review", json={"route": "nic", "declaration": True}, headers=auth(member))

    assert (response.status_code, response.json()["detail"]["problems"]) == (409, ["appeal_pending"])


# --- Deciding an appeal (D05, PRM-29) ---------------------------------------------------------------------


def test_appeals_are_decided_only_by_holders_of_idv_appeal_decide(client, auth, decided, member, reviewer, decider):
    decided(member, reviewer, **UNABLE)
    appeal(client, auth, member)

    assert client.get("/v1/identity/appeals", headers=auth(reviewer)).json() == {"detail": "forbidden"}
    [listed] = client.get("/v1/identity/appeals", headers=auth(decider)).json()
    assert (listed["appealedDecision"], listed["state"]) == ("unable_to_verify", "submitted")


def test_the_original_reviewer_never_decides_the_appeal(client, auth, decided, member, decider):
    decided(member, decider, **UNABLE)  # the regional coordinator made the first decision
    appeal(client, auth, member)

    response = client.post(f"/v1/identity/appeals/{appeal_id(client, auth, decider)}/claim", headers=auth(decider))

    assert (response.status_code, response.json()) == (409, {"detail": "original_reviewer"})


def test_claiming_an_appeal_opens_the_evidence_to_the_decider(client, db_session, auth, decided, member, reviewer, decider):
    file = decided(member, reviewer, **UNABLE)
    appeal(client, auth, member)
    image = file["documents"][0]["id"]
    view_link = f"/v1/identity/documents/{image}/view-link"
    assert client.post(view_link, headers=auth(decider)).json() == {"detail": "no_open_review"}

    claimed = client.post(f"/v1/identity/appeals/{appeal_id(client, auth, decider)}/claim", headers=auth(decider)).json()

    assert (claimed["state"], claimed["claimedBy"]) == ("in_review", str(decider.id))
    assert claimed["decision"]["decision"] == "unable_to_verify"
    assert claimed["statement"] == "The card is mine; please look again."
    assert client.post(view_link, headers=auth(decider)).status_code == 200
    assert last_audit(db_session).action == "identity.evidence.link_issued"


def test_upholding_keeps_the_decision_and_tells_the_member_why(client, db_session, auth, decided, member, reviewer, decider):
    decided(member, reviewer, **UNABLE)
    appeal(client, auth, member)
    aid = appeal_id(client, auth, decider)
    client.post(f"/v1/identity/appeals/{aid}/claim", headers=auth(decider))

    upheld = client.post(
        f"/v1/identity/appeals/{aid}/decision",
        json={"outcome": "uphold", "reason": "The card number is not a valid NIC."},
        headers=auth(decider),
    ).json()

    assert (upheld["state"], upheld["deciderTier"], upheld["review"]["state"]) == ("upheld", "4", "unable_to_verify")
    mine = client.get("/v1/identity/me/review", headers=auth(member))
    outcome = mine.json()["history"][0]["appeal"]
    assert (outcome["state"], outcome["outcomeReason"], outcome["deciderTier"]) == (
        "upheld", "The card number is not a valid NIC.", "4"
    )
    assert str(decider.id) not in mine.text
    entry = last_audit(db_session)
    assert (entry.action, entry.details["outcome"]) == ("identity.appeal.decided", "uphold")

    # The outcome is final (FR-IDV-013), and the member may start a new review afterwards.
    with pytest.raises(DBAPIError), db_session.begin_nested():
        db_session.execute(text("UPDATE identity.review_appeal SET state = 'overturned' WHERE id = :id"), {"id": aid})
    again = client.post("/v1/identity/me/review", json={"route": "nic", "declaration": True}, headers=auth(member))
    assert again.json()["state"] == "submitted"


def test_overturning_sends_the_review_back_for_someone_else_to_decide(
    client, db_session, auth, decided, make_reviewer, member, reviewer, decider, area
):
    file = decided(member, reviewer, **UNABLE)
    appeal(client, auth, member)
    aid = appeal_id(client, auth, decider)
    client.post(f"/v1/identity/appeals/{aid}/claim", headers=auth(decider))

    overturned = client.post(
        f"/v1/identity/appeals/{aid}/decision",
        json={"outcome": "overturn", "reason": "The images are clear enough to review again."},
        headers=auth(decider),
    ).json()

    assert overturned["state"] == "overturned"
    assert (overturned["review"]["state"], overturned["review"]["claimedBy"]) == ("submitted", None)
    status = db_session.scalar(text("SELECT verification_status FROM npm.member WHERE id = :id"), {"id": member.id})
    assert status == "review_pending"  # back in review in the live member app too

    again = client.post(f"/v1/identity/reviews/{file['id']}/claim", headers=auth(reviewer))
    assert (again.status_code, again.json()) == (409, {"detail": "overturned_on_appeal"})

    colleague = make_reviewer(area.district)
    claimed = client.post(f"/v1/identity/reviews/{file['id']}/claim", headers=auth(colleague)).json()
    for document in claimed["documents"]:
        url = client.post(f"/v1/identity/documents/{document['id']}/view-link", headers=auth(colleague)).json()["url"]
        client.get(url, headers=auth(colleague))
    approved = client.post(
        f"/v1/identity/reviews/{file['id']}/decision",
        json={"decision": "approve", "checklist": CHECKLIST},
        headers=auth(colleague),
    ).json()
    assert approved["state"] == "verified"
    assert [d["decision"] for d in approved["decisions"]] == ["unable_to_verify", "approve"]
    assert approved["decisions"][0]["appeal"]["state"] == "overturned"


def test_overturning_a_correction_request(client, db_session, auth, decided, member, reviewer, decider):
    decided(member, reviewer, **UPDATE)
    appeal(client, auth, member, "The back of my card is readable.")
    aid = appeal_id(client, auth, decider)
    client.post(f"/v1/identity/appeals/{aid}/claim", headers=auth(decider))

    overturned = client.post(
        f"/v1/identity/appeals/{aid}/decision", json={"outcome": "overturn", "reason": "It is readable."}, headers=auth(decider)
    ).json()

    assert overturned["review"]["state"] == "submitted"
    assert client.get("/v1/identity/me/review", headers=auth(member)).json()["state"] == "submitted"


def test_only_the_person_holding_the_appeal_decides_it(client, auth, decided, make_reviewer, member, reviewer, decider, area):
    decided(member, reviewer, **UNABLE)
    appeal(client, auth, member)
    aid = appeal_id(client, auth, decider)
    other = make_reviewer(area.province, permissions=(APPEAL, VIEW), tier="4", level="province")
    body = {"outcome": "uphold", "reason": "Not valid."}

    unclaimed = client.post(f"/v1/identity/appeals/{aid}/decision", json=body, headers=auth(decider))
    assert (unclaimed.status_code, unclaimed.json()) == (409, {"detail": "not_open"})

    client.post(f"/v1/identity/appeals/{aid}/claim", headers=auth(decider))
    by_other = client.post(f"/v1/identity/appeals/{aid}/decision", json=body, headers=auth(other))
    taken = client.post(f"/v1/identity/appeals/{aid}/claim", headers=auth(other))
    no_reason = client.post(f"/v1/identity/appeals/{aid}/decision", json={"outcome": "uphold", "reason": ""}, headers=auth(decider))

    assert (by_other.status_code, by_other.json()) == (409, {"detail": "not_claimed_by_you"})
    assert (taken.status_code, taken.json()) == (409, {"detail": "claimed_by_another"})
    assert no_reason.status_code == 422


def test_nobody_decides_their_own_appeal(client, auth, decided, member_in, area, reviewer, assign, super_admin):
    decider = member_in(area)
    assign(decider, "4", "province", area.province, [APPEAL, VIEW], granted_by=super_admin)
    decided(decider, reviewer, **UNABLE)
    appeal(client, auth, decider)
    [own] = client.get("/v1/identity/appeals", headers=auth(decider)).json()

    response = client.post(f"/v1/identity/appeals/{own['id']}/claim", headers=auth(decider))

    assert (response.status_code, response.json()) == (403, {"detail": "own_record"})
