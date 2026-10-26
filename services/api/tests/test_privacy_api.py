"""/v1/privacy (data-subject requests) against a real database. Skipped without DATABASE_URL.
Everything is rolled back; SMS go to an in-memory outbox.
"""

import random
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Row, text
from sqlalchemy.exc import DBAPIError

from app.integrations.sms import DevelopmentSms

HANDLE = "privacy.requests.handle"
PASSWORD = "correct horse battery"  # the create_member default


@pytest.fixture
def client(db_client) -> TestClient:
    db_client.app.state.sms = DevelopmentSms()
    return db_client


@pytest.fixture
def dpo(create_member, assign) -> Row:
    person = create_member(verified=True)
    assign(person, "5", "platform", None, [HANDLE])
    return person


def confirm_phone(db_session, member: Row) -> str:
    phone = f"+9477{random.randrange(10**6, 10**7)}"
    db_session.execute(
        text("INSERT INTO identity.recovery_contact (member_id, phone) VALUES (:id, :phone)"), {"id": member.id, "phone": phone}
    )
    return phone


def test_a_copy_request_gets_a_receipt_with_its_due_date_and_reaches_the_dpo(client, auth, member_in, area, dpo):
    member = member_in(area)

    receipt = client.post("/v1/privacy/requests", json={"kind": "copy", "note": "Everything you hold"}, headers=auth(member))
    again = client.post("/v1/privacy/requests", json={"kind": "copy"}, headers=auth(member)).json()
    register = client.get("/v1/privacy/requests", headers=auth(dpo)).json()

    body = receipt.json()
    assert receipt.status_code == 201 and body["requestRef"].startswith("DSR-") and body["retention"] == []
    days = (datetime.fromisoformat(body["dueAt"]) - datetime.fromisoformat(body["createdAt"])).days
    assert 27 <= days <= 31  # 21 working days
    assert again["requestRef"] == body["requestRef"]
    mine = [entry for entry in register if entry["requestRef"] == body["requestRef"]]
    assert (mine[0]["note"], mine[0]["kind"]) == ("Everything you hold", "copy")
    assert client.get("/v1/privacy/requests", headers=auth(member)).json() == {"detail": "forbidden"}


def test_closing_needs_the_password_and_a_code_and_promises_no_instant_deletion(client, db_session, auth, member_in, area):
    member = member_in(area)
    without_number = client.post("/v1/privacy/closure-code", headers=auth(member))
    confirm_phone(db_session, member)
    code = client.post("/v1/privacy/closure-code", headers=auth(member)).json()["devCode"]

    unconfirmed = client.post("/v1/privacy/requests", json={"kind": "closure"}, headers=auth(member))
    wrong_password = client.post(
        "/v1/privacy/requests", json={"kind": "closure", "password": "not my password", "code": code}, headers=auth(member)
    )
    wrong_code = client.post(
        "/v1/privacy/requests",
        json={"kind": "closure", "password": PASSWORD, "code": "000000" if code != "000000" else "111111"},
        headers=auth(member),
    )
    receipt = client.post(
        "/v1/privacy/requests", json={"kind": "closure", "password": PASSWORD, "code": code}, headers=auth(member)
    )

    assert (without_number.status_code, without_number.json()) == (409, {"detail": "no_recovery_number"})
    assert unconfirmed.status_code == 422
    assert (wrong_password.status_code, wrong_password.json()) == (401, {"detail": "wrong_password"})
    assert (wrong_code.status_code, wrong_code.json()) == (401, {"detail": "invalid_code"})
    assert receipt.status_code == 201
    assert receipt.json()["state"] == "open" and len(receipt.json()["retention"]) >= 4  # what is kept, and for how long
    assert client.get("/v1/members/me", headers=auth(member)).status_code == 200  # nothing closed yet (BR-079)


def test_the_dpo_completing_a_closure_closes_the_account_and_the_member_is_told(client, db_session, auth, member_in, area, dpo):
    member = member_in(area)
    phone = confirm_phone(db_session, member)
    code = client.post("/v1/privacy/closure-code", headers=auth(member)).json()["devCode"]
    receipt = client.post(
        "/v1/privacy/requests", json={"kind": "closure", "password": PASSWORD, "code": code}, headers=auth(member)
    ).json()
    session = auth(member)

    closed = client.post(
        f"/v1/privacy/requests/{receipt['id']}/decision", json={"outcome": "completed", "note": "Closed as asked"},
        headers=auth(dpo),
    )
    again = client.post(
        f"/v1/privacy/requests/{receipt['id']}/decision", json={"outcome": "refused", "note": "Changed"}, headers=auth(dpo)
    )

    assert closed.json()["state"] == "completed"
    assert client.get("/v1/members/me", headers=session).status_code == 401
    assert db_session.scalar(text("SELECT deleted_at IS NOT NULL FROM npm.member WHERE id = :id"), {"id": member.id})
    outbox: DevelopmentSms = client.app.state.sms
    assert any(m.phone == phone and receipt["requestRef"] in m.text for m in outbox.sent)
    assert (again.status_code, again.json()) == (409, {"detail": "already_closed"})
    with pytest.raises(DBAPIError), db_session.begin_nested():
        db_session.execute(text("UPDATE privacy.request SET state = 'refused' WHERE id = :id"), {"id": receipt["id"]})


def test_the_dpo_never_decides_their_own_request(client, auth, dpo):
    receipt = client.post("/v1/privacy/requests", json={"kind": "copy"}, headers=auth(dpo)).json()

    response = client.post(
        f"/v1/privacy/requests/{receipt['id']}/decision", json={"outcome": "completed", "note": "Mine"}, headers=auth(dpo)
    )

    assert (response.status_code, response.json()) == (403, {"detail": "own_record"})
