"""Community ideas (H13), surveys (H14, H21) and development proposals (M15 to M17, D15)."""

import uuid

import pytest
from sqlalchemy import text

from app.modules.community.proposals import rules as proposal_rules
from app.modules.community.surveys import repository as survey_repository
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
    assert idea_id not in [i["id"] for i in hidden["local"]] and [i["id"] for i in queue] == [idea_id]
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
    assert mine["appeal"] is None and mine["editedByModerator"] is False


def place(db_session, area, where):
    """A GN division (with the areas above it) chosen relative to the `area` fixture."""
    return db_session.execute(
        text(
            f"""
            SELECT d.province_code AS province, ds.district_code AS district, ds.ds_code AS ds, g.gn_code AS gn
            FROM geo.gn_division g
            JOIN geo.ds_division ds ON ds.ds_code = g.ds_code
            JOIN geo.district d ON d.district_code = ds.district_code
            WHERE {where} ORDER BY (ds.ds_code = :ds), g.gn_code LIMIT 1
            """
        ),
        {"province": area.province, "district": area.district, "ds": area.ds, "gn": area.gn},
    ).one()


@pytest.fixture
def neighbour_gn(db_session, area):
    """Another GN division in the same district, in another DS division where there is one."""
    return place(db_session, area, "ds.district_code = :district AND g.gn_code <> :gn")


@pytest.fixture
def far_gn(db_session, area):
    """A GN division in another district of the same province."""
    return place(db_session, area, "d.province_code = :province AND ds.district_code <> :district")


@pytest.fixture
def province_moderator(create_member, assign, area, super_admin):
    person = create_member(verified=True)
    assign(person, "4", "province", area.province, ["content.moderate", "dev.review"], granted_by=super_admin)
    return person


def published_idea(client, auth, author, moderator, title, **moderation):
    sent = client.post("/v1/ideas", json={"title": title, "benefit": "A real benefit for the village."}, headers=auth(author))
    assert sent.status_code == 201, sent.json()
    done = client.post(f"/v1/ideas/{sent.json()['id']}/moderation", json={"publish": True, **moderation},
                       headers=auth(moderator))
    assert done.status_code == 200, done.json()
    return sent.json()["id"]


def test_local_ideas_are_the_members_gn_ds_and_district_not_the_whole_province(
    client, auth, member_in, area, neighbour_gn, far_gn, province_moderator
):
    member = member_in(area, verified=True, active=True)
    neighbour = member_in(neighbour_gn, verified=True, active=True)
    far_away = member_in(far_gn, verified=True, active=True)
    next_door = published_idea(client, auth, neighbour, province_moderator, "Shade trees at the market")
    elsewhere = published_idea(client, auth, far_away, province_moderator, "A jetty for the fishing boats")

    local = client.get("/v1/ideas", headers=auth(member)).json()["local"]
    supported = client.put(f"/v1/ideas/{next_door}/support", json={"support": True}, headers=auth(member))
    outside = client.put(f"/v1/ideas/{elsewhere}/support", json={"support": True}, headers=auth(member))

    ids = [i["id"] for i in local]
    assert next_door in ids and elsewhere not in ids  # H13: the same district, never the whole province
    assert supported.status_code == 200 and supported.json()["supports"] == 1  # the board and support agree
    assert outside.status_code == 404


def test_a_moderator_may_publish_an_edited_version_and_the_author_keeps_their_own(
    client, auth, member_in, area, moderator, db_session
):
    author, neighbour = (member_in(area, verified=True, active=True) for _ in range(2))
    sent = client.post("/v1/ideas", json={"title": "Lights near Mr Kumar's house",
                                          "benefit": "Mr Kumar at No. 12 walks home in the dark."}, headers=auth(author))
    idea_id = sent.json()["id"]

    too_short = client.post(f"/v1/ideas/{idea_id}/moderation", json={"publish": True, "editedTitle": "  Ab   "},
                            headers=auth(moderator))
    not_on_reject = client.post(f"/v1/ideas/{idea_id}/moderation",
                                json={"publish": False, "reason": "Names a person.", "editedTitle": "Street lights"},
                                headers=auth(moderator))
    done = client.post(f"/v1/ideas/{idea_id}/moderation", json={
        "publish": True, "editedTitle": "Street lights on the lane", "editedBenefit": "Neighbours walk home in the light.",
    }, headers=auth(moderator))
    seen = client.get("/v1/ideas", headers=auth(neighbour)).json()["local"][0]
    own = client.get("/v1/ideas", headers=auth(author)).json()["mine"][0]
    details = db_session.scalar(
        text("SELECT details FROM ops.audit_log WHERE action = 'idea.published' AND target_id = :id"), {"id": idea_id}
    )

    assert too_short.json()["detail"]["problems"] == ["edited_title_length"]
    assert not_on_reject.json()["detail"]["problems"] == ["edits_only_when_publishing"]
    assert done.json()["publishedTitle"] == "Street lights on the lane"
    assert (seen["title"], seen["benefit"]) == ("Street lights on the lane", "Neighbours walk home in the light.")
    assert (seen["editedByModerator"], seen["publishedTitle"]) == (False, None)  # nothing about the original
    assert (own["title"], own["editedByModerator"]) == ("Lights near Mr Kumar's house", True)
    assert own["publishedBenefit"] == "Neighbours walk home in the light."
    assert details == {"redacted": True}


def test_the_author_sees_their_appeal_and_its_outcome(client, auth, member_in, area, moderator, create_member, db_session):
    author = member_in(area, verified=True, active=True)
    idea_id = client.post("/v1/ideas", json={"title": "A reading room", "benefit": "Students study after school."},
                          headers=auth(author)).json()["id"]
    client.post(f"/v1/ideas/{idea_id}/moderation", json={"publish": False, "reason": "Too close to an election notice."},
                headers=auth(moderator))
    other = create_member(verified=True)
    db_session.execute(
        text(
            """INSERT INTO community.moderation_appeal (item_kind, item_id, member_id, body, original_moderator, area_path,
                                                       state, reason, decided_by, decided_at)
               VALUES ('idea', :idea, :member, 'It is not about any election at all.', :moderator, ARRAY['platform'],
                       'upheld', 'The notice period applies.', :other, clock_timestamp())"""
        ),
        {"idea": idea_id, "member": author.id, "moderator": moderator.id, "other": other.id},
    )

    own = client.get("/v1/ideas", headers=auth(author)).json()["mine"][0]

    assert own["appeal"]["state"] == "upheld" and own["appeal"]["reason"] == "The notice period applies."
    assert own["appeal"]["decidedAt"] is not None


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


def test_anonymous_answers_are_written_apart_from_the_participation(
    client, auth, member_in, area, survey_manager, db_session, monkeypatch
):
    """FR-SRV-003: rows written in one transaction share its id (xmin), which would tie them together."""
    member, unlucky = (member_in(area, verified=True, active=True) for _ in range(2))
    survey_id = open_survey(client, auth, survey_manager, area, anonymous=True)
    q1, q2, q3 = (q["id"] for q in client.get(f"/v1/surveys/{survey_id}", headers=auth(member)).json()["questions"])
    answers = {"answers": {q1: "daily", q2: 3, q3: "low"}}

    sent = client.post(f"/v1/surveys/{survey_id}/responses", json=answers, headers=auth(member))
    took_part = db_session.scalar(
        text("SELECT xmin::text FROM community.survey_participation WHERE survey_id = :s AND member_id = :m"),
        {"s": survey_id, "m": member.id},
    )
    answered = db_session.scalar(text("SELECT xmin::text FROM community.survey_response WHERE survey_id = :s"), {"s": survey_id})

    assert sent.status_code == 200 and sent.json()["receipt"] is not None
    assert took_part != answered

    # If the answers cannot be saved, the member is not left marked as answered and may send again.
    def fail(*_args, **_kwargs):
        raise RuntimeError("disk full")

    monkeypatch.setattr(survey_repository, "record_answers", fail)
    with pytest.raises(RuntimeError):
        client.post(f"/v1/surveys/{survey_id}/responses", json=answers, headers=auth(unlucky))
    monkeypatch.undo()
    marked = db_session.scalar(
        text("SELECT count(*) FROM community.survey_participation WHERE survey_id = :s AND member_id = :m"),
        {"s": survey_id, "m": unlucky.id},
    )
    again = client.post(f"/v1/surveys/{survey_id}/responses", json=answers, headers=auth(unlucky))

    assert marked == 0
    assert again.status_code == 200 and again.json()["receipt"] is not None
    assert db_session.scalar(text("SELECT count(*) FROM community.survey_response WHERE survey_id = :s"), {"s": survey_id}) == 2


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


def test_members_see_proposals_for_their_own_gn_ds_and_district_only(
    client, auth, member_in, area, neighbour_gn, far_gn, province_moderator
):
    member, author = (member_in(area, verified=True, active=True) for _ in range(2))
    near = client.post("/v1/proposals", json={**proposal_body(area), "area": {"level": "gn", "code": neighbour_gn.gn}},
                       headers=auth(author)).json()["id"]
    far = client.post("/v1/proposals", json={**proposal_body(area), "area": {"level": "district", "code": far_gn.district}},
                      headers=auth(author)).json()["id"]
    for proposal_id in (near, far):
        moved = client.post(f"/v1/proposals/manage/{proposal_id}/stage", json={"stage": "review"},
                            headers=auth(province_moderator))
        assert moved.status_code == 200, moved.json()

    listed = [p["id"] for p in client.get("/v1/proposals", headers=auth(member)).json()["area"]]

    assert near in listed and far not in listed  # M15: never every proposal in the province
    assert client.get(f"/v1/proposals/{near}", headers=auth(member)).status_code == 200
    assert client.get(f"/v1/proposals/{far}", headers=auth(member)).status_code == 404


def test_regional_needs_hide_small_groups_even_by_subtraction():
    rows = [("D1", "A", "fisheries", 12), ("D1", "B", "fisheries", 6), ("D1", None, "education", 4), ("D2", "C", "water", 10)]
    table = proposal_rules.needs_table(rows)
    assert ("district:D1", "fisheries", 18) in table
    assert ("ds:A", "fisheries", 12) not in table  # 18 - 12 = 6 would expose division B
    assert ("district:D1", "education", None) in table
    assert ("ds:C", "water", 10) in table and ("district:D2", "water", 10) in table


def test_a_survey_editor_reads_the_whole_draft(client, auth, area, survey_manager):
    created = client.post("/v1/surveys/manage", json=survey_body(area), headers=auth(survey_manager)).json()

    draft = client.get(f"/v1/surveys/manage/{created['id']}", headers=auth(survey_manager)).json()

    assert draft["privacyEn"].startswith("Results are reported") and len(draft["questions"]) == 3
    assert draft["questions"][2]["sensitive"] is True
