"""/v1/identity/me/review and /v1/identity/reviews against a real database. Skipped without DATABASE_URL.

Database changes are rolled back afterwards; images go to a temporary evidence store.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Row, text
from sqlalchemy.exc import DBAPIError

VERIFY = "members.verify"
VIEW = "members.view_identity_evidence"
CHECKLIST = ["pages_present", "readable", "details_match_profile", "selfie_reviewable", "area_checked"]
NIC_IMAGES = ("nic_front", "nic_back", "selfie")


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
def colleague(make_reviewer, area) -> Row:
    return make_reviewer(area.district)


def review_id(client, auth, staff: Row, review_ref: str) -> str:
    [found] = client.get("/v1/identity/reviews", params={"ref": review_ref}, headers=auth(staff)).json()
    return found["id"]


def view_every_image(client, auth, staff: Row, file: dict) -> None:
    for document in file["documents"]:
        url = client.post(f"/v1/identity/documents/{document['id']}/view-link", headers=auth(staff)).json()["url"]
        assert client.get(url, headers=auth(staff)).status_code == 200


def express_status(db_session, member: Row) -> Row:
    return db_session.execute(
        text("SELECT verification_status, verified_by, verified_at FROM npm.member WHERE id = :id"), {"id": member.id}
    ).one()


def last_audit(db_session) -> Row:
    return db_session.execute(
        text("SELECT action, actor_id, target_id, area_code, details FROM ops.audit_log ORDER BY id DESC LIMIT 1")
    ).one()


# --- Submitting (A09, FR-REG-019; BR-004, BR-011) -------------------------------------------------


def test_submitting_creates_one_review_reference(client, db_session, auth, submitted, member, area):
    review = submitted(member)

    assert review["reviewRef"].startswith("VR-")
    assert (review["state"], review["route"], review["history"]) == ("submitted", "nic", [])
    again = client.post("/v1/identity/me/review", json={"route": "nic", "declaration": True}, headers=auth(member))
    assert again.json()["reviewRef"] == review["reviewRef"]  # a repeated tap is the same review
    count = db_session.scalar(text("SELECT count(*) FROM identity.identity_review WHERE member_id = :id"), {"id": member.id})
    assert count == 1

    assert express_status(db_session, member).verification_status == "review_pending"  # the live app shows "in review"
    entry = last_audit(db_session)
    assert (entry.action, entry.actor_id, entry.area_code) == ("identity.review.submitted", member.id, area.gn)
    assert entry.details["reviewRef"] == review["reviewRef"]
    assert client.get("/v1/identity/me/review", headers=auth(member)).json()["reviewRef"] == review["reviewRef"]


def test_submitting_needs_every_image_of_the_route(client, auth, upload, member):
    upload(member, "nic_front")
    upload(member, "nic_back")

    nic = client.post("/v1/identity/me/review", json={"route": "nic", "declaration": True}, headers=auth(member))
    passport = client.post("/v1/identity/me/review", json={"route": "passport", "declaration": True}, headers=auth(member))

    assert (nic.status_code, nic.json()["detail"]) == (409, {"code": "submission_refused", "problems": ["missing:selfie"]})
    assert passport.json()["detail"]["problems"] == ["route_mismatch"]  # BR-003: a NIC account stays on the NIC route
    assert client.get("/v1/identity/me/review", headers=auth(member)).json() is None


def test_submitting_needs_the_declaration(client, auth, member):
    response = client.post("/v1/identity/me/review", json={"route": "nic", "declaration": False}, headers=auth(member))
    assert response.status_code == 422


def test_a_verified_member_does_not_submit_again(client, auth, upload, member_in, area):
    verified = member_in(area, verified=True)
    for kind in NIC_IMAGES:
        upload(verified, kind)

    response = client.post("/v1/identity/me/review", json={"route": "nic", "declaration": True}, headers=auth(verified))

    assert response.json()["detail"]["problems"] == ["already_verified"]


# --- The queue (W01, FR-WEB-001, 002) -----------------------------------------------------------------


def test_reviewers_see_only_their_area(client, db_session, auth, make_reviewer, submitted, member, reviewer, area):
    review = submitted(member)
    other_district = db_session.scalar(
        text("SELECT district_code FROM geo.district WHERE district_code <> :code ORDER BY district_code LIMIT 1"),
        {"code": area.district},
    )
    outsider = make_reviewer(other_district)

    mine = client.get("/v1/identity/reviews", headers=auth(reviewer)).json()
    theirs = client.get("/v1/identity/reviews", headers=auth(outsider)).json()

    assert review["reviewRef"] in [r["reviewRef"] for r in mine]
    assert review["reviewRef"] not in [r["reviewRef"] for r in theirs]
    assert client.get("/v1/identity/reviews/counts", headers=auth(reviewer)).json()["awaitingReview"] >= 1
    opened = client.get(f"/v1/identity/reviews/{review_id(client, auth, reviewer, review['reviewRef'])}", headers=auth(outsider))
    assert (opened.status_code, opened.json()) == (403, {"detail": "outside_your_area"})


def test_members_without_members_verify_are_refused(client, auth, member, make_reviewer, area):
    viewer_only = make_reviewer(area.district, permissions=[VIEW])
    for person in (member, viewer_only):
        assert client.get("/v1/identity/reviews", headers=auth(person)).json() == {"detail": "forbidden"}


# --- Claiming (FR-WEB-003) and the evidence it opens (PRM-03) -------------------------------------------------


def test_claiming_opens_the_evidence_to_one_reviewer(client, db_session, auth, submitted, member, reviewer, colleague):
    review = submitted(member)
    rid = review_id(client, auth, reviewer, review["reviewRef"])
    first_image = client.get(f"/v1/identity/reviews/{rid}", headers=auth(reviewer)).json()["documents"][0]["id"]
    view_link = f"/v1/identity/documents/{first_image}/view-link"
    assert client.post(view_link, headers=auth(reviewer)).json() == {"detail": "no_open_review"}  # not claimed yet

    claimed = client.post(f"/v1/identity/reviews/{rid}/claim", headers=auth(reviewer)).json()

    assert (claimed["state"], claimed["claimedBy"]) == ("in_review", str(reviewer.id))
    assert claimed["claimedByName"] == "Test Member"
    assert client.post(view_link, headers=auth(reviewer)).status_code == 200
    assert last_audit(db_session).action == "identity.evidence.link_issued"

    taken = client.post(f"/v1/identity/reviews/{rid}/claim", headers=auth(colleague))
    assert (taken.status_code, taken.json()) == (409, {"detail": "claimed_by_another"})
    seen_by_colleague = client.get(f"/v1/identity/reviews/{rid}", headers=auth(colleague)).json()
    assert seen_by_colleague["claimedBy"] == str(reviewer.id)  # "In review by …", read-only
    assert client.post(view_link, headers=auth(colleague)).json() == {"detail": "no_open_review"}
    assert client.get("/v1/identity/reviews/counts", headers=auth(reviewer)).json()["assignedToMe"] == 1


def test_releasing_closes_the_evidence_again(client, auth, submitted, member, reviewer, colleague):
    rid = review_id(client, auth, reviewer, submitted(member)["reviewRef"])
    client.post(f"/v1/identity/reviews/{rid}/claim", headers=auth(reviewer))

    not_theirs = client.post(f"/v1/identity/reviews/{rid}/release", headers=auth(colleague))
    released = client.post(f"/v1/identity/reviews/{rid}/release", headers=auth(reviewer)).json()

    assert (not_theirs.status_code, not_theirs.json()) == (409, {"detail": "not_claimed_by_you"})
    assert (released["state"], released["claimedBy"]) == ("submitted", None)
    image = released["documents"][0]["id"]
    assert client.post(f"/v1/identity/documents/{image}/view-link", headers=auth(reviewer)).json() == {
        "detail": "no_open_review"
    }


def test_a_review_held_by_a_former_reviewer_can_be_taken_over(
    client, db_session, auth, submitted, member, reviewer, colleague
):
    rid = review_id(client, auth, reviewer, submitted(member)["reviewRef"])
    client.post(f"/v1/identity/reviews/{rid}/claim", headers=auth(reviewer))
    db_session.execute(
        text("UPDATE access.staff_assignment SET state = 'revoked', ended_at = now() WHERE member_id = :id"),
        {"id": reviewer.id},
    )

    taken = client.post(f"/v1/identity/reviews/{rid}/claim", headers=auth(colleague))

    assert (taken.status_code, taken.json()["claimedBy"]) == (200, str(colleague.id))
    entry = last_audit(db_session)
    assert (entry.action, entry.details["takenOverFrom"]) == ("identity.review.claimed", str(reviewer.id))


def test_nobody_reviews_their_own_record(client, auth, submitted, member_in, area, assign, super_admin):
    reviewer = member_in(area)
    assign(reviewer, "3A", "district", area.district, [VERIFY, VIEW], granted_by=super_admin)
    own = review_id(client, auth, reviewer, submitted(reviewer)["reviewRef"])

    for response in (
        client.get(f"/v1/identity/reviews/{own}", headers=auth(reviewer)),
        client.post(f"/v1/identity/reviews/{own}/claim", headers=auth(reviewer)),
    ):
        assert (response.status_code, response.json()) == (403, {"detail": "own_record"})


# --- Deciding (W02, FR-WEB-007 to 011; BR-082) ------------------------------------------------------------


@pytest.fixture
def in_review(client, auth, submitted, member, reviewer) -> dict:
    """The member's review, claimed by the reviewer; returns the review file."""
    rid = review_id(client, auth, reviewer, submitted(member)["reviewRef"])
    return client.post(f"/v1/identity/reviews/{rid}/claim", headers=auth(reviewer)).json()


def decide(client, auth, staff: Row, file: dict, **body) -> object:
    return client.post(f"/v1/identity/reviews/{file['id']}/decision", json=body, headers=auth(staff))


def test_approval_needs_the_checklist_and_every_image_opened(client, db_session, auth, in_review, member, reviewer):
    unseen = decide(client, auth, reviewer, in_review, decision="approve", checklist=CHECKLIST)
    assert (unseen.status_code, unseen.json()["detail"]["code"]) == (422, "decision_refused")
    assert unseen.json()["detail"]["problems"] == [f"evidence_not_viewed:{kind}" for kind in NIC_IMAGES]

    view_every_image(client, auth, reviewer, in_review)
    partial = decide(client, auth, reviewer, in_review, decision="approve", checklist=CHECKLIST[:4])
    assert partial.json()["detail"]["problems"] == ["checklist_incomplete:area_checked"]

    approved = decide(client, auth, reviewer, in_review, decision="approve", checklist=CHECKLIST).json()

    assert approved["state"] == "verified" and approved["decidedAt"]
    [decision] = approved["decisions"]
    assert (decision["decision"], decision["reviewerId"], decision["reviewerTier"]) == ("approve", str(reviewer.id), "3A")
    assert {kind: d["id"] for kind, d in decision["evidence"].items()} == {d["kind"]: d["id"] for d in in_review["documents"]}
    status = express_status(db_session, member)
    assert (status.verification_status, status.verified_by) == ("identity_confirmed", reviewer.id)
    entry = last_audit(db_session)
    assert (entry.action, entry.actor_id, entry.details["decision"]) == ("identity.review.decided", reviewer.id, "approve")

    # The member sees the outcome and the reviewer's tier, never who it was (FR-PROF-006).
    mine = client.get("/v1/identity/me/review", headers=auth(member))
    assert mine.json()["state"] == "verified"
    assert mine.json()["history"][0]["reviewerTier"] == "3A"
    assert str(reviewer.id) not in mine.text

    # A closed review closes its evidence (PRM-03), and its decision can never be changed (FR-WEB-011).
    image = in_review["documents"][0]["id"]
    assert client.post(f"/v1/identity/documents/{image}/view-link", headers=auth(reviewer)).json() == {
        "detail": "no_open_review"
    }
    with pytest.raises(DBAPIError), db_session.begin_nested():
        db_session.execute(text("UPDATE identity.review_decision SET decision = 'unable_to_verify'"))


def test_a_correction_returns_to_the_same_review(client, db_session, auth, upload, in_review, member, reviewer):
    asked = decide(
        client,
        auth,
        reviewer,
        in_review,
        decision="request_update",
        items=["nic_back"],
        reasonCategory="image_unreadable",
        note="The back of the card is blurred.",
    ).json()
    assert asked["state"] == "needs_update"

    mine = client.get("/v1/identity/me/review", headers=auth(member)).json()
    assert mine["state"] == "needs_update"
    assert (mine["history"][0]["requestedItems"], mine["history"][0]["note"]) == (["nic_back"], "The back of the card is blurred.")

    resend = {"route": "nic", "declaration": True}
    not_yet = client.post("/v1/identity/me/review", json=resend, headers=auth(member))
    assert not_yet.json()["detail"]["problems"] == ["not_updated:nic_back"]

    upload(member, "nic_back")
    corrected = client.post("/v1/identity/me/review", json=resend, headers=auth(member)).json()

    assert (corrected["reviewRef"], corrected["state"]) == (mine["reviewRef"], "in_review")  # back with the same reviewer
    assert express_status(db_session, member).verification_status == "review_pending"
    assert last_audit(db_session).action == "identity.review.resubmitted"


def test_unable_to_verify_needs_a_reason_and_closes_the_review(client, db_session, auth, in_review, member, reviewer):
    no_reason = decide(client, auth, reviewer, in_review, decision="unable_to_verify")
    assert no_reason.json()["detail"]["problems"] == ["reason_required"]

    closed = decide(client, auth, reviewer, in_review, decision="unable_to_verify", reasonCategory="document_not_valid").json()

    assert closed["state"] == "unable_to_verify"
    assert express_status(db_session, member).verification_status == "nic_format"  # what was checked before review
    mine = client.get("/v1/identity/me/review", headers=auth(member)).json()
    assert mine["history"][0]["reasonCategory"] == "document_not_valid"

    again = client.post("/v1/identity/me/review", json={"route": "nic", "declaration": True}, headers=auth(member)).json()
    assert again["reviewRef"] != mine["reviewRef"] and again["state"] == "submitted"


def test_only_the_reviewer_holding_the_review_decides(client, auth, submitted, member, reviewer, colleague, in_review):
    by_colleague = decide(client, auth, colleague, in_review, decision="unable_to_verify", reasonCategory="other")
    assert (by_colleague.status_code, by_colleague.json()) == (409, {"detail": "not_claimed_by_you"})

    client.post(f"/v1/identity/reviews/{in_review['id']}/release", headers=auth(reviewer))
    unclaimed = decide(client, auth, reviewer, in_review, decision="unable_to_verify", reasonCategory="other")
    assert (unclaimed.status_code, unclaimed.json()) == (409, {"detail": "not_open"})


def test_requested_items_must_belong_to_the_route(client, auth, in_review, reviewer):
    response = decide(
        client, auth, reviewer, in_review, decision="request_update", items=["passport_page"], reasonCategory="other"
    )
    assert response.json()["detail"]["problems"] == ["item_not_for_route:passport_page"]
