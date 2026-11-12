"""/v1/home against a real database. Skipped without DATABASE_URL. Everything is rolled back."""

import random
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Row, text


@pytest.fixture
def client(db_client) -> TestClient:
    return db_client


def confirm_phone(db_session, member: Row) -> None:
    db_session.execute(
        text("INSERT INTO identity.recovery_contact (member_id, phone) VALUES (:id, :phone)"),
        {"id": member.id, "phone": f"+9477{random.randrange(10**6, 10**7)}"},
    )


def publish_event(db_session, area: Row, creator: Row, starts_in: timedelta, title: str = "Village meeting") -> str:
    starts = datetime.now(UTC) + starts_in
    return str(
        db_session.scalar(
            text(
                """
                INSERT INTO events.event (title_en, title_ta, event_type, starts_at, ends_at, checkin_opens_at,
                                          checkin_closes_at, venue, area_key, area_path, state, published_at,
                                          created_by, updated_by)
                VALUES (:title, 'கூட்டம்', 'community_meeting', :starts, :ends, :starts, :ends, 'Hall',
                        :district, ARRAY['platform', :province, :district], 'published', now(), :creator, :creator)
                RETURNING id
                """
            ),
            {
                "title": title,
                "starts": starts,
                "ends": starts + timedelta(hours=2),
                "district": f"district:{area.district}",
                "province": f"province:{area.province}",
                "creator": creator.id,
            },
        )
    )


def test_a_new_member_sees_the_awaiting_review_home_with_locks_explained(client, auth, member_in, area):
    member = member_in(area)

    home = client.get("/v1/home", headers=auth(member)).json()

    assert (home["layout"], home["identityState"], home["membershipState"]) == ("awaiting_review", "not_submitted", "pending")
    assert home["nextStep"]["kind"] == "submit_identity"
    actions = {a["key"]: a for a in home["quickActions"]}
    assert list(actions) == ["report_issue", "volunteer", "my_area", "community"]
    assert actions["report_issue"]["available"] is True
    assert (actions["volunteer"]["reason"], actions["volunteer"]["nextStep"]) == ("identity_not_verified", "view_verification")
    services = [s["key"] for s in home["hub"]["services"]]
    assert services.index("party_fund") == 3 and home["hub"]["gnLabel"] == home["gnName"]
    assert {t["key"]: t["available"] for t in home["tabs"]} == {"events": True, "card": True, "gallery": True}


def test_an_active_member_sees_one_next_step_and_the_next_event_nearby(client, db_session, auth, member_in, area):
    member = member_in(area, verified=True, active=True)
    confirm_phone(db_session, member)
    later = publish_event(db_session, area, member, timedelta(days=5), "Harvest day")
    tomorrow = publish_event(db_session, area, member, timedelta(hours=20), "Road meeting")

    quiet = client.get("/v1/home", headers=auth(member)).json()
    client.put(f"/v1/events/{later}/rsvp", json={"response": "going"}, headers=auth(member))
    client.put(f"/v1/events/{tomorrow}/rsvp", json={"response": "going"}, headers=auth(member))
    busy = client.get("/v1/home", headers=auth(member)).json()

    assert (quiet["layout"], quiet["nextStep"]) == ("active", None)
    assert quiet["comingUp"]["id"] == tomorrow
    assert all(a["available"] for a in quiet["quickActions"] + quiet["hub"]["services"])
    assert (busy["nextStep"]["kind"], busy["nextStep"]["eventId"]) == ("event_soon", tomorrow)  # within 48 hours
    assert busy["comingUp"]["myResponse"] == "going"


def test_a_correction_request_outranks_everything_else(client, db_session, auth, member_in, area):
    member = member_in(area)
    review_ref = db_session.scalar(
        text(
            """
            INSERT INTO identity.identity_review (member_id, route, state, area_path)
            VALUES (:id, 'nic', 'needs_update', '{platform}') RETURNING review_ref
            """
        ),
        {"id": member.id},
    )
    soon = publish_event(db_session, area, member, timedelta(hours=10))
    db_session.execute(
        text("INSERT INTO events.rsvp (event_id, member_id, response) VALUES (:event, :member, 'going')"),
        {"event": soon, "member": member.id},
    )

    home = client.get("/v1/home", headers=auth(member)).json()

    assert (home["nextStep"]["kind"], home["nextStep"]["reviewRef"]) == ("correct_identity", review_ref)
    assert (home["identityState"], home["reviewRef"]) == ("needs_update", review_ref)


def test_a_service_behind_an_off_module_switch_shows_as_not_open(database_settings, db_session, auth, create_member):
    # Production enforces module switches; the party fund's routes answer 404 while community_finance
    # is off, so Home must not offer a page that cannot load (seen on production, 12 November 2026).
    from app.db.session import get_db
    from app.main import create_app

    app = create_app(database_settings.model_copy(update={"enforce_feature_flags": True}))
    app.dependency_overrides[get_db] = lambda: db_session
    enforced = TestClient(app)
    member = create_member(verified=True, active=True)
    db_session.execute(text("UPDATE ops.feature_flag SET enabled = false WHERE key = 'community_finance'"))

    hub = {item["key"]: item for item in enforced.get("/v1/home", headers=auth(member)).json()["hub"]["services"]}
    assert (hub["party_fund"]["available"], hub["party_fund"]["reason"]) == (False, "not_open")
    assert hub["learning"]["available"] is True  # services without a switch are unchanged

    db_session.execute(
        # A switch can only be on once its phase gate is recorded (feature_flag_enabled_needs_gate).
        text("INSERT INTO ops.feature_flag (key, enabled, gate, gate_recorded_at) VALUES ('community_finance', true, 'G1', now()) "
             "ON CONFLICT (key) DO UPDATE SET enabled = true, gate = 'G1', gate_recorded_at = now()")
    )
    hub = {item["key"]: item for item in enforced.get("/v1/home", headers=auth(member)).json()["hub"]["services"]}
    assert hub["party_fund"]["available"] is True
