"""Community Support (BRD M11 to M14, S11, S12, D13, D14, FR-AST-001 to 013)."""

import re
from datetime import date

import pytest
from sqlalchemy import text

from app.core import small_numbers
from app.modules.assistance import rules


@pytest.fixture
def client(db_client):
    return db_client


@pytest.fixture
def staff(create_member, assign, area, super_admin):
    def person(tier, level, code, permissions):
        member = create_member(verified=True)
        assign(member, tier, level, code, permissions, granted_by=super_admin)
        return member

    return {
        "intake": person("2B", "ds", area.ds, ["assistance.intake"]),
        "worker": person("3B", "district", area.district, ["assistance.casework"]),
        "other_worker": person("3B", "district", area.district, ["assistance.casework"]),
        "decider": person("3A", "district", area.district, ["assistance.decide"]),
        "second_decider": person("4", "province", area.province, ["assistance.decide", "assistance.programme.manage"]),
    }


def request_body(**overrides):
    return {
        "category": "food", "summary": "Our family has had no regular food since the fishing ban began.",
        "emergency": False, "consent": True, "fullName": "Applicant Person", "phone": "0771234567", **overrides,
    }


def programme_with_criteria(client, auth, manager):
    programme = client.post("/v1/assistance/manage/programmes", json={
        "nameEn": "Food support", "nameTa": "உணவு உதவி", "descriptionEn": "Dry rations for families in need.",
        "descriptionTa": "தேவையுள்ள குடும்பங்களுக்கு உலர் உணவுப் பொருட்கள்.", "categories": ["food"],
    }, headers=auth(manager)).json()
    return client.post(f"/v1/assistance/manage/programmes/{programme['id']}/criteria", json={
        "criteriaEn": "Household income under the poverty line.", "criteriaTa": "வறுமைக் கோட்டுக்குக் கீழ் வருமானம்.",
    }, headers=auth(manager)).json()


def test_anyone_signed_in_may_ask_without_membership_and_the_reference_says_nothing(client, auth, member_in, area):
    pending = member_in(area)  # neither verified nor active (BR-102)

    home = client.get("/v1/assistance", headers=auth(pending)).json()
    no_consent = client.post("/v1/assistance/requests", json=request_body(consent=False), headers=auth(pending))
    sent = client.post("/v1/assistance/requests", json=request_body(), headers=auth(pending))

    assert home["emergencyContacts"][0]["number"] == "119" and len(home["categories"]) == 10
    assert no_consent.json()["detail"]["problems"] == ["consent_required"]
    assert sent.status_code == 201 and re.fullmatch(r"AS-[A-Z2-7]{8}", sent.json()["caseRef"])
    assert sent.json()["state"] == "screening"
    assert "food" not in sent.json()["caseRef"].lower()


def test_the_public_form_needs_no_account_and_is_rate_limited(client, area):
    body = request_body(area={"level": "ds", "code": area.ds})
    first = client.post("/v1/assistance/public-requests", json=body)
    no_phone = client.post("/v1/assistance/public-requests", json={**body, "phone": None})
    for _ in range(4):
        client.post("/v1/assistance/public-requests", json=body)
    limited = client.post("/v1/assistance/public-requests", json=body)

    assert first.status_code == 201 and set(first.json()) == {"caseRef"}
    assert no_phone.json()["detail"]["problems"] == ["phone_required"]
    assert limited.json()["detail"]["problems"] == ["too_many_requests"]


def test_only_the_assigned_caseworker_and_deciders_open_a_case_and_every_opening_is_audited(
    client, auth, member_in, area, staff, db_session
):
    applicant = member_in(area)
    case_id = client.post("/v1/assistance/requests", json=request_body(area={"level": "ds", "code": area.ds}),
                          headers=auth(applicant)).json()["id"]

    screening = client.get(f"/v1/assistance/manage/cases/{case_id}", headers=auth(staff["intake"]))
    assigned = client.post(f"/v1/assistance/manage/cases/{case_id}/assign", json={"caseworkerId": str(staff["worker"].id)},
                           headers=auth(staff["decider"]))
    intake_after = client.get(f"/v1/assistance/manage/cases/{case_id}", headers=auth(staff["intake"]))
    other = client.get(f"/v1/assistance/manage/cases/{case_id}", headers=auth(staff["other_worker"]))
    worker = client.get(f"/v1/assistance/manage/cases/{case_id}", headers=auth(staff["worker"]))

    assert screening.status_code == 200
    assert assigned.json()["state"] == "assessment"
    assert (intake_after.status_code, other.status_code) == (403, 403)
    assert other.json()["detail"] == "not_assigned"
    assert worker.json()["applicantName"] == "Applicant Person" and worker.json()["mayWork"] is True
    # FR-AST-009: no membership, verification, contribution or campaign field anywhere.
    for forbidden in ("memberCode", "membership", "verification", "contribution", "applicantMemberId"):
        assert forbidden not in str(worker.json())
    opened = db_session.scalar(text("SELECT count(*) FROM ops.audit_log WHERE action = 'assistance.case.opened' AND target_id = :id"),
                               {"id": case_id})
    refused = db_session.scalar(text("SELECT count(*) FROM ops.audit_log WHERE target_id = :id AND action LIKE 'access.%'"),
                                {"id": case_id})
    assert opened >= 2 and refused >= 2


def test_decisions_cite_criteria_and_an_appeal_is_decided_by_someone_else(client, auth, member_in, area, staff, db_session):
    applicant = member_in(area)
    criteria = programme_with_criteria(client, auth, staff["second_decider"])
    case_id = client.post("/v1/assistance/requests", json=request_body(area={"level": "ds", "code": area.ds}),
                          headers=auth(applicant)).json()["id"]
    client.post(f"/v1/assistance/manage/cases/{case_id}/assign", json={"caseworkerId": str(staff["worker"].id)},
                headers=auth(staff["decider"]))

    decided = client.post(f"/v1/assistance/manage/cases/{case_id}/decision", json={
        "outcome": "not_eligible", "criteriaVersionId": criteria["criteriaVersionId"],
        "reasonEn": "Income is above the published line.", "reasonTa": "வருமானம் வெளியிடப்பட்ட எல்லைக்கு மேல்.",
    }, headers=auth(staff["decider"]))
    decision_id = decided.json()["decisions"][0]["id"]
    appealed = client.post(f"/v1/assistance/requests/{case_id}/appeals", json={
        "decisionId": decision_id, "kind": "appeal", "body": "Our income fell after the fishing ban began.",
    }, headers=auth(applicant))
    twice = client.post(f"/v1/assistance/requests/{case_id}/appeals", json={
        "decisionId": decision_id, "kind": "complaint", "body": "A second complaint about the same decision.",
    }, headers=auth(applicant))
    same_person = client.post(f"/v1/assistance/manage/appeals/{appealed.json()['id']}/decision", json={
        "change": False, "reason": "The decision stands on the income figures.",
    }, headers=auth(staff["decider"]))
    changed = client.post(f"/v1/assistance/manage/appeals/{appealed.json()['id']}/decision", json={
        "change": True, "reason": "The new income evidence meets the criteria.", "outcome": "approved",
        "criteriaVersionId": criteria["criteriaVersionId"], "reasonTa": "புதிய வருமானச் சான்று அளவுகோல்களைப் பூர்த்தி செய்கிறது.",
    }, headers=auth(staff["second_decider"]))
    mine = client.get(f"/v1/assistance/requests/{case_id}", headers=auth(applicant)).json()

    assert decided.json()["decisions"][0]["criteriaVersion"] == 1
    assert appealed.status_code == 201 and twice.json()["detail"]["problems"] == ["already_appealed"]
    assert (same_person.status_code, same_person.json()["detail"]) == (403, "original_decider")
    assert changed.status_code == 204
    assert [d["outcome"] for d in mine["decisions"]] == ["not_eligible", "approved"]
    assert mine["appeals"][0]["state"] == "changed"


def test_delivery_and_partner_referral_need_the_right_steps(client, auth, member_in, area, staff):
    applicant = member_in(area)
    criteria = programme_with_criteria(client, auth, staff["second_decider"])
    partner = client.post("/v1/assistance/manage/partners", json={"name": "Jaffna Food Bank", "kind": "ngo",
                                                                  "contact": "021 222 3333"},
                          headers=auth(staff["second_decider"])).json()
    case_id = client.post("/v1/assistance/requests", json=request_body(area={"level": "ds", "code": area.ds}),
                          headers=auth(applicant)).json()["id"]
    client.post(f"/v1/assistance/manage/cases/{case_id}/assign", json={"caseworkerId": str(staff["worker"].id)},
                headers=auth(staff["decider"]))

    early = client.post(f"/v1/assistance/manage/cases/{case_id}/deliveries", json={
        "kind": "Dry rations", "amount": "1 pack", "deliveredOn": date.today().isoformat(), "provider": "Food Bank",
        "evidence": "Signed receipt 12"}, headers=auth(staff["worker"]))
    no_consent = client.post(f"/v1/assistance/manage/cases/{case_id}/referrals",
                             json={"partnerId": partner["id"], "consent": False}, headers=auth(staff["worker"]))
    referred = client.post(f"/v1/assistance/manage/cases/{case_id}/referrals",
                           json={"partnerId": partner["id"], "consent": True}, headers=auth(staff["worker"]))
    client.post(f"/v1/assistance/manage/cases/{case_id}/decision", json={
        "outcome": "approved", "criteriaVersionId": criteria["criteriaVersionId"],
        "reasonEn": "Meets the published income line.", "reasonTa": "வெளியிடப்பட்ட வருமான எல்லையைப் பூர்த்தி செய்கிறது.",
    }, headers=auth(staff["decider"]))
    delivered = client.post(f"/v1/assistance/manage/cases/{case_id}/deliveries", json={
        "kind": "Dry rations", "amount": "1 pack", "deliveredOn": date.today().isoformat(), "provider": "Food Bank",
        "evidence": "Signed receipt 12"}, headers=auth(staff["worker"]))

    assert early.json()["detail"]["problems"] == ["not_allowed_from:assessment"]
    assert no_consent.json()["detail"]["problems"] == ["partner_consent_required"]
    assert referred.json()["referrals"][0]["partner"] == "Jaffna Food Bank"
    assert delivered.json()["deliveries"][0]["evidence"] == "Signed receipt 12"


def test_a_repeat_request_is_suggested_for_linking_not_rejected(client, auth, member_in, area, staff):
    applicant = member_in(area)
    first = client.post("/v1/assistance/requests", json=request_body(area={"level": "ds", "code": area.ds}),
                        headers=auth(applicant)).json()["id"]
    second = client.post("/v1/assistance/requests", json=request_body(category="housing", area={"level": "ds", "code": area.ds}),
                         headers=auth(applicant))

    file = client.get(f"/v1/assistance/manage/cases/{second.json()['id']}", headers=auth(staff["decider"])).json()
    linked = client.post(f"/v1/assistance/manage/cases/{second.json()['id']}/link", json={"otherCaseId": first},
                         headers=auth(staff["decider"])).json()

    assert second.status_code == 201
    assert [d["id"] for d in file["possibleDuplicates"]] == [first]
    assert linked["linkedCaseRef"] is not None


def test_assistance_rows_are_invisible_outside_the_module(client, auth, member_in, area, db_session):
    applicant = member_in(area)
    client.post("/v1/assistance/requests", json=request_body(), headers=auth(applicant))
    db_session.execute(
        text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'test_app_user') THEN
                    CREATE ROLE test_app_user;
                END IF;
                GRANT USAGE ON SCHEMA assistance TO test_app_user;
                GRANT SELECT ON ALL TABLES IN SCHEMA assistance TO test_app_user;
            END
            $$;
            """
        )
    )
    try:
        db_session.execute(text("SET ROLE test_app_user"))
        # The request above opened the firewall for its own transaction; this test shares one outer
        # transaction, so close it again to see what any other code sees.
        db_session.execute(text("SELECT set_config('assistance.firewall', '', true)"))
        hidden = db_session.scalar(text("SELECT count(*) FROM assistance.case"))
        db_session.execute(text("SELECT set_config('assistance.firewall', 'open', true)"))
        shown = db_session.scalar(text("SELECT count(*) FROM assistance.case"))
    finally:
        db_session.execute(text("RESET ROLE"))
    assert hidden == 0 and shown >= 1


# FR-AST-013 (no assistance decisions alongside fundraising or election-roster rights) is RB-12,
# tested in test_access_rules.py::test_rb12_assistance_decisions_never_sit_with_fundraising_in_the_same_area.


def test_small_numbers_are_hidden_directly_and_by_subtraction():
    table = small_numbers.area_table([("D", "A", "food|open", 12), ("D", "B", "food|open", 3)])
    assert ("district:D", "food|open", 15) in table and not any(area == "ds:A" for area, _, _ in table)
    assert rules.hide_small(4) is None and rules.hide_small(0) == 0
