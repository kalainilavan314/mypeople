"""/v1/identity/register, consent, progress, passport sign-in and /v1/geography against a real
database. Skipped without DATABASE_URL. Everything is rolled back afterwards.
"""

import random

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Row, text

from app.core.security import SESSION_COOKIE
from app.modules.membership.rules import NOTICE_VERSIONS

JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + bytes(256)
PASSWORD = "a long tamil passphrase"


@pytest.fixture
def client(identity_client) -> TestClient:
    return identity_client


def new_nic() -> str:
    # 12 random digits: the new NIC format, unlike any real member's.
    return str(random.randrange(10**11, 10**12))


def form(**changes) -> dict:
    return {
        "fullName": "Kumar Selvaraj",
        "route": "nic",
        "idNumber": new_nic(),
        "password": PASSWORD,
        "acceptTerms": True,
        "language": "ta",
        **changes,
    }


def register(client: TestClient, **changes):
    return client.post("/v1/identity/register", json=form(**changes))


def bearer(response) -> dict[str, str]:
    return {"Authorization": f"Bearer {response.json()['token']}"}


# --- Registering (A03, FR-AUTH-010 to 013) -----------------------------------------------------------


def test_registering_with_a_nic_creates_a_draft_account(client, db_session, area):
    nic = new_nic()
    response = register(
        client, idNumber=nic, dob="1990-04-12", gender="prefer_not_to_say",
        districtCode=area.district, dsCode=area.ds, gsCode=area.gn,
    )

    assert response.status_code == 201
    member = response.json()["member"]
    assert (member["verificationStatus"], member["language"], member["gsCode"]) == ("nic_format", "ta", area.gn)
    assert response.cookies.get(SESSION_COOKIE)
    member_id = member["id"]
    assert client.get("/v1/membership/me", headers=bearer(response)).json()["state"] == "pending"
    route = db_session.execute(
        text("SELECT route, passport_country FROM identity.identity_record WHERE member_id = :id"), {"id": member_id}
    ).one()
    assert (route.route, route.passport_country) == ("nic", None)
    consent = db_session.scalar(
        text("SELECT notice_version FROM membership.consent_record WHERE member_id = :id AND consent_type = 'terms_and_privacy'"),
        {"id": member_id},
    )
    assert consent == NOTICE_VERSIONS["terms_and_privacy"]
    audit = db_session.execute(
        text("SELECT details FROM ops.audit_log WHERE action = 'identity.account.registered' ORDER BY id DESC LIMIT 1")
    ).one()
    assert audit.details == {"memberId": member_id, "route": "nic"}
    assert nic not in str(audit.details)

    signed_in = client.post("/v1/auth/sign-in", json={"nic": nic.lower(), "password": PASSWORD})
    assert (signed_in.status_code, signed_in.json()["member"]["id"]) == (200, member_id)


def test_registering_with_a_passport_and_signing_in_with_it(client, db_session):  # BR-003, BR-005, FR-AUTH-005
    response = register(client, route="passport", idNumber="n 1234567", passportCountry="lka")

    assert response.status_code == 201
    assert response.json()["member"]["verificationStatus"] == "unverified"
    progress = client.get("/v1/identity/me/progress", headers=bearer(response)).json()
    assert progress["route"] == "passport"
    assert [s["name"] for s in progress["steps"]] == ["identity_consent", "passport_page", "selfie", "submit"]

    with_passport = {"passportNumber": "N1234567", "passportCountry": "LKA", "password": PASSWORD}
    assert client.post("/v1/auth/sign-in", json=with_passport).status_code == 200
    other_country = {**with_passport, "passportCountry": "IND"}
    assert client.post("/v1/auth/sign-in", json=other_country).status_code == 401
    both = {**with_passport, "nic": "123456789V"}
    assert client.post("/v1/auth/sign-in", json=both).status_code == 422


def test_an_id_number_already_registered_is_refused(client, create_member):  # BR-007, FR-AUTH-012
    nic = new_nic()
    create_member(nic=nic)

    response = register(client, idNumber=nic)

    assert (response.status_code, response.json()) == (409, {"detail": "already_registered"})


@pytest.mark.parametrize(
    ("changes", "problems"),
    [
        ({"idNumber": "12345"}, ["invalid_id_number"]),
        ({"password": "short"}, ["password_too_short"]),
        ({"password": "Password123"}, ["password_too_common"]),
        ({"fullName": " K "}, ["invalid_name"]),
        ({"dob": "2015-01-01"}, ["under_minimum_age"]),
        ({"dsCode": "LK4103"}, ["area_incomplete"]),
        ({"districtCode": "LK99"}, ["unknown_area"]),
    ],
    ids=["nic-format", "short-password", "common-password", "name", "age", "area-incomplete", "unknown-area"],
)
def test_invalid_registrations_explain_each_problem(client, changes, problems):
    response = register(client, **changes)
    assert (response.status_code, response.json()["detail"]) == (
        422, {"code": "registration_refused", "problems": problems}
    )


def test_the_terms_must_be_accepted_and_passports_need_a_country(client):
    assert register(client, acceptTerms=False).status_code == 422
    assert register(client, route="passport", idNumber="N1234567").status_code == 422


def test_a_valid_referral_code_is_recorded_and_an_invalid_one_does_not_block(client, db_session, create_member):
    referrer = create_member()
    # Real codes are upper case (both sign-ups generate them so, and match the input upper-cased).
    code = f"KUMA-{random.randrange(1000, 10000)}{random.randrange(10, 100)}"
    db_session.execute(text("UPDATE npm.member SET referral_code = :code WHERE id = :id"), {"code": code, "id": referrer.id})

    accepted = register(client, referralCode=code.lower())
    unknown = register(client, referralCode="NOPE-0000")

    assert accepted.json()["referralAccepted"] is True
    assert unknown.status_code == 201 and unknown.json()["referralAccepted"] is False
    assert register(client).json()["referralAccepted"] is None
    referred = db_session.scalar(
        text("SELECT referrer_id FROM npm.referral_event WHERE referred_id = :id"), {"id": accepted.json()["member"]["id"]}
    )
    assert referred == referrer.id


def test_survey_answers_are_optional_and_stored(client, db_session):  # FR-REG-032
    response = register(client, surveyAnswers={"marital_status": "prefer_not_to_say"})

    answers = db_session.execute(
        text("SELECT question_id, answer FROM npm.onboarding_answer WHERE member_id = :id"),
        {"id": response.json()["member"]["id"]},
    ).all()
    assert [(a.question_id, a.answer) for a in answers] == [("marital_status", "prefer_not_to_say")]


# --- Consent before uploads (A04, BR-008, FR-REG-003) and progress (FR-AUTH-009) -----------------------


def test_identity_consent_comes_before_any_upload(client, db_session):
    account = register(client)
    headers = bearer(account)
    put = lambda: client.put(  # noqa: E731
        "/v1/identity/me/documents/nic_front", content=JPEG, headers={**headers, "Content-Type": "image/jpeg"}
    )
    notices = client.get("/v1/identity/notices").json()
    assert notices == {"termsAndPrivacy": NOTICE_VERSIONS["terms_and_privacy"], "identityReview": NOTICE_VERSIONS["identity_review"]}

    assert (put().status_code, put().json()) == (409, {"detail": "consent_required"})
    outdated = client.post("/v1/identity/me/consent", json={"noticeVersion": "draft-2020-01"}, headers=headers)
    assert (outdated.status_code, outdated.json()) == (409, {"detail": "notice_outdated"})

    for _ in range(2):  # consenting again changes nothing
        given = client.post("/v1/identity/me/consent", json={"noticeVersion": notices["identityReview"]}, headers=headers)
        assert given.status_code == 204
    assert put().status_code == 201

    progress = client.get("/v1/identity/me/progress", headers=headers).json()
    assert [(s["name"], s["done"]) for s in progress["steps"]] == [
        ("identity_consent", True), ("nic_front", True), ("nic_back", False), ("selfie", False), ("submit", False)
    ]
    assert (progress["nextStep"], progress["reviewState"]) == ("nic_back", None)
    count = db_session.scalar(
        text("SELECT count(*) FROM membership.consent_record WHERE member_id = :id AND consent_type = 'identity_review'"),
        {"id": account.json()["member"]["id"]},
    )
    assert count == 1


def test_an_already_verified_account_has_no_identity_onboarding_steps_left(client, create_member, auth):
    member = create_member(verified=True)

    progress = client.get("/v1/identity/me/progress", headers=auth(member)).json()

    assert progress["nextStep"] is None
    assert progress["reviewState"] == "verified"
    assert [(step["name"], step["done"]) for step in progress["steps"]] == [
        ("identity_consent", True),
        ("nic_front", True),
        ("nic_back", True),
        ("selfie", True),
        ("submit", True),
    ]


# --- Geography (FR-REG-029, BR-017) ----------------------------------------------------------------


def test_areas_are_listed_from_the_top_down(client, area):
    districts = client.get("/v1/geography/districts").json()
    ds_divisions = client.get(f"/v1/geography/districts/{area.district}/ds-divisions").json()
    gn_divisions = client.get(f"/v1/geography/ds-divisions/{area.ds}/gn-divisions").json()

    assert area.district in {d["code"] for d in districts}
    assert all(d["code"].startswith("LK") for d in districts)  # rows without DS divisions are left out
    assert area.ds in {d["code"] for d in ds_divisions}
    assert area.gn in {g["code"] for g in gn_divisions}
    assert client.get("/v1/geography/districts/LK99/ds-divisions").status_code == 404
