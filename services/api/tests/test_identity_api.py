"""/v1/identity against a real database and a temporary evidence store. Skipped without DATABASE_URL.

Database changes are rolled back afterwards; the store lives in pytest's tmp_path.
"""

import os
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Row, text

from app.db.session import get_db
from app.main import create_app
from app.modules.audit.service import verify_chain
from app.modules.identity.documents import links

JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + os.urandom(2048)
PNG = b"\x89PNG\r\n\x1a\n" + os.urandom(1024)
VIEW = "members.view_identity_evidence"


def _client(settings, db_session) -> TestClient:
    app = create_app(settings)
    app.dependency_overrides[get_db] = lambda: db_session
    return TestClient(app)


@pytest.fixture
def client(identity_client) -> TestClient:
    return identity_client


@pytest.fixture
def member(member_in, area) -> Row:
    return member_in(area)


@pytest.fixture
def reviewer(create_member, assign, super_admin, area, member, open_review) -> Row:
    """A district coordinator allowed to see identity evidence in the member's district,
    holding the member's identity review (PRM-03)."""
    person = create_member(verified=True)
    assign(person, "3A", "district", area.district, [VIEW, "members.verify"], granted_by=super_admin)
    open_review(member, person)
    return person


def audit_entries(db_session, action: str) -> list[Row]:
    return db_session.execute(
        text(
            "SELECT actor_id, target_type, target_id, area_code, details FROM ops.audit_log "
            "WHERE action = :action ORDER BY id"
        ),
        {"action": action},
    ).all()


def last_audit(db_session) -> Row:
    return db_session.execute(
        text("SELECT action, actor_id, target_id, area_code, details FROM ops.audit_log ORDER BY id DESC LIMIT 1")
    ).one()


# --- Member uploads (FR-REG-004, 005, 010; BR-020) -------------------------------------------


def test_a_member_uploads_both_sides_and_replaces_one(client, db_session, auth, upload, member, area):
    front = upload(member, "nic_front", JPEG)
    back = upload(member, "nic_back", PNG, "image/png")
    assert (front["kind"], front["version"], front["contentType"], front["byteSize"]) == (
        "nic_front", 1, "image/jpeg", len(JPEG)
    )

    replaced = upload(member, "nic_front")

    mine = client.get("/v1/identity/me/documents", headers=auth(member)).json()
    assert [(d["kind"], d["version"]) for d in mine] == [("nic_back", 1), ("nic_front", 2)]
    assert {d["id"] for d in mine} == {back["id"], replaced["id"]}  # replacing the front kept the back
    old_state = db_session.scalar(
        text("SELECT state FROM identity.identity_document WHERE id = :id"), {"id": front["id"]}
    )
    assert old_state == "superseded"

    entry = last_audit(db_session)
    assert (entry.action, entry.actor_id, entry.target_id, entry.area_code) == (
        "identity.document.uploaded", member.id, replaced["id"], area.gn
    )
    assert entry.details == {"memberId": str(member.id), "kind": "nic_front", "version": 2}


def test_uploads_are_capped_per_day_before_any_file_is_written(
    client, db_session, auth, upload, member, evidence_dir
):
    """The review finding: every version is kept, so unlimited uploads could fill the private disk."""
    for number in range(12):
        upload(member, ("nic_front", "nic_back", "selfie")[number % 3])

    refused = client.put(
        "/v1/identity/me/documents/nic_front", content=JPEG, headers={**auth(member), "Content-Type": "image/jpeg"}
    )

    assert (refused.status_code, refused.json()) == (429, {"detail": "upload_limit"})
    assert 0 < int(refused.headers["Retry-After"]) <= 24 * 60 * 60
    assert len([path for path in evidence_dir.rglob("*") if path.is_file()]) == 12

    db_session.execute(
        text("UPDATE identity.identity_document SET server_ack_at = now() - interval '25 hours' WHERE member_id = :id"),
        {"id": member.id},
    )
    assert upload(member, "nic_front")["version"] > 1  # a day later, uploads are allowed again


def test_the_stored_file_is_encrypted(upload, member, evidence_dir):
    document = upload(member, data=JPEG)

    [stored] = [path for path in evidence_dir.rglob("*") if path.is_file()]
    assert stored.name == f"{document['id']}.bin"
    assert JPEG not in stored.read_bytes()


@pytest.mark.parametrize(
    ("data", "content_type", "status", "code"),
    [
        (b"%PDF-1.7\n" + bytes(64), "application/pdf", 415, "unsupported_type"),
        (b"%PDF-1.7\n" + bytes(64), "image/jpeg", 415, "unsupported_type"),  # PDF claiming to be a JPEG
        (PNG, "image/jpeg", 415, "unsupported_type"),
        (b"", "image/jpeg", 400, "empty_file"),
        (b"\xff\xd8\xff" + bytes(10 * 1024 * 1024), "image/jpeg", 413, "too_large"),
    ],
    ids=["pdf", "pdf-sent-as-jpeg", "png-sent-as-jpeg", "empty", "over-10-mb"],
)
def test_uploads_that_are_not_identity_images_are_refused(client, db_session, auth, member, data, content_type, status, code):
    response = client.put(
        "/v1/identity/me/documents/nic_front", content=data, headers={**auth(member), "Content-Type": content_type}
    )

    assert (response.status_code, response.json()) == (status, {"detail": code})
    assert client.get("/v1/identity/me/documents", headers=auth(member)).json() == []


def test_the_size_limit_holds_without_a_content_length(client, auth, member):
    chunks = (b"\xff\xd8\xff" + bytes(1024 * 1024 - 3) if i == 0 else bytes(1024 * 1024) for i in range(11))

    response = client.put(
        "/v1/identity/me/documents/nic_front", content=chunks, headers={**auth(member), "Content-Type": "image/jpeg"}
    )

    assert (response.status_code, response.json()) == (413, {"detail": "too_large"})


def test_uploading_needs_a_session(client):
    response = client.put("/v1/identity/me/documents/nic_front", content=JPEG, headers={"Content-Type": "image/jpeg"})
    assert response.status_code == 401


def test_without_storage_settings_uploads_answer_503(database_settings, db_session, auth, member):
    unconfigured = database_settings.model_copy(update={"evidence_storage_dir": None, "evidence_encryption_key": None})
    response = _client(unconfigured, db_session).put(
        "/v1/identity/me/documents/nic_front", content=JPEG, headers={**auth(member), "Content-Type": "image/jpeg"}
    )
    assert (response.status_code, response.json()) == (503, {"detail": "evidence_storage_not_configured"})


# --- Reviewer access (FR-ARCH-007, BR-086, PRM-03) -------------------------------------------


def test_a_reviewer_views_evidence_through_a_short_lived_link_and_each_view_is_logged(
    client, db_session, auth, upload, member, reviewer, area
):
    document = upload(member, data=JPEG)

    listed = client.get(f"/v1/identity/members/{member.id}/documents", headers=auth(reviewer)).json()
    assert [d["id"] for d in listed] == [document["id"]]

    link = client.post(f"/v1/identity/documents/{document['id']}/view-link", headers=auth(reviewer)).json()
    assert link["url"].startswith("/v1/identity/evidence/")
    expires = datetime.fromisoformat(link["expiresAt"])
    assert timedelta(minutes=4) < expires - datetime.now(UTC) <= timedelta(minutes=5)
    [issued] = audit_entries(db_session, "identity.evidence.link_issued")
    assert (issued.actor_id, issued.target_id, issued.area_code) == (reviewer.id, document["id"], area.gn)

    for _ in range(2):
        response = client.get(link["url"], headers=auth(reviewer))
        assert response.status_code == 200
        assert response.content == JPEG

    assert response.headers["content-type"] == "image/jpeg"
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["content-disposition"] == "inline"
    assert "sandbox" in response.headers["content-security-policy"]
    views = audit_entries(db_session, "identity.evidence.viewed")
    assert len(views) == 2
    assert {(v.actor_id, v.target_id, v.area_code) for v in views} == {(reviewer.id, document["id"], area.gn)}
    assert views[0].details == {**issued.details, "kind": "nic_front", "version": 1}
    assert verify_chain(db_session).ok


def test_the_member_sees_when_their_evidence_was_viewed_but_not_by_whom(client, auth, upload, member, reviewer):
    document = upload(member)
    for _ in range(2):
        url = client.post(f"/v1/identity/documents/{document['id']}/view-link", headers=auth(reviewer)).json()["url"]
        client.get(url, headers=auth(reviewer))
        client.get(url, headers=auth(reviewer))  # reloading the same link is one viewing

    response = client.get("/v1/identity/me/evidence-views", headers=auth(member))

    views = response.json()
    assert [(v["kind"], v["role"]) for v in views] == [("nic_front", "identity_reviewer")] * 2
    assert str(reviewer.id) not in response.text


def test_a_link_older_than_five_minutes_is_refused(client, database_settings, auth, upload, member, reviewer):
    document = upload(member)
    issued = datetime.now(UTC) - timedelta(minutes=6)
    token, _ = links.sign_view_link(
        document_id=uuid.UUID(document["id"]),
        viewer_id=reviewer.id,
        jwt_secret=database_settings.jwt_secret.get_secret_value(),
        issued_at=issued,
    )

    response = client.get(f"/v1/identity/evidence/{token}", headers=auth(reviewer))

    assert (response.status_code, response.json()) == (403, {"detail": "link_expired"})


def test_an_edited_link_is_refused(client, auth, upload, member, reviewer):
    document = upload(member)
    url = client.post(f"/v1/identity/documents/{document['id']}/view-link", headers=auth(reviewer)).json()["url"]

    response = client.get(url[:-2] + ("AA" if not url.endswith("AA") else "BB"), headers=auth(reviewer))

    assert (response.status_code, response.json()) == (403, {"detail": "link_invalid"})


def test_a_missing_or_damaged_file_is_reported_not_shown(client, db_session, auth, upload, member, reviewer, evidence_dir):
    document = upload(member)
    url = client.post(f"/v1/identity/documents/{document['id']}/view-link", headers=auth(reviewer)).json()["url"]
    [stored] = [path for path in evidence_dir.rglob("*") if path.is_file()]
    stored.write_bytes(stored.read_bytes()[:-1])

    response = client.get(url, headers=auth(reviewer))

    assert (response.status_code, response.json()) == (500, {"detail": "evidence_unreadable"})
    assert audit_entries(db_session, "identity.evidence.viewed") == []


def test_a_link_passed_to_another_reviewer_is_refused_and_logged(
    client, db_session, auth, assign, create_member, super_admin, upload, member, reviewer, area
):
    colleague = create_member(verified=True)
    assign(colleague, "3A", "district", area.district, [VIEW], granted_by=super_admin)
    document = upload(member)
    url = client.post(f"/v1/identity/documents/{document['id']}/view-link", headers=auth(reviewer)).json()["url"]

    response = client.get(url, headers=auth(colleague))

    assert (response.status_code, response.json()) == (403, {"detail": "link_not_yours"})
    entry = last_audit(db_session)
    assert (entry.action, entry.actor_id, entry.target_id) == ("access.denied", colleague.id, document["id"])
    assert entry.details == {"permission": VIEW, "reason": "link_not_yours"}
    assert audit_entries(db_session, "identity.evidence.viewed") == []


def test_revoking_the_permission_stops_a_link_already_issued(client, db_session, auth, upload, member, reviewer):
    document = upload(member)
    url = client.post(f"/v1/identity/documents/{document['id']}/view-link", headers=auth(reviewer)).json()["url"]
    db_session.execute(
        text("UPDATE access.staff_assignment SET state = 'revoked', ended_at = now() WHERE member_id = :id"),
        {"id": reviewer.id},
    )

    response = client.get(url, headers=auth(reviewer))

    assert (response.status_code, response.json()) == (403, {"detail": "forbidden"})
    assert audit_entries(db_session, "identity.evidence.viewed") == []


def test_a_reviewer_from_another_district_is_refused_and_logged(
    client, db_session, auth, assign, create_member, super_admin, upload, member, area
):
    other_district = db_session.scalar(
        text("SELECT district_code FROM geo.district WHERE district_code <> :code ORDER BY district_code LIMIT 1"),
        {"code": area.district},
    )
    outsider = create_member(verified=True)
    assign(outsider, "3A", "district", other_district, [VIEW], granted_by=super_admin)
    document = upload(member)

    listed = client.get(f"/v1/identity/members/{member.id}/documents", headers=auth(outsider))
    link = client.post(f"/v1/identity/documents/{document['id']}/view-link", headers=auth(outsider))

    assert (listed.status_code, listed.json()) == (403, {"detail": "outside_your_area"})
    assert (link.status_code, link.json()) == (403, {"detail": "outside_your_area"})
    entry = last_audit(db_session)
    assert (entry.action, entry.actor_id, entry.target_id, entry.area_code) == (
        "access.denied", outsider.id, str(member.id), area.gn
    )
    assert entry.details == {"permission": VIEW, "reason": "outside_your_area"}


def test_a_member_without_an_area_is_visible_only_to_platform_scope(
    client, auth, assign, create_member, super_admin, upload, reviewer, open_review
):
    unplaced = create_member()
    document = upload(unplaced)
    national = create_member(verified=True)
    assign(national, "5", "platform", None, [VIEW], granted_by=super_admin)
    open_review(unplaced, national)

    district = client.post(f"/v1/identity/documents/{document['id']}/view-link", headers=auth(reviewer))
    platform = client.post(f"/v1/identity/documents/{document['id']}/view-link", headers=auth(national))

    assert (district.status_code, district.json()) == (403, {"detail": "outside_your_area"})
    assert platform.status_code == 200


def test_evidence_opens_only_inside_the_viewers_open_review(
    client, db_session, auth, assign, create_member, super_admin, upload, member, area, open_review
):
    document = upload(member)
    reviewer = create_member(verified=True)
    colleague = create_member(verified=True)
    for person in (reviewer, colleague):
        assign(person, "3A", "district", area.district, [VIEW, "members.verify"], granted_by=super_admin)
    view_link = f"/v1/identity/documents/{document['id']}/view-link"

    without_review = client.post(view_link, headers=auth(reviewer))
    assert (without_review.status_code, without_review.json()) == (403, {"detail": "no_open_review"})
    entry = last_audit(db_session)
    assert (entry.action, entry.actor_id, entry.details["reason"]) == ("access.denied", reviewer.id, "no_open_review")

    review_id = open_review(member, colleague)
    assert client.post(view_link, headers=auth(reviewer)).json() == {"detail": "no_open_review"}  # held by someone else

    db_session.execute(
        text("UPDATE identity.identity_review SET claimed_by = :reviewer WHERE id = :id"),
        {"reviewer": reviewer.id, "id": review_id},
    )
    url = client.post(view_link, headers=auth(reviewer)).json()["url"]
    assert client.get(url, headers=auth(reviewer)).status_code == 200

    # The review leaves "in review" (a correction was asked for): the link already issued stops working.
    db_session.execute(text("UPDATE identity.identity_review SET state = 'needs_update' WHERE id = :id"), {"id": review_id})
    closed = client.get(url, headers=auth(reviewer))
    assert (closed.status_code, closed.json()) == (403, {"detail": "no_open_review"})


def test_nobody_opens_their_own_identity_evidence(client, auth, upload, member_in, assign, super_admin, area):
    reviewer = member_in(area, verified=True)
    assign(reviewer, "3A", "district", area.district, [VIEW], granted_by=super_admin)
    own = upload(reviewer)

    listed = client.get(f"/v1/identity/members/{reviewer.id}/documents", headers=auth(reviewer))
    link = client.post(f"/v1/identity/documents/{own['id']}/view-link", headers=auth(reviewer))

    assert (listed.status_code, listed.json()) == (403, {"detail": "own_record"})
    assert (link.status_code, link.json()) == (403, {"detail": "own_record"})


def test_members_and_staff_without_the_permission_are_refused_and_logged(
    client, db_session, auth, assign, create_member, super_admin, upload, member, area
):
    document = upload(member)
    verifier_only = create_member(verified=True)
    assign(verifier_only, "3A", "district", area.district, ["members.verify"], granted_by=super_admin)

    for person in (member, verifier_only):
        response = client.post(f"/v1/identity/documents/{document['id']}/view-link", headers=auth(person))
        assert (response.status_code, response.json()) == (403, {"detail": "forbidden"})
        entry = last_audit(db_session)
        assert (entry.action, entry.actor_id, entry.details["permission"]) == ("access.denied", person.id, VIEW)


def test_unknown_documents_and_members_are_not_found(client, auth, reviewer):
    unknown = "00000000-0000-4000-8000-000000000000"
    assert client.post(f"/v1/identity/documents/{unknown}/view-link", headers=auth(reviewer)).status_code == 404
    assert client.get(f"/v1/identity/members/{unknown}/documents", headers=auth(reviewer)).status_code == 404
