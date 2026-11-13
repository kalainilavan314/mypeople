"""Tests for Community Reports API and Work Queue Integration (D01 & Part A).

Verifies:
- Area-scoped aggregate counts for D01 operational work queues.
- Dedicated staff permission `reports.view` enforcement.
- Scope inheritance (District, DS, GN, Platform).
- Bounded list pagination and status filtering.
- Rejection of invalid status with stable error code ("invalid_state").
- Routine aggregate count queries are NOT audited (prevents noise).
- Identifiable list queries ARE audited.
- Failure resilience: if report counts fail, other work queues continue functioning and "reports" appears in `unavailable`.
"""

import uuid
from datetime import UTC, datetime
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.modules.access import service as access_service
from app.modules.community.reports import repository, service as reports_service


@pytest.fixture
def create_report(db_session: Session):
    """Insert a test community report with explicit geography and status."""

    def _insert(
        member_id: uuid.UUID,
        *,
        title: str = "Pothole on Main Road",
        category: str = "road",
        status: str = "submitted",
        priority: str = "medium",
        district_code: str | None = None,
        ds_code: str | None = None,
        gs_code: str | None = None,
        area_path: list[str] | None = None,
    ) -> uuid.UUID:
        report_id = uuid.uuid4()
        now = datetime.now(UTC)
        path = area_path or ["platform"]
        db_session.execute(
            text(
                """
                INSERT INTO npm.community_report
                    (id, member_id, category, title, description, district_code, ds_code, gs_code, area_path, priority, status, created_at, updated_at)
                VALUES
                    (:id, :member_id, :category, :title, 'Needs urgent repair', :district_code, :ds_code, :gs_code, :area_path, :priority, :status, :created_at, :updated_at)
                """
            ),
            {
                "id": report_id,
                "member_id": member_id,
                "category": category,
                "title": title,
                "district_code": district_code,
                "ds_code": ds_code,
                "gs_code": gs_code,
                "area_path": path,
                "priority": priority,
                "status": status,
                "created_at": now,
                "updated_at": now,
            },
        )
        return report_id

    return _insert


def test_work_queues_community_reports_count_scoped(
    db_client: TestClient,
    db_session: Session,
    create_member,
    assign,
    auth,
    area,
    super_admin,
    create_report,
):
    """D01: Staff with reports.view receives area-scoped actionable community report counts."""
    # Member who reports an issue in area.district
    reporter = create_member(verified=True)

    # District staff with reports.view
    staff_district = create_member(verified=True)
    assign(staff_district, "3A", "district", area.district, ["reports.view"], granted_by=super_admin)

    # Staff in a different district
    other_district_code = "LK-99" if area.district != "LK-99" else "LK-98"
    staff_other = create_member(verified=True)
    assign(staff_other, "3A", "district", other_district_code, ["reports.view"], granted_by=super_admin)

    # Staff without reports.view
    staff_unpermitted = create_member(verified=True)
    assign(staff_unpermitted, "3A", "district", area.district, ["events.manage"], granted_by=super_admin)

    # Insert reports in area.district:
    # 1 submitted, 1 under_review, 1 resolved (not actionable)
    district_path = ["platform", f"province:{area.province}", f"district:{area.district}"]
    create_report(reporter.id, title="Road broken", status="submitted", district_code=area.district, area_path=district_path)
    create_report(reporter.id, title="Water pipe leak", status="under_review", district_code=area.district, area_path=district_path)
    create_report(reporter.id, title="Old solved issue", status="resolved", district_code=area.district, area_path=district_path)

    # 1. Staff with permission in district receives the counts
    res = db_client.get("/v1/access/work-queues", headers=auth(staff_district))
    assert res.status_code == 200
    data = res.json()
    assert data["reports"] is not None
    assert data["reports"]["submitted"] >= 1
    assert data["reports"]["underReview"] >= 1
    assert data["reports"]["totalActionable"] >= 2

    # 2. Staff in another district receives 0 for this district
    res_other = db_client.get("/v1/access/work-queues", headers=auth(staff_other))
    assert res_other.status_code == 200
    data_other = res_other.json()
    assert data_other["reports"] is not None
    assert data_other["reports"]["submitted"] == 0
    assert data_other["reports"]["totalActionable"] == 0

    # 3. Staff without permission receives None
    res_unpermitted = db_client.get("/v1/access/work-queues", headers=auth(staff_unpermitted))
    assert res_unpermitted.status_code == 200
    data_unpermitted = res_unpermitted.json()
    assert data_unpermitted["reports"] is None


def test_community_reports_endpoints_and_auditing(
    db_client: TestClient,
    db_session: Session,
    create_member,
    assign,
    auth,
    area,
    super_admin,
    create_report,
):
    """Direct API endpoints for community reports counts and listing, including audit rules."""
    staff = create_member(verified=True)
    assign(staff, "3A", "district", area.district, ["reports.view"], granted_by=super_admin)

    reporter = create_member(verified=True)
    district_path = ["platform", f"province:{area.province}", f"district:{area.district}"]
    report_id = create_report(
        reporter.id,
        title="Waste accumulation",
        category="waste",
        status="submitted",
        priority="high",
        district_code=area.district,
        area_path=district_path,
    )

    # Count audit entries before calling counts endpoint
    audit_count_before = db_session.scalar(text("SELECT count(*) FROM ops.audit_log")) or 0

    # 1. GET /v1/community/reports/counts
    res_counts = db_client.get("/v1/community/reports/counts", headers=auth(staff))
    assert res_counts.status_code == 200
    counts = res_counts.json()
    assert counts["submitted"] >= 1
    assert counts["totalActionable"] >= 1

    # Routine aggregate count query MUST NOT write to audit log
    audit_count_after_counts = db_session.scalar(text("SELECT count(*) FROM ops.audit_log")) or 0
    assert audit_count_after_counts == audit_count_before

    # 2. GET /v1/community/reports (paginated list)
    res_list = db_client.get("/v1/community/reports?status=submitted&limit=10", headers=auth(staff))
    assert res_list.status_code == 200
    listing = res_list.json()
    assert listing["total"] >= 1
    assert len(listing["items"]) >= 1
    item = listing["items"][0]
    assert item["title"] == "Waste accumulation"
    assert item["category"] == "waste"
    assert item["status"] == "submitted"
    assert item["priority"] == "high"
    # Reporter contact data or member_id must NOT be exposed
    assert "memberId" not in item
    assert "phone" not in item

    # Identifiable list query MUST write to audit log
    audit_count_after_list = db_session.scalar(text("SELECT count(*) FROM ops.audit_log")) or 0
    assert audit_count_after_list > audit_count_after_counts

    last_audit = db_session.execute(
        text("SELECT action, target_type FROM ops.audit_log ORDER BY id DESC LIMIT 1")
    ).one()
    assert last_audit.action == "reports.viewed"
    assert last_audit.target_type == "community_reports"

    # 3. Detail is area-scoped, excludes reporter identity, and is audited.
    res_detail = db_client.get(f"/v1/community/reports/{report_id}", headers=auth(staff))
    assert res_detail.status_code == 200
    assert res_detail.json()["id"] == str(report_id)
    assert "memberId" not in res_detail.json()
    detail_audit = db_session.execute(
        text("SELECT action, target_id FROM ops.audit_log ORDER BY id DESC LIMIT 1")
    ).one()
    assert detail_audit.action == "reports.record.viewed"
    assert detail_audit.target_id == str(report_id)

    # 4. Invalid status has a stable service-level refusal, not a framework-dependent 422.
    res_bad = db_client.get("/v1/community/reports?status=bogus_status", headers=auth(staff))
    assert res_bad.status_code == 400
    assert res_bad.json()["detail"] == "invalid_state"

    # Pagination input is bounded before it can reach SQL.
    res_offset = db_client.get("/v1/community/reports?offset=100001", headers=auth(staff))
    assert res_offset.status_code == 422

    # 5. Caller without reports.view receives 403
    unpermitted = create_member(verified=True)
    res_forbidden = db_client.get("/v1/community/reports/counts", headers=auth(unpermitted))
    assert res_forbidden.status_code == 403


def test_report_snapshot_is_derived_scoped_and_immutable(
    db_client: TestClient,
    db_session: Session,
    create_member,
    member_in,
    assign,
    auth,
    area,
    super_admin,
):
    """Every future insert gets a submission-time hierarchy; later profile moves cannot rewrite it."""
    reporter = member_in(area, verified=True)
    report_id = uuid.uuid4()
    db_session.execute(
        text(
            """
            INSERT INTO npm.community_report (id, member_id, category, title, description, priority, status)
            VALUES (:id, :member_id, 'road', 'Snapshot test', 'Inserted through the legacy producer shape',
                    'medium', 'submitted')
            """
        ),
        {"id": report_id, "member_id": reporter.id},
    )
    expected = [
        "platform",
        f"province:{area.province}",
        f"district:{area.district}",
        f"ds:{area.ds}",
        f"gn:{area.gn}",
    ]
    stored = db_session.execute(
        text("SELECT district_code, ds_code, gs_code, area_path FROM npm.community_report WHERE id = :id"),
        {"id": report_id},
    ).one()
    assert list(stored.area_path) == expected
    assert (stored.district_code, stored.ds_code, stored.gs_code) == (area.district, area.ds, area.gn)

    gn_staff = create_member(verified=True)
    assign(gn_staff, "1", "gn", area.gn, ["reports.view"], granted_by=super_admin)
    assert db_client.get(f"/v1/community/reports/{report_id}", headers=auth(gn_staff)).status_code == 200

    outside_staff = create_member(verified=True)
    assign(outside_staff, "1", "gn", "OUTSIDE-GN", ["reports.view"], granted_by=super_admin)
    assert db_client.get(f"/v1/community/reports/{report_id}", headers=auth(outside_staff)).status_code == 404

    db_session.execute(
        text("UPDATE npm.member SET district_code = NULL, ds_code = NULL, gs_code = NULL WHERE id = :id"),
        {"id": reporter.id},
    )
    assert list(db_session.scalar(
        text("SELECT area_path FROM npm.community_report WHERE id = :id"), {"id": report_id}
    )) == expected

    with pytest.raises(DBAPIError, match="community_report_area_snapshot_is_immutable"):
        with db_session.begin_nested():
            db_session.execute(
                text("UPDATE npm.community_report SET area_path = ARRAY['platform'] WHERE id = :id"),
                {"id": report_id},
            )


def test_work_queues_resilience_on_community_reports_error(
    db_session: Session,
    create_member,
    assign,
    area,
    super_admin,
):
    """If community reports query fails, other queues still work and 'reports' is marked unavailable."""
    staff = create_member(verified=True)
    assign(staff, "3A", "district", area.district, ["reports.view", "events.manage"], granted_by=super_admin)

    staff_obj = access_service.load_staff(db_session, staff.id)
    assert staff_obj is not None

    with patch("app.modules.community.reports.service.queue_counts", side_effect=RuntimeError("DB timeout")):
        result = access_service.work_queues(db_session, staff_obj)
        assert result.reports is None
        assert "reports" in result.unavailable
        # Other permitted queues still populated
        assert result.events is not None
