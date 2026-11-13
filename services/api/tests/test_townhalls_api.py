"""Ask the Leader / Live Town Hall (BRD M21 to M23, D18, FR-THL-001 to 009)."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text

from app.modules.community.townhalls import service as townhalls


@pytest.fixture
def client(db_client):
    return db_client


@pytest.fixture
def producer(create_member, assign, area, super_admin):
    person = create_member(verified=True)
    assign(person, "4", "province", area.province, ["townhall.produce", "townhall.moderate"], granted_by=super_admin)
    return person


@pytest.fixture
def moderator(create_member, assign, area, super_admin):
    person = create_member(verified=True)
    assign(person, "3B", "district", area.district, ["townhall.moderate"], granted_by=super_admin)
    return person


def session_body(area, starts_in=timedelta(days=3), **overrides):
    starts = datetime.now(UTC) + starts_in
    return {
        "titleEn": "Ask the leader: fisheries", "titleTa": "தலைவரிடம் கேளுங்கள்: மீன்பிடி",
        "descriptionEn": "Questions on fishing permits and harbour repairs.",
        "descriptionTa": "மீன்பிடி அனுமதிகள் மற்றும் துறைமுகத் திருத்தங்கள் பற்றிய கேள்விகள்.",
        "language": "both", "speakersEn": "Provincial coordinator", "speakersTa": "மாகாண ஒருங்கிணைப்பாளர்",
        "startsAt": starts.isoformat(), "endsAt": (starts + timedelta(hours=1)).isoformat(),
        "area": {"level": "district", "code": area.district}, **overrides,
    }


def scheduled(client, auth, producer, area, **overrides):
    created = client.post("/v1/town-halls/manage", json=session_body(area, **overrides), headers=auth(producer))
    assert created.status_code == 201, created.json()
    moved = client.post(f"/v1/town-halls/manage/{created.json()['id']}/state", json={"state": "scheduled"}, headers=auth(producer))
    assert moved.status_code == 200, moved.json()
    return created.json()["id"]


def test_questions_are_shown_only_after_moderation_and_votes_count_once(client, auth, member_in, area, producer, moderator):
    asker, voter = (member_in(area, verified=True, active=True) for _ in range(2))
    session_id = scheduled(client, auth, producer, area)

    asked = client.post(f"/v1/town-halls/{session_id}/questions", json={"body": "When will the harbour be repaired?"},
                        headers=auth(asker)).json()
    before = client.get(f"/v1/town-halls/{session_id}", headers=auth(voter)).json()
    client.post(f"/v1/town-halls/manage/questions/{asked['id']}/moderation", json={"decision": "approve"}, headers=auth(moderator))
    first = client.post(f"/v1/town-halls/questions/{asked['id']}/vote", headers=auth(voter)).json()
    second = client.post(f"/v1/town-halls/questions/{asked['id']}/vote", headers=auth(voter)).json()
    own = client.post(f"/v1/town-halls/questions/{asked['id']}/vote", headers=auth(asker))
    after = client.get(f"/v1/town-halls/{session_id}", headers=auth(voter)).json()

    assert asked["state"] == "pending" and before["questions"] == []
    assert (first["votes"], second["votes"]) == (1, 1)
    assert own.json()["detail"]["problems"] == ["own_question"]
    assert [q["body"] for q in after["questions"]] == ["When will the harbour be repaired?"]
    assert after["questions"][0]["mine"] is False and after["questions"][0]["moderationReason"] is None


def test_a_rejected_question_tells_its_author_why_and_merges_need_an_approved_target(
    client, auth, member_in, area, producer, moderator, db_session
):
    asker = member_in(area, verified=True, active=True)
    session_id = scheduled(client, auth, producer, area)
    first = client.post(f"/v1/town-halls/{session_id}/questions", json={"body": "Harbour repairs, when?"},
                        headers=auth(asker)).json()
    second = client.post(f"/v1/town-halls/{session_id}/questions", json={"body": "Is the harbour being repaired?"},
                         headers=auth(asker)).json()

    early_merge = client.post(f"/v1/town-halls/manage/questions/{second['id']}/moderation",
                              json={"decision": "merge", "reason": "Same question", "mergeInto": first["id"]},
                              headers=auth(moderator))
    client.post(f"/v1/town-halls/manage/questions/{first['id']}/moderation", json={"decision": "approve"}, headers=auth(moderator))
    merged = client.post(f"/v1/town-halls/manage/questions/{second['id']}/moderation",
                         json={"decision": "merge", "reason": "Same question as an earlier one", "mergeInto": first["id"]},
                         headers=auth(moderator))
    mine = client.get(f"/v1/town-halls/{session_id}", headers=auth(asker)).json()["questions"]

    assert early_merge.json()["detail"]["problems"] == ["merge_target_not_approved"]
    assert merged.json()["state"] == "merged"
    assert {q["state"]: q["moderationReason"] for q in mine} == {"approved": None, "merged": "Same question as an earlier one"}
    told = db_session.scalar(text("SELECT count(*) FROM notifications.notification WHERE member_id = :m "
                                  "AND template = 'townhall_question_not_shown'"), {"m": asker.id})
    assert told == 1


def test_no_session_in_a_silence_window_and_a_legal_review_in_an_election_period(
    client, auth, producer, area, silence, db_session
):
    silence(area)  # a district election whose silence covers now and the next two days

    in_silence = client.post("/v1/town-halls/manage", json=session_body(area, starts_in=timedelta(hours=5)), headers=auth(producer))
    scheduled_try = client.post(f"/v1/town-halls/manage/{in_silence.json()['id']}/state", json={"state": "scheduled"},
                                headers=auth(producer))
    later = client.post("/v1/town-halls/manage", json=session_body(area, starts_in=timedelta(days=5)), headers=auth(producer))
    no_review = client.post(f"/v1/town-halls/manage/{later.json()['id']}/state", json={"state": "scheduled"},
                            headers=auth(producer))

    reviewed = client.put(f"/v1/town-halls/manage/{later.json()['id']}",
                          json={**session_body(area, starts_in=timedelta(days=5)), "legalReviewRef": "LR-2026-014"},
                          headers=auth(producer))
    staff_view = client.get(f"/v1/town-halls/manage/{later.json()['id']}", headers=auth(producer)).json()

    assert (scheduled_try.status_code, scheduled_try.json()["detail"]["code"]) == (409, "silence_period")
    assert no_review.json()["detail"]["problems"] == ["legal_review_required"]
    assert reviewed.status_code == 200 and staff_view["legalReviewRef"] == "LR-2026-014"


def test_answers_are_live_with_a_time_or_written_in_both_languages_and_reminders_go_once(
    client, auth, member_in, area, producer, moderator, db_session
):
    asker = member_in(area, verified=True, active=True)
    session_id = scheduled(client, auth, producer, area, starts_in=timedelta(minutes=10))
    client.put(f"/v1/town-halls/{session_id}/reminder", json={"remind": True}, headers=auth(asker))
    question = client.post(f"/v1/town-halls/{session_id}/questions", json={"body": "What about the fishing permits?"},
                           headers=auth(asker)).json()
    client.post(f"/v1/town-halls/manage/questions/{question['id']}/moderation", json={"decision": "approve"},
                headers=auth(moderator))

    sent = townhalls.remind(db_session, datetime.now(UTC))
    again = townhalls.remind(db_session, datetime.now(UTC))
    no_time = client.post(f"/v1/town-halls/manage/questions/{question['id']}/answer", json={"mode": "live"}, headers=auth(producer))
    written = client.post(f"/v1/town-halls/manage/questions/{question['id']}/answer", json={
        "mode": "written", "answerEn": "Permits reopen in January.", "answerTa": "அனுமதிகள் ஜனவரியில் மீண்டும் வழங்கப்படும்.",
    }, headers=auth(producer)).json()

    assert (sent, again) == (2, 0)  # the 24-hour and the 15-minute reminder, each once
    assert no_time.json()["detail"]["problems"] == ["time_required"]
    assert written["answerMode"] == "written" and written["answerTa"].startswith("அனுமதிகள்")
