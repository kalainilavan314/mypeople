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


def declare_election(db_session, area, admin, silence_in=timedelta(days=20)):
    """A declared district election running now whose silence window is still weeks away."""
    now = datetime.now(UTC)
    db_session.execute(
        text(
            """
            INSERT INTO election.period (election_type, title_en, title_ta, area_key, area_path, starts_at, ends_at,
                                         silence_starts_at, silence_ends_at, polling_day, source_url, source_reference,
                                         source_published_at, declared_by)
            VALUES ('provincial', 'Provincial council election', 'மாகாண சபைத் தேர்தல்', :key, :path, :starts, :ends,
                    :silence_starts, :silence_ends, :polling_day, 'https://elections.example/notice', 'Gazette 2/2026',
                    :starts, :admin)
            """
        ),
        {
            "key": f"district:{area.district}",
            "path": ["platform", f"province:{area.province}", f"district:{area.district}"],
            "starts": now - timedelta(days=1), "ends": now + silence_in + timedelta(days=5),
            "silence_starts": now + silence_in, "silence_ends": now + silence_in + timedelta(days=2),
            "polling_day": (now + silence_in + timedelta(days=1)).date(), "admin": admin.id,
        },
    )


def ended(client, auth, producer, area):
    session_id = scheduled(client, auth, producer, area)
    client.post(f"/v1/town-halls/manage/{session_id}/state", json={"state": "live"}, headers=auth(producer))
    moved = client.post(f"/v1/town-halls/manage/{session_id}/state", json={"state": "ended"}, headers=auth(producer))
    assert moved.json()["state"] == "ended", moved.json()
    return session_id


def test_going_live_rechecks_the_legal_review_for_an_election_declared_after_scheduling(
    client, auth, producer, area, super_admin, db_session
):
    session_id = scheduled(client, auth, producer, area)
    declare_election(db_session, area, super_admin)

    unreviewed = client.post(f"/v1/town-halls/manage/{session_id}/state", json={"state": "live"}, headers=auth(producer))
    reviewed = client.put(f"/v1/town-halls/manage/{session_id}",
                          json={**session_body(area), "legalReviewRef": "LR-2026-021"}, headers=auth(producer))
    live = client.post(f"/v1/town-halls/manage/{session_id}/state", json={"state": "live"}, headers=auth(producer))

    assert unreviewed.json()["detail"]["problems"] == ["legal_review_required"]
    assert reviewed.status_code == 200, reviewed.json()
    assert live.json()["state"] == "live"


def test_cancelling_tells_everyone_who_asked_for_a_reminder(client, auth, member_in, area, producer, db_session):
    reminded, quiet = (member_in(area, verified=True, active=True) for _ in range(2))
    session_id = scheduled(client, auth, producer, area)
    client.put(f"/v1/town-halls/{session_id}/reminder", json={"remind": True}, headers=auth(reminded))

    cancelled = client.post(f"/v1/town-halls/manage/{session_id}/state",
                            json={"state": "cancelled", "reason": "The speaker is unwell."}, headers=auth(producer))

    def told(member):
        return db_session.scalar(text("SELECT count(*) FROM notifications.notification WHERE member_id = :m "
                                      "AND template = 'townhall_cancelled' AND target_id = :t"),
                                 {"m": member.id, "t": session_id})

    assert cancelled.json()["state"] == "cancelled"
    assert (told(reminded), told(quiet)) == (1, 0)


def test_outcomes_link_only_to_published_promises_and_existing_cases(
    client, auth, member_in, area, producer, super_admin, db_session
):
    reporter, neighbour = (member_in(area, verified=True, active=True) for _ in range(2))
    session_id = ended(client, auth, producer, area)
    promise = {
        "title_en": "Repair the harbour wall", "title_ta": "துறைமுகச் சுவரைத் திருத்துதல்",
        "description_en": "Rebuild the damaged harbour wall.", "description_ta": "சேதமடைந்த துறைமுகச் சுவரை மீளக் கட்டுதல்.",
        "area": f"district:{area.district}", "path": ["platform", f"province:{area.province}", f"district:{area.district}"],
        "by": super_admin.id,
    }
    insert_promise = text(
        """
        INSERT INTO community.promise (title_en, title_ta, description_en, description_ta, source_reference,
                                       source_published_on, office_en, office_ta, kind, theme, area_key, area_path,
                                       planned_start, due_date, target_en, target_ta, drafted_by, publication)
        VALUES (:title_en, :title_ta, :description_en, :description_ta, 'Manifesto 2026', current_date, 'Harbour Office',
                'துறைமுக அலுவலகம்', 'party_commitment', 'fisheries', :area, :path, current_date, current_date + 90,
                'Wall rebuilt', 'சுவர் மீளக் கட்டப்படும்', :by, :publication)
        RETURNING id
        """
    )
    draft_id = db_session.scalar(insert_promise, {**promise, "publication": "draft"})
    published_id = db_session.scalar(insert_promise, {**promise, "publication": "published"})
    case_number = db_session.scalar(
        text(
            """
            INSERT INTO community.issue (reporter_id, client_reference, category, title, description, location_kind,
                                         district_code, ds_code, gn_code, area_path)
            VALUES (:m, gen_random_uuid(), 'other', 'Harbour wall is broken',
                    'The harbour wall has been broken since the storm last month.', 'my_gn', :district, :ds, :gn, :path)
            RETURNING case_number
            """
        ),
        {"m": reporter.id, "district": area.district, "ds": area.ds, "gn": area.gn,
         "path": ["platform", f"province:{area.province}", f"district:{area.district}", f"ds:{area.ds}", f"gn:{area.gn}"]},
    )

    def archive(outcomes):
        return client.post(f"/v1/town-halls/manage/{session_id}/archive", json={"outcomes": outcomes}, headers=auth(producer))

    outcome = {"textEn": "The harbour wall will be rebuilt.", "textTa": "துறைமுகச் சுவர் மீளக் கட்டப்படும்."}
    refused = archive([{**outcome, "promiseId": str(draft_id)}, {**outcome, "caseNumber": "CI-99999999"}])
    malformed = archive([{**outcome, "caseNumber": "CS-12"}])
    saved = archive([{**outcome, "promiseId": str(published_id), "caseNumber": case_number}])
    as_reporter = client.get(f"/v1/town-halls/{session_id}", headers=auth(reporter)).json()["outcomes"]
    as_neighbour = client.get(f"/v1/town-halls/{session_id}", headers=auth(neighbour)).json()["outcomes"]

    assert refused.json()["detail"]["problems"] == ["outcome_promise_not_published:1", "outcome_case_not_found:2"]
    assert malformed.status_code == 422
    assert saved.status_code == 200, saved.json()
    assert as_reporter[0]["promiseId"] == str(published_id) and as_reporter[0]["caseNumber"] == case_number
    assert as_reporter[0]["caseId"] is not None  # the reporter may open their own case
    assert as_neighbour[0]["caseId"] is None  # a team-only case is not shown to others


def test_question_search_takes_percent_and_underscore_literally(client, auth, member_in, area, producer, moderator):
    asker, reader = (member_in(area, verified=True, active=True) for _ in range(2))
    session_id = scheduled(client, auth, producer, area)
    for body in ("Will fees fall by 50% next year?", "Will fees fall by 50 rupees next year?"):
        asked = client.post(f"/v1/town-halls/{session_id}/questions", json={"body": body}, headers=auth(asker)).json()
        client.post(f"/v1/town-halls/manage/questions/{asked['id']}/moderation", json={"decision": "approve"},
                    headers=auth(moderator))

    percent = client.get(f"/v1/town-halls/{session_id}", params={"q": "50%"}, headers=auth(reader)).json()["questions"]
    underscore = client.get(f"/v1/town-halls/{session_id}", params={"q": "50_"}, headers=auth(reader)).json()["questions"]

    assert [q["body"] for q in percent] == ["Will fees fall by 50% next year?"]
    assert underscore == []


def test_only_verified_active_members_vote_and_only_while_the_session_is_open(
    client, auth, member_in, area, producer, moderator, db_session
):
    asker, voter = (member_in(area, verified=True, active=True) for _ in range(2))
    pending_member = member_in(area, verified=True)
    session_id = scheduled(client, auth, producer, area)
    asked = client.post(f"/v1/town-halls/{session_id}/questions", json={"body": "When will the bus service return?"},
                        headers=auth(asker)).json()
    client.post(f"/v1/town-halls/manage/questions/{asked['id']}/moderation", json={"decision": "approve"},
                headers=auth(moderator))

    not_active = client.post(f"/v1/town-halls/questions/{asked['id']}/vote", headers=auth(pending_member))
    client.post(f"/v1/town-halls/manage/{session_id}/state", json={"state": "live"}, headers=auth(producer))
    live_vote = client.post(f"/v1/town-halls/questions/{asked['id']}/vote", headers=auth(voter))
    client.post(f"/v1/town-halls/manage/{session_id}/state", json={"state": "ended"}, headers=auth(producer))
    late = client.post(f"/v1/town-halls/questions/{asked['id']}/vote", headers=auth(asker))
    late_ask = client.post(f"/v1/town-halls/{session_id}/questions", json={"body": "One more question please?"},
                           headers=auth(voter))

    assert not_active.json()["detail"]["problems"] == ["membership_not_active"]
    assert live_vote.json()["votes"] == 1
    assert late.json()["detail"]["problems"] == ["session_closed"]
    assert late_ask.json()["detail"]["problems"] == ["session_closed"]
