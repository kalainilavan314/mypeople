"""The Tamil AI assistant (M28) and its knowledge base (D20): FR-AIA-001 to 010, BR-125 to 128, OD-48.

No test calls a real model: a scripted provider stands in for the configured one and records what it
was sent, so the tests also show what leaves the server.
"""

import json
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db.session import get_db
from app.main import create_app
from app.modules.ai.assistant import service as assistant
from app.modules.ai.providers import ProviderReply

ROAD_TEXT = (
    "Members may report a broken road from the Home tab. The GN coordinator reviews every report within five working days."
)
ROAD_TEXT_TA = "வீதிகளில் உள்ள குழிகளை முகப்புத் தாவலில் இருந்து அறிவிக்கலாம். கிராம சேவகர் பிரிவு ஒருங்கிணைப்பாளர் ஐந்து வேலை நாட்களுக்குள் பார்ப்பார்."


class ScriptedProvider:
    code = "anthropic"
    model_ref = "claude-opus-5-5"

    def __init__(self):
        self.sent: list[str] = []
        self.next: ProviderReply | None = None

    def answer(self, content: str) -> ProviderReply:
        self.sent.append(content)
        assert self.next is not None, "the test did not script an answer"
        return self.next


def reply(**data):
    return ProviderReply("done", {"outcome": "answered", "refusal": "none", "explanation": "", "sources": [], "quotes": [],
                                  "topics": [], **data}, latency_ms=850, input_tokens=1500, output_tokens=220)


@pytest.fixture
def provider():
    return ScriptedProvider()


@pytest.fixture
def client(db_client, provider):
    db_client.app.state.assistant_provider = provider
    return db_client


@pytest.fixture
def editors(create_member, assign, super_admin, area):
    first, second = create_member(verified=True), create_member(verified=True)
    assign(first, "3B", "district", area.district, ["ai.kb.manage"], granted_by=super_admin)
    assign(second, "4", "province", area.province, ["ai.kb.manage"], granted_by=super_admin)
    return first, second


@pytest.fixture
def live_model(db_session, super_admin):
    """The assistant's model, made live as the AI Governance Lead would (D21)."""
    db_session.execute(text("UPDATE ai.model SET status = 'retired', retired_at = now() WHERE task = 'assistant' AND status = 'live'"))
    return db_session.scalar(
        text(
            """INSERT INTO ai.model (task, name, provider, provider_code, model_ref, version, licence, licence_commercial_use,
                   no_training_terms, data_location, training_data_summary, status, registered_by, approved_by, live_at)
               VALUES ('assistant', 'Claude Opus', 'Anthropic', 'anthropic', 'claude-opus-5-5', 'test-live', 'Commercial terms',
                   true, true, 'United States', 'Provider training data; no member data.', 'live', :admin, :admin, now())
               RETURNING id"""
        ),
        {"admin": super_admin.id},
    )


def source_body(**overrides):
    return {"kind": "app_help", "titleTa": "வீதிப் பிரச்சினைகளை அறிவித்தல்", "titleEn": "Reporting road problems",
            "bodyTa": ROAD_TEXT_TA, "bodyEn": ROAD_TEXT, "publisher": "TMK member services",
            "reviewDue": (date.today() + timedelta(days=180)).isoformat(), **overrides}


def approved_source(client, auth, editors, **overrides):
    drafter, approver = editors
    created = client.post("/v1/assistant/manage/sources", json=source_body(**overrides), headers=auth(drafter))
    assert created.status_code == 201, created.json()
    source_id = created.json()["id"]
    decided = client.post(f"/v1/assistant/manage/sources/{source_id}/decision", json={"approve": True}, headers=auth(approver))
    assert decided.status_code == 200, decided.json()
    return decided.json()


def test_while_switched_off_members_get_404(database_settings, db_session, auth, create_member):
    app = create_app(database_settings.model_copy(update={"enforce_feature_flags": True}))
    app.dependency_overrides[get_db] = lambda: db_session
    response = TestClient(app).get("/v1/assistant", headers=auth(create_member()))
    assert (response.status_code, response.json()) == (404, {"detail": "feature_unavailable"})


def test_without_a_provider_or_a_live_model_it_says_why_and_sends_nothing(db_client, client, provider, auth, create_member,
                                                                          db_session):
    member = create_member()
    db_client.app.state.assistant_provider = None
    home = client.get("/v1/assistant", headers=auth(member)).json()
    asked = client.post("/v1/assistant/messages", json={"text": "How do I report a road?"}, headers=auth(member))
    assert (home["available"], home["reason"], home["retentionDays"]) == (False, "provider_not_configured", 30)
    assert asked.status_code == 503 and asked.json()["detail"]["problems"] == ["provider_not_configured"]

    db_session.execute(text("UPDATE ai.model SET status = 'retired', retired_at = now() WHERE task = 'assistant' AND status = 'live'"))
    db_client.app.state.assistant_provider = provider
    assert client.get("/v1/assistant", headers=auth(member)).json()["reason"] == "model_not_approved"
    assert provider.sent == []


def test_a_cited_answer_keeps_official_text_apart_and_nothing_personal_is_sent(client, provider, auth, editors, live_model,
                                                                              member_in, area, db_session):
    source = approved_source(client, auth, editors)
    member = member_in(area, verified=True, active=True)
    provider.next = reply(explanation="You can report it from Home; a coordinator looks at it.", sources=[1],
                          quotes=[{"source": 1, "text": "Members may report a broken road from the Home tab."},
                                  {"source": 1, "text": "Members get a reply on the same day."}])

    asked = client.post("/v1/assistant/messages",
                        json={"text": "How do I report a broken road? My NIC is 851234567V, phone 0771234567", "language": "en"},
                        headers=auth(member))

    assert asked.status_code == 200, asked.json()
    body = asked.json()
    assert body["question"]["redactions"] == ["nic", "phone"]
    assert "851234567V" not in body["question"]["body"] and "0771234567" not in body["question"]["body"]
    sent = provider.sent[0]
    assert "851234567V" not in sent and "0771234567" not in sent and "Test Member" not in sent and area.gn not in sent
    answer = body["answer"]
    assert answer["outcome"] == "answered" and answer["body"].startswith("You can report it")
    [citation] = answer["citations"]
    assert (citation["sourceId"], citation["version"], citation["kind"]) == (source["id"], 1, "app_help")
    # FR-AIA-004: only the sentence found word for word in the source is shown as official text.
    assert citation["quotes"] == [{"language": "en", "text": "Members may report a broken road from the Home tab."}]
    logged = db_session.execute(
        text("SELECT model_id, purpose, outcome, cited, message_id, latency_ms, input_tokens FROM ai.inference ORDER BY id DESC LIMIT 1")
    ).one()
    assert (logged.model_id, logged.purpose, logged.outcome, logged.latency_ms, logged.input_tokens) == (
        live_model, "member", "answered", 850, 1500)
    assert logged.cited == [{"sourceId": source["id"], "version": 1}] and str(logged.message_id) == answer["id"]

    # A follow-up in the same conversation carries the earlier (redacted) turns.
    provider.next = reply(explanation="Within five working days.", sources=[1])
    follow = client.post("/v1/assistant/messages", json={"text": "How long?", "language": "en",
                                                         "conversationId": body["conversationId"]}, headers=auth(member))
    assert follow.json()["conversationId"] == body["conversationId"]
    assert "<earlier_conversation>" in provider.sent[1] and "851234567V" not in provider.sent[1]
    conversation = client.get(f"/v1/assistant/conversations/{body['conversationId']}", headers=auth(member)).json()
    assert [m["role"] for m in conversation["messages"]] == ["member", "assistant", "member", "assistant"]


def test_no_approved_source_means_no_model_call_and_an_offer_of_a_person(client, provider, auth, live_model, create_member):
    member = create_member()
    asked = client.post("/v1/assistant/messages", json={"text": "Xylophone quantum zebra"}, headers=auth(member)).json()
    assert asked["answer"]["outcome"] == "no_source" and asked["answer"]["citations"] == []
    assert provider.sent == []


def test_an_uncited_answer_is_replaced_and_a_refusal_is_kept(client, provider, auth, editors, live_model, create_member):
    approved_source(client, auth, editors)
    member = create_member()
    provider.next = reply(explanation="The party will fix every road by 2027.", sources=[])
    uncited = client.post("/v1/assistant/messages", json={"text": "When will the road be repaired?", "language": "en"},
                          headers=auth(member)).json()["answer"]
    provider.next = reply(outcome="answered", refusal="eligibility", explanation="Community Support decides; here is how to ask.",
                          sources=[1], topics=["eligibility"])
    eligibility = client.post("/v1/assistant/messages", json={"text": "Am I eligible for help with a broken road?",
                                                              "language": "en"}, headers=auth(member)).json()["answer"]
    provider.next = ProviderReply("refused", None, latency_ms=10)
    declined = client.post("/v1/assistant/messages", json={"text": "Road report details please", "language": "en"},
                           headers=auth(member)).json()["answer"]

    assert uncited["outcome"] == "no_source" and "2027" not in uncited["body"]
    assert (eligibility["outcome"], eligibility["refusal"], eligibility["topics"]) == ("answered", "eligibility", ["eligibility"])
    assert declined["outcome"] == "refused" and declined["citations"] == []


def test_a_drafter_cannot_approve_and_retired_or_overdue_sources_are_not_searched(client, provider, auth, editors, live_model,
                                                                                  create_member, db_session):
    drafter, approver = editors
    own = client.post("/v1/assistant/manage/sources", json=source_body(titleEn="Fishing permits"), headers=auth(drafter)).json()
    refused = client.post(f"/v1/assistant/manage/sources/{own['id']}/decision", json={"approve": True}, headers=auth(drafter))
    returned = client.post(f"/v1/assistant/manage/sources/{own['id']}/decision", json={"approve": False}, headers=auth(approver))
    assert refused.status_code == 403 and refused.json()["detail"] == "own_draft"
    assert returned.json()["detail"]["problems"] == ["reason_required"]

    source = approved_source(client, auth, editors)
    assert source["passages"] == 2 and source["approvedByName"] == "Test Member"
    member = create_member()
    db_session.execute(text("UPDATE ai.kb_source SET review_due = current_date - 1 WHERE id = :id"), {"id": source["id"]})
    overdue = client.post("/v1/assistant/messages", json={"text": "report broken road", "language": "en"}, headers=auth(member))
    assert overdue.json()["answer"]["outcome"] == "no_source" and provider.sent == []

    reviewed = client.post(f"/v1/assistant/manage/sources/{source['id']}/review",
                           json={"reviewDue": (date.today() + timedelta(days=90)).isoformat()}, headers=auth(drafter))
    assert reviewed.status_code == 200 and reviewed.json()["reviewOverdue"] is False
    retired = client.post(f"/v1/assistant/manage/sources/{source['id']}/retire", json={"reason": "Replaced by new guide"},
                          headers=auth(drafter))
    assert retired.json()["state"] == "retired" and retired.json()["passages"] == 0
    gone = client.post("/v1/assistant/messages", json={"text": "report broken road", "language": "en"}, headers=auth(member))
    assert gone.json()["answer"]["outcome"] == "no_source" and provider.sent == []


def test_a_new_version_supersedes_the_old_one_only_once_approved(client, auth, editors, db_session):
    drafter, approver = editors
    first = approved_source(client, auth, editors)
    draft = client.post(f"/v1/assistant/manage/sources/{first['id']}/new-version", headers=auth(approver))
    second_draft = client.post(f"/v1/assistant/manage/sources/{first['id']}/new-version", headers=auth(approver))
    assert draft.status_code == 201 and draft.json()["version"] == 2 and draft.json()["state"] == "draft"
    assert second_draft.json()["detail"]["problems"] == ["draft_exists"]
    edited = client.put(f"/v1/assistant/manage/sources/{draft.json()['id']}",
                        json=source_body(bodyEn=ROAD_TEXT + " Photos help.", changeNote="Added a note on photos"),
                        headers=auth(approver))
    assert edited.status_code == 200
    approved = client.post(f"/v1/assistant/manage/sources/{draft.json()['id']}/decision", json={"approve": True},
                           headers=auth(drafter))
    history = client.get(f"/v1/assistant/manage/sources/{first['id']}", headers=auth(drafter)).json()
    assert approved.json()["state"] == "approved"
    assert [(v["version"], v["state"]) for v in history["versions"]] == [(2, "approved"), (1, "superseded")]
    assert db_session.scalar(text("SELECT count(*) FROM ai.kb_chunk WHERE source_id = :id"), {"id": first["id"]}) == 0


def test_ratings_error_reports_and_a_handover_with_consent(client, provider, auth, editors, live_model, create_member,
                                                           db_session):
    approved_source(client, auth, editors)
    member = create_member()
    editor = editors[0]
    provider.next = reply(explanation="Report it from Home.", sources=[1])
    asked = client.post("/v1/assistant/messages", json={"text": "How do I report a broken road?", "language": "en"},
                        headers=auth(member)).json()
    answer_id = asked["answer"]["id"]

    rated = client.post(f"/v1/assistant/messages/{answer_id}/rating", json={"rating": "not_helpful"}, headers=auth(member))
    other = create_member()
    not_theirs = client.post(f"/v1/assistant/messages/{answer_id}/rating", json={"rating": "helpful"}, headers=auth(other))
    report = client.post(f"/v1/assistant/messages/{answer_id}/error-report",
                         json={"note": "It is the DS office, call 0212223334"}, headers=auth(member))
    again = client.post(f"/v1/assistant/messages/{answer_id}/error-report", json={"note": "Again please"}, headers=auth(member))
    assert rated.json()["rating"] == "not_helpful" and not_theirs.status_code == 404
    assert report.status_code == 201 and again.status_code == 409

    queue = client.get("/v1/assistant/manage/error-reports", params={"state": "open"}, headers=auth(editor)).json()
    mine = next(r for r in queue if r["id"] == report.json()["id"])
    assert mine["question"] == "How do I report a broken road?" and mine["answer"] == "Report it from Home."
    assert "0212223334" not in mine["note"] and mine["citations"][0]["titleEn"] == "Reporting road problems"
    assert "memberId" not in mine
    resolved = client.post(f"/v1/assistant/manage/error-reports/{mine['id']}/resolve",
                           json={"outcome": "fixed", "resolution": "Source now names the DS office."}, headers=auth(editor))
    assert resolved.json()["state"] == "fixed"

    without_consent = client.post("/v1/assistant/handovers", json={"request": "Please call me back about this",
                                                                   "conversationId": asked["conversationId"],
                                                                   "shareConversation": False}, headers=auth(member))
    with_consent = client.post("/v1/assistant/handovers", json={"request": "Please help me with this road",
                                                                "conversationId": asked["conversationId"],
                                                                "shareConversation": True}, headers=auth(member))
    assert without_consent.json()["sharedMessages"] == 0 and with_consent.json()["sharedMessages"] == 2
    staff_view = client.get("/v1/assistant/manage/handovers", params={"state": "open"}, headers=auth(editor)).json()
    shared = next(h for h in staff_view if h["id"] == with_consent.json()["id"])
    unshared = next(h for h in staff_view if h["id"] == without_consent.json()["id"])
    assert [line["role"] for line in shared["transcript"]] == ["member", "assistant"] and unshared["transcript"] == []

    answered = client.post(f"/v1/assistant/manage/handovers/{shared['id']}/reply",
                           json={"reply": "Your GN coordinator will visit on Monday."}, headers=auth(editor))
    assert answered.json()["state"] == "answered"
    mine_now = client.get("/v1/assistant/handovers", headers=auth(member)).json()
    assert next(h for h in mine_now if h["id"] == shared["id"])["reply"] == "Your GN coordinator will visit on Monday."
    notice = db_session.execute(
        text("SELECT template, target_kind FROM notifications.notification WHERE member_id = :m ORDER BY created_at DESC LIMIT 1"),
        {"m": member.id},
    ).one()
    assert tuple(notice) == ("assistant_handover_answered", "assistant_handover")
    summary = client.get("/v1/assistant/manage/summary", headers=auth(editor)).json()
    assert summary["openHandovers"] >= 1 and summary["notHelpful30Days"] >= 1


def test_conversations_are_kept_30_days_behind_a_firewall_and_can_be_deleted(client, provider, auth, editors, live_model,
                                                                             create_member, db_session):
    approved_source(client, auth, editors)
    member = create_member()
    provider.next = reply(explanation="Report it from Home.", sources=[1])
    asked = client.post("/v1/assistant/messages", json={"text": "broken road report", "language": "en"},
                        headers=auth(member)).json()
    conversation_id = asked["conversationId"]

    # Without the ai module opening it, the table answers as if empty (BR-127, BR-159). The test database
    # role may be a superuser, which row security never applies to, so look as an ordinary role.
    db_session.execute(
        text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'test_app_user') THEN
                    CREATE ROLE test_app_user;
                END IF;
                GRANT USAGE ON SCHEMA ai TO test_app_user;
                GRANT SELECT ON ALL TABLES IN SCHEMA ai TO test_app_user;
            END
            $$;
            """
        )
    )
    try:
        db_session.execute(text("SET ROLE test_app_user"))
        db_session.execute(text("SELECT set_config('ai.firewall', '', true)"))
        hidden = db_session.scalar(text("SELECT count(*) FROM ai.message"))
        db_session.execute(text("SELECT set_config('ai.firewall', 'open', true)"))
        shown = db_session.scalar(text("SELECT count(*) FROM ai.message"))
    finally:
        db_session.execute(text("RESET ROLE"))
    assert hidden == 0 and shown >= 2

    db_session.execute(text("SELECT set_config('ai.firewall', 'open', true)"))
    db_session.execute(text("UPDATE ai.message SET created_at = now() - interval '31 days' WHERE conversation_id = :id"),
                       {"id": conversation_id})
    db_session.execute(text("UPDATE ai.conversation SET last_message_at = now() - interval '31 days' WHERE id = :id"),
                       {"id": conversation_id})
    hidden = client.get(f"/v1/assistant/conversations/{conversation_id}", headers=auth(member)).json()
    assert hidden["messages"] == []
    assert all(c["id"] != conversation_id for c in client.get("/v1/assistant", headers=auth(member)).json()["conversations"])
    purged = assistant.purge_expired(db_session)
    assert purged.messages >= 2 and purged.conversations >= 1
    assert client.get(f"/v1/assistant/conversations/{conversation_id}", headers=auth(member)).status_code == 404

    provider.next = reply(explanation="Report it from Home.", sources=[1])
    kept = client.post("/v1/assistant/messages", json={"text": "broken road report", "language": "en"}, headers=auth(member)).json()
    other = create_member()
    assert client.delete(f"/v1/assistant/conversations/{kept['conversationId']}", headers=auth(other)).status_code == 404
    assert client.delete(f"/v1/assistant/conversations/{kept['conversationId']}", headers=auth(member)).status_code == 204
    assert client.get(f"/v1/assistant/conversations/{kept['conversationId']}", headers=auth(member)).status_code == 404


def test_manifesto_material_is_held_back_during_an_election_silence(client, provider, auth, editors, live_model, member_in, area,
                                                                     silence):
    approved_source(client, auth, editors, kind="manifesto", titleEn="Our manifesto on roads", titleTa="வீதிகள் பற்றிய விஞ்ஞாபனம்")
    member = member_in(area, verified=True, active=True)
    silence(area)
    asked = client.post("/v1/assistant/messages", json={"text": "manifesto broken road", "language": "en"}, headers=auth(member))
    assert asked.json()["answer"]["outcome"] == "no_source" and provider.sent == []


def test_staff_try_a_question_with_a_model_in_shadow_mode(client, provider, auth, editors, create_member, super_admin, db_session):
    approved_source(client, auth, editors)
    db_session.execute(text("UPDATE ai.model SET status = 'retired', retired_at = now() WHERE task = 'assistant' AND status = 'live'"))
    member = create_member()
    unregistered = client.post("/v1/assistant/manage/try", json={"question": "broken road report"}, headers=auth(editors[0]))
    assert unregistered.status_code == 503 and unregistered.json()["detail"]["problems"] == ["model_not_registered"]
    db_session.execute(
        text(
            """INSERT INTO ai.model (task, name, provider, provider_code, model_ref, version, licence, data_location,
                   training_data_summary, registered_by)
               VALUES ('assistant', 'Claude Opus', 'Anthropic', 'anthropic', 'claude-opus-5-5', 'test-shadow', 'Terms',
                   'United States', 'Provider training data only.', :admin)"""
        ),
        {"admin": super_admin.id},
    )
    provider.next = reply(explanation="Report it from Home.", sources=[1])
    tried = client.post("/v1/assistant/manage/try", json={"question": "broken road report", "language": "en"},
                        headers=auth(editors[0]))
    assert tried.status_code == 200 and tried.json()["modelStatus"] == "shadow" and tried.json()["outcome"] == "answered"
    assert client.post("/v1/assistant/manage/try", json={"question": "x"}, headers=auth(member)).status_code == 403
    # Members are still not answered by a model in shadow mode.
    assert client.get("/v1/assistant", headers=auth(member)).json()["reason"] == "model_not_approved"
    assert db_session.scalar(text("SELECT purpose FROM ai.inference ORDER BY id DESC LIMIT 1")) == "staff_preview"
    assert json.loads(json.dumps(tried.json()["citations"]))[0]["kind"] == "app_help"
