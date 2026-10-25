"""Recovery contact, account recovery and assisted recovery against a real database.
Skipped without DATABASE_URL. Everything is rolled back; SMS go to an in-memory outbox.
"""

import random

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Row, text

from app.core.security import nic_hash
from app.integrations.sms import DevelopmentSms, NoSms, SmsUnavailable
from app.modules.identity.recovery import service as recovery_service

NEW_PASSWORD = "another long passphrase"


@pytest.fixture
def client(identity_client) -> TestClient:
    identity_client.app.state.sms = DevelopmentSms()
    return identity_client


@pytest.fixture
def outbox(client) -> DevelopmentSms:
    return client.app.state.sms


def new_phone() -> str:
    return f"077{random.randrange(10**6, 10**7)}"


def e164(local: str) -> str:
    return "+94" + local[1:]


def confirm(client, auth, member: Row, phone: str) -> None:
    code = client.post("/v1/identity/me/phone", json={"phone": phone}, headers=auth(member)).json()["devCode"]
    response = client.post("/v1/identity/me/phone/confirm", json={"phone": phone, "code": code}, headers=auth(member))
    assert response.status_code == 200, response.text


def wrong(code: str) -> str:
    return "000000" if code != "000000" else "111111"


# --- Recovery contact (FR-REG-028) -------------------------------------------------------------------


def test_a_number_becomes_the_recovery_contact_only_after_its_code(client, db_session, auth, create_member, outbox):
    member = create_member()
    phone = new_phone()

    sent = client.post("/v1/identity/me/phone", json={"phone": phone}, headers=auth(member))
    assert sent.status_code == 202 and sent.json()["sent"] is True
    code = sent.json()["devCode"]
    assert outbox.sent[-1].phone == e164(phone) and code in outbox.sent[-1].text
    assert client.get("/v1/identity/me/phone", headers=auth(member)).json() is None  # not yet confirmed

    bad = client.post("/v1/identity/me/phone/confirm", json={"phone": phone, "code": wrong(code)}, headers=auth(member))
    good = client.post("/v1/identity/me/phone/confirm", json={"phone": phone, "code": code}, headers=auth(member))

    assert (bad.status_code, bad.json()) == (401, {"detail": "invalid_code"})
    assert good.json() == {"phone": e164(phone)}
    assert client.get("/v1/identity/me/phone", headers=auth(member)).json() == {"phone": e164(phone)}
    shown = db_session.scalar(text("SELECT phone FROM npm.member WHERE id = :id"), {"id": member.id})
    assert shown == e164(phone)  # the live app shows the confirmed number
    audit = db_session.execute(
        text("SELECT details FROM ops.audit_log WHERE action = 'identity.contact.confirmed' ORDER BY id DESC LIMIT 1")
    ).one()
    assert audit.details == {"memberId": str(member.id), "replaced": False}
    assert phone[1:] not in str(audit.details)


def test_changing_the_number_tells_the_old_one(client, auth, create_member, outbox):
    member = create_member()
    first, second = new_phone(), new_phone()
    confirm(client, auth, member, first)

    confirm(client, auth, member, second)

    assert outbox.sent[-1].phone == e164(first) and "recovery number was changed" in outbox.sent[-1].text


def test_a_number_on_another_account_is_refused_only_after_its_code(client, db_session, auth, create_member, outbox):
    """Asking for a code answers the same for any number, so it reveals nobody's (review finding);
    only the person holding the phone, with its code, learns that another account has it."""
    phone = new_phone()
    confirm(client, auth, create_member(), phone)
    member = create_member()
    db_session.execute(  # past the one-minute wait for another code to the same number
        text("UPDATE npm.otp SET created_at = created_at - interval '2 minutes' WHERE phone = :phone"),
        {"phone": e164(phone)},
    )

    asked = client.post("/v1/identity/me/phone", json={"phone": phone}, headers=auth(member))
    unused = client.post("/v1/identity/me/phone", json={"phone": new_phone()}, headers=auth(create_member()))
    confirmed = client.post(
        "/v1/identity/me/phone/confirm", json={"phone": phone, "code": asked.json()["devCode"]}, headers=auth(member)
    )

    assert (asked.status_code, unused.status_code) == (202, 202)
    assert asked.json().keys() == unused.json().keys()
    assert outbox.sent[-2].phone == e164(phone)  # the code went to the phone, not to the person asking
    assert (confirmed.status_code, confirmed.json()) == (409, {"detail": "phone_unavailable"})
    assert client.get("/v1/identity/me/phone", headers=auth(member)).json() is None


def test_asking_for_codes_is_limited_before_anything_is_looked_up(client, auth, create_member):
    phone = new_phone()
    confirm(client, auth, create_member(), phone)
    member = create_member()
    client.post("/v1/identity/me/phone", json={"phone": phone}, headers=auth(member))

    again = client.post("/v1/identity/me/phone", json={"phone": phone}, headers=auth(member))

    assert (again.status_code, again.json()) == (429, {"detail": "too_many_requests"})


def test_codes_for_other_purposes_do_not_use_up_this_ones_limit(client, db_session, auth, create_member):
    """The review finding: Express's public code endpoint shared the per-phone limits, so anyone
    could use up a member's daily allowance and block their recovery codes."""
    phone = new_phone()
    db_session.execute(  # a day's worth of sign-up codes asked for through Express, the last just now
        text(
            """
            INSERT INTO npm.otp (phone, code, purpose, ip, expires_at, created_at)
            SELECT :phone, 'not-a-code', 'signup', '198.51.100.20', now(), now() - make_interval(mins => n * 5)
            FROM generate_series(0, 9) AS n
            """
        ),
        {"phone": e164(phone)},
    )

    response = client.post("/v1/identity/me/phone", json={"phone": phone}, headers=auth(create_member()))

    assert response.status_code == 202


def test_codes_are_rate_limited_like_the_express_api(client, auth, create_member):
    member = create_member()
    phone = new_phone()
    client.post("/v1/identity/me/phone", json={"phone": phone}, headers=auth(member))

    again = client.post("/v1/identity/me/phone", json={"phone": phone}, headers=auth(member))

    assert (again.status_code, again.json(), again.headers["retry-after"]) == (429, {"detail": "too_many_requests"}, "60")


def test_without_an_sms_provider_codes_are_not_pretended(client, auth, create_member):
    client.app.state.sms = NoSms()
    member = create_member()

    phone = client.post("/v1/identity/me/phone", json={"phone": new_phone()}, headers=auth(member))
    recovery = client.post("/v1/auth/recovery/request", json={"nic": "123456789V"})

    assert (phone.status_code, phone.json()) == (503, {"detail": "sms_not_configured"})
    assert (recovery.status_code, recovery.json()) == (503, {"detail": "sms_not_configured"})


# --- Recovery (A16, FR-AUTH-014 to 016, BR-023) ------------------------------------------------------


@pytest.fixture
def account(client, db_session, auth, create_member) -> tuple[Row, str, str]:
    """A member with a known NIC and a recovery number confirmed a while ago."""
    nic = str(random.randrange(10**11, 10**12))
    member = create_member(nic=nic)
    phone = new_phone()
    confirm(client, auth, member, phone)
    # The confirmation code was sent "just now"; move it back past the one-minute cooldown.
    db_session.execute(
        text("UPDATE npm.otp SET created_at = created_at - interval '2 minutes' WHERE phone = :phone"),
        {"phone": e164(phone)},
    )
    return member, nic, phone


def test_the_recovery_code_is_stored_first_and_sent_after_the_answer(db_session, database_settings, account):
    """The review finding: sending inside the request made answers for registered numbers slower
    by the SMS provider's round trip. The request only stores the code; deliver() sends it later."""
    _, nic, phone = account
    outbox = DevelopmentSms()
    id_hash = nic_hash(nic, database_settings.nic_pepper.get_secret_value())

    pending = recovery_service.request_recovery(
        db_session, id_hash, "203.0.113.30", database_settings.jwt_secret.get_secret_value()
    )

    assert pending is not None and len(outbox.sent) == 0  # stored, nothing sent yet
    recovery_service.deliver(outbox, pending)
    assert [(m.phone, pending.code in m.text) for m in outbox.sent] == [(e164(phone), True)]


class FailingSms:
    """A provider that is configured but refuses to send."""

    def send(self, phone: str, text: str) -> None:
        raise SmsUnavailable()


def test_a_failing_sms_provider_gives_the_same_answer_for_every_number(client, account):
    _, nic, _ = account
    client.app.state.sms = FailingSms()

    registered = client.post("/v1/auth/recovery/request", json={"nic": nic})
    unknown = client.post("/v1/auth/recovery/request", json={"nic": "199912345670"})

    assert (registered.status_code, registered.json()) == (unknown.status_code, unknown.json()) == (
        202, {"sent": True, "devCode": None}
    )


def test_recovering_an_account_with_the_code(client, db_session, auth, account, outbox):
    member, nic, phone = account
    old_session = auth(member)

    code = client.post("/v1/auth/recovery/request", json={"nic": nic}).json()["devCode"]
    assert outbox.sent[-1].phone == e164(phone)
    verified = client.post("/v1/auth/recovery/verify", json={"nic": nic, "code": code})
    assert verified.status_code == 200 and verified.json()["expiresInSeconds"] == 600
    token = verified.json()["resetToken"]

    weak = client.post("/v1/auth/recovery/reset", json={"resetToken": token, "newPassword": "short"})
    assert weak.json()["detail"] == {"code": "password_refused", "problems": ["password_too_short"]}
    reset = client.post("/v1/auth/recovery/reset", json={"resetToken": token, "newPassword": NEW_PASSWORD})

    assert reset.status_code == 204
    assert client.get("/v1/members/me", headers=old_session).json() == {"detail": "session_expired"}  # FR-AUTH-016
    assert client.post("/v1/auth/sign-in", json={"nic": nic, "password": NEW_PASSWORD}).status_code == 200
    assert any("password was changed" in m.text and m.phone == e164(phone) for m in outbox.sent)
    again = client.post("/v1/auth/recovery/reset", json={"resetToken": token, "newPassword": NEW_PASSWORD + "!"})
    assert (again.status_code, again.json()) == (401, {"detail": "invalid_reset_token"})  # single use
    assert db_session.scalar(
        text("SELECT count(*) FROM ops.audit_log WHERE action = 'identity.password.reset' AND actor_id = :id"),
        {"id": member.id},
    ) == 1


def test_recovery_answers_the_same_for_unknown_numbers_and_missing_contacts(client, create_member, outbox):
    nic_without_contact = str(random.randrange(10**11, 10**12))
    create_member(nic=nic_without_contact)
    before = len(outbox.sent)

    unknown = client.post("/v1/auth/recovery/request", json={"nic": "199912345678"})
    no_contact = client.post("/v1/auth/recovery/request", json={"nic": nic_without_contact})

    assert unknown.status_code == no_contact.status_code == 202
    assert unknown.json() == no_contact.json() == {"sent": True, "devCode": None}
    assert len(outbox.sent) == before  # nothing was sent anywhere
    verify = client.post("/v1/auth/recovery/verify", json={"nic": "199912345678", "code": "123456"})
    assert (verify.status_code, verify.json()) == (401, {"detail": "invalid_code"})


def test_a_recovery_code_is_burnt_after_five_wrong_guesses(client, account):
    _, nic, _ = account
    code = client.post("/v1/auth/recovery/request", json={"nic": nic}).json()["devCode"]

    answers = [client.post("/v1/auth/recovery/verify", json={"nic": nic, "code": wrong(code)}).json() for _ in range(5)]
    after = client.post("/v1/auth/recovery/verify", json={"nic": nic, "code": code})

    assert answers == [{"detail": "invalid_code"}] * 5
    assert after.status_code == 401  # the right code no longer works


# --- Assisted recovery (FR-AUTH-017) -------------------------------------------------------------------


def test_assisted_recovery_gives_a_reference_and_reaches_the_area_reviewers(
    client, db_session, auth, member_in, make_reviewer, super_admin, area, outbox
):
    nic = str(random.randrange(10**11, 10**12))
    member = member_in(area, nic=nic)
    reviewer = make_reviewer(area.district)
    body = {"nic": nic, "contactMethod": "in_person", "message": "I lost my phone."}

    receipt = client.post("/v1/auth/recovery/assisted", json=body)
    unmatched = client.post("/v1/auth/recovery/assisted", json={**body, "nic": "199912345678"})

    assert receipt.status_code == unmatched.status_code == 202
    assert receipt.json()["reference"].startswith("AR-") and unmatched.json()["reference"].startswith("AR-")
    queue = client.get("/v1/identity/recovery-requests", headers=auth(reviewer)).json()
    mine = [r for r in queue if r["reference"] == receipt.json()["reference"]]
    assert [r["memberId"] for r in mine] == [str(member.id)]
    assert unmatched.json()["reference"] not in {r["reference"] for r in queue}  # platform scope only
    everything = client.get("/v1/identity/recovery-requests", headers=auth(super_admin)).json()
    assert unmatched.json()["reference"] in {r["reference"] for r in everything}

    new = new_phone()
    resolved = client.post(
        f"/v1/identity/recovery-requests/{mine[0]['id']}/resolve",
        json={"outcome": "contact_replaced", "newPhone": new, "note": "Identity checked at the district office."},
        headers=auth(reviewer),
    ).json()

    assert (resolved["state"], resolved["resolvedBy"]) == ("contact_replaced", str(reviewer.id))
    contact = db_session.execute(
        text("SELECT phone, confirmed_by FROM identity.recovery_contact WHERE member_id = :id"), {"id": member.id}
    ).one()
    assert (contact.phone, contact.confirmed_by) == (e164(new), reviewer.id)
    code = client.post("/v1/auth/recovery/request", json={"nic": nic}).json()["devCode"]
    assert outbox.sent[-1].phone == e164(new) and code  # the person now recovers normally


def test_a_staff_members_recovery_number_is_replaced_only_by_a_higher_tier(
    client, db_session, auth, member_in, make_reviewer, assign, super_admin, area
):
    """The review finding: a reviewer could give a peer's or a senior's account a number they hold,
    then reset its password."""
    nic = str(random.randrange(10**11, 10**12))
    colleague = member_in(area, nic=nic, verified=True)
    assign(colleague, "3A", "district", area.district, ["members.verify"], granted_by=super_admin)
    reviewer = make_reviewer(area.district)
    client.post("/v1/auth/recovery/assisted", json={"nic": nic, "contactMethod": "in_person"})
    [request] = [
        r for r in client.get("/v1/identity/recovery-requests", headers=auth(reviewer)).json()
        if r["memberId"] == str(colleague.id)
    ]
    resolve = f"/v1/identity/recovery-requests/{request['id']}/resolve"
    body = {"outcome": "contact_replaced", "newPhone": new_phone(), "note": "Identity checked at the office."}

    by_peer = client.post(resolve, json=body, headers=auth(reviewer))
    regional = make_reviewer(area.province, tier="4", level="province")
    by_senior = client.post(resolve, json=body, headers=auth(regional))

    assert (by_peer.status_code, by_peer.json()) == (403, {"detail": "target_outranks_you"})
    assert (by_senior.status_code, by_senior.json()["state"]) == (200, "contact_replaced")


def test_assisted_requests_are_limited_per_address(client):
    body = {"nic": "199912345678", "contactMethod": "email", "contactValue": "someone@example.org"}
    statuses = [client.post("/v1/auth/recovery/assisted", json=body).status_code for _ in range(4)]
    assert statuses == [202, 202, 202, 429]


def test_registrations_are_limited_per_address(client):
    def register():
        return client.post(
            "/v1/identity/register",
            json={
                "fullName": "Kumar Selvaraj",
                "route": "nic",
                "idNumber": str(random.randrange(10**11, 10**12)),
                "password": "a long tamil passphrase",
                "acceptTerms": True,
                "language": "ta",
            },
        )

    statuses = [register().status_code for _ in range(6)]
    assert statuses == [201] * 5 + [429]
