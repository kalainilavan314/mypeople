"""Welfare, jobs and livelihood guide (M39, M40, D28; FR-LIV-001 to 006, BR-142)."""

from datetime import date, timedelta

import pytest
from sqlalchemy import text

from app.modules.content.guide import rules
from app.modules.content.guide.service import today as guide_today  # the Sri Lankan day, as the API uses


@pytest.fixture
def client(db_client):
    return db_client


@pytest.fixture
def editor(create_member, assign, area, super_admin):
    person = create_member(verified=True)
    assign(person, "3B", "district", area.district, ["guide.edit"], granted_by=super_admin)
    return person


@pytest.fixture
def reviewer(super_admin):
    return super_admin  # Tier 5 holds guide.review by default


def entry_body(**overrides):
    today = guide_today()
    return {
        "category": "scholarship",
        "titleEn": "Mahapola higher education scholarship",
        "titleTa": "மகாபொல உயர்கல்விப் புலமைப்பரிசில்",
        "summaryEn": "A monthly allowance for university students from low-income families.",
        "summaryTa": "குறைந்த வருமானக் குடும்பங்களைச் சேர்ந்த பல்கலைக்கழக மாணவர்களுக்கான மாதாந்தக் கொடுப்பனவு.",
        "bodyEn": "The trust fund publishes the criteria each year. Applications go through the university.",
        "bodyTa": "நம்பிக்கை நிதியம் ஒவ்வொரு ஆண்டும் நிபந்தனைகளை வெளியிடுகிறது. பல்கலைக்கழகம் ஊடாக விண்ணப்பிக்கவும்.",
        "providerEn": "Mahapola Trust Fund",
        "providerTa": "மகாபொல நம்பிக்கை நிதியம்",
        "contact": "Mahapola Trust Fund office, Colombo",
        "sourceUrl": "https://www.mahapola.lk/scholarships",
        "publishedOn": (today - timedelta(days=30)).isoformat(),
        "verifiedOn": (today - timedelta(days=2)).isoformat(),
        "expiresOn": (today + timedelta(days=60)).isoformat(),
        **overrides,
    }


def published_entry(client, auth, editor, reviewer, **overrides):
    created = client.post("/v1/guide/manage", json=entry_body(**overrides), headers=auth(editor))
    assert created.status_code == 201, created.json()
    entry_id = created.json()["id"]
    asked = client.post(f"/v1/guide/manage/{entry_id}/request-review", headers=auth(editor))
    assert asked.status_code == 200, asked.json()
    decided = client.post(f"/v1/guide/manage/{entry_id}/review", json={"approve": True}, headers=auth(reviewer))
    assert decided.json()["state"] == "published", decided.json()
    return entry_id


def notices(db_session, member, key):
    return db_session.execute(
        text("SELECT target_id FROM notifications.notification WHERE member_id = :m AND template = :k"),
        {"m": member.id, "k": key},
    ).scalars().all()


def test_an_entry_without_a_source_or_in_one_language_is_refused_for_publication(client, auth, editor):
    # FR-LIV-002, FR-LIV-005: a draft may be incomplete; review asks for everything.
    draft = client.post(
        "/v1/guide/manage", json=entry_body(titleTa=None, summaryTa=None, bodyTa=None, providerTa=None, sourceUrl=None),
        headers=auth(editor),
    )
    assert draft.status_code == 201 and draft.json()["state"] == "draft"
    asked = client.post(f"/v1/guide/manage/{draft.json()['id']}/request-review", headers=auth(editor))

    assert asked.status_code == 422
    problems = asked.json()["detail"]["problems"]
    assert {"source_url_required", "title_ta_required", "summary_ta_required", "body_ta_required"} <= set(problems)
    assert set(draft.json()["missing"]) >= {"source_url_required", "title_ta_required"}


def test_a_second_person_publishes_and_members_find_it_by_search(client, auth, editor, reviewer, db_session, member_in, area):
    member = member_in(area)
    created = client.post("/v1/guide/manage", json=entry_body(), headers=auth(editor)).json()
    client.post(f"/v1/guide/manage/{created['id']}/request-review", headers=auth(editor))
    hidden = client.get(f"/v1/guide/{created['id']}", headers=auth(member))
    # The editor who asked cannot publish it, even holding the review permission too (FR-LIV-003).
    db_session.execute(
        text("UPDATE access.staff_assignment SET permissions = array_append(permissions, 'guide.review') WHERE member_id = :m"),
        {"m": editor.id},
    )
    own = client.post(f"/v1/guide/manage/{created['id']}/review", json={"approve": True}, headers=auth(editor))
    published = client.post(f"/v1/guide/manage/{created['id']}/review", json={"approve": True}, headers=auth(reviewer))

    found = client.get("/v1/guide", params={"q": "scholarship"}, headers=auth(member)).json()
    by_tamil = client.get("/v1/guide", params={"q": "புலமைப்பரிசில்"}, headers=auth(member)).json()
    other_category = client.get("/v1/guide", params={"q": "scholarship", "category": "job"}, headers=auth(member)).json()
    detail = client.get(f"/v1/guide/{created['id']}", headers=auth(member)).json()

    assert hidden.status_code == 404
    assert (own.status_code, own.json()["detail"]) == (403, "own_entry")
    assert published.json()["state"] == "published"
    assert created["id"] in [e["id"] for e in found] and created["id"] in [e["id"] for e in by_tamil]
    assert created["id"] not in [e["id"] for e in other_category]
    # FR-LIV-002, 004: the source, both dates and the disclaimer on every entry.
    assert detail["sourceUrl"] == "https://www.mahapola.lk/scholarships"
    assert detail["publishedOn"] and detail["verifiedOn"]
    assert "Check eligibility with the provider" in detail["disclaimerEn"] and detail["disclaimerTa"]


def test_wording_that_says_a_person_qualifies_is_refused(client, auth, editor):
    # FR-LIV-004, BR-142.
    refused = client.post("/v1/guide/manage", json=entry_body(summaryEn="You qualify if your family earns little."),
                          headers=auth(editor))
    refused_ta = client.post("/v1/guide/manage", json=entry_body(bodyTa="நீங்கள் தகுதியானவர் என்றால் விண்ணப்பியுங்கள்."),
                             headers=auth(editor))

    assert refused.json()["detail"]["problems"] == ["states_eligibility"]
    assert refused_ta.json()["detail"]["problems"] == ["states_eligibility"]


def test_an_entry_leaves_the_list_after_its_end_date(client, auth, editor, reviewer, db_session, member_in, area):
    # FR-LIV-003: "Given an expired scheme, then it leaves the active list."
    member = member_in(area)
    entry_id = published_entry(client, auth, editor, reviewer)
    db_session.execute(text("UPDATE content.guide_entry SET expires_on = current_date - 1 WHERE id = :id"), {"id": entry_id})

    listed = client.get("/v1/guide", headers=auth(member)).json()
    detail = client.get(f"/v1/guide/{entry_id}", headers=auth(member))
    expired = client.get("/v1/guide/manage", params={"expired": True}, headers=auth(editor)).json()
    late = client.post("/v1/guide/manage", json=entry_body(expiresOn=(guide_today() - timedelta(days=1)).isoformat()),
                       headers=auth(editor)).json()
    late_review = client.post(f"/v1/guide/manage/{late['id']}/request-review", headers=auth(editor))

    assert entry_id not in [e["id"] for e in listed]
    assert detail.status_code == 404
    assert [e["expired"] for e in expired if e["id"] == entry_id] == [True]
    assert "already_expired" in late_review.json()["detail"]["problems"]


def test_a_report_reaches_the_editors_queue_with_the_entry_link(client, auth, editor, reviewer, db_session, member_in, area):
    # FR-LIV-006: "Given a report, then the editor receives it with the entry link."
    member = member_in(area)
    entry_id = published_entry(client, auth, editor, reviewer)

    sent = client.post(f"/v1/guide/{entry_id}/reports", json={"reason": "closed", "note": "Applications closed last week"},
                       headers=auth(member))
    again = client.post(f"/v1/guide/{entry_id}/reports", json={"reason": "outdated"}, headers=auth(member))
    detail = client.get(f"/v1/guide/{entry_id}", headers=auth(member)).json()
    queue = client.get("/v1/guide/manage/reports", headers=auth(editor)).json()
    mine = [r for r in queue if r["id"] == sent.json()["id"]]

    assert sent.status_code == 201
    assert again.json()["detail"]["problems"] == ["already_reported"]
    assert detail["myOpenReport"]["reason"] == "closed"
    assert [str(t) for t in notices(db_session, editor, "guide_entry_reported")] == [entry_id]
    assert len(mine) == 1 and mine[0]["entryId"] == entry_id and "memberId" not in mine[0]

    dismissed_without_reason = client.post(f"/v1/guide/manage/reports/{mine[0]['id']}/resolution",
                                           json={"outcome": "dismissed"}, headers=auth(editor))
    fixed = client.post(f"/v1/guide/manage/reports/{mine[0]['id']}/resolution",
                        json={"outcome": "fixed", "note": "End date set"}, headers=auth(editor))

    assert dismissed_without_reason.json()["detail"]["problems"] == ["reason_required"]
    assert fixed.json()["state"] == "fixed"
    assert [str(t) for t in notices(db_session, member, "guide_report_closed")] == [entry_id]


def test_changing_a_published_entry_takes_it_off_the_guide_until_reviewed(client, auth, editor, reviewer, member_in, area):
    member = member_in(area)
    entry_id = published_entry(client, auth, editor, reviewer)

    changed = client.put(f"/v1/guide/manage/{entry_id}", json=entry_body(titleEn="Mahapola scholarship 2027"),
                         headers=auth(editor))
    while_changed = client.get(f"/v1/guide/{entry_id}", headers=auth(member))
    verify_draft = client.post(f"/v1/guide/manage/{entry_id}/verified", headers=auth(editor))
    client.post(f"/v1/guide/manage/{entry_id}/request-review", headers=auth(editor))
    client.post(f"/v1/guide/manage/{entry_id}/review", json={"approve": True}, headers=auth(reviewer))
    verified = client.post(f"/v1/guide/manage/{entry_id}/verified", headers=auth(editor))
    withdrawn = client.post(f"/v1/guide/manage/{entry_id}/withdraw", json={"reason": "The scheme closed early"},
                            headers=auth(editor))
    gone = client.get(f"/v1/guide/{entry_id}", headers=auth(member))

    assert changed.json()["state"] == "draft"
    assert while_changed.status_code == 404
    assert verify_draft.json()["detail"]["problems"] == ["not_allowed_from:draft"]
    assert verified.json()["verifiedOn"] == guide_today().isoformat()
    assert withdrawn.json()["state"] == "withdrawn" and gone.status_code == 404


def test_returning_an_entry_needs_a_reason_and_members_cannot_manage(client, auth, editor, reviewer, member_in, area):
    member = member_in(area)
    created = client.post("/v1/guide/manage", json=entry_body(), headers=auth(editor)).json()
    client.post(f"/v1/guide/manage/{created['id']}/request-review", headers=auth(editor))

    no_reason = client.post(f"/v1/guide/manage/{created['id']}/review", json={"approve": False}, headers=auth(reviewer))
    returned = client.post(f"/v1/guide/manage/{created['id']}/review",
                           json={"approve": False, "note": "Add the closing date"}, headers=auth(reviewer))

    assert no_reason.json()["detail"]["problems"] == ["reason_required"]
    assert (returned.json()["state"], returned.json()["reviewNote"]) == ("draft", "Add the closing date")
    assert client.get("/v1/guide/manage", headers=auth(member)).status_code == 403
    assert client.post("/v1/guide/manage", json=entry_body(), headers=auth(member)).status_code == 403


def test_the_rules_never_let_a_draft_claim_eligibility():
    assert rules.claims_qualification("Everyone qualifies for this grant")
    assert not rules.claims_qualification("Check eligibility with the provider")
    assert rules.search_pattern("100%_sure") == "%100\\%\\_sure%"
    assert rules.is_expired(date(2026, 1, 1), date(2026, 1, 2)) and not rules.is_expired(date(2026, 1, 2), date(2026, 1, 2))
