"""Wings and committees (BRD M31, M32, S18, D23; FR-COM-001 to 009, BR-132, RB-08, RB-09, OS-17)
against a real database."""

from datetime import date, timedelta

import pytest
from sqlalchemy import text


@pytest.fixture
def client(db_client):
    return db_client


@pytest.fixture
def administrator(create_member, assign, area, super_admin):
    """A Tier 4 role administrator for the province: proposes and assigns roles, cannot approve."""
    person = create_member(verified=True)
    assign(person, "4", "province", area.province, ["roles.assign"], granted_by=super_admin)
    return person


def member_code(db_session, person):
    return db_session.scalar(text("SELECT member_code FROM npm.member WHERE id = :id"), {"id": person.id})


def propose(client, auth, by, area, scope=None, **overrides):
    body = {
        "kind": "wing", "wingType": "farmers", "nameEn": "Farmers' wing", "nameTa": "விவசாயிகள் அணி",
        "purposeEn": "Farmers organising for water, seed and fair prices.",
        "purposeTa": "நீர், விதை, நியாய விலைக்காக ஒன்றிணையும் விவசாயிகள்.",
        "area": scope or {"level": "province", "code": area.province},
        **overrides,
    }
    response = client.post("/v1/committees/admin", json=body, headers=auth(by))
    assert response.status_code == 201, response.json()
    return response.json()


def approve(client, auth, approver, committee_id):
    response = client.post(f"/v1/committees/admin/{committee_id}/decision", json={"approve": True}, headers=auth(approver))
    assert response.status_code == 200, response.json()
    return response.json()


def active_committee(client, auth, administrator, super_admin, area, wing_type="farmers", **overrides):
    wing = propose(client, auth, administrator, area, wingType=wing_type)
    approve(client, auth, super_admin, wing["id"])
    committee = propose(client, auth, administrator, area, kind="committee", wingType=wing_type, wingId=wing["id"],
                        nameEn="Valikamam farmers' committee", nameTa="வலிகாமம் விவசாயிகள் குழு",
                        scope={"level": "district", "code": area.district}, **overrides)
    approve(client, auth, super_admin, committee["id"])
    return committee


@pytest.fixture
def committee(client, auth, administrator, super_admin, area):
    return active_committee(client, auth, administrator, super_admin, area)


@pytest.fixture
def coordinator(client, auth, administrator, committee, member_in, area, db_session):
    person = member_in(area, verified=True, active=True)
    granted = client.post(f"/v1/committees/admin/{committee['id']}/roles",
                          json={"memberCode": member_code(db_session, person), "role": "coordinator"},
                          headers=auth(administrator))
    assert granted.status_code == 200, granted.json()
    return person


def join(client, auth, coordinator, committee_id, person, role="member"):
    applied = client.post(f"/v1/committees/{committee_id}/applications", json={"note": "I farm paddy in Kopay."},
                          headers=auth(person))
    assert applied.status_code == 201, applied.json()
    decided = client.post(f"/v1/committees/{committee_id}/manage/applications/{applied.json()['id']}/decision",
                          json={"approve": True, "role": role}, headers=auth(coordinator))
    assert decided.status_code == 200, decided.json()
    return decided.json()


def post_item(client, auth, by, committee_id, **body):
    return client.post(f"/v1/committees/{committee_id}/manage/items", json={"title": "Water meeting",
                                                                            "body": "Details follow.", **body},
                       headers=auth(by))


def notices(db_session, person, template):
    return db_session.scalar(
        text("SELECT count(*) FROM notifications.notification WHERE member_id = :id AND template = :t"),
        {"id": person.id, "t": template},
    )


def test_a_wing_or_committee_exists_only_after_tier_5_approval(client, auth, administrator, super_admin, area,
                                                               member_in):
    member = member_in(area, verified=True, active=True)
    wing = propose(client, auth, administrator, area)
    hidden = [c["id"] for c in client.get("/v1/committees", headers=auth(member)).json()]
    not_tier5 = client.post(f"/v1/committees/admin/{wing['id']}/decision", json={"approve": True},
                            headers=auth(administrator))
    child_too_early = client.post("/v1/committees/admin", json={
        "kind": "committee", "wingType": "farmers", "wingId": wing["id"], "nameEn": "Early committee",
        "nameTa": "முந்திய குழு", "purposeEn": "A committee before its wing is approved.",
        "purposeTa": "அணி அங்கீகரிக்கப்படுமுன் ஒரு குழு.", "area": {"level": "district", "code": area.district},
    }, headers=auth(administrator))

    approved = approve(client, auth, super_admin, wing["id"])
    committee = propose(client, auth, administrator, area, kind="committee", wingId=wing["id"],
                        nameEn="Valikamam farmers' committee", scope={"level": "district", "code": area.district})
    before = [c["id"] for c in client.get("/v1/committees", headers=auth(member)).json()]
    approve(client, auth, super_admin, committee["id"])
    after = {c["id"]: c for c in client.get("/v1/committees", headers=auth(member)).json()}

    assert wing["state"] == "proposed" and wing["id"] not in hidden
    assert not_tier5.status_code == 403  # roles.assign alone cannot approve (FR-COM-001)
    assert child_too_early.json()["detail"]["problems"] == ["wing_not_active"]
    assert approved["state"] == "active"
    assert committee["id"] not in before
    assert after[committee["id"]]["applyProblem"] is None and after[committee["id"]]["wingNameEn"] == "Farmers' wing"


def test_access_opens_only_after_a_coordinator_approves(client, auth, committee, coordinator, member_in, area, db_session):
    member = member_in(area, verified=True, active=True)
    announced = post_item(client, auth, coordinator, committee["id"], itemType="announcement",
                          title="Seed distribution on Saturday")
    assert announced.status_code == 201, announced.json()

    applied = client.post(f"/v1/committees/{committee['id']}/applications", json={}, headers=auth(member))
    before = client.get(f"/v1/committees/{committee['id']}", headers=auth(member)).json()
    twice = client.post(f"/v1/committees/{committee['id']}/applications", json={}, headers=auth(member))
    waiting = notices(db_session, coordinator, "committee_application_received")
    manage = client.get(f"/v1/committees/{committee['id']}/manage", headers=auth(coordinator)).json()
    decided = client.post(f"/v1/committees/{committee['id']}/manage/applications/{applied.json()['id']}/decision",
                          json={"approve": True, "role": "secretary"}, headers=auth(coordinator))
    after = client.get(f"/v1/committees/{committee['id']}", headers=auth(member)).json()

    assert before["items"] == [] and before["myMembership"]["state"] == "applied"  # FR-COM-004
    assert twice.json()["detail"]["problems"] == ["already_applied"]
    assert waiting == 1 and [a["id"] for a in manage["applications"]] == [applied.json()["id"]]
    assert decided.json()["role"] == "secretary"
    assert after["myMembership"]["role"] == "secretary"
    assert [i["title"] for i in after["items"]] == ["Seed distribution on Saturday"]
    assert notices(db_session, member, "committee_application_decided") == 1
    # FR-COM-003: the role decision is logged with the coordinator who made it.
    entry = db_session.execute(text(
        "SELECT actor_id, details FROM ops.audit_log WHERE action = 'committee.application.approved' "
        "AND target_id = :id ORDER BY id DESC LIMIT 1"), {"id": applied.json()["id"]}).one()
    assert entry.actor_id == coordinator.id and entry.details == {"role": "secretary"}


def test_a_decline_needs_a_reason_and_the_member_may_apply_again(client, auth, committee, coordinator, member_in, area):
    member = member_in(area, verified=True, active=True)
    applied = client.post(f"/v1/committees/{committee['id']}/applications", json={}, headers=auth(member)).json()
    path = f"/v1/committees/{committee['id']}/manage/applications/{applied['id']}/decision"
    no_reason = client.post(path, json={"approve": False}, headers=auth(coordinator))
    declined = client.post(path, json={"approve": False, "reason": "Committee is full this season."},
                           headers=auth(coordinator))
    seen = client.get(f"/v1/committees/{committee['id']}", headers=auth(member)).json()
    again = client.post(f"/v1/committees/{committee['id']}/applications", json={}, headers=auth(member))

    assert no_reason.json()["detail"]["problems"] == ["reason_required"]
    assert declined.json()["state"] == "declined"
    assert seen["myMembership"]["decisionReason"] == "Committee is full this season."
    assert again.status_code == 201


def test_minutes_are_visible_only_after_another_coordinator_approves(client, auth, committee, coordinator, member_in,
                                                                     area, db_session):
    secretary = member_in(area, verified=True, active=True)
    member = member_in(area, verified=True, active=True)
    join(client, auth, coordinator, committee["id"], secretary, role="secretary")
    join(client, auth, coordinator, committee["id"], member)
    meeting = post_item(client, auth, secretary, committee["id"], itemType="meeting", title="Monthly meeting",
                        startsAt="2026-12-05T10:00:00+05:30", place="Kopay library").json()
    minutes = post_item(client, auth, secretary, committee["id"], itemType="minutes", title="Minutes of the monthly meeting",
                        body="Agreed to ask for a second tank.", meetingId=meeting["id"])
    assert minutes.status_code == 201, minutes.json()
    hidden = [i["id"] for i in client.get(f"/v1/committees/{committee['id']}", headers=auth(member)).json()["items"]]
    secretary_cannot = client.post(f"/v1/committees/{committee['id']}/manage/items/{minutes.json()['id']}/decision",
                                   json={"approve": True}, headers=auth(secretary))
    approved = client.post(f"/v1/committees/{committee['id']}/manage/items/{minutes.json()['id']}/decision",
                           json={"approve": True}, headers=auth(coordinator))
    shown = [i["id"] for i in client.get(f"/v1/committees/{committee['id']}", headers=auth(member)).json()["items"]]

    own = post_item(client, auth, coordinator, committee["id"], itemType="minutes", title="Coordinator's own minutes",
                    meetingId=meeting["id"]).json()
    own_decision = client.post(f"/v1/committees/{committee['id']}/manage/items/{own['id']}/decision",
                               json={"approve": True}, headers=auth(coordinator))

    assert minutes.json()["state"] == "awaiting_approval" and minutes.json()["id"] not in hidden
    assert notices(db_session, coordinator, "committee_minutes_waiting") == 1
    assert secretary_cannot.status_code == 403 and secretary_cannot.json()["detail"] == "coordinator_only"
    assert approved.json()["state"] == "published" and minutes.json()["id"] in shown
    assert own_decision.status_code == 403 and own_decision.json()["detail"] == "own_minutes"


def test_a_task_is_notified_and_appears_in_my_activity(client, auth, committee, coordinator, member_in, area,
                                                       db_session):
    member = member_in(area, verified=True, active=True)
    joined = join(client, auth, coordinator, committee["id"], member)
    due = (date.today() + timedelta(days=7)).isoformat()
    task = post_item(client, auth, coordinator, committee["id"], itemType="task", title="Collect the seed orders",
                     dueOn=due, assigneeMembershipId=joined["id"])
    assert task.status_code == 201, task.json()
    activity = client.get("/v1/profile/activity", params={"kind": "committee_task"}, headers=auth(member))
    space = client.get(f"/v1/committees/{committee['id']}", headers=auth(member)).json()
    done = client.post(f"/v1/committees/{committee['id']}/tasks/{task.json()['id']}/done", headers=auth(member))
    again = client.post(f"/v1/committees/{committee['id']}/tasks/{task.json()['id']}/done", headers=auth(member))

    assert notices(db_session, member, "committee_task_assigned") == 1
    assert activity.status_code == 200, activity.json()
    assert [(a["reference"], a["state"], a["targetId"]) for a in activity.json()] == [
        (task.json()["itemRef"], "open", committee["id"])]
    mine = next(i for i in space["items"] if i["id"] == task.json()["id"])
    assert mine["assignedToMe"] is True and mine["dueOn"] == due
    assert done.json()["doneAt"] is not None
    assert again.json()["detail"]["problems"] == ["already_done"]


def test_a_restricted_document_opens_only_for_named_roles(client, auth, committee, coordinator, member_in, area):
    secretary = member_in(area, verified=True, active=True)
    member = member_in(area, verified=True, active=True)
    join(client, auth, coordinator, committee["id"], secretary, role="secretary")
    join(client, auth, coordinator, committee["id"], member)
    document = post_item(client, auth, coordinator, committee["id"], itemType="document", title="Bank account details",
                         body="Account held at the cooperative.", accessRoles=["coordinator", "secretary"]).json()

    def ids(person):
        return [i["id"] for i in client.get(f"/v1/committees/{committee['id']}", headers=auth(person)).json()["items"]]

    assert document["id"] in ids(secretary)
    assert document["id"] not in ids(member)
    assert document["id"] in ids(coordinator)


def test_discussion_is_moderated_and_there_are_no_direct_messages(client, auth, committee, coordinator, member_in, area):
    member = member_in(area, verified=True, active=True)
    other = member_in(area, verified=True, active=True)
    join(client, auth, coordinator, committee["id"], member)
    join(client, auth, coordinator, committee["id"], other)
    thread = client.post(f"/v1/committees/{committee['id']}/threads",
                         json={"title": "Drip irrigation", "body": "Has anyone tried it?"}, headers=auth(member)).json()
    unseen = [i["id"] for i in client.get(f"/v1/committees/{committee['id']}", headers=auth(other)).json()["items"]]
    own_waiting = client.get(f"/v1/committees/{committee['id']}", headers=auth(member)).json()["myWaiting"]
    client.post(f"/v1/committees/{committee['id']}/manage/items/{thread['id']}/decision", json={"approve": True},
                headers=auth(coordinator))
    reply = client.post(f"/v1/committees/{committee['id']}/threads/{thread['id']}/posts", json={"body": "Yes, it works."},
                        headers=auth(other)).json()
    before = client.get(f"/v1/committees/{committee['id']}/threads/{thread['id']}", headers=auth(member)).json()
    moderated = client.post(f"/v1/committees/{committee['id']}/manage/posts/{reply['id']}/decision",
                            json={"decision": "publish"}, headers=auth(coordinator))
    after = client.get(f"/v1/committees/{committee['id']}/threads/{thread['id']}", headers=auth(member)).json()

    assert thread["state"] == "awaiting_approval" and thread["id"] not in unseen
    assert [i["id"] for i in own_waiting] == [thread["id"]]
    assert reply["state"] == "awaiting_approval" and before["posts"] == []
    assert moderated.json()["state"] == "published" and [p["body"] for p in after["posts"]] == ["Yes, it works."]
    # OS-17: nothing in the committees API sends anything to one person.
    paths = [path for path in client.app.openapi()["paths"] if path.startswith("/v1/committees")]
    assert not any(word in path for path in paths for word in ("message", "direct", "chat", "inbox"))


def test_coordinators_see_only_their_own_committee(client, auth, administrator, super_admin, committee, coordinator, area,
                                                   member_in):
    other = active_committee(client, auth, administrator, super_admin, area, wing_type="fishers")
    own = client.get(f"/v1/committees/{committee['id']}/manage", headers=auth(coordinator))
    foreign = client.get(f"/v1/committees/{other['id']}/manage", headers=auth(coordinator))
    member = member_in(area, verified=True, active=True)
    join(client, auth, coordinator, committee["id"], member)
    member_tools = client.get(f"/v1/committees/{committee['id']}/manage", headers=auth(member))
    coordinating = client.get("/v1/committees/coordinating", headers=auth(coordinator)).json()

    assert own.status_code == 200 and own.json()["report"]["coordinators"] == 1
    assert foreign.status_code == 403 and foreign.json()["detail"] == "not_committee_officer"  # FR-COM-009
    assert member_tools.status_code == 403
    assert [c["committee"]["id"] for c in coordinating] == [committee["id"]]


def test_administrators_see_the_roster_and_counts_never_the_content(client, auth, administrator, committee, coordinator,
                                                                    member_in, area):
    member = member_in(area, verified=True, active=True)
    join(client, auth, coordinator, committee["id"], member)
    post_item(client, auth, coordinator, committee["id"], itemType="announcement", title="Private plan")

    detail = client.get(f"/v1/committees/admin/{committee['id']}", headers=auth(administrator)).json()
    space = client.get(f"/v1/committees/{committee['id']}", headers=auth(administrator))
    tools = client.get(f"/v1/committees/{committee['id']}/manage", headers=auth(administrator))

    assert sorted(r["role"] for r in detail["roster"]) == ["coordinator", "member"]
    assert detail["report"]["announcements"] == 1 and "items" not in detail
    assert space.status_code == 404  # RB-08: an administrator's area never opens the committee space
    assert tools.status_code == 403


def test_a_committee_always_keeps_a_coordinator(client, auth, committee, coordinator, member_in, area):
    member = member_in(area, verified=True, active=True)
    joined = join(client, auth, coordinator, committee["id"], member)
    manage = client.get(f"/v1/committees/{committee['id']}/manage", headers=auth(coordinator)).json()
    own_row = next(r for r in manage["roster"] if r["role"] == "coordinator")

    demote_self = client.put(f"/v1/committees/{committee['id']}/manage/members/{own_row['id']}/role",
                             json={"role": "member"}, headers=auth(coordinator))
    leave = client.post(f"/v1/committees/{committee['id']}/leave", headers=auth(coordinator))
    promote = client.put(f"/v1/committees/{committee['id']}/manage/members/{joined['id']}/role",
                         json={"role": "coordinator"}, headers=auth(coordinator))
    removed = client.post(f"/v1/committees/{committee['id']}/manage/members/{joined['id']}/remove",
                          json={"reason": "Asked to step back."}, headers=auth(coordinator))
    space = client.get(f"/v1/committees/{committee['id']}", headers=auth(member)).json()

    assert demote_self.json()["detail"]["problems"] == ["last_coordinator"]
    assert leave.json()["detail"]["problems"] == ["last_coordinator"]
    assert promote.json()["role"] == "coordinator"
    assert removed.status_code == 204
    assert space["items"] == [] and space["myMembership"]["state"] == "removed"  # access ends at once


def test_volunteer_places_are_kept(client, auth, committee, coordinator, member_in, area):
    first = member_in(area, verified=True, active=True)
    second = member_in(area, verified=True, active=True)
    join(client, auth, coordinator, committee["id"], first)
    join(client, auth, coordinator, committee["id"], second)
    item = post_item(client, auth, coordinator, committee["id"], itemType="volunteer", title="Help at the seed fair",
                     dueOn=(date.today() + timedelta(days=3)).isoformat(), places=1).json()
    path = f"/v1/committees/{committee['id']}/volunteer/{item['id']}/signup"

    taken = client.put(path, json={"signedUp": True}, headers=auth(first))
    full = client.put(path, json={"signedUp": True}, headers=auth(second))
    names = client.get(f"/v1/committees/{committee['id']}/manage/items/{item['id']}/signups", headers=auth(coordinator))
    withdrawn = client.put(path, json={"signedUp": False}, headers=auth(first))

    assert taken.json()["signedUp"] is True and taken.json()["signups"] == 1
    assert full.json()["detail"]["problems"] == ["no_places_left"]
    assert names.json()["names"] == ["Test Member"]
    assert withdrawn.json()["signups"] == 0


def test_the_youth_wing_is_for_members_aged_18_and_over(client, auth, administrator, super_admin, area, member_in,
                                                        db_session):
    youth = active_committee(client, auth, administrator, super_admin, area, wing_type="youth")
    member = member_in(area, verified=True, active=True)
    db_session.execute(text("UPDATE npm.member SET dob = :dob WHERE id = :id"),
                       {"dob": date.today().replace(year=date.today().year - 17), "id": member.id})
    young = client.post(f"/v1/committees/{youth['id']}/applications", json={}, headers=auth(member))
    db_session.execute(text("UPDATE npm.member SET dob = NULL WHERE id = :id"), {"id": member.id})
    unknown = client.post(f"/v1/committees/{youth['id']}/applications", json={}, headers=auth(member))
    db_session.execute(text("UPDATE npm.member SET dob = '1999-03-01' WHERE id = :id"), {"id": member.id})
    adult = client.post(f"/v1/committees/{youth['id']}/applications", json={}, headers=auth(member))

    assert young.json()["detail"]["problems"] == ["below_minimum_age"]
    assert unknown.json()["detail"]["problems"] == ["age_not_confirmed"]
    assert adult.status_code == 201


def test_an_unverified_member_cannot_apply_and_is_told_why(client, auth, committee, member_in, area):
    member = member_in(area)
    card = next(c for c in client.get("/v1/committees", headers=auth(member)).json() if c["id"] == committee["id"])
    refused = client.post(f"/v1/committees/{committee['id']}/applications", json={}, headers=auth(member))

    assert card["applyProblem"] == "identity_not_verified"
    assert refused.json()["detail"]["problems"] == ["identity_not_verified"]


def test_closing_a_committee_ends_its_space(client, auth, super_admin, committee, coordinator):
    no_reason = client.post(f"/v1/committees/admin/{committee['id']}/close", json={"reason": ""}, headers=auth(super_admin))
    closed = client.post(f"/v1/committees/admin/{committee['id']}/close", json={"reason": "Merged with the district committee."},
                         headers=auth(super_admin))
    tools = client.get(f"/v1/committees/{committee['id']}/manage", headers=auth(coordinator))

    assert no_reason.status_code == 422
    assert closed.json()["state"] == "closed"
    assert tools.status_code == 403
