"""Integration tests for Launch Priority Admin Panel modules:
D01 (Work Queues), D07 (Events Console), D08 (Gallery Console), D09 (Broadcast Messaging),
and D34 (Configuration & Feature Gates).
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.modules.access import service as access_service
from app.modules.messaging.broadcasts import service as broadcasts_service


# --- D01 Work Queues ----------------------------------------------------------------------------------


def test_work_queues_counts_scoped_by_area(db_client: TestClient, create_member, assign, auth, area, super_admin):
    """D01: Queues return true SQL counts scoped by staff jurisdiction."""
    # Staff A has events.manage in district
    staff_a = create_member(verified=True)
    assign(staff_a, "3A", "district", area.district, ["events.manage"], granted_by=super_admin)

    # Staff B has events.manage across the whole province
    staff_b = create_member(verified=True)
    assign(staff_b, "4", "province", area.province, ["events.manage"], granted_by=super_admin)

    # Create Event via API in Staff A's district
    starts = (datetime.now(UTC) + timedelta(days=2)).replace(microsecond=0)
    ends = starts + timedelta(hours=2)
    res_ev = db_client.post(
        "/v1/events",
        json={
            "titleEn": "District Meeting",
            "titleTa": "மாவட்டக் கூட்டம்",
            "eventType": "community_meeting",
            "area": {"level": "district", "code": area.district},
            "venue": "Town Hall",
            "startsAt": starts.isoformat(),
            "endsAt": ends.isoformat(),
        },
        headers=auth(staff_a),
    )
    assert res_ev.status_code == 201

    # Query queues for Staff A (district scope)
    res_a = db_client.get("/v1/access/work-queues", headers=auth(staff_a))
    assert res_a.status_code == 200
    queues_a = res_a.json()
    assert queues_a["events"] is not None
    assert queues_a["events"]["drafts"] >= 1

    # Query queues for Staff B (province scope covering Staff A's district)
    res_b = db_client.get("/v1/access/work-queues", headers=auth(staff_b))
    assert res_b.status_code == 200
    queues_b = res_b.json()
    assert queues_b["events"] is not None
    assert queues_b["events"]["drafts"] >= 1


def test_work_queues_gallery_takedown_and_albums(db_client: TestClient, create_member, assign, auth, area, super_admin):
    """D01: Staff with gallery permissions see both takedown requests and album review queues."""
    staff = create_member(verified=True)
    assign(staff, "4", "province", area.province, ["gallery.publish", "gallery.takedown"], granted_by=super_admin)

    # Create album via API
    res_alb = db_client.post(
        "/v1/content/albums",
        json={
            "titleEn": "Test Album",
            "titleTa": "ஆல்பம்",
            "category": "community",
            "place": "Jaffna",
            "area": {"level": "province", "code": area.province},
            "albumDate": datetime.now(UTC).strftime("%Y-%m-%d"),
            "publisher": "Cultural Committee",
            "summaryEn": "Annual cultural exhibition",
            "summaryTa": "வருடாந்த கலாச்சார கண்காட்சி",
        },
        headers=auth(staff),
    )
    assert res_alb.status_code == 201

    res = db_client.get("/v1/access/work-queues", headers=auth(staff))
    assert res.status_code == 200
    data = res.json()
    assert data["galleryAlbums"] is not None
    assert data["galleryAlbums"]["drafts"] >= 1
    assert data["galleryRemovals"] is not None
    assert isinstance(data["unavailable"], list)


def test_work_queues_error_handling_marks_unavailable(db_session: Session, create_member, assign, area, super_admin):
    """D01: If a queue query fails, it records the queue in `unavailable` rather than swallowing."""
    staff_member = create_member(verified=True)
    assign(staff_member, "4", "province", area.province, ["events.manage"], granted_by=super_admin)

    staff_obj = access_service.load_staff(db_session, staff_member.id)
    assert staff_obj is not None

    # Simulate an error during events query
    with patch("app.modules.access.service.visible_areas", side_effect=RuntimeError("Simulated DB error")):
        result = access_service.work_queues(db_session, staff_obj)
        assert result.events is None
        assert "events" in result.unavailable


# --- D07 Events Management ----------------------------------------------------------------------------


def test_event_create_update_and_clear_capacity(db_client: TestClient, db_session: Session, create_member, assign, auth, area, super_admin):
    """D07: Clearing capacity explicitly sets capacity to NULL (unlimited)."""
    staff = create_member(verified=True)
    assign(staff, "3A", "district", area.district, ["events.manage"], granted_by=super_admin)

    # 1. Create event with capacity 50
    starts = (datetime.now(UTC) + timedelta(days=5)).replace(microsecond=0)
    ends = starts + timedelta(hours=2)
    create_payload = {
        "titleEn": "Youth Leadership Forum",
        "titleTa": "இளைஞர் தலைமைத்துவ மன்றம்",
        "eventType": "training",
        "area": {"level": "district", "code": area.district},
        "venue": "Jaffna Central College",
        "startsAt": starts.isoformat(),
        "endsAt": ends.isoformat(),
        "capacity": 50,
    }

    res = db_client.post("/v1/events", json=create_payload, headers=auth(staff))
    assert res.status_code == 201
    event = res.json()
    event_id = event["id"]
    assert event["capacity"] == 50

    # 2. Update event: clear capacity (send capacity: null)
    update_payload = {
        "capacity": None,
    }
    res_update = db_client.patch(f"/v1/events/{event_id}", json=update_payload, headers=auth(staff))
    assert res_update.status_code == 200
    updated = res_update.json()
    assert updated["capacity"] is None

    # Verify directly in the database
    row = db_session.execute(text("SELECT capacity FROM events.event WHERE id = :id"), {"id": event_id}).one()
    assert row.capacity is None


def test_event_publish_and_cancel_lifecycle(db_client: TestClient, create_member, assign, auth, area, super_admin):
    """D07: Events move through draft -> published -> cancelled with audit trail."""
    staff = create_member(verified=True)
    assign(staff, "3A", "district", area.district, ["events.manage"], granted_by=super_admin)

    starts = (datetime.now(UTC) + timedelta(days=4)).replace(microsecond=0)
    ends = starts + timedelta(hours=2)
    res = db_client.post(
        "/v1/events",
        json={
            "titleEn": "Community Meeting",
            "titleTa": "சமூகக் கூட்டம்",
            "eventType": "community_meeting",
            "area": {"level": "district", "code": area.district},
            "venue": "Village Hall",
            "startsAt": starts.isoformat(),
            "endsAt": ends.isoformat(),
        },
        headers=auth(staff),
    )
    assert res.status_code == 201
    event_id = res.json()["id"]

    # Publish
    res_pub = db_client.post(f"/v1/events/{event_id}/publish", headers=auth(staff))
    assert res_pub.status_code == 200
    assert res_pub.json()["state"] == "published"

    # Cancel with reason
    res_cancel = db_client.post(
        f"/v1/events/{event_id}/cancel",
        json={"reason": "Venue maintenance required"},
        headers=auth(staff),
    )
    assert res_cancel.status_code == 200
    assert res_cancel.json()["state"] == "cancelled"


# --- D08 Gallery & Takedown Permissions ---------------------------------------------------------------


def test_gallery_takedown_only_permission_isolation(db_client: TestClient, create_member, assign, auth, area, super_admin):
    """D08: Staff with gallery.takedown only can access removals, but not manage albums."""
    takedown_staff = create_member(verified=True)
    assign(takedown_staff, "3A", "district", area.district, ["gallery.takedown"], granted_by=super_admin)

    # Removals queue succeeds
    res_removals = db_client.get("/v1/content/removal-requests", headers=auth(takedown_staff))
    assert res_removals.status_code == 200

    # Album management is refused (403)
    res_albums = db_client.get("/v1/content/albums/manage", headers=auth(takedown_staff))
    assert res_albums.status_code == 403


def test_gallery_album_submission_separation_of_duties(db_client: TestClient, db_session: Session, create_member, assign, auth, area, super_admin):
    """D08: Author who submitted an album cannot publish it (separation of duties)."""
    staff_a = create_member(verified=True)
    assign(staff_a, "4", "province", area.province, ["gallery.publish"], granted_by=super_admin)

    staff_b = create_member(verified=True)
    assign(staff_b, "4", "province", area.province, ["gallery.publish"], granted_by=super_admin)

    # Staff A creates album
    res = db_client.post(
        "/v1/content/albums",
        json={
            "titleEn": "Cultural Day 2026",
            "titleTa": "கலாச்சார நாள் 2026",
            "category": "community",
            "place": "Jaffna",
            "area": {"level": "province", "code": area.province},
            "albumDate": datetime.now(UTC).strftime("%Y-%m-%d"),
            "publisher": "Cultural Committee",
            "summaryEn": "Annual cultural exhibition",
            "summaryTa": "வருடாந்த கலாச்சார கண்காட்சி",
        },
        headers=auth(staff_a),
    )
    assert res.status_code == 201
    album_id = res.json()["id"]

    # Transition to submitted state by Staff A in DB to test publish separation of duties
    db_session.execute(
        text("UPDATE content.album SET state = 'submitted', submitted_by = :author WHERE id = :id"),
        {"author": staff_a.id, "id": album_id},
    )
    db_session.commit()

    # Staff A tries to self-publish -> 409 refused (own_submission)
    res_self_pub = db_client.post(f"/v1/content/albums/{album_id}/publish", headers=auth(staff_a))
    assert res_self_pub.status_code == 409
    assert "own_submission" in res_self_pub.text

    # Staff B publishes album -> succeeds
    res_pub = db_client.post(f"/v1/content/albums/{album_id}/publish", headers=auth(staff_b))
    assert res_pub.status_code == 200
    assert res_pub.json()["state"] == "published"


# --- D09 Broadcast Messaging --------------------------------------------------------------------------


def test_broadcast_wider_than_district_requires_approval(db_client: TestClient, create_member, assign, auth, area, super_admin):
    """D09: Broadcasts with provincial scope require second-person senior approval."""
    staff_author = create_member(verified=True)
    assign(staff_author, "4", "province", area.province, ["notifications.send"], granted_by=super_admin)

    staff_approver = create_member(verified=True)
    assign(staff_approver, "4", "province", area.province, ["notifications.send"], granted_by=super_admin)

    # 1. Author creates provincial broadcast
    res = db_client.post(
        "/v1/notifications/broadcasts",
        json={
            "topic": "announcements",
            "titleEn": "Important Civic Notice",
            "titleTa": "முக்கிய பொது அறிவித்தல்",
            "bodyEn": "Community services will be open this Saturday for all residents.",
            "bodyTa": "அனைத்து குடியிருப்பாளர்களுக்காகவும் இந்த சனிக்கிழமை சமூக சேவைகள் திறந்திருக்கும்.",
            "area": {"level": "province", "code": area.province},
        },
        headers=auth(staff_author),
    )
    assert res.status_code == 201
    broadcast_id = res.json()["id"]

    # 2. Check preview: wider than district requires approval
    preview_res = db_client.post(f"/v1/notifications/broadcasts/{broadcast_id}/preview", headers=auth(staff_author))
    assert preview_res.status_code == 200
    assert preview_res.json()["needsApproval"] is True

    # 3. Author submits -> moves to pending_approval
    sub_res = db_client.post(f"/v1/notifications/broadcasts/{broadcast_id}/submit", json={}, headers=auth(staff_author))
    assert sub_res.status_code == 200
    assert sub_res.json()["state"] == "pending_approval"

    # 4. Author cannot self-approve -> refused
    self_app = db_client.post(f"/v1/notifications/broadcasts/{broadcast_id}/approve", headers=auth(staff_author))
    assert self_app.status_code == 409
    assert "own_submission" in self_app.text

    # 5. Independent senior staff approves -> moves to scheduled
    app_res = db_client.post(f"/v1/notifications/broadcasts/{broadcast_id}/approve", headers=auth(staff_approver))
    assert app_res.status_code == 200
    assert app_res.json()["state"] == "scheduled"


def test_broadcast_dispatch_worker_send_due(db_client: TestClient, db_session: Session, create_member, assign, auth, area, super_admin):
    """D09: Background worker `send_due` picks up scheduled broadcasts and delivers them."""
    staff = create_member(verified=True)
    assign(staff, "3A", "district", area.district, ["notifications.send"], granted_by=super_admin)

    # Create district broadcast via API
    res = db_client.post(
        "/v1/notifications/broadcasts",
        json={
            "topic": "announcements",
            "titleEn": "Worker Dispatch Test",
            "titleTa": "பணியாளர் சோதனை",
            "bodyEn": "Testing worker dispatch delivery.",
            "bodyTa": "செய்தி விநியோக சோதனை.",
            "area": {"level": "district", "code": area.district},
        },
        headers=auth(staff),
    )
    assert res.status_code == 201
    broadcast_id = res.json()["id"]

    # Submit for immediate dispatch (moves to scheduled)
    sub_res = db_client.post(f"/v1/notifications/broadcasts/{broadcast_id}/submit", json={}, headers=auth(staff))
    assert sub_res.status_code == 200
    assert sub_res.json()["state"] == "scheduled"

    # Update send_at in DB to slightly in the past to simulate due moment
    db_session.execute(
        text("UPDATE notifications.broadcast SET send_at = now() - interval '1 minute' WHERE id = :id"),
        {"id": broadcast_id},
    )

    # Run dispatch worker
    sent_count = broadcasts_service.send_due(db_session, datetime.now(UTC))
    assert sent_count >= 1

    # Verify state in database
    row = db_session.execute(text("SELECT state, sent_at FROM notifications.broadcast WHERE id = :id"), {"id": broadcast_id}).one()
    assert row.state == "sent"
    assert row.sent_at is not None


# --- D34 Configuration & Feature Gates ----------------------------------------------------------------


def test_features_and_phase_gates(db_client: TestClient, create_member, assign, auth, super_admin):
    """D34: Feature flags and phase gates administration."""
    staff = create_member(verified=True)
    assign(staff, "5", "platform", None, ["system.configure", "config.view", "config.manage"], granted_by=super_admin)

    # List registry
    res = db_client.get("/v1/features/registry", headers=auth(staff))
    assert res.status_code == 200
    features = res.json()
    assert isinstance(features, list)
    assert len(features) > 0

    target_feature = next((f for f in features if f["key"] == "identity_appeals"), features[0])
    key = target_feature["key"]
    needed_gate = target_feature["requiredGate"]

    # Record phase gate for this feature
    gate_res = db_client.post(
        f"/v1/features/{key}/gate",
        json={"gate": needed_gate, "approvalRef": "APPROVAL-001", "reason": "Verified security architecture sign-off"},
        headers=auth(staff),
    )
    assert gate_res.status_code == 200
    assert gate_res.json()["gate"] == needed_gate

    # Enable feature
    enable_res = db_client.post(
        f"/v1/features/{key}/enable",
        json={"reason": "Phase gate approved and active"},
        headers=auth(staff),
    )
    assert enable_res.status_code == 200
    assert enable_res.json()["enabled"] is True

    # Disable feature
    disable_res = db_client.post(
        f"/v1/features/{key}/disable",
        json={"reason": "Temporary maintenance pause"},
        headers=auth(staff),
    )
    assert disable_res.status_code == 200
    assert disable_res.json()["enabled"] is False
