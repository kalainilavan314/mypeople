"""Official content through the API (BRD D30, M47, M48 check part; FR-AUT-001 to 005, 009; BR-148, BR-150;
INT-22, INT-24; NFR-ELC-03)."""

import base64
import hashlib
import io
import os

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import SecretStr
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.db.session import get_db
from app.main import create_app
from app.modules.content.official import signing
from app.modules.content.official.check_limiter import CheckLimiter

STATEMENT = {
    "titleEn": "Flood relief: how to ask for help",
    "titleTa": "வெள்ள நிவாரணம்: உதவி கேட்பது எப்படி",
    "bodyEn": "Contact your Grama Niladhari or call 117. The movement never asks for money for relief.",
    "bodyTa": "உங்கள் கிராம அலுவலரைத் தொடர்புகொள்ளுங்கள் அல்லது 117 ஐ அழையுங்கள். நிவாரணத்துக்காக இயக்கம் ஒருபோதும் பணம் கேட்பதில்லை.",
}
CORRECTION = {
    **STATEMENT,
    "bodyEn": "Contact your Grama Niladhari or call 117 (Disaster Management Centre). Relief is always free.",
    "bodyTa": "உங்கள் கிராம அலுவலரைத் தொடர்புகொள்ளுங்கள் அல்லது 117 (அனர்த்த முகாமைத்துவ நிலையம்) ஐ அழையுங்கள். நிவாரணம் எப்போதும் இலவசம்.",
    "reasonEn": "Added which centre answers 117.",
    "reasonTa": "117 இற்குப் பதிலளிக்கும் நிலையம் சேர்க்கப்பட்டது.",
}
WITHDRAWAL = {"reasonEn": "Replaced by the district's own notice.", "reasonTa": "மாவட்டத்தின் சொந்த அறிவித்தலால் மாற்றப்பட்டது."}


def build_client(database_settings, db_session, tmp_path, signing_key: str | None) -> TestClient:
    update = {"media_storage_dir": tmp_path / "media"}
    if signing_key is not None:
        update["content_signing_key"] = SecretStr(signing_key)
    app = create_app(database_settings.model_copy(update=update))
    app.dependency_overrides[get_db] = lambda: db_session
    return TestClient(app)


@pytest.fixture
def signing_key() -> str:
    return base64.b64encode(os.urandom(32)).decode()


@pytest.fixture
def client(database_settings, db_session, tmp_path, signing_key) -> TestClient:
    return build_client(database_settings, db_session, tmp_path, signing_key)


@pytest.fixture
def media_lead(create_member, assign, super_admin, area):
    """A district media lead (Tier 3B) with an explicit content.sign_publish grant (PRM-57, "3B (media)")."""
    person = create_member(verified=True)
    assign(person, "3B", "district", area.district, ["content.sign_publish"], granted_by=super_admin)
    return person


def member_code(db_session, person) -> str:
    return db_session.scalar(text("SELECT member_code FROM npm.member WHERE id = :id"), {"id": person.id})


@pytest.fixture
def registered(client, auth, super_admin, media_lead, db_session):
    response = client.post("/v1/content/official/publishers", json={
        "memberCode": member_code(db_session, media_lead), "nameEn": "TMK Media Office", "nameTa": "தமக ஊடகப் பணிமனை"},
        headers=auth(super_admin))
    assert response.status_code == 201, response.text
    return response.json()


def publish(client, auth, person, body=STATEMENT) -> dict:
    draft = client.post("/v1/content/official/manage", json=body, headers=auth(person))
    assert draft.status_code == 201, draft.text
    published = client.post(f"/v1/content/official/manage/{draft.json()['id']}/publish", headers=auth(person))
    assert published.status_code == 200, published.text
    return published.json()


def png() -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (640, 360), "teal").save(out, format="PNG")
    return out.getvalue()


# --- FR-AUT-001: registered publishers and a configured key -------------------------------------------------


def test_signing_needs_a_key_and_a_registered_publisher(
    database_settings, db_session, tmp_path, client, auth, super_admin, media_lead, member_in, area
):
    keyless = build_client(database_settings, db_session, tmp_path, None)
    draft = client.post("/v1/content/official/manage", json=STATEMENT, headers=auth(media_lead)).json()

    no_key = keyless.post(f"/v1/content/official/manage/{draft['id']}/publish", headers=auth(media_lead))
    status = client.get("/v1/content/official/manage/signing", headers=auth(media_lead)).json()
    unregistered = client.post(f"/v1/content/official/manage/{draft['id']}/publish", headers=auth(media_lead))
    self_registration = client.post("/v1/content/official/publishers", json={
        "memberCode": member_code(db_session, super_admin), "nameEn": "Leader", "nameTa": "தலைவர்"}, headers=auth(super_admin))
    plain_member = member_in(area, verified=True, active=True)
    no_permission = client.post("/v1/content/official/publishers", json={
        "memberCode": member_code(db_session, plain_member), "nameEn": "Someone", "nameTa": "ஒருவர்"}, headers=auth(super_admin))
    not_tier5 = client.post("/v1/content/official/publishers", json={
        "memberCode": member_code(db_session, media_lead), "nameEn": "Me", "nameTa": "நான்"}, headers=auth(media_lead))

    assert (no_key.status_code, no_key.json()["detail"]) == (503, "signing_unavailable")
    assert status["available"] is True and status["myPublisher"] is None and status["keyId"].startswith("ed25519:")
    assert (unregistered.status_code, unregistered.json()["detail"]) == (403, "not_a_registered_publisher")
    assert (self_registration.status_code, self_registration.json()["detail"]) == (403, "own_record")
    assert no_permission.json()["detail"]["problems"] == ["needs_sign_publish_permission"]
    assert (not_tier5.status_code, not_tier5.json()["detail"]) == (403, "forbidden")


def test_a_registered_publisher_signs_and_anyone_can_check_it(client, auth, media_lead, registered, member_in, area,
                                                               db_session):
    incomplete = client.post("/v1/content/official/manage", json={"titleEn": "Only a title"}, headers=auth(media_lead)).json()
    refused = client.post(f"/v1/content/official/manage/{incomplete['id']}/publish", headers=auth(media_lead))
    statement = publish(client, auth, media_lead)
    revision = statement["revisions"][0]
    keys = client.get("/v1/content/official/keys").json()
    by_code = client.get("/v1/content/official/check", params={"code": statement["checkCode"].lower().replace("-", " ")})
    by_link = client.get("/v1/content/official/check", params={"code": statement["checkLink"]}).json()
    forged = client.get("/v1/content/official/check", params={"code": "TMK-0000-0000"}).json()
    member = member_in(area, verified=True, active=True)
    listed = client.get("/v1/content/official", headers=auth(member)).json()
    detail = client.get(f"/v1/content/official/{statement['id']}", headers=auth(member)).json()
    draft_hidden = client.get(f"/v1/content/official/{incomplete['id']}", headers=auth(member))

    assert refused.json()["detail"]["problems"] == ["title_ta_required", "body_ta_required", "body_en_required"]
    assert statement["state"] == "published" and statement["signed"] is True
    assert statement["checkLink"].endswith(f"/check/{statement['checkCode']}")
    # FR-AUT-002: the signature verifies against the published key, with nothing but the public record.
    key = next(k for k in keys if k["keyId"] == revision["keyId"])
    assert key["current"] is True
    assert signing.verify(key["publicKey"], revision["signedPayload"].encode(), revision["signature"])
    assert by_code.status_code == 200 and by_code.json()["status"] == "verified"
    assert by_code.json()["statement"]["latest"]["titleTa"] == STATEMENT["titleTa"]
    assert by_link["status"] == "verified" and by_link["checkCode"] == statement["checkCode"]
    assert (forged["status"], forged["problem"], forged["statement"]) == ("not_verified", "no_matching_record", None)
    mine = next(item for item in listed if item["id"] == statement["id"])
    assert mine["signed"] is True and mine["latest"]["publisherNameEn"] == "TMK Media Office" and mine["revisionCount"] == 1
    assert incomplete["id"] not in [item["id"] for item in listed] and draft_hidden.status_code == 404
    assert [r["revision"] for r in detail["revisions"]] == [1]
    # FR-AUT-009: the decision is in the audit log, ids only.
    audited = db_session.execute(
        text("SELECT action, details FROM ops.audit_log WHERE target_id = :id ORDER BY id"), {"id": statement["id"]}
    ).all()
    assert [row.action for row in audited] == ["content.official.drafted", "content.official.published"]
    assert STATEMENT["titleEn"] not in str(audited[-1].details)


# --- BR-150: corrections append; FR-AUT-004 -----------------------------------------------------------------


def test_a_correction_is_a_new_signed_revision_and_the_original_stays(client, auth, media_lead, registered, member_in,
                                                                      area, db_session):
    statement = publish(client, auth, media_lead)
    unchanged = client.post(f"/v1/content/official/manage/{statement['id']}/corrections",
                            json={**STATEMENT, **{k: CORRECTION[k] for k in ("reasonEn", "reasonTa")}}, headers=auth(media_lead))
    corrected = client.post(f"/v1/content/official/manage/{statement['id']}/corrections", json=CORRECTION,
                            headers=auth(media_lead)).json()
    edit_after_signing = client.put(f"/v1/content/official/manage/{statement['id']}", json=STATEMENT, headers=auth(media_lead))
    member = member_in(area, verified=True, active=True)
    detail = client.get(f"/v1/content/official/{statement['id']}", headers=auth(member)).json()
    checked = client.get("/v1/content/official/check", params={"code": statement["checkCode"]}).json()

    assert unchanged.json()["detail"]["problems"] == ["nothing_changed"]
    assert edit_after_signing.json()["detail"]["problems"] == ["not_allowed_from:published"]
    assert corrected["checkCode"] == statement["checkCode"] and corrected["signed"] is True
    first, second = detail["revisions"]
    assert (first["revision"], first["bodyEn"], first["correctionReasonEn"]) == (1, STATEMENT["bodyEn"], None)
    assert (second["revision"], second["bodyEn"], second["correctionReasonTa"]) == (2, CORRECTION["bodyEn"], CORRECTION["reasonTa"])
    assert first["verified"] and second["verified"] and detail["revisionCount"] == 2
    assert detail["latest"]["revision"] == 2 and checked["statement"]["latest"]["revision"] == 2
    # The original record cannot be changed, even directly in the database.
    with pytest.raises(DBAPIError, match="cannot be changed or deleted"), db_session.begin_nested():
        db_session.execute(text("UPDATE content.official_revision SET body_en = 'edited' WHERE id = :id"), {"id": first["id"]})


def test_a_withdrawn_statement_says_so_to_everyone_who_checks(client, auth, media_lead, registered, super_admin):
    statement = publish(client, auth, media_lead)
    withdrawn = client.post(f"/v1/content/official/manage/{statement['id']}/withdraw", json=WITHDRAWAL,
                            headers=auth(super_admin)).json()
    checked = client.get("/v1/content/official/check", params={"code": statement["checkCode"]}).json()
    correction = client.post(f"/v1/content/official/manage/{statement['id']}/corrections", json=CORRECTION,
                             headers=auth(media_lead))

    assert withdrawn["state"] == "withdrawn"
    assert checked["status"] == "withdrawn" and checked["statement"]["withdrawalReasonTa"] == WITHDRAWAL["reasonTa"]
    assert correction.json()["detail"]["problems"] == ["not_allowed_from:withdrawn"]


# --- BR-148, FR-AUT-003: a changed record loses its label ---------------------------------------------------


def test_a_record_changed_behind_the_api_stops_verifying(client, auth, media_lead, registered, member_in, area, db_session):
    statement = publish(client, auth, media_lead)
    db_session.execute(text("UPDATE content.official_publisher SET name_en = 'Someone else' WHERE id = :id"),
                       {"id": registered["id"]})
    member = member_in(area, verified=True, active=True)
    listed = next(i for i in client.get("/v1/content/official", headers=auth(member)).json() if i["id"] == statement["id"])
    checked = client.get("/v1/content/official/check", params={"code": statement["checkCode"]}).json()

    assert listed["signed"] is False and listed["latest"]["verified"] is False
    assert (checked["status"], checked["problem"], checked["statement"]) == ("not_verified", "signature_invalid", None)


def test_a_revoked_publisher_cannot_sign_again_but_earlier_statements_still_verify(client, auth, media_lead, registered,
                                                                                  super_admin):
    statement = publish(client, auth, media_lead)
    revoked = client.post(f"/v1/content/official/publishers/{registered['id']}/revoke", json={"reason": "Left the media office"},
                          headers=auth(super_admin)).json()
    again = client.post("/v1/content/official/manage", json=STATEMENT, headers=auth(media_lead)).json()
    refused = client.post(f"/v1/content/official/manage/{again['id']}/publish", headers=auth(media_lead))
    checked = client.get("/v1/content/official/check", params={"code": statement["checkCode"]}).json()

    assert revoked["state"] == "revoked"
    assert (refused.status_code, refused.json()["detail"]) == (403, "not_a_registered_publisher")
    assert checked["status"] == "verified"


# --- NFR-ELC-03: no official publishing during a silence window -----------------------------------------------


def test_publishing_is_held_back_during_a_silence_window_anywhere(client, auth, media_lead, registered, silence, area,
                                                                   db_session):
    draft = client.post("/v1/content/official/manage", json=STATEMENT, headers=auth(media_lead)).json()
    silence(area, level="ds")

    refused = client.post(f"/v1/content/official/manage/{draft['id']}/publish", headers=auth(media_lead))

    assert refused.status_code == 409 and refused.json()["detail"]["code"] == "silence_period"
    blocked = db_session.scalar(text(
        "SELECT details->>'blockedAction' FROM ops.audit_log WHERE action = 'election.silence.blocked' AND target_id = :id"
    ), {"id": draft["id"]})
    assert blocked == "content.official.publish"


# --- FR-AUT-002: images are signed by their hash ------------------------------------------------------------


def test_an_image_is_signed_by_its_hash_and_public_only_once_published(client, auth, media_lead, registered):
    image = client.post("/v1/content/official/manage/images", content=png(),
                        headers={**auth(media_lead), "Content-Type": "image/png"}).json()
    draft = client.post("/v1/content/official/manage", json={**STATEMENT, "imageId": image["id"]}, headers=auth(media_lead)).json()
    before = client.get(f"/v1/content/official/images/{image['id']}")
    staff_preview = client.get(f"/v1/content/official/manage/images/{image['id']}", headers=auth(media_lead))
    published = client.post(f"/v1/content/official/manage/{draft['id']}/publish", headers=auth(media_lead)).json()
    after = client.get(f"/v1/content/official/images/{image['id']}")
    revision = published["revisions"][0]

    assert before.status_code == 404 and staff_preview.status_code == 200
    assert after.status_code == 200 and after.headers["content-type"] == "image/webp"
    assert hashlib.sha256(after.content).hexdigest() == image["sha256"] == revision["imageSha256"]
    assert f'"imageSha256":"{image["sha256"]}"' in revision["signedPayload"] and revision["verified"]


# --- INT-22: public checks are rate-limited; the switch -----------------------------------------------------


def test_public_checks_are_rate_limited(client):
    client.app.state.official_check_limiter = CheckLimiter(limit=2, window_seconds=600)

    answers = [client.get("/v1/content/official/check", params={"code": "TMK-0000-0000"}) for _ in range(3)]

    assert [a.status_code for a in answers] == [200, 200, 429]
    assert answers[-1].json()["detail"] == "too_many_requests" and int(answers[-1].headers["retry-after"]) > 0


def test_official_content_is_off_until_its_gate_is_recorded(database_settings, db_session, auth, member_in, area):
    app = create_app(database_settings.model_copy(update={"enforce_feature_flags": True}))
    app.dependency_overrides[get_db] = lambda: db_session
    enforced = TestClient(app)
    member = member_in(area)

    for response in (
        enforced.get("/v1/content/official/check", params={"code": "TMK-0000-0000"}),
        enforced.get("/v1/content/official/keys"),
        enforced.get("/v1/content/official", headers=auth(member)),
    ):
        assert (response.status_code, response.json()) == (404, {"detail": "feature_unavailable"})


# --- M29: the Election Commission's own links (FR-ELX-002, 003) ---------------------------------------------


def test_election_information_links_only_to_the_election_commission(db_client, auth, member_in, area, db_session):
    member = member_in(area)
    before = db_session.scalar(text("SELECT count(*) FROM ops.audit_log"))

    links = db_client.get("/v1/election/official-links", headers=auth(member)).json()

    assert links["labelEn"] == "Election Commission information" and links["pollingStationLocator"] is False
    assert {link["key"] for link in links["links"]} == {"election_commission", "voter_registration", "polling_station"}
    assert all(link["url"].startswith("https://") and "elections.gov.lk" in link["url"] for link in links["links"])
    assert db_session.scalar(text("SELECT count(*) FROM ops.audit_log")) == before  # nothing recorded about the member
