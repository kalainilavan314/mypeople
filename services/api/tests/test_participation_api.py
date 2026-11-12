"""Community ideas (H13), surveys (H14, H21) and development proposals (M15 to M17, D15)."""

import uuid

import pytest
from sqlalchemy import text

from app.modules.community.proposals import rules as proposal_rules
from app.modules.community.surveys import rules as survey_rules


@pytest.fixture
def client(db_client):
    return db_client


def notices(db_session, member, template):
    return db_session.scalar(
        text("SELECT count(*) FROM notifications.notification WHERE member_id = :id AND template = :t"),
        {"id": member.id, "t": template},
    )


@pytest.fixture
def moderator(create_member, assign, area, super_admin):
    person = create_member(verified=True)
    assign(person, "3A", "district", area.district, ["content.moderate", "dev.review", "dev.approve_planning"],
           granted_by=super_admin)
    return person


# --- Ideas ---------------------------------------------------------------------------------------------


def test_an_idea_is_seen_by_others_only_after_moderation_and_support_never_changes_it(
    client, auth, member_in, area, moderator, db_session
):
    author, neighbour = (member_in(area, verified=True, active=True) for _ in range(2))

    too_long = client.post("/v1/ideas", json={"title": "x" * 81, "benefit": "Children reach school safely."},
                           headers=auth(author))
    sent = client.post("/v1/ideas", json={"title": "Zebra crossing at the school", "benefit": "Children cross safely."},
                       headers=auth(author))
    idea_id = sent.json()["id"]
    hidden = client.get("/v1/ideas", headers=auth(neighbour)).json()
    queue = client.get("/v1/ideas/moderation", headers=auth(moderator)).json()
    client.post(f"/v1/ideas/{idea_id}/moderation", json={"publish": True}, headers=auth(moderator))
    supported = client.put(f"/v1/ideas/{idea_id}/support", json={"support": True}, headers=auth(neighbour))
    twice = client.put(f"/v1/ideas/{idea_id}/support", json={"support": True}, headers=auth(neighbour))
    own = client.put(f"/v1/ideas/{idea_id}/support", json={"support": True}, headers=auth(author))
    board = client.get("/v1/ideas", headers=auth(author)).json()

    assert too_long.status_code == 422
    assert sent.json()["state"] == "pending" and sent.json()["ideaRef"].startswith("ID-")
    assert hidden["local"] == [] and [i["id"] for i in queue] == [idea_id]
    assert (supported.json()["supports"], twice.json()["supports"]) == (1, 1)
    assert own.json()["detail"]["problems"] == ["own_idea"]
    assert board["mine"][0]["state"] == "published" and board["mine"][0]["supports"] == 1
    assert notices(db_session, author, "idea_published") == 1


def test_a_rejected_idea_tells_its_author_why(client, auth, member_in, area, moderator):
    author = member_in(area, verified=True, active=True)
    idea_id = client.post("/v1/ideas", json={"title": "Paint the bus stop", "benefit": "A brighter bus stop."},
                          headers=auth(author)).json()["id"]

    no_reason = client.post(f"/v1/ideas/{idea_id}/moderation", json={"publish": False}, headers=auth(moderator))
    client.post(f"/v1/ideas/{idea_id}/moderation", json={"publish": False, "reason": "Already planned by the council."},
                headers=auth(moderator))
    mine = client.get("/v1/ideas", headers=auth(author)).json()["mine"][0]

    assert no_reason.json()["detail"]["problems"] == ["reason_required"]
    assert (mine["state"], mine["moderationReason"]) == ("rejected", "Already planned by the council.")


# --- Surveys -------------------------------------------------------------------------------------------


def survey_body(area, **overrides):
    return {
        "titleEn": "Water supply in your village", "titleTa": "உங்கள் கிராமத்தின் நீர் விநியோகம்",
        "audienceEn": "Members in this DS division", "audienceTa": "இப்பிரதேச செயலகப் பிரிவின் உறுப்பினர்கள்",
        "privacyEn": "Results are reported only in groups of ten or more.",
        "privacyTa": "முடிவுகள் பத்து அல்லது அதற்கு மேற்பட்டோர் குழுக்களாக மட்டுமே அறிவிக்கப்படும்.",
        "nextStepsEn": "The divisional team will share a summary next month.",
        "nextStepsTa": "பிரதேசக் குழு அடுத்த மாதம் சுருக்கத்தைப் பகிரும்.",
        "area": {"level": "ds", "code": area.ds},
        "questions": [
            {"kind": "single", "promptEn": "How often does water come?", "promptTa": "நீர் எத்தனை முறை வருகிறது?",
             "options": [{"key": "daily", "en": "Daily", "ta": "தினமும்"}, {"key": "weekly", "en": "Weekly", "ta": "வாரந்தோறும்"}]},
            {"kind": "scale", "promptEn": "How satisfied are you?", "promptTa": "நீங்கள் எவ்வளவு திருப்தி?"},
            {"kind": "single", "promptEn": "Household income band", "promptTa": "குடும்ப வருமான வகை", "sensitive": True,
             "options": [{"key": "low", "en": "Low", "ta": "குறைவு"}, {"key": "other", "en": "Other", "ta": "ஏனையவை"}]},
        ],
        **overrides,
    }


@pytest.fixture
def survey_manager(create_member, assign, area, super_admin):
    person = create_member(verified=True)
    assign(person, "3B", "district", area.district, ["surveys.manage"], granted_by=super_admin)
    return person


def open_survey(client, auth, manager, area, **overrides):
    created = client.post("/v1/surveys/manage", json=survey_body(area, **overrides), headers=auth(manager))
    assert created.status_code == 201, created.json()
    client.post(f"/v1/surveys/manage/{created.json()['id']}/state", json={"state": "open"}, headers=auth(manager))
    return created.json()["id"]


def test_one_response_per_member_with_a_receipt_and_prefer_not_to_say(client, auth, member_in, area, survey_manager):
    member = member_in(area, verified=True, active=True)
    survey_id = open_survey(client, auth, survey_manager, area)

    survey = client.get(f"/v1/surveys/{survey_id}", headers=auth(member)).json()
    q1, q2, q3 = (q["id"] for q in survey["questions"])
    bad = client.post(f"/v1/surveys/{survey_id}/responses",
                      json={"answers": {q1: "daily", q2: 9, q3: "low"}}, headers=auth(member))
    not_sensitive = client.post(f"/v1/surveys/{survey_id}/responses",
                                json={"answers": {q1: "prefer_not_to_say", q2: 4, q3: "low"}}, headers=auth(member))
    sent = client.post(f"/v1/surveys/{survey_id}/responses",
                       json={"answers": {q1: "daily", q2: 4, q3: "prefer_not_to_say"}}, headers=auth(member))
    again = client.post(f"/v1/surveys/{survey_id}/responses",
                        json={"answers": {q1: "weekly", q2: 2, q3: "low"}}, headers=auth(member))
    activity = client.get("/v1/profile/activity?kind=survey_response", headers=auth(member)).json()

    assert survey["canAnswer"] is True and survey["anonymous"] is False and survey["questions"][2]["sensitive"] is True
    assert bad.json()["detail"]["problems"] == ["answer_invalid:2"]
    assert not_sensitive.json()["detail"]["problems"] == ["answer_invalid:1"]
    assert sent.json()["receipt"]["receiptRef"].startswith("SR-") and sent.json()["canAnswer"] is False
    assert sent.json()["nextStepsEn"].startswith("The divisional team")
    assert again.json()["detail"]["problems"] == ["already_answered"]
    assert [a["reference"] for a in activity] == [sent.json()["receipt"]["receiptRef"]]


def test_an_anonymous_survey_keeps_no_link_between_member_and_answers(client, auth, member_in, area, survey_manager, db_session):
    member = member_in(area, verified=True, active=True)
    refused = client.post("/v1/surveys/manage", json=survey_body(area, anonymous=True, allowEdits=True),
                          headers=auth(survey_manager))
    survey_id = open_survey(client, auth, survey_manager, area, anonymous=True)
    q1, q2, q3 = (q["id"] for q in client.get(f"/v1/surveys/{survey_id}", headers=auth(member)).json()["questions"])

    client.post(f"/v1/surveys/{survey_id}/responses", json={"answers": {q1: "daily", q2: 3, q3: "low"}}, headers=auth(member))

    assert refused.json()["detail"]["problems"] == ["anonymous_surveys_cannot_be_edited"]
    stored = db_session.execute(
        text("SELECT member_id FROM community.survey_response WHERE survey_id = :s"), {"s": survey_id}
    ).scalar_one()
    assert stored is None
    taken = db_session.scalar(
        text("SELECT count(*) FROM community.survey_participation WHERE survey_id = :s AND member_id = :m"),
        {"s": survey_id, "m": member.id},
    )
    assert taken == 1


def test_results_hide_groups_under_ten(client, auth, member_in, area, survey_manager):
    survey_id = open_survey(client, auth, survey_manager, area)
    members = [member_in(area, verified=True, active=True) for _ in range(11)]
    ids = [q["id"] for q in client.get(f"/v1/surveys/{survey_id}", headers=auth(members[0])).json()["questions"]]
    for index, member in enumerate(members):
        choice = "daily" if index < 10 else "weekly"
        client.post(f"/v1/surveys/{survey_id}/responses", json={"answers": {ids[0]: choice, ids[1]: 4, ids[2]: "low"}},
                    headers=auth(member))

    results = client.get(f"/v1/surveys/manage/{survey_id}/results", headers=auth(survey_manager)).json()

    assert results["responses"] == 11
    assert results["questions"][0]["counts"] == {"daily": 10, "weekly": None}


def test_survey_rules():
    assert survey_rules.check_questions([]) == ["questions_required"]
    assert survey_rules.check_questions([{"kind": "single", "options": [{"key": "a"}]}]) == ["options_required:1"]
    assert survey_rules.hide_small(0) == 0 and survey_rules.hide_small(9) is None and survey_rules.hide_small(10) == 10


# --- Development proposals ---------------------------------------------------------------------------------


def proposal_body(area, **overrides):
    return {
        "clientReference": str(uuid.uuid4()),
        "title": "Solar street lights on the coast road",
        "category": "roads_transport",
        "area": {"level": "ds", "code": area.ds},
        "problem": "The coast road is dark after seven and fishermen walk home without light.",
        "solution": "Install twenty solar street lights along the two-kilometre stretch.",
        "benefit": "Safer walks home for fishing families.",
        "costEstimate": "1500000",
        **overrides,
    }


def test_a_proposal_is_moderated_and_moved_only_by_the_tier_with_authority(
    client, auth, member_in, area, moderator, create_member, assign, super_admin, db_session
):
    author = member_in(area, verified=True, active=True)
    ds_reviewer = create_member(verified=True)
    assign(ds_reviewer, "2A", "ds", area.ds, ["dev.review"], granted_by=super_admin)

    missing = client.post("/v1/proposals", json=proposal_body(area, problem=""), headers=auth(author))
    body = proposal_body(area)
    sent = client.post("/v1/proposals", json=body, headers=auth(author))
    repeat = client.post("/v1/proposals", json=body, headers=auth(author))
    proposal_id = sent.json()["id"]
    published = client.post(f"/v1/proposals/manage/{proposal_id}/stage", json={"stage": "review"}, headers=auth(moderator))
    too_low = client.post(f"/v1/proposals/manage/{proposal_id}/stage",
                          json={"stage": "approved_for_planning", "reason": "Good value"}, headers=auth(ds_reviewer))
    approved = client.post(f"/v1/proposals/manage/{proposal_id}/stage",
                           json={"stage": "approved_for_planning", "reason": "Fits the district road plan."},
                           headers=auth(moderator))
    view = client.get(f"/v1/proposals/{proposal_id}", headers=auth(author)).json()

    assert missing.status_code == 422
    assert sent.status_code == 201 and repeat.json()["id"] == proposal_id and sent.json()["stage"] == "pending_moderation"
    assert published.json()["stage"] == "review"
    assert too_low.status_code == 403  # FR-DEV-006: approval for planning needs Tier 3A or above
    assert approved.json()["stage"] == "approved_for_planning"
    assert (view["stageReason"], [e["toStage"] for e in view["history"]]) == (
        "Fits the district road plan.", ["pending_moderation", "review", "approved_for_planning"],
    )
    assert view["history"][-1]["actorTier"] == "3A"
    assert notices(db_session, author, "proposal_stage") == 2


def test_a_rejected_proposal_can_be_revised_and_published_ones_reach_the_area(
    client, auth, member_in, area, moderator, db_session
):
    author, neighbour = (member_in(area, verified=True, active=True) for _ in range(2))
    proposal_id = client.post("/v1/proposals", json=proposal_body(area), headers=auth(author)).json()["id"]

    rejected = client.post(f"/v1/proposals/manage/{proposal_id}/stage",
                           json={"stage": "rejected", "reason": "Please add the length of road."}, headers=auth(moderator))
    hidden = client.get(f"/v1/proposals/{proposal_id}", headers=auth(neighbour))
    revised = client.put(f"/v1/proposals/{proposal_id}", json={
        k: v for k, v in proposal_body(area, solution="Install twenty solar lights along 2 km of the coast road.").items()
        if k not in ("clientReference", "area")
    }, headers=auth(author))
    client.post(f"/v1/proposals/manage/{proposal_id}/stage", json={"stage": "review"}, headers=auth(moderator))
    found = client.get("/v1/proposals", params={"q": "solar"}, headers=auth(neighbour)).json()

    assert rejected.json()["stage"] == "rejected" and notices(db_session, author, "proposal_rejected") == 1
    assert hidden.status_code == 404
    assert (revised.json()["stage"], revised.json()["revision"]) == ("pending_moderation", 2)
    assert [p["id"] for p in found["area"]] == [proposal_id]


def test_regional_needs_hide_small_groups_even_by_subtraction():
    rows = [("D1", "A", "fisheries", 12), ("D1", "B", "fisheries", 6), ("D1", None, "education", 4), ("D2", "C", "water", 10)]
    table = proposal_rules.needs_table(rows)
    assert ("district:D1", "fisheries", 18) in table
    assert ("ds:A", "fisheries", 12) not in table  # 18 - 12 = 6 would expose division B
    assert ("district:D1", "education", None) in table
    assert ("ds:C", "water", 10) in table and ("district:D2", "water", 10) in table
