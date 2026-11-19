"""Diaspora participation (BRD M46; FR-DSP-001 to 006, BR-147) against a real database."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text

from tests.test_committees_api import active_committee


@pytest.fixture
def client(db_client):
    return db_client


@pytest.fixture
def administrator(create_member, assign, area, super_admin):
    person = create_member(verified=True)
    assign(person, "4", "province", area.province, ["roles.assign"], granted_by=super_admin)
    return person


@pytest.fixture
def event_manager(create_member, assign, area, super_admin):
    person = create_member(verified=True)
    assign(person, "3A", "district", area.district, ["events.manage"], granted_by=super_admin)
    return person


REGISTRATION = {"countryCode": "CA", "timeZone": "America/Toronto", "contactTopics": ["international_events"],
                "skills": ["translation"], "consent": True}


def publish_event(db_session, area, creator, starts):
    return str(db_session.scalar(
        text(
            """
            INSERT INTO events.event (title_en, title_ta, event_type, starts_at, ends_at, checkin_opens_at,
                                      checkin_closes_at, venue, area_key, area_path, state, published_at,
                                      created_by, updated_by)
            VALUES ('Diaspora town hall', 'புலம்பெயர் மக்கள் மன்றம்', 'town_hall', :starts, :ends, :starts, :ends,
                    'Online and Jaffna', :district, ARRAY['platform', :province, :district], 'published', now(),
                    :creator, :creator)
            RETURNING id
            """
        ),
        {"starts": starts, "ends": starts + timedelta(hours=2), "district": f"district:{area.district}",
         "province": f"province:{area.province}", "creator": creator.id},
    ))


def test_a_supporter_registers_without_verification_and_without_contribution_rights(client, auth, create_member,
                                                                                     db_session):
    supporter = create_member()  # identity not verified, membership pending
    before = client.get("/v1/diaspora/me", headers=auth(supporter)).json()
    no_consent = client.put("/v1/diaspora/me", json={**REGISTRATION, "consent": False}, headers=auth(supporter))
    wrong_zone = client.put("/v1/diaspora/me", json={**REGISTRATION, "timeZone": "Europe/Paris"}, headers=auth(supporter))
    registered = client.put("/v1/diaspora/me", json=REGISTRATION, headers=auth(supporter))
    withdrawn = client.delete("/v1/diaspora/me", headers=auth(supporter))
    after = client.get("/v1/diaspora/me", headers=auth(supporter)).json()

    assert before == {"supporter": None, "contributions": {"available": False, "reason": "foreign_contributions_disabled"}}
    assert no_consent.json()["detail"]["problems"] == ["consent_required"]
    assert wrong_zone.json()["detail"]["problems"] == ["time_zone_not_in_country"]
    assert registered.status_code == 200, registered.json()
    assert registered.json()["supporter"]["countryCode"] == "CA"
    assert registered.json()["contributions"]["available"] is False  # BR-147: registration confers no right
    assert withdrawn.status_code == 204 and after["supporter"] is None  # deleted on withdrawal (ENT-59)
    # Registration never changes the identity or membership state.
    assert db_session.scalar(text("SELECT verification_status FROM npm.member WHERE id = :id"),
                             {"id": supporter.id}) == "unverified"


def test_international_events_show_sri_lanka_time_and_the_supporters_own(client, auth, create_member, area,
                                                                       event_manager, db_session, super_admin):
    supporter = create_member()
    client.put("/v1/diaspora/me", json=REGISTRATION, headers=auth(supporter))
    # 18:00 in Sri Lanka on a July evening (FR-DSP-002's example), a year ahead so it is upcoming.
    starts = datetime(datetime.now(UTC).year + 1, 7, 15, 12, 30, tzinfo=UTC)
    event_id = publish_event(db_session, area, super_admin, starts)
    unlisted = [e["id"] for e in client.get("/v1/diaspora/events", headers=auth(supporter)).json()]
    managed = [e["id"] for e in client.get("/v1/diaspora/manage/events", headers=auth(event_manager)).json()]
    listed = client.put(f"/v1/diaspora/manage/events/{event_id}", json={"international": True}, headers=auth(event_manager))
    seen = next(e for e in client.get("/v1/diaspora/events", headers=auth(supporter)).json() if e["id"] == event_id)
    notified = db_session.scalar(text(
        "SELECT count(*) FROM notifications.notification WHERE member_id = :id AND template = 'diaspora_event_listed'"),
        {"id": supporter.id})

    assert event_id not in unlisted and event_id in managed
    assert listed.json()["international"] is True
    assert seen["sriLanka"]["time"] == "18:00" and seen["local"] == {
        "date": starts.strftime("%Y-%m-%d"), "time": "08:30", "utcOffset": "-04:00"}
    assert seen["timeZone"] == "America/Toronto"
    assert notified == 1


def test_only_the_events_area_manager_lists_it(client, auth, create_member, assign, area, db_session, super_admin):
    elsewhere = create_member(verified=True)
    assign(elsewhere, "3A", "district", "LK11" if area.district != "LK11" else "LK12", ["events.manage"],
           granted_by=super_admin)
    event_id = publish_event(db_session, area, super_admin, datetime.now(UTC) + timedelta(days=10))
    refused = client.put(f"/v1/diaspora/manage/events/{event_id}", json={"international": True}, headers=auth(elsewhere))
    assert refused.status_code == 403 and refused.json()["detail"] == "outside_your_area"


def test_remote_volunteering_reaches_supporters_wherever_they_live(client, auth, create_member, assign, area, super_admin,
                                                                   member_in):
    coordinator = create_member(verified=True)
    assign(coordinator, "2B", "ds", area.ds, ["volunteers.manage"], granted_by=super_admin)
    starts = datetime.now(UTC) + timedelta(days=5)
    body = {
        "titleEn": "Translate the farmers' guide", "titleTa": "விவசாயிகள் வழிகாட்டியை மொழிபெயர்த்தல்",
        "roleEn": "Translator", "roleTa": "மொழிபெயர்ப்பாளர்",
        "descriptionEn": "Translate a short guide from English into Tamil.",
        "descriptionTa": "ஒரு சிறிய வழிகாட்டியை ஆங்கிலத்திலிருந்து தமிழுக்கு மொழிபெயர்த்தல்.",
        "placeEn": "Online", "placeTa": "இணையவழி", "bringEn": "A laptop", "bringTa": "ஒரு மடிக்கணினி",
        "teamEn": "Media team", "teamTa": "ஊடகக் குழு", "startsAt": starts.isoformat(),
        "endsAt": (starts + timedelta(hours=4)).isoformat(), "skills": ["translation"], "places": 3, "remote": True,
        "area": {"level": "ds", "code": area.ds},
    }
    created = client.post("/v1/volunteering/manage/opportunities", json=body, headers=auth(coordinator)).json()
    client.post(f"/v1/volunteering/manage/opportunities/{created['id']}/state", json={"state": "open"},
                headers=auth(coordinator))
    supporter = create_member(verified=True, active=True)  # no area: lives abroad
    client.put("/v1/diaspora/me", json=REGISTRATION, headers=auth(supporter))

    remote = [o for o in client.get("/v1/diaspora/opportunities", headers=auth(supporter)).json() if o["id"] == created["id"]]
    detail = client.get(f"/v1/volunteering/opportunities/{created['id']}", headers=auth(supporter))

    assert created["remote"] is True
    assert remote and remote[0]["matchesMySkills"] is True and remote[0]["placesLeft"] == 3
    assert detail.status_code == 200 and detail.json()["remote"] is True  # FR-DSP-003: marked "Remote"


def test_a_supporters_proposal_is_tagged_for_aggregate_analysis_only(client, auth, member_in, area, db_session):
    supporter = member_in(area, verified=True, active=True)
    client.put("/v1/diaspora/me", json=REGISTRATION, headers=auth(supporter))
    sent = client.post("/v1/proposals", json={
        "clientReference": "2b1f9f43-8f5c-4d0e-9b6b-3d0d1c2a9e11", "title": "A library for Kopay",
        "category": "education", "area": {"level": "ds", "code": area.ds},
        "problem": "Children walk ten kilometres to reach the nearest library.",
        "solution": "Open a small reading room in the community hall.",
        "benefit": "Hundreds of children read close to home.",
    }, headers=auth(supporter))
    assert sent.status_code == 201, sent.json()
    columns = [row[0] for row in db_session.execute(text(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'diaspora' AND table_name = 'proposal_tag'"))]
    tagged = db_session.scalar(text("SELECT count(*) FROM diaspora.proposal_tag WHERE proposal_id = :id"),
                               {"id": sent.json()["id"]})
    assert tagged == 1 and sorted(columns) == ["proposal_id", "tagged_at"]  # no member id is kept


def test_staff_see_counts_only_with_small_numbers_hidden(client, auth, create_member, assign, area, super_admin):
    local_analyst = create_member(verified=True)
    assign(local_analyst, "3A", "district", area.district, ["analytics.view"], granted_by=super_admin)
    supporter = create_member()
    client.put("/v1/diaspora/me", json={**REGISTRATION, "countryCode": "NZ", "timeZone": "Pacific/Auckland"},
               headers=auth(supporter))

    summary = client.get("/v1/diaspora/manage/summary", headers=auth(super_admin)).json()
    local = client.get("/v1/diaspora/manage/summary", headers=auth(local_analyst))

    nz = next(c for c in summary["byCountry"] if c["key"] == "NZ")
    assert summary["total"] >= 1 and nz["count"] is None  # fewer than 5: hidden
    assert local.status_code == 403 and local.json()["detail"] == "platform_scope_required"


def test_a_registered_supporter_may_apply_to_a_diaspora_committee_without_verification(
        client, auth, administrator, super_admin, area, create_member):
    diaspora_committee = active_committee(client, auth, administrator, super_admin, area, wing_type="diaspora")
    supporter = create_member()
    unregistered = client.post(f"/v1/committees/{diaspora_committee['id']}/applications", json={}, headers=auth(supporter))
    client.put("/v1/diaspora/me", json=REGISTRATION, headers=auth(supporter))
    listed = [c["id"] for c in client.get("/v1/committees", params={"wingType": "diaspora"}, headers=auth(supporter)).json()]
    registered = client.post(f"/v1/committees/{diaspora_committee['id']}/applications", json={}, headers=auth(supporter))

    assert unregistered.json()["detail"]["problems"] == ["identity_not_verified"]
    assert registered.status_code == 201  # FR-DSP-005: access then follows committee rules (coordinator approval)
    assert registered.json()["state"] == "applied"
    assert diaspora_committee["id"] in listed  # listed for supporters wherever the committee is based


def test_the_party_fund_refuses_a_registered_overseas_supporter(db_session, create_member, database_settings):
    from datetime import date

    from pydantic import SecretStr

    from app.modules.finance import service as finance
    from app.modules.finance.schemas import ContributionCreateRequest

    supporter = create_member(verified=True, active=True)
    db_session.execute(text(
        """INSERT INTO diaspora.supporter (member_id, country_code, time_zone, consent_version)
           VALUES (:id, 'GB', 'Europe/London', 'test')"""), {"id": supporter.id})
    settings = database_settings.model_copy(update={
        "finance_intake_enabled": True, "finance_bank_name": "Test Bank", "finance_account_name": "TMK",
        "finance_account_number": SecretStr("0000000001"), "finance_branch_name": "Jaffna",
        "finance_transfer_instructions_en": "Transfer in LKR.", "finance_transfer_instructions_ta": "இலங்கை ரூபாயில் அனுப்புக.",
        "finance_encryption_key": SecretStr("A" * 44), "finance_malware_scanner": "test",
    })
    assert settings.is_finance_configured and not settings.feature_flags_enforced
    request = ContributionCreateRequest.model_construct(
        amount_minor=50000, transfer_date=date.today(), bank_reference="REF12345", paying_for_self=True,
        no_privilege_acknowledged=True, information_accurate_acknowledged=True, idempotency_key="k-1")
    with pytest.raises(finance.InvalidSubmission) as refused:
        finance.create_or_get_draft(db_session, settings, supporter.id, request)
    assert refused.value.code == "foreign_contributions_disabled"
