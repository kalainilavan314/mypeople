"""Community Support (BRD M11 to M14, S11, S12, D13, D14, FR-AST-001 to 013)."""

import re
import uuid
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


def programme_with_criteria(client, auth, manager, categories=("food",)):
    programme = client.post("/v1/assistance/manage/programmes", json={
        "nameEn": "Food support", "nameTa": "உணவு உதவி", "descriptionEn": "Dry rations for families in need.",
        "descriptionTa": "தேவையுள்ள குடும்பங்களுக்கு உலர் உணவுப் பொருட்கள்.", "categories": list(categories),
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
    form = client.get("/v1/assistance/public-form")
    body = request_body(area={"level": "ds", "code": area.ds})
    first = client.post("/v1/assistance/public-requests", json=body)
    no_phone = client.post("/v1/assistance/public-requests", json={**body, "phone": None})
    for _ in range(4):
        client.post("/v1/assistance/public-requests", json=body)
    limited = client.post("/v1/assistance/public-requests", json=body)

    assert form.status_code == 200 and form.json()["emergencyContacts"][0]["number"] == "119"
    assert len(form.json()["categories"]) == 10 and set(form.json()) == {"emergencyContacts", "categories"}
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

    assert screening.status_code == 200 and screening.json()["fullFile"] is False
    assert screening.json()["applicantName"] is None and screening.json()["summary"] is None
    assert assigned.json()["state"] == "assessment"
    assert (intake_after.status_code, other.status_code) == (403, 403)
    assert other.json()["detail"] == "not_assigned"
    assert worker.json()["applicantName"] == "Applicant Person" and worker.json()["mayWork"] is True
    assert worker.json()["fullFile"] is True
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
    assert mine["appeals"][0]["state"] == "changed" and mine["appeals"][0]["caseRef"] == mine["caseRef"]


def add_partner(client, auth, manager, name="Jaffna Food Bank"):
    return client.post("/v1/assistance/manage/partners", json={"name": name, "kind": "ngo", "contact": "021 222 3333"},
                       headers=auth(manager)).json()


def test_delivery_and_a_hotline_referral_need_the_right_steps(client, auth, area, staff, db_session):
    """Without an app account, the caseworker records the consent the applicant gave them (FR-AST-004)."""
    criteria = programme_with_criteria(client, auth, staff["second_decider"])
    partner = add_partner(client, auth, staff["second_decider"])
    case_id = client.post("/v1/assistance/manage/intake", json={
        **request_body(), "channel": "hotline", "area": {"level": "ds", "code": area.ds},
    }, headers=auth(staff["intake"])).json()["id"]
    client.post(f"/v1/assistance/manage/cases/{case_id}/assign", json={"caseworkerId": str(staff["worker"].id)},
                headers=auth(staff["decider"]))

    early = client.post(f"/v1/assistance/manage/cases/{case_id}/deliveries", json={
        "kind": "Dry rations", "amount": "1 pack", "deliveredOn": date.today().isoformat(), "provider": "Food Bank",
        "evidence": "Signed receipt 12"}, headers=auth(staff["worker"]))
    no_consent = client.post(f"/v1/assistance/manage/cases/{case_id}/referrals",
                             json={"partnerId": partner["id"], "purpose": "Dry rations for the family.", "consent": False},
                             headers=auth(staff["worker"]))
    referred = client.post(f"/v1/assistance/manage/cases/{case_id}/referrals",
                           json={"partnerId": partner["id"], "purpose": "Dry rations for the family.", "consent": True},
                           headers=auth(staff["worker"]))
    client.post(f"/v1/assistance/manage/cases/{case_id}/decision", json={
        "outcome": "approved", "criteriaVersionId": criteria["criteriaVersionId"],
        "reasonEn": "Meets the published income line.", "reasonTa": "வெளியிடப்பட்ட வருமான எல்லையைப் பூர்த்தி செய்கிறது.",
    }, headers=auth(staff["decider"]))
    delivered = client.post(f"/v1/assistance/manage/cases/{case_id}/deliveries", json={
        "kind": "Dry rations", "amount": "1 pack", "deliveredOn": date.today().isoformat(), "provider": "Food Bank",
        "evidence": "Signed receipt 12"}, headers=auth(staff["worker"]))
    referral = referred.json()["referrals"][0]
    accepted = client.post(f"/v1/assistance/manage/cases/{case_id}/referrals/{referral['id']}",
                           json={"state": "accepted", "outcome": "Food parcel booked."}, headers=auth(staff["worker"]))
    logged = db_session.execute(
        text("SELECT details FROM ops.audit_log WHERE action = 'assistance.referral.updated' AND target_id = :id"),
        {"id": case_id},
    ).scalar_one()

    assert referred.json()["consentInApp"] is False
    assert early.json()["detail"]["problems"] == ["not_allowed_from:assessment"]
    assert no_consent.json()["detail"]["problems"] == ["partner_consent_required"]
    assert (referral["partner"], referral["purpose"], referral["state"]) == ("Jaffna Food Bank", "Dry rations for the family.", "sent")
    assert referral["consentRecordedBy"] == "caseworker" and referral["consentAt"] is not None
    assert delivered.json()["deliveries"][0]["evidence"] == "Signed receipt 12"
    assert accepted.json()["referrals"][0]["state"] == "accepted"
    # Ids and the state only, never the outcome text.
    assert logged == {"referral": referral["id"], "state": "accepted"}


def test_a_member_consents_to_each_partner_referral_in_the_app(client, auth, member_in, area, staff, db_session):
    """M12: the caseworker proposes; nothing is shared until the applicant agrees, once, for that partner."""
    applicant, stranger = member_in(area), member_in(area)
    food_bank = add_partner(client, auth, staff["second_decider"])
    clinic = add_partner(client, auth, staff["second_decider"], name="Point Pedro Clinic")
    case_id = client.post("/v1/assistance/requests", json=request_body(area={"level": "ds", "code": area.ds}),
                          headers=auth(applicant)).json()["id"]
    client.post(f"/v1/assistance/manage/cases/{case_id}/assign", json={"caseworkerId": str(staff["worker"].id)},
                headers=auth(staff["decider"]))

    def propose(partner, purpose):
        # The caseworker's tick is not the member's consent: the referral still waits for the member.
        return client.post(f"/v1/assistance/manage/cases/{case_id}/referrals",
                           json={"partnerId": partner["id"], "purpose": purpose, "consent": True}, headers=auth(staff["worker"]))

    proposed = propose(food_bank, "Dry rations for the family.").json()
    first = proposed["referrals"][0]
    second = propose(clinic, "A check-up for the children.").json()["referrals"][1]
    too_early = client.post(f"/v1/assistance/manage/cases/{case_id}/referrals/{first['id']}", json={"state": "accepted"},
                            headers=auth(staff["worker"]))
    notices = text("SELECT count(*) FILTER (WHERE action_done_at IS NULL), count(*) FROM notifications.notification "
                   "WHERE member_id = :m AND template = 'assistance_referral_consent' AND target_id = :c")
    waiting_notices = db_session.execute(notices, {"m": applicant.id, "c": case_id}).one()
    mine = client.get(f"/v1/assistance/requests/{case_id}", headers=auth(applicant)).json()
    not_theirs = client.post(f"/v1/assistance/requests/{case_id}/referrals/{first['id']}/consent", json={"consent": True},
                             headers=auth(stranger))
    agreed = client.post(f"/v1/assistance/requests/{case_id}/referrals/{first['id']}/consent", json={"consent": True},
                         headers=auth(applicant))
    again = client.post(f"/v1/assistance/requests/{case_id}/referrals/{first['id']}/consent", json={"consent": False},
                        headers=auth(applicant))
    refused = client.post(f"/v1/assistance/requests/{case_id}/referrals/{second['id']}/consent", json={"consent": False},
                          headers=auth(applicant))
    answered_notices = db_session.execute(notices, {"m": applicant.id, "c": case_id}).one()
    partner_said = client.post(f"/v1/assistance/manage/cases/{case_id}/referrals/{first['id']}", json={"state": "accepted"},
                               headers=auth(staff["worker"]))
    after_refusal = client.post(f"/v1/assistance/manage/cases/{case_id}/referrals/{second['id']}", json={"state": "accepted"},
                                headers=auth(staff["worker"]))
    actions = db_session.execute(
        text("SELECT action, details FROM ops.audit_log WHERE target_id = :id AND action LIKE 'assistance.referral.%' "
             "ORDER BY occurred_at"),
        {"id": case_id},
    ).all()

    assert proposed["consentInApp"] is True
    assert (first["state"], first["consentAt"], first["consentRecordedBy"]) == ("proposed", None, None)
    assert too_early.json()["detail"]["problems"] == ["referral_not_shared"]
    waiting = [(r["partner"], r["partnerKind"], r["purpose"], r["state"]) for r in mine["referrals"]]
    assert waiting == [("Jaffna Food Bank", "ngo", "Dry rations for the family.", "proposed"),
                       ("Point Pedro Clinic", "ngo", "A check-up for the children.", "proposed")]
    assert "outcome" not in mine["referrals"][0]
    assert not_theirs.status_code == 404
    assert agreed.status_code == 200 and agreed.json()["referrals"][0]["state"] == "sent"
    assert agreed.json()["referrals"][0]["consentAt"] is not None
    assert again.json()["detail"]["problems"] == ["referral_already_answered"]
    assert refused.json()["referrals"][1]["state"] == "consent_declined"
    assert partner_said.json()["referrals"][0]["consentRecordedBy"] == "applicant"
    assert partner_said.json()["referrals"][0]["state"] == "accepted"
    assert after_refusal.json()["detail"]["problems"] == ["referral_not_shared"]
    # Ids only: never the purpose, which describes the person's need.
    assert [action for action, _ in actions] == [
        "assistance.referral.proposed", "assistance.referral.proposed", "assistance.referral.consented",
        "assistance.referral.consent_declined", "assistance.referral.updated",
    ]
    assert all("purpose" not in details and "Dry rations" not in str(details) for _, details in actions)
    # One action-needed notice per proposal; they leave "Action needed" once nothing waits for an answer.
    assert tuple(waiting_notices) == (2, 2) and tuple(answered_notices) == (0, 2)


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


# FR-AST-013 (no assistance decisions alongside fundraising or election-roster rights, in any area) is
# RB-12, tested in test_access_rules.py::test_rb12_assistance_decisions_never_sit_with_fundraising_in_any_area
# and test_rb12_an_assistance_decider_gets_no_election_roster_rights_in_another_province.


def test_small_numbers_are_hidden_directly_and_by_subtraction():
    table = small_numbers.area_table([("D", "A", "food|open", 12), ("D", "B", "food|open", 3)])
    assert ("district:D", "food|open", 15) in table and not any(area == "ds:A" for area, _, _ in table)
    assert rules.hide_small(4) is None and rules.hide_small(0) == 0


def test_intake_sees_only_the_summary_and_routes_the_case_to_a_caseworker(client, auth, member_in, area, staff, db_session):
    """S12: intake staff never see the person's name, phone or request; they route the case and lose it."""
    applicant = member_in(area)
    case_id = client.post("/v1/assistance/requests", json=request_body(household="2 adults", area={"level": "ds", "code": area.ds}),
                          headers=auth(applicant)).json()["id"]

    summary = client.get(f"/v1/assistance/manage/cases/{case_id}", headers=auth(staff["intake"]))
    workers = client.get(f"/v1/assistance/manage/cases/{case_id}/caseworkers", headers=auth(staff["intake"]))
    note = client.post(f"/v1/assistance/manage/cases/{case_id}/notes", json={"body": "Called back."}, headers=auth(staff["intake"]))
    routed = client.post(f"/v1/assistance/manage/cases/{case_id}/assign", json={"caseworkerId": str(staff["worker"].id)},
                         headers=auth(staff["intake"]))
    after = client.get(f"/v1/assistance/manage/cases/{case_id}", headers=auth(staff["intake"]))

    body = summary.json()
    assert summary.status_code == 200 and body["fullFile"] is False and body["caseRef"].startswith("AS-")
    assert (body["applicantName"], body["applicantPhone"], body["household"], body["summary"]) == (None, None, None, None)
    assert body["notes"] == [] and body["possibleDuplicates"] == [] and body["decisions"] == []
    assert (body["mayAssign"], body["mayDecide"], body["mayWork"]) == (True, False, False)
    assert "Applicant Person" not in str(body) and "0771234567" not in str(body)
    assert str(staff["worker"].id) in {w["memberId"] for w in workers.json()}
    assert (note.status_code, note.json()["detail"]) == (403, "not_assigned")
    assert routed.status_code == 200 and routed.json()["fullFile"] is False and routed.json()["state"] == "assessment"
    assert routed.json()["applicantName"] is None and routed.json()["caseworkerName"] is not None
    assert after.status_code == 403
    views = db_session.scalars(
        text("SELECT details->>'view' FROM ops.audit_log WHERE action = 'assistance.case.opened' AND target_id = :id"),
        {"id": case_id},
    ).all()
    assert views == ["summary"]


def test_a_decision_cites_the_current_criteria_of_an_active_programme_for_the_kind_of_help(client, auth, member_in, area, staff):
    """D13: not a superseded version, a retired programme, or a programme for another kind of help."""
    manager = staff["second_decider"]
    food = programme_with_criteria(client, auth, manager)
    newer = client.post(f"/v1/assistance/manage/programmes/{food['id']}/criteria", json={
        "criteriaEn": "Household income under the revised poverty line.",
        "criteriaTa": "திருத்திய வறுமைக் கோட்டுக்குக் கீழ் வருமானம்.",
    }, headers=auth(manager)).json()
    housing = programme_with_criteria(client, auth, manager, categories=("housing",))
    retired = programme_with_criteria(client, auth, manager)
    client.post(f"/v1/assistance/manage/programmes/{retired['id']}/active", json={"active": False}, headers=auth(manager))
    applicant = member_in(area)
    case_id = client.post("/v1/assistance/requests", json=request_body(area={"level": "ds", "code": area.ds}),
                          headers=auth(applicant)).json()["id"]

    def decide(criteria_version_id):
        return client.post(f"/v1/assistance/manage/cases/{case_id}/decision", json={
            "outcome": "approved", "criteriaVersionId": criteria_version_id,
            "reasonEn": "Meets the published income line.", "reasonTa": "வெளியிடப்பட்ட வருமான எல்லையைப் பூர்த்தி செய்கிறது.",
        }, headers=auth(staff["decider"]))

    superseded = decide(food["criteriaVersionId"])
    other_kind = decide(housing["criteriaVersionId"])
    inactive = decide(retired["criteriaVersionId"])
    unknown = decide(str(uuid.uuid4()))
    current = decide(newer["criteriaVersionId"])

    for refused in (superseded, other_kind, inactive):
        assert refused.json()["detail"]["problems"] == ["criteria_not_current"]
    assert unknown.json()["detail"]["problems"] == ["criteria_version_required"]
    assert current.status_code == 200 and current.json()["decisions"][0]["criteriaVersion"] == 2


def test_duplicates_match_the_person_never_a_household_description(client, auth, area, staff):
    """S11, FR-AST-006: the same phone or name is suggested; families who only share "2 adults, 3 children" are not."""

    def intake(name, phone):
        return client.post("/v1/assistance/manage/intake", json={
            **request_body(fullName=name, phone=phone, household="2 adults, 3 children"), "channel": "hotline",
            "area": {"level": "ds", "code": area.ds},
        }, headers=auth(staff["intake"])).json()["id"]

    def suggested(case_id):
        file = client.get(f"/v1/assistance/manage/cases/{case_id}", headers=auth(staff["decider"])).json()
        return {other["id"] for other in file["possibleDuplicates"]}

    first = intake("Sivakumar Rajan", "0771111111")
    unrelated = intake("Meena Tharsan", "0772222222")
    same_name = intake("sivakumar  rajan.", "0773333333")
    same_phone = intake("Rajan S.", "+94 77 111 1111")

    assert first not in suggested(unrelated) and unrelated not in suggested(first)
    assert first in suggested(same_name)
    assert first in suggested(same_phone)


def test_public_statistics_show_districts_only_and_hide_groups_under_ten(client, auth, member_in, area):
    """D14, FR-AST-012: anonymised aggregates for anyone, without an account."""
    applicant = member_in(area)
    for category, times in (("food", 10), ("housing", 3)):
        for _ in range(times):
            client.post("/v1/assistance/requests", json=request_body(category=category, area={"level": "gn", "code": area.gn}),
                        headers=auth(applicant))

    statistics = client.get("/v1/assistance/statistics")

    cells = {(cell["areaKey"], cell["category"]): cell["count"] for cell in statistics.json()["cells"]}
    assert statistics.status_code == 200 and statistics.json()["minimumGroup"] == 10
    assert cells[(f"district:{area.district}", "food")] >= 10
    assert cells[(f"district:{area.district}", "housing")] is None
    # Districts only: no DS or GN division, state or person.
    assert all(key == "platform" or key.startswith("district:") for key, _ in cells)
    assert all(set(cell) == {"areaKey", "category", "count"} for cell in statistics.json()["cells"])
