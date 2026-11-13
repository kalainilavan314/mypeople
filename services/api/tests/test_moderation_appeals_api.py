"""One appeal against a moderation decision on an idea or added information (D12) against a real database."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db.session import get_db
from app.main import create_app

SUMMARY = {
    "publish": True, "titleEn": "Leaking water main near the school", "titleTa": "பாடசாலை அருகே நீர்க்குழாய் கசிவு",
    "summaryEn": "A leaking water main near the school gate has been reported.",
    "summaryTa": "பாடசாலை வாயில் அருகே நீர்க்குழாய் கசிவு முறையிடப்பட்டுள்ளது.",
}
APPEAL = "My note only described the leak; it named nobody and gave no contact details."


@pytest.fixture
def client(identity_client):
    return identity_client


@pytest.fixture
def moderators(create_member, assign, area, super_admin, db_session):
    """Two moderators over the test district: the first decides, the second reviews the appeal.
    Moderators already in the database copy are set aside inside the rolled-back transaction."""
    db_session.execute(
        text(
            """UPDATE access.staff_assignment SET state = 'revoked', ended_at = now()
               WHERE state = 'active' AND 'content.moderate' = ANY(permissions) AND member_id <> :keep"""
        ),
        {"keep": super_admin.id},
    )

    def moderator():
        person = create_member(verified=True)
        assign(person, "3A", "district", area.district, ["content.moderate"], granted_by=super_admin)
        return person

    return moderator(), moderator()


def notices(db_session, member, template):
    return db_session.scalar(
        text("SELECT count(*) FROM notifications.notification WHERE member_id = :id AND template = :template"),
        {"id": member.id, "template": template},
    )


def rejected_addition(client, auth, member_in, area, first_moderator):
    """A public case with a published summary, information a neighbour added, and its rejection."""
    reporter = member_in(area, verified=True, active=True)
    neighbour = member_in(area, verified=True, active=True)
    case_id = client.post("/v1/issues", json={
        "clientReference": str(uuid.uuid4()), "category": "water", "title": "Leaking water pipe at the school",
        "description": "The water pipe beside the school gate has been leaking for a week.", "locationKind": "my_gn",
        "visibility": "public",
    }, headers=auth(reporter)).json()["id"]
    client.post(f"/v1/cases/{case_id}/public-summary", json=SUMMARY, headers=auth(first_moderator))
    addition_id = client.post(f"/v1/issues/{case_id}/information", json={"body": "The leak is worse after rain."},
                              headers=auth(neighbour)).json()["id"]
    rejected = client.post(f"/v1/cases/{case_id}/additions/{addition_id}/moderation",
                           json={"approve": False, "reason": "Duplicate of the report"}, headers=auth(first_moderator))
    assert rejected.status_code == 200, rejected.text
    return case_id, addition_id, neighbour


def rejected_idea(db_session, member_in, area, moderator):
    author = member_in(area, verified=True, active=True)
    path = ["platform", f"province:{area.province}", f"district:{area.district}", f"ds:{area.ds}", f"gn:{area.gn}"]
    idea_id = db_session.scalar(
        text(
            """
            INSERT INTO community.idea (author_id, title, benefit, area_key, area_path, state, moderation_reason,
                                        moderated_by, moderated_at)
            VALUES (:author, 'A reading room at the library', 'Students would have a quiet place to study after school.',
                    :key, :path, 'rejected', 'Not specific enough', :moderator, now())
            RETURNING id
            """
        ),
        {"author": author.id, "key": path[-1], "path": path, "moderator": moderator.id},
    )
    return str(idea_id), author


def test_the_author_appeals_a_rejected_addition_once_and_another_moderator_changes_it(
    client, auth, member_in, area, moderators, db_session
):
    first, second = moderators
    case_id, addition_id, neighbour = rejected_addition(client, auth, member_in, area, first)

    before = client.get(f"/v1/issues/{case_id}", headers=auth(neighbour)).json()["myAdditions"]
    appealed = client.post("/v1/moderation-appeals", json={"itemKind": "addition", "itemId": addition_id, "body": APPEAL},
                           headers=auth(neighbour))
    again = client.post("/v1/moderation-appeals", json={"itemKind": "addition", "itemId": addition_id, "body": APPEAL},
                        headers=auth(neighbour))
    after = client.get(f"/v1/issues/{case_id}", headers=auth(neighbour)).json()["myAdditions"]

    assert [(a["id"], a["state"], a["moderationReason"], a["canAppeal"], a["appeal"]) for a in before] == [
        (addition_id, "rejected", "Duplicate of the report", True, None)
    ]
    assert appealed.status_code == 201
    assert (appealed.json()["state"], appealed.json()["reason"]) == ("open", None)
    assert again.status_code == 422 and again.json()["detail"] == {"code": "appeal_refused", "problems": ["already_appealed"]}
    assert after[0]["canAppeal"] is False and after[0]["appeal"]["state"] == "open"
    mine = client.get("/v1/moderation-appeals/mine", params={"itemKind": "addition", "itemId": addition_id},
                      headers=auth(neighbour)).json()
    assert mine["appeal"]["id"] == appealed.json()["id"]

    # The moderator who rejected it cannot decide the appeal; the queue says so.
    listed = client.get("/v1/moderation-appeals/manage", headers=auth(first)).json()
    ours = [a for a in listed if a["id"] == appealed.json()["id"]]
    assert ours and ours[0]["canDecide"] is False
    assert (ours[0]["itemText"], ours[0]["originalReason"], ours[0]["body"], ours[0]["issueId"]) == (
        "The leak is worse after rain.", "Duplicate of the report", APPEAL, case_id,
    )
    assert ours[0]["caseNumber"].startswith("CI-")
    own = client.post(f"/v1/moderation-appeals/manage/{appealed.json()['id']}/decision",
                      json={"change": True, "reason": "Fine"}, headers=auth(first))
    assert (own.status_code, own.json()["detail"]) == (403, "original_moderator")

    decided = client.post(f"/v1/moderation-appeals/manage/{appealed.json()['id']}/decision",
                          json={"change": True, "reason": "It adds a useful detail about the rain."}, headers=auth(second))
    assert decided.status_code == 200, decided.text
    assert (decided.json()["state"], decided.json()["itemState"], decided.json()["canDecide"]) == ("changed", "approved", False)
    twice = client.post(f"/v1/moderation-appeals/manage/{appealed.json()['id']}/decision",
                        json={"change": False, "reason": "No change"}, headers=auth(second))
    assert twice.json()["detail"]["problems"] == ["already_decided"]

    seen = client.get(f"/v1/issues/{case_id}", headers=auth(neighbour)).json()
    assert [u["body"] for u in seen["communityUpdates"]] == ["The leak is worse after rain."]
    assert seen["myAdditions"][0]["appeal"]["state"] == "changed"
    assert seen["myAdditions"][0]["appeal"]["reason"] == "It adds a useful detail about the rain."
    assert notices(db_session, neighbour, "addition_appeal_decided") == 1
    target = db_session.scalar(
        text("SELECT target_id FROM notifications.notification WHERE member_id = :id AND template = 'addition_appeal_decided'"),
        {"id": neighbour.id},
    )
    assert str(target) == case_id
    history = client.get(f"/v1/cases/{case_id}", headers=auth(second)).json()["history"]
    assert history[-1]["kind"] == "addition_moderated" and history[-1]["details"]["approved"] is True
    audited = db_session.execute(
        text("""SELECT action, details FROM ops.audit_log WHERE target_type = 'moderation_appeal' AND target_id = :id
                ORDER BY id"""),
        {"id": appealed.json()["id"]},
    ).all()
    assert [row.action for row in audited] == ["moderation_appeal.submitted", "access.denied", "moderation_appeal.decided"]
    assert audited[1].details["reason"] == "original_moderator"  # the first moderator's attempt is on record
    assert audited[2].details == {"itemKind": "addition", "itemId": addition_id, "outcome": "changed"}
    assert APPEAL not in str([row.details for row in audited])  # ids and outcomes only


def test_only_the_author_of_a_rejected_item_appeals(client, auth, member_in, area, moderators, db_session):
    first, _ = moderators
    case_id, addition_id, neighbour = rejected_addition(client, auth, member_in, area, first)
    stranger = member_in(area, verified=True, active=True)
    pending = client.post(f"/v1/issues/{case_id}/information", json={"body": "Still leaking this morning."},
                          headers=auth(neighbour)).json()["id"]

    someone_else = client.post("/v1/moderation-appeals", json={"itemKind": "addition", "itemId": addition_id, "body": APPEAL},
                               headers=auth(stranger))
    not_rejected = client.post("/v1/moderation-appeals", json={"itemKind": "addition", "itemId": pending, "body": APPEAL},
                               headers=auth(neighbour))
    too_short = client.post("/v1/moderation-appeals", json={"itemKind": "addition", "itemId": addition_id, "body": "No"},
                            headers=auth(neighbour))
    only_spaces = client.post("/v1/moderation-appeals",
                              json={"itemKind": "addition", "itemId": addition_id, "body": "    why       "},
                              headers=auth(neighbour))
    missing = client.post("/v1/moderation-appeals", json={"itemKind": "idea", "itemId": addition_id, "body": APPEAL},
                          headers=auth(neighbour))

    assert (someone_else.status_code, someone_else.json()["detail"]) == (404, "not_found")
    assert not_rejected.status_code == 422 and not_rejected.json()["detail"]["problems"] == ["not_rejected"]
    assert too_short.status_code == 422
    assert only_spaces.json()["detail"] == {"code": "appeal_refused", "problems": ["appeal_too_short"]}
    assert missing.status_code == 404
    assert client.get("/v1/moderation-appeals/mine", params={"itemKind": "addition", "itemId": addition_id},
                      headers=auth(stranger)).json() == {"appeal": None}


def test_an_idea_appeal_is_upheld_by_a_second_moderator_with_a_reason(client, auth, member_in, area, moderators, db_session):
    first, second = moderators
    idea_id, author = rejected_idea(db_session, member_in, area, first)

    appealed = client.post("/v1/moderation-appeals", json={"itemKind": "idea", "itemId": idea_id, "body": APPEAL},
                           headers=auth(author))
    upheld = client.post(f"/v1/moderation-appeals/manage/{appealed.json()['id']}/decision",
                         json={"change": False, "reason": "It still needs a place and a cost."}, headers=auth(second))
    idea = db_session.execute(text("SELECT state, moderation_reason FROM community.idea WHERE id = :id"), {"id": idea_id}).one()
    mine = client.get("/v1/moderation-appeals/mine", params={"itemKind": "idea", "itemId": idea_id}, headers=auth(author)).json()

    assert appealed.status_code == 201 and appealed.json()["itemKind"] == "idea"
    assert upheld.status_code == 200 and upheld.json()["state"] == "upheld"
    assert (idea.state, idea.moderation_reason) == ("rejected", "Not specific enough")
    assert (mine["appeal"]["state"], mine["appeal"]["reason"]) == ("upheld", "It still needs a place and a cost.")
    assert notices(db_session, author, "idea_appeal_decided") == 1


def test_a_changed_idea_decision_publishes_it(client, auth, member_in, area, moderators, db_session):
    first, second = moderators
    idea_id, author = rejected_idea(db_session, member_in, area, first)
    appeal_id = client.post("/v1/moderation-appeals", json={"itemKind": "idea", "itemId": idea_id, "body": APPEAL},
                            headers=auth(author)).json()["id"]

    changed = client.post(f"/v1/moderation-appeals/manage/{appeal_id}/decision",
                          json={"change": True, "reason": "Clear enough for the area."}, headers=auth(second))
    idea = db_session.execute(
        text("SELECT state, moderation_reason, moderated_by FROM community.idea WHERE id = :id"), {"id": idea_id}
    ).one()

    assert changed.status_code == 200 and changed.json()["itemState"] == "published"
    assert (idea.state, idea.moderation_reason, idea.moderated_by) == ("published", None, second.id)


def test_appeals_are_decided_only_inside_the_moderators_areas_and_never_on_ones_own(
    client, auth, member_in, area, moderators, create_member, assign, super_admin, db_session
):
    first, _ = moderators
    idea_id, author = rejected_idea(db_session, member_in, area, first)
    appeal_id = client.post("/v1/moderation-appeals", json={"itemKind": "idea", "itemId": idea_id, "body": APPEAL},
                            headers=auth(author)).json()["id"]
    elsewhere = create_member(verified=True)
    other_district = db_session.scalar(
        text("SELECT district_code FROM geo.district WHERE district_code <> :d ORDER BY district_code LIMIT 1"),
        {"d": area.district},
    )
    assign(elsewhere, "3A", "district", other_district, ["content.moderate"], granted_by=super_admin)
    assign(author, "3A", "district", area.district, ["content.moderate"], granted_by=super_admin)

    outside = client.post(f"/v1/moderation-appeals/manage/{appeal_id}/decision",
                          json={"change": True, "reason": "Fine"}, headers=auth(elsewhere))
    listed = client.get("/v1/moderation-appeals/manage", headers=auth(elsewhere)).json()
    own = client.post(f"/v1/moderation-appeals/manage/{appeal_id}/decision",
                      json={"change": True, "reason": "Fine"}, headers=auth(author))
    member = client.get("/v1/moderation-appeals/manage", headers=auth(member_in(area, verified=True, active=True)))

    assert (outside.status_code, outside.json()["detail"]) == (403, "outside_your_area")
    assert appeal_id not in [a["id"] for a in listed]
    assert (own.status_code, own.json()["detail"]) == (403, "own_record")
    assert member.status_code == 403


def test_the_database_refuses_a_decision_by_the_original_moderator(member_in, area, moderators, db_session):
    first, _ = moderators
    idea_id, author = rejected_idea(db_session, member_in, area, first)
    appeal_id = db_session.scalar(
        text(
            """INSERT INTO community.moderation_appeal (item_kind, item_id, member_id, body, original_moderator, area_path)
               VALUES ('idea', :item, :member, :body, :moderator, '{platform}') RETURNING id"""
        ),
        {"item": idea_id, "member": author.id, "body": APPEAL, "moderator": first.id},
    )
    with pytest.raises(Exception, match="moderation_appeal_other_person"):
        with db_session.begin_nested():
            db_session.execute(
                text("""UPDATE community.moderation_appeal SET state = 'upheld', reason = 'No', decided_by = :by,
                        decided_at = now() WHERE id = :id"""),
                {"by": first.id, "id": appeal_id},
            )


def test_an_appeal_is_closed_while_its_module_is_switched_off(database_settings, db_session, auth, member_in, area, moderators):
    app = create_app(database_settings.model_copy(update={"enforce_feature_flags": True}))
    app.dependency_overrides[get_db] = lambda: db_session
    enforced = TestClient(app)
    first, _ = moderators
    idea_id, author = rejected_idea(db_session, member_in, area, first)
    db_session.execute(text("UPDATE ops.feature_flag SET enabled = false WHERE key IN ('ideas_surveys', 'community_issues')"))

    appealed = enforced.post("/v1/moderation-appeals", json={"itemKind": "idea", "itemId": idea_id, "body": APPEAL},
                             headers=auth(author))
    mine = enforced.get("/v1/moderation-appeals/mine", params={"itemKind": "addition", "itemId": idea_id}, headers=auth(author))
    listed = enforced.get("/v1/moderation-appeals/manage", headers=auth(first))

    assert (appealed.status_code, appealed.json()["detail"]) == (404, "feature_unavailable")
    assert (mine.status_code, mine.json()["detail"]) == (404, "feature_unavailable")
    assert listed.status_code == 200 and listed.json() == []
