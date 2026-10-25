"""/v1/membership/me/card, its code and scanning against a real database. Skipped without
DATABASE_URL. Everything is rolled back afterwards.
"""

import time

import pytest
from sqlalchemy import Row, text

from app.modules.membership.card import tokens

SCAN = "events.checkin_scan"


@pytest.fixture
def member(member_in, area) -> Row:
    """Identity verified and membership Active: the card is available."""
    return member_in(area, verified=True, active=True)


@pytest.fixture
def scanner(make_reviewer, area) -> Row:
    return make_reviewer(area.district, permissions=(SCAN,))


def scan(db_client, auth, scanner: Row, code: str) -> dict:
    response = db_client.post("/v1/membership/card/scan", json={"code": code}, headers=auth(scanner))
    assert response.status_code == 200, response.text
    return response.json()


def test_an_active_verified_member_sees_the_card(db_client, auth, member):
    card = db_client.get("/v1/membership/me/card", headers=auth(member)).json()

    assert (card["available"], card["identityVerified"], card["membershipState"]) == (True, True, "active")
    assert card["displayName"] == "Test Member" and card["memberCode"].startswith("TEST-")
    assert card["memberSince"] and card["districtName"]
    assert card["publicCard"] == {
        "displayName": card["displayName"],
        "memberCode": card["memberCode"],
        "districtName": card["districtName"],
        "gnName": card["gnName"],
    }
    assert not {"nic", "nicHash", "dob", "phone", "passportNumber"} & set(card)  # FR-CARD-002


def test_without_verified_identity_or_active_membership_there_is_no_card(db_client, auth, member_in, area):
    pending = member_in(area, verified=True)

    card = db_client.get("/v1/membership/me/card", headers=auth(pending)).json()
    code = db_client.get("/v1/membership/me/card/code", headers=auth(pending))

    assert (card["available"], card["membershipState"], card["displayName"], card["publicCard"]) == (
        False, "pending", None, None
    )
    assert (code.status_code, code.json()) == (409, {"detail": "card_not_available"})


def test_a_valid_code_is_scanned_and_confirmed_on_the_card(db_client, db_session, auth, member, scanner):
    issued = db_client.get("/v1/membership/me/card/code", headers=auth(member)).json()
    assert issued["refreshAfterSeconds"] == 60
    assert str(member.id) not in issued["code"]  # an opaque reference only (FR-CARD-004)

    result = scan(db_client, auth, scanner, issued["code"])

    assert result == {"result": "valid", "displayName": "Test Member", "memberCode": result["memberCode"]}
    assert db_client.get("/v1/membership/me/card", headers=auth(member)).json()["lastScannedAt"]
    audit = db_session.execute(
        text("SELECT actor_id, target_id, details FROM ops.audit_log WHERE action = 'membership.card.scanned' ORDER BY id DESC LIMIT 1")
    ).one()
    assert (audit.actor_id, audit.target_id, audit.details["result"]) == (scanner.id, str(member.id), "valid")


def test_an_expired_or_altered_code_is_refused(db_client, db_session, auth, member, scanner, database_settings):
    db_client.get("/v1/membership/me/card/code", headers=auth(member))
    ref = db_session.scalar(text("SELECT card_ref FROM membership.card WHERE member_id = :id"), {"id": member.id})
    old = tokens.sign(ref, database_settings.jwt_secret.get_secret_value(), int(time.time()) - 100).code

    assert scan(db_client, auth, scanner, old) == {"result": "expired", "displayName": None, "memberCode": None}
    assert scan(db_client, auth, scanner, "C1.made.up.code.x.y")["result"] == "not_valid"


def test_suspension_stops_codes_already_shown(db_client, db_session, auth, member, scanner, make_reviewer, area):
    code = db_client.get("/v1/membership/me/card/code", headers=auth(member)).json()["code"]
    activator = make_reviewer(area.district, permissions=("members.activate",))

    suspended = db_client.post(
        f"/v1/membership/members/{member.id}/changes",
        json={"action": "suspend", "reasonCode": "conduct_investigation"},
        headers=auth(activator),
    )

    assert suspended.status_code == 200
    assert scan(db_client, auth, scanner, code)["result"] == "not_valid"  # FR-CARD-015
    reason = db_session.execute(
        text("SELECT details FROM ops.audit_log WHERE action = 'membership.card.scanned' ORDER BY id DESC LIMIT 1")
    ).one().details["reason"]
    assert reason == "unknown_card"  # the reference was replaced
    assert db_client.get("/v1/membership/me/card/code", headers=auth(member)).status_code == 409
    card = db_client.get("/v1/membership/me/card", headers=auth(member)).json()
    assert (card["available"], card["membershipState"], card["reasonCode"]) == (False, "suspended", "conduct_investigation")


def test_only_holders_of_events_checkin_scan_can_scan(db_client, auth, member, create_member):
    code = db_client.get("/v1/membership/me/card/code", headers=auth(member)).json()["code"]

    response = db_client.post("/v1/membership/card/scan", json={"code": code}, headers=auth(create_member()))

    assert (response.status_code, response.json()) == (403, {"detail": "forbidden"})
