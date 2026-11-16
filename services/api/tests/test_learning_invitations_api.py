"""Learning (H15, H16, FR-LRN-001 to 004) and invitations (H19, H20, FR-REF-001 to 006)."""

import re

import pytest
from sqlalchemy import text

from app.modules.membership.invitations import service as invitations


@pytest.fixture
def client(db_client):
    return db_client


@pytest.fixture
def author(create_member, assign, area, super_admin):
    person = create_member(verified=True)
    assign(person, "3A", "district", area.district, ["content.moderate"], granted_by=super_admin)
    return person


def lesson(n):
    return {
        "titleEn": f"Lesson {n}", "titleTa": f"பாடம் {n}",
        "bodyEn": "How the movement listens to every village, step by step.",
        "bodyTa": "இயக்கம் ஒவ்வொரு கிராமத்தையும் படிப்படியாகக் கேட்கும் முறை.",
        "minutes": 4,
    }


def published_course(client, auth, author, lessons=3):
    created = client.post("/v1/learning/manage/courses", json={
        "titleEn": "How My People works", "titleTa": "என் மக்கள் எவ்வாறு செயற்படுகிறது",
        "summaryEn": "A short course about the movement and the app.",
        "summaryTa": "இயக்கமும் செயலியும் பற்றிய சிறு பாடநெறி.",
        "topic": "movement", "lessons": [lesson(n) for n in range(1, lessons + 1)],
    }, headers=auth(author))
    assert created.status_code == 201, created.json()
    course_id = created.json()["id"]
    client.post(f"/v1/learning/manage/courses/{course_id}/state", json={"state": "published"}, headers=auth(author))
    return course_id


def test_progress_is_recorded_only_on_complete_and_resumes_after_save_and_exit(client, auth, member_in, area, author, db_session):
    member = member_in(area, verified=True, active=True)
    course_id = published_course(client, auth, author)

    catalogue = client.get("/v1/learning/courses", headers=auth(member)).json()
    course = client.get(f"/v1/learning/courses/{course_id}", headers=auth(member)).json()
    first, second, third = (l["id"] for l in course["lessonList"])
    opened_only = client.get(f"/v1/learning/courses/{course_id}", headers=auth(member)).json()
    client.post(f"/v1/learning/courses/{course_id}/lessons/{first}/complete", headers=auth(member))
    saved = client.post(f"/v1/learning/courses/{course_id}/save-exit", json={"lessonId": second}, headers=auth(member)).json()
    mine = client.get("/v1/learning/courses", headers=auth(member)).json()

    assert [c["id"] for c in catalogue["available"]] == [course_id]
    assert (catalogue["available"][0]["lessons"], catalogue["available"][0]["minutes"]) == (3, 12)
    assert opened_only["completedLessons"] == 0 and opened_only["resumePosition"] is None
    assert (saved["completedLessons"], saved["resumePosition"]) == (1, 2)
    assert [c["id"] for c in mine["mine"]] == [course_id] and mine["available"] == []

    client.post(f"/v1/learning/courses/{course_id}/lessons/{second}/complete", headers=auth(member))
    done = client.post(f"/v1/learning/courses/{course_id}/lessons/{third}/complete", headers=auth(member)).json()
    after = client.get("/v1/learning/courses", headers=auth(member)).json()
    activity = client.get("/v1/profile/activity?kind=course", headers=auth(member)).json()

    assert done["completedAt"] is not None and [c["id"] for c in after["completed"]] == [course_id]
    assert activity[0]["state"] == "completed"
    tiers = db_session.scalar(text("SELECT count(*) FROM access.staff_assignment WHERE member_id = :m"), {"m": member.id})
    assert tiers == 0  # FR-LRN-004: completing a course never grants a role


def test_a_retired_course_stays_in_the_history_of_those_who_took_it(client, auth, member_in, area, author):
    learner, newcomer = (member_in(area, verified=True, active=True) for _ in range(2))
    course_id = published_course(client, auth, author, lessons=1)
    lesson_id = client.get(f"/v1/learning/courses/{course_id}", headers=auth(learner)).json()["lessonList"][0]["id"]
    client.post(f"/v1/learning/courses/{course_id}/lessons/{lesson_id}/complete", headers=auth(learner))

    retired = client.post(f"/v1/learning/manage/courses/{course_id}/state", json={"state": "retired"}, headers=auth(author))
    history = client.get("/v1/learning/courses", headers=auth(learner)).json()
    offered = client.get("/v1/learning/courses", headers=auth(newcomer)).json()

    assert retired.json()["state"] == "retired"
    assert [c["id"] for c in history["completed"]] == [course_id]  # H15 completed-course history
    assert course_id not in [c["id"] for c in offered["available"]]


def test_only_published_courses_are_seen_and_drafts_only_change(client, auth, member_in, area, author):
    member = member_in(area, verified=True, active=True)
    draft = client.post("/v1/learning/manage/courses", json={
        "titleEn": "Draft course here", "titleTa": "வரைவுப் பாடநெறி",
        "summaryEn": "Not ready for members yet.", "summaryTa": "இன்னும் உறுப்பினர்களுக்குத் தயாராகவில்லை.",
        "topic": "app", "lessons": [],
    }, headers=auth(author)).json()["id"]
    course_id = published_course(client, auth, author)

    empty = client.post(f"/v1/learning/manage/courses/{draft}/state", json={"state": "published"}, headers=auth(author))
    hidden = client.get(f"/v1/learning/courses/{draft}", headers=auth(member))
    locked = client.put(f"/v1/learning/manage/courses/{course_id}", json={
        "titleEn": "Changed title here", "titleTa": "மாற்றிய தலைப்பு", "summaryEn": "Changed summary text.",
        "summaryTa": "மாற்றிய சுருக்கம்.", "topic": "app", "lessons": [lesson(1)],
    }, headers=auth(author))

    assert empty.json()["detail"]["problems"] == ["lessons_required"]
    assert hidden.status_code == 404
    assert locked.json()["detail"]["problems"] == ["only_drafts_change"]
    assert client.get("/v1/learning/manage/courses", headers=auth(member)).status_code == 403


def test_an_invitation_link_carries_only_an_opaque_token(client, auth, member_in, area):
    member = member_in(area, verified=True, active=True)

    previewed = client.get("/v1/invitations/preview", params={"language": "ta"}, headers=auth(member)).json()
    before = client.get("/v1/invitations/mine", headers=auth(member)).json()
    created = client.post("/v1/invitations", json={"language": "ta"}, headers=auth(member)).json()
    mine = client.get("/v1/invitations/mine", headers=auth(member)).json()

    assert previewed["preview"].startswith("என் மக்கள்") and "/join/" in previewed["preview"]
    assert before["invitations"] == []  # H20: a preview is never listed as Shared
    assert re.fullmatch(r"https://[^/]+/join/INV-[A-Z2-7]{12}", created["url"]), created["url"]
    assert created["preview"].startswith("என் மக்கள்") and created["url"] in created["preview"]
    assert mine["referralCode"] and mine["invitations"] == [
        {"number": 1, "status": "shared", "createdAt": mine["invitations"][0]["createdAt"]}
    ]


def test_a_share_that_was_closed_unsent_is_taken_back(client, auth, member_in, area, db_session):
    member = member_in(area, verified=True, active=True)
    first = client.post("/v1/invitations", json={"language": "en"}, headers=auth(member)).json()
    second = client.post("/v1/invitations", json={"language": "en"}, headers=auth(member)).json()
    db_session.execute(
        text("UPDATE membership.invitation SET created_at = created_at - interval '1 hour' WHERE token = :t"),
        {"t": first["url"].rsplit("/", 1)[1]},
    )

    cancelled = client.post(f"/v1/invitations/{second['number']}/cancel", headers=auth(member))
    too_late = client.post(f"/v1/invitations/{first['number']}/cancel", headers=auth(member))
    listed = client.get("/v1/invitations/mine", headers=auth(member)).json()["invitations"]

    assert cancelled.status_code == 204
    assert too_late.status_code == 404  # an older link may already be out with someone: never broken
    assert [i["number"] for i in listed] == [first["number"]]


def test_an_invitation_goes_pending_then_active_without_naming_anyone(client, auth, member_in, area, db_session):
    inviter = member_in(area, verified=True, active=True)
    token = client.post("/v1/invitations", json={"language": "en"}, headers=auth(inviter)).json()["url"].rsplit("/", 1)[1]

    joined = client.post("/v1/identity/register", json={
        "fullName": "New Neighbour", "route": "nic", "idNumber": "199912345678", "password": "a long enough password",
        "acceptTerms": True, "language": "en", "referralCode": token,
    })
    client.cookies.clear()  # registering signs the newcomer in; the inviter's token must count
    pending = client.get("/v1/invitations/mine", headers=auth(inviter)).json()["invitations"][0]
    invitee = db_session.scalar(text("SELECT invitee_id FROM membership.invitation WHERE token = :t"), {"t": token})
    db_session.execute(text("INSERT INTO membership.membership (member_id, state, reason_code) VALUES (:m, 'active', 'identity_verified')"),
                       {"m": invitee})
    active = client.get("/v1/invitations/mine", headers=auth(inviter)).json()["invitations"][0]

    assert joined.status_code == 201, joined.json()
    assert joined.json()["referralAccepted"] is True
    assert set(pending) == {"number", "status", "createdAt"} and pending["status"] == "pending"
    assert active["status"] == "active"
    again = client.post("/v1/identity/register", json={
        "fullName": "Second Person", "route": "nic", "idNumber": "199912345679", "password": "a long enough password",
        "acceptTerms": True, "language": "en", "referralCode": token,
    })
    assert again.json()["referralAccepted"] is False  # one person per invitation


def test_only_active_members_invite_and_tokens_are_random():
    first, second = invitations.new_token(), invitations.new_token()
    assert first != second and re.fullmatch(r"INV-[A-Z2-7]{12}", first)
    assert invitations.link("https://app.tmk.lk/", first) == f"https://app.tmk.lk/join/{first}"


def test_a_pending_member_cannot_invite(client, auth, member_in, area):
    pending = member_in(area)
    refused = client.post("/v1/invitations", json={"language": "en"}, headers=auth(pending))
    assert (refused.status_code, refused.json()["detail"]) == (422, "membership_not_active")
