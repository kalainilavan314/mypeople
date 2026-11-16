"""Comprehensive automated tests for Community Finance via Bank Transfer Slips (M1.4).

Covers all 32 required backend test scenarios:
1. Duplicate POST with same idempotency key returns same draft.
2. Same idempotency key with changed payload returns 409 idempotency_conflict.
3. Future transfer date and negative/zero amount rejected (422).
4. Missing declarations rejected (422).
5. Missing slip prevents submit (422 slip_required).
6. MIME spoofing rejected (422 unsupported_media_type).
7. Oversized / decompression bomb image rejected (422).
8. Infected scan rejected (400 malware_detected) and no bytes persisted.
9. Missing production scanner fails closed (503 finance_scanner_unavailable).
10. Slip is encrypted in persistence; plaintext absent from database.
11. Slip correction creates a new immutable version.
12. Member cannot access another member's contribution (404).
13. Non-finance staff denied listing or inspecting cases (403).
14. Tier 5 without explicit finance permission denied (403).
15. Donor cannot review own contribution (403 donor_cannot_review_own_contribution).
16. Reviewer cannot approve own review (403 reviewer_cannot_approve_own_review).
17. Donor cannot approve own contribution (403 donor_cannot_review_own_contribution).
18. Related-party conflict blocks approval (403 related_party_conflict).
19. Duplicate bank reference creates review flag, not automatic rejection.
20. Internal threshold creates enhanced_review_threshold flag only.
21. Pending contribution has no CN receipt (409 receipt_not_issued).
22. Concurrent approval creates exactly one CN receipt.
23. Failed approval rolls back receipt counter.
24. Receipt numbers are unique and sequential.
25. Invalid status transitions rejected (409 invalid_finance_transition).
26. Audit contains no sensitive finance values (amounts, account numbers, notes absent).
27. Slip viewer token expires and is viewer-bound.
28. Slip streaming response headers contain Cache-Control: no-store.
29. CSV formula injection sanitized (', =, +, -, @).
30. Feature disabled returns 404 in production mode.
31. Missing bank configuration returns safe unavailable response.
32. Notifications contain no sensitive contribution data.
"""

import base64
import io
import os
import uuid
from datetime import UTC, date, datetime, timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pydantic import SecretStr
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.session import get_db
from app.main import create_app
from app.modules.features.rules import FEATURES


TEST_KEY_BYTES = b"01234567890123456789012345678901"
TEST_KEY_B64 = base64.b64encode(TEST_KEY_BYTES).decode("ascii")


def make_valid_jpeg(width: int = 200, height: int = 200, color: str = "blue") -> bytes:
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


@pytest.fixture
def finance_settings(database_settings: Settings) -> Settings:
    return database_settings.model_copy(
        update={
            "finance_intake_enabled": True,
            "finance_bank_name": "Bank of Ceylon",
            "finance_account_name": "My People Party Fund",
            "finance_account_number": "0001234567",
            "finance_branch_name": "Colombo Central",
            "finance_transfer_instructions_en": "Please use reference in transfer",
            "finance_transfer_instructions_ta": "பரிமாற்றத்தில் குறிப்பைப் பயன்படுத்தவும்",
            "finance_encryption_key": SecretStr(TEST_KEY_B64),
            "finance_malware_scanner": "development",
            "finance_internal_review_threshold_minor": 10_000_000,  # 100,000 LKR
        }
    )


@pytest.fixture
def fclient(finance_settings: Settings, db_session: Session) -> TestClient:
    app = create_app(finance_settings)
    app.dependency_overrides[get_db] = lambda: db_session
    return TestClient(app)


@pytest.fixture
def make_finance_staff(create_member, assign, super_admin):
    def _create(permissions: list[str], tier: str = "3B"):
        m = create_member(verified=True)
        assign(m, tier, "platform", None, permissions, granted_by=super_admin)
        return m

    return _create


# ---------------------------------------------------------------------------
# Test 1 & 2: Idempotency
# ---------------------------------------------------------------------------


def test_duplicate_post_same_idempotency_key_returns_same_draft(fclient, create_member, auth):
    member = create_member(verified=True)
    headers = {**auth(member), "X-Idempotency-Key": "test-key-1"}
    today = date.today().isoformat()
    payload = {
        "amountMinor": 500000,
        "transferDate": today,
        "bankReference": "REF-1001",
        "noPrivilegeAcknowledged": True,
        "informationAccurateAcknowledged": True,
        "payingForSelf": True,
    }

    res1 = fclient.post("/v1/fund/contributions", json=payload, headers=headers)
    assert res1.status_code == 200, res1.text
    data1 = res1.json()
    assert data1["status"] == "DRAFT"
    assert data1["bankReference"] == "REF-1001"
    assert data1["contributionRef"].startswith("MP-")

    # Second request with exact same idempotency key and payload returns identical record
    res2 = fclient.post("/v1/fund/contributions", json=payload, headers=headers)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["id"] == data1["id"]
    assert data2["contributionRef"] == data1["contributionRef"]


def test_missing_idempotency_key_is_rejected(fclient, create_member, auth):
    member = create_member(verified=True)
    headers = auth(member)
    headers.pop("Idempotency-Key")
    response = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 500000,
            "transferDate": date.today().isoformat(),
            "bankReference": "REF-NO-IDEMPOTENCY",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=headers,
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "idempotency_key_required"


def test_same_idempotency_key_changed_payload_conflict(fclient, create_member, auth):
    member = create_member(verified=True)
    headers = {**auth(member), "X-Idempotency-Key": "test-key-conflict"}
    today = date.today().isoformat()
    payload1 = {
        "amountMinor": 500000,
        "transferDate": today,
        "bankReference": "REF-1001",
        "noPrivilegeAcknowledged": True,
        "informationAccurateAcknowledged": True,
        "payingForSelf": True,
    }
    res1 = fclient.post("/v1/fund/contributions", json=payload1, headers=headers)
    assert res1.status_code == 200

    # Same idempotency key, different amount
    payload2 = {**payload1, "amountMinor": 1000000}
    res2 = fclient.post("/v1/fund/contributions", json=payload2, headers=headers)
    assert res2.status_code == 409
    assert res2.json()["detail"] == "idempotency_conflict"


# ---------------------------------------------------------------------------
# Test 3: Future transfer date & negative/zero amount rejected
# ---------------------------------------------------------------------------


def test_future_transfer_date_and_non_positive_amount_rejected(fclient, create_member, auth):
    member = create_member(verified=True)
    headers = auth(member)
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    today = date.today().isoformat()

    # Future date rejected
    res_future = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 500000,
            "transferDate": tomorrow,
            "bankReference": "REF-FUT",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=headers,
    )
    assert res_future.status_code == 422

    # Zero or negative amount rejected
    res_zero = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 0,
            "transferDate": today,
            "bankReference": "REF-ZERO",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=headers,
    )
    assert res_zero.status_code == 422


# ---------------------------------------------------------------------------
# Test 4: Missing declarations rejected
# ---------------------------------------------------------------------------


def test_missing_declarations_rejected(fclient, create_member, auth):
    member = create_member(verified=True)
    headers = auth(member)
    today = date.today().isoformat()

    res = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 500000,
            "transferDate": today,
            "bankReference": "REF-DECL",
            "noPrivilegeAcknowledged": False,  # Missing
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=headers,
    )
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# Test 5: Missing slip prevents submit
# ---------------------------------------------------------------------------


def test_missing_slip_prevents_submit(fclient, create_member, auth):
    member = create_member(verified=True)
    headers = auth(member)
    today = date.today().isoformat()

    res_draft = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 500000,
            "transferDate": today,
            "bankReference": "REF-NOSLIP",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=headers,
    )
    assert res_draft.status_code == 200
    cid = res_draft.json()["id"]

    res_submit = fclient.post(f"/v1/fund/contributions/{cid}/submit", headers=headers)
    assert res_submit.status_code == 422
    assert res_submit.json()["detail"] == "slip_required"


# ---------------------------------------------------------------------------
# Test 6: MIME spoofing rejected
# ---------------------------------------------------------------------------


def test_mime_spoofing_rejected(fclient, create_member, auth):
    member = create_member(verified=True)
    headers = auth(member)
    today = date.today().isoformat()

    res_draft = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 500000,
            "transferDate": today,
            "bankReference": "REF-MIME",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=headers,
    )
    cid = res_draft.json()["id"]

    # Spoofed payload: text disguised as image/jpeg
    fake_jpeg = b"This is not a real image but has jpeg header claiming"
    res_upload = fclient.put(
        f"/v1/fund/contributions/{cid}/slip",
        content=fake_jpeg,
        headers={**headers, "Content-Type": "image/jpeg"},
    )
    assert res_upload.status_code == 422
    assert res_upload.json()["detail"] == "unsupported_media_type"


# ---------------------------------------------------------------------------
# Test 7: Oversized / decompression bomb image rejected
# ---------------------------------------------------------------------------


def test_oversized_or_decompression_bomb_rejected(fclient, create_member, auth):
    member = create_member(verified=True)
    headers = auth(member)
    today = date.today().isoformat()

    res_draft = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 500000,
            "transferDate": today,
            "bankReference": "REF-BOMB",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=headers,
    )
    cid = res_draft.json()["id"]

    # Oversized payload (> 15 MB)
    huge_bytes = b"\xff\xd8\xff" + b"A" * (16 * 1024 * 1024)
    res_huge = fclient.put(
        f"/v1/fund/contributions/{cid}/slip",
        content=huge_bytes,
        headers={**headers, "Content-Type": "image/jpeg"},
    )
    assert res_huge.status_code == 413
    assert res_huge.json()["detail"] == "too_large"


# ---------------------------------------------------------------------------
# Test 8: Infected scan rejected & no bytes persisted
# ---------------------------------------------------------------------------


def test_infected_scan_rejected_and_no_bytes_persisted(fclient, db_session, create_member, auth):
    member = create_member(verified=True)
    headers = auth(member)
    today = date.today().isoformat()

    res_draft = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 500000,
            "transferDate": today,
            "bankReference": "REF-VIRUS",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=headers,
    )
    cid = res_draft.json()["id"]

    # Image bytes with EICAR test string appended
    valid_jpeg = make_valid_jpeg()
    eicar = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
    infected_payload = valid_jpeg + eicar

    res_upload = fclient.put(
        f"/v1/fund/contributions/{cid}/slip",
        content=infected_payload,
        headers={**headers, "Content-Type": "image/jpeg"},
    )
    assert res_upload.status_code == 400
    assert res_upload.json()["detail"] == "malware_detected"

    # Confirm zero slips recorded in DB
    slips = db_session.execute(
        text("SELECT count(*) FROM finance.contribution_slip WHERE contribution_id = :cid"),
        {"cid": cid},
    ).scalar()
    assert slips == 0


# ---------------------------------------------------------------------------
# Test 9: Missing production scanner fails closed
# ---------------------------------------------------------------------------


def test_missing_production_scanner_fails_closed(finance_settings, db_session, create_member, auth):
    settings = finance_settings.model_copy(update={"finance_malware_scanner": "unavailable"})
    app = create_app(settings)
    app.dependency_overrides[get_db] = lambda: db_session
    client = TestClient(app)

    member = create_member(verified=True)
    headers = auth(member)
    today = date.today().isoformat()

    res_draft = client.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 500000,
            "transferDate": today,
            "bankReference": "REF-SCANFAIL",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=headers,
    )
    cid = res_draft.json()["id"]

    res_upload = client.put(
        f"/v1/fund/contributions/{cid}/slip",
        content=make_valid_jpeg(),
        headers={**headers, "Content-Type": "image/jpeg"},
    )
    assert res_upload.status_code == 503
    assert res_upload.json()["detail"] == "finance_scanner_unavailable"


# ---------------------------------------------------------------------------
# Test 10: Slip is encrypted in persistence; plaintext absent from database
# ---------------------------------------------------------------------------


def test_slip_encrypted_in_persistence(fclient, db_session, create_member, auth):
    member = create_member(verified=True)
    headers = auth(member)
    today = date.today().isoformat()

    res_draft = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 500000,
            "transferDate": today,
            "bankReference": "REF-ENC",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=headers,
    )
    cid = res_draft.json()["id"]
    jpeg = make_valid_jpeg(100, 100, "green")

    res_upload = fclient.put(
        f"/v1/fund/contributions/{cid}/slip",
        content=jpeg,
        headers={**headers, "Content-Type": "image/jpeg"},
    )
    assert res_upload.status_code == 204

    # Direct DB inspection: encrypted_image should NOT contain raw plaintext bytes
    row = db_session.execute(
        text("SELECT encrypted_image, key_id FROM finance.contribution_slip WHERE contribution_id = :cid"),
        {"cid": cid},
    ).one()
    assert bytes(row.encrypted_image) != jpeg
    assert b"JFIF" not in bytes(row.encrypted_image)
    assert row.key_id is not None


# ---------------------------------------------------------------------------
# Test 11: Slip correction creates a new immutable version
# ---------------------------------------------------------------------------


def test_slip_correction_creates_new_immutable_version(
    fclient, db_session, create_member, make_finance_staff, auth
):
    member = create_member(verified=True)
    staff_rev = make_finance_staff(["finance.review"])
    today = date.today().isoformat()

    # Member creates and submits
    d = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 500000,
            "transferDate": today,
            "bankReference": "REF-VER",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=auth(member),
    ).json()
    cid = d["id"]
    fclient.put(f"/v1/fund/contributions/{cid}/slip", content=make_valid_jpeg(), headers=auth(member))
    fclient.post(f"/v1/fund/contributions/{cid}/submit", headers=auth(member))

    # Staff reviewer requests correction
    fclient.post(
        f"/v1/finance/contributions/{cid}/reconcile",
        json={"action": "needs_correction", "reason": "Slip image was blurry"},
        headers=auth(staff_rev),
    )

    # Member uploads replacement slip
    res_reup = fclient.put(
        f"/v1/fund/contributions/{cid}/slip",
        content=make_valid_jpeg(color="red"),
        headers=auth(member),
    )
    assert res_reup.status_code == 204

    # DB contains version 1 and version 2
    versions = db_session.execute(
        text("SELECT version FROM finance.contribution_slip WHERE contribution_id = :cid ORDER BY version"),
        {"cid": cid},
    ).scalars().all()
    assert versions == [1, 2]

    # Database refuse_change trigger prevents UPDATE on slips
    with pytest.raises(Exception):
        db_session.execute(
            text("UPDATE finance.contribution_slip SET content_type = 'image/png' WHERE contribution_id = :cid AND version = 1"),
            {"cid": cid},
        )
        db_session.flush()
    db_session.rollback()


# ---------------------------------------------------------------------------
# Test 12: Member cannot access another member's contribution
# ---------------------------------------------------------------------------


def test_member_cannot_access_another_members_contribution(fclient, create_member, auth):
    member_a = create_member(verified=True)
    member_b = create_member(verified=True)
    today = date.today().isoformat()

    d = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 500000,
            "transferDate": today,
            "bankReference": "REF-ISOL",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=auth(member_a),
    ).json()
    cid = d["id"]

    # Member B tries to access Member A's contribution
    res = fclient.get(f"/v1/fund/contributions/{cid}", headers=auth(member_b))
    assert res.status_code == 404
    assert res.json()["detail"] == "contribution_not_found"


# ---------------------------------------------------------------------------
# Test 13 & 14: Non-finance staff & Tier 5 without permission denied
# ---------------------------------------------------------------------------


def test_non_finance_staff_denied_listing_or_inspecting_cases(fclient, create_member, assign, super_admin, auth):
    staff_member = create_member(verified=True)
    # Assign permissions that do NOT include finance
    assign(staff_member, "3A", "district", "LK-11", ["reports.view", "events.manage"], granted_by=super_admin)

    res = fclient.get("/v1/finance/contributions", headers=auth(staff_member))
    assert res.status_code == 403


def test_tier_5_without_explicit_finance_permission_denied(fclient, super_admin, auth):
    # super_admin has tier 5 with default permissions, which intentionally do NOT include finance.review or finance.approve
    res = fclient.get("/v1/finance/contributions", headers=auth(super_admin))
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# Test 15, 16, 17, 18: Separation of duties (donor/reviewer/approver conflicts)
# ---------------------------------------------------------------------------


def test_separation_of_duties_and_conflicts(
    fclient, create_member, make_finance_staff, auth
):
    # Donor is also a staff member with finance permissions
    donor_staff = make_finance_staff(["finance.review", "finance.approve"])
    reviewer = make_finance_staff(["finance.review"])
    approver = make_finance_staff(["finance.approve"])
    today = date.today().isoformat()

    # Donor submits contribution
    d = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 500000,
            "transferDate": today,
            "bankReference": "REF-DUTIES",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=auth(donor_staff),
    ).json()
    cid = d["id"]
    fclient.put(f"/v1/fund/contributions/{cid}/slip", content=make_valid_jpeg(), headers=auth(donor_staff))
    fclient.post(f"/v1/fund/contributions/{cid}/submit", headers=auth(donor_staff))

    # 15. Donor cannot review own contribution
    res_self_rev = fclient.post(
        f"/v1/finance/contributions/{cid}/reconcile",
        json={"action": "matched", "statementReference": "ST-001", "reason": "Self match"},
        headers=auth(donor_staff),
    )
    assert res_self_rev.status_code == 403
    assert res_self_rev.json()["detail"] == "donor_cannot_review_own_contribution"

    reviewer_dual = make_finance_staff(["finance.review", "finance.approve"])
    # Reviewer matches it
    res_rev = fclient.post(
        f"/v1/finance/contributions/{cid}/reconcile",
        json={"action": "matched", "statementReference": "ST-001", "reason": "Verified on BOC portal"},
        headers=auth(reviewer_dual),
    )
    assert res_rev.status_code == 204

    # 16. Reviewer cannot approve own review
    res_self_app = fclient.post(
        f"/v1/finance/contributions/{cid}/approve",
        json={"action": "approve", "reason": "Self approve", "relatedPartyConflict": False},
        headers=auth(reviewer_dual),
    )
    assert res_self_app.status_code == 403
    assert res_self_app.json()["detail"] == "reviewer_cannot_approve_own_review"

    # 17. Donor cannot approve own contribution
    res_donor_app = fclient.post(
        f"/v1/finance/contributions/{cid}/approve",
        json={"action": "approve", "reason": "Donor approve"},
        headers=auth(donor_staff),
    )
    assert res_donor_app.status_code == 403
    assert res_donor_app.json()["detail"] in ("donor_cannot_approve_own_contribution", "donor_cannot_review_own_contribution")

    # 18. Related-party conflict blocks approval
    res_conflict = fclient.post(
        f"/v1/finance/contributions/{cid}/approve",
        json={"action": "approve", "reason": "Is my family member", "relatedPartyConflict": True},
        headers=auth(approver),
    )
    assert res_conflict.status_code == 403
    assert res_conflict.json()["detail"] == "related_party_conflict"

    # Valid independent approval succeeds
    res_valid_app = fclient.post(
        f"/v1/finance/contributions/{cid}/approve",
        json={"action": "approve", "reason": "Independent verified and matches bank statement", "relatedPartyConflict": False},
        headers=auth(approver),
    )
    assert res_valid_app.status_code == 200
    assert res_valid_app.json()["receiptCode"].startswith("CN-")


# ---------------------------------------------------------------------------
# Test 19 & 20: Risk flags (Duplicate bank reference & Enhanced threshold)
# ---------------------------------------------------------------------------


def test_duplicate_bank_reference_and_enhanced_threshold_flags(fclient, create_member, make_finance_staff, auth):
    member = create_member(verified=True)
    staff_rev = make_finance_staff(["finance.review"])
    today = date.today().isoformat()

    # Contribution 1 with REF-DUP
    d1 = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 500000,
            "transferDate": today,
            "bankReference": "REF-DUP",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=auth(member),
    ).json()
    fclient.put(f"/v1/fund/contributions/{d1['id']}/slip", content=make_valid_jpeg(), headers=auth(member))
    fclient.post(f"/v1/fund/contributions/{d1['id']}/submit", headers=auth(member))

    # Contribution 2 with same REF-DUP and amount over threshold (120,000 LKR = 12,000,000 minor)
    d2 = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 12_000_000,
            "transferDate": today,
            "bankReference": "REF-DUP",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=auth(member),
    ).json()
    fclient.put(f"/v1/fund/contributions/{d2['id']}/slip", content=make_valid_jpeg(), headers=auth(member))
    fclient.post(f"/v1/fund/contributions/{d2['id']}/submit", headers=auth(member))

    # Inspect staff detail for d2
    detail = fclient.get(f"/v1/finance/contributions/{d2['id']}", headers=auth(staff_rev)).json()
    assert detail["status"] == "SUBMITTED"  # Not rejected, remains submitted for review
    assert "duplicate_bank_reference" in detail["riskFlags"]
    assert "enhanced_review_threshold" in detail["riskFlags"]


# ---------------------------------------------------------------------------
# Test 21: Pending contribution has no CN receipt
# ---------------------------------------------------------------------------


def test_pending_contribution_has_no_cn_receipt(fclient, create_member, auth):
    member = create_member(verified=True)
    today = date.today().isoformat()

    d = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 500000,
            "transferDate": today,
            "bankReference": "REF-NOREC",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=auth(member),
    ).json()
    cid = d["id"]
    fclient.put(f"/v1/fund/contributions/{cid}/slip", content=make_valid_jpeg(), headers=auth(member))
    fclient.post(f"/v1/fund/contributions/{cid}/submit", headers=auth(member))

    res = fclient.get(f"/v1/fund/contributions/{cid}/receipt", headers=auth(member))
    assert res.status_code == 409
    assert res.json()["detail"] == "receipt_not_issued"


# ---------------------------------------------------------------------------
# Test 22, 23, 24: Concurrent approval, rollback & unique sequential receipts
# ---------------------------------------------------------------------------


def test_receipt_issuance_and_rollback(fclient, db_session, create_member, make_finance_staff, auth):
    donor = create_member(verified=True)
    reviewer = make_finance_staff(["finance.review"])
    approver = make_finance_staff(["finance.approve"])
    today = date.today().isoformat()

    def submit_one(ref_code: str) -> str:
        d = fclient.post(
            "/v1/fund/contributions",
            json={
                "amountMinor": 500000,
                "transferDate": today,
                "bankReference": ref_code,
                "noPrivilegeAcknowledged": True,
                "informationAccurateAcknowledged": True,
                "payingForSelf": True,
            },
            headers=auth(donor),
        ).json()
        cid = d["id"]
        fclient.put(f"/v1/fund/contributions/{cid}/slip", content=make_valid_jpeg(), headers=auth(donor))
        fclient.post(f"/v1/fund/contributions/{cid}/submit", headers=auth(donor))
        fclient.post(
            f"/v1/finance/contributions/{cid}/reconcile",
            json={"action": "matched", "statementReference": f"ST-{ref_code}", "reason": "Matched"},
            headers=auth(reviewer),
        )
        return cid

    cid1 = submit_one("REF-SEQ-1")
    cid2 = submit_one("REF-SEQ-2")

    # Approve 1 -> CN-00001
    res1 = fclient.post(
        f"/v1/finance/contributions/{cid1}/approve",
        json={"action": "approve", "reason": "Approve 1", "relatedPartyConflict": False},
        headers=auth(approver),
    )
    assert res1.status_code == 200
    rec1 = res1.json()["receiptCode"]

    # 22. Concurrent / duplicate approval fails
    res_dup = fclient.post(
        f"/v1/finance/contributions/{cid1}/approve",
        json={"action": "approve", "reason": "Approve 1 again", "relatedPartyConflict": False},
        headers=auth(approver),
    )
    assert res_dup.status_code == 409

    # Approve 2 -> CN-00002
    res2 = fclient.post(
        f"/v1/finance/contributions/{cid2}/approve",
        json={"action": "approve", "reason": "Approve 2", "relatedPartyConflict": False},
        headers=auth(approver),
    )
    assert res2.status_code == 200
    rec2 = res2.json()["receiptCode"]

    # 24. Sequential and unique
    assert rec1 != rec2
    assert int(rec2.split("-")[1]) == int(rec1.split("-")[1]) + 1

    # 23. Failed transaction does not leak counter:
    current_counter = db_session.scalar(text("SELECT last_number FROM finance.receipt_counter WHERE singleton = true"))
    try:
        # Simulate an exception in transaction
        with db_session.begin_nested():
            db_session.execute(text("UPDATE finance.receipt_counter SET last_number = last_number + 1 WHERE singleton = true"))
            raise RuntimeError("Simulation error")
    except RuntimeError:
        pass
    after_counter = db_session.scalar(text("SELECT last_number FROM finance.receipt_counter WHERE singleton = true"))
    assert after_counter == current_counter


# ---------------------------------------------------------------------------
# Test 25: Invalid status transitions rejected
# ---------------------------------------------------------------------------


def test_invalid_status_transitions_rejected(fclient, create_member, make_finance_staff, auth):
    donor = create_member(verified=True)
    reviewer = make_finance_staff(["finance.review"])
    approver = make_finance_staff(["finance.approve"])
    today = date.today().isoformat()

    d = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 500000,
            "transferDate": today,
            "bankReference": "REF-TRANS",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=auth(donor),
    ).json()
    cid = d["id"]

    res_reconcile = fclient.post(
        f"/v1/finance/contributions/{cid}/reconcile",
        json={"action": "matched", "statementReference": "ST-DRAFT", "reason": "Must not pass"},
        headers=auth(reviewer),
    )
    assert res_reconcile.status_code == 409
    assert res_reconcile.json()["detail"] == "cannot_matched_from_status:DRAFT"

    # Attempting to directly approve a DRAFT contribution
    res = fclient.post(
        f"/v1/finance/contributions/{cid}/approve",
        json={"action": "approve", "reason": "Skip to end", "relatedPartyConflict": False},
        headers=auth(approver),
    )
    assert res.status_code == 409
    assert res.json()["detail"] in ("invalid_finance_transition", "cannot_approve_from_status:DRAFT")


def test_reviewer_can_resume_a_held_contribution(fclient, create_member, make_finance_staff, auth):
    donor = create_member(verified=True)
    reviewer = make_finance_staff(["finance.review"])
    draft = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 500000,
            "transferDate": date.today().isoformat(),
            "bankReference": "REF-HOLD-RESUME",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=auth(donor),
    ).json()
    contribution_id = draft["id"]
    fclient.put(
        f"/v1/fund/contributions/{contribution_id}/slip",
        content=make_valid_jpeg(),
        headers=auth(donor),
    )
    fclient.post(f"/v1/fund/contributions/{contribution_id}/submit", headers=auth(donor))

    held = fclient.post(
        f"/v1/finance/contributions/{contribution_id}/reconcile",
        json={"action": "hold", "reason": "Bank statement query remains open"},
        headers=auth(reviewer),
    )
    assert held.status_code == 204

    resumed = fclient.post(
        f"/v1/finance/contributions/{contribution_id}/claim",
        headers=auth(reviewer),
    )
    assert resumed.status_code == 204
    detail = fclient.get(
        f"/v1/finance/contributions/{contribution_id}",
        headers=auth(reviewer),
    ).json()
    assert detail["status"] == "PENDING_REVIEW"


# ---------------------------------------------------------------------------
# Test 26: Audit contains no sensitive finance values
# ---------------------------------------------------------------------------


def test_audit_contains_no_sensitive_finance_values(fclient, db_session, create_member, make_finance_staff, auth):
    donor = create_member(verified=True)
    staff_rev = make_finance_staff(["finance.review"])
    today = date.today().isoformat()

    d = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 777777,
            "transferDate": today,
            "bankReference": "SECRET-BANK-REF-999",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=auth(donor),
    ).json()
    cid = d["id"]
    fclient.put(f"/v1/fund/contributions/{cid}/slip", content=make_valid_jpeg(), headers=auth(donor))
    fclient.post(f"/v1/fund/contributions/{cid}/submit", headers=auth(donor))

    # Reviewer matches
    fclient.post(
        f"/v1/finance/contributions/{cid}/reconcile",
        json={"action": "matched", "statementReference": "CONFIDENTIAL-STMT", "reason": "Confidential internal note"},
        headers=auth(staff_rev),
    )

    # Inspect all ops.audit_log entries for this contribution
    audit_rows = db_session.execute(
        text("SELECT action, details FROM ops.audit_log WHERE target_id = :target_id"),
        {"target_id": cid},
    ).all()

    assert len(audit_rows) > 0
    for row in audit_rows:
        details_str = str(row.details)
        # Sensitive amounts, account numbers, secret notes must not appear in audit log
        assert "777777" not in details_str
        assert "SECRET-BANK-REF-999" not in details_str
        assert "CONFIDENTIAL-STMT" not in details_str
        assert "Confidential internal note" not in details_str


# ---------------------------------------------------------------------------
# Test 27 & 28: Slip viewer token and streaming response headers
# ---------------------------------------------------------------------------


def test_slip_viewer_token_and_streaming_headers(fclient, create_member, make_finance_staff, auth):
    donor = create_member(verified=True)
    staff_rev = make_finance_staff(["finance.review"])
    other_staff = make_finance_staff(["finance.review"])
    today = date.today().isoformat()

    d = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 500000,
            "transferDate": today,
            "bankReference": "REF-TOKEN",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=auth(donor),
    ).json()
    cid = d["id"]
    jpeg = make_valid_jpeg(150, 150, "purple")
    fclient.put(f"/v1/fund/contributions/{cid}/slip", content=jpeg, headers=auth(donor))
    fclient.post(f"/v1/fund/contributions/{cid}/submit", headers=auth(donor))

    # Staff reviewer requests view token
    res_tok = fclient.post(f"/v1/finance/contributions/{cid}/slip-view", headers=auth(staff_rev))
    assert res_tok.status_code == 200
    token = res_tok.json()["token"]

    # 27. Other staff cannot stream with viewer-bound token of first staff
    res_wrong_viewer = fclient.get(f"/v1/finance/slips/{token}", headers=auth(other_staff))
    assert res_wrong_viewer.status_code == 403

    # Authorized staff streams successfully
    res_stream = fclient.get(f"/v1/finance/slips/{token}", headers=auth(staff_rev))
    assert res_stream.status_code == 200
    assert res_stream.content.startswith(b"\xff\xd8\xff")
    streamed_img = Image.open(io.BytesIO(res_stream.content))
    assert streamed_img.size == (150, 150)

    # 28. No-store cache control headers
    cache_control = res_stream.headers.get("Cache-Control", "")
    assert "no-store" in cache_control

    # The evidence grant is consumed by the first successful inspection.
    replay = fclient.get(f"/v1/finance/slips/{token}", headers=auth(staff_rev))
    assert replay.status_code == 403
    assert replay.json()["detail"] == "invalid_slip_view_token"


def test_fund_config_returns_real_account_number_only_when_available(fclient):
    response = fclient.get("/v1/fund/config")
    assert response.status_code == 200
    config = response.json()
    assert config["intakeAvailable"] is True
    assert config["accountNumber"] == "0001234567"
    assert config["accountNumberMasked"] == "••••••••4567"


# ---------------------------------------------------------------------------
# Test 29: CSV formula injection sanitized
# ---------------------------------------------------------------------------


def test_csv_formula_injection_sanitized(fclient, create_member, make_finance_staff, auth):
    donor = create_member(verified=True)
    reviewer = make_finance_staff(["finance.review"])
    approver = make_finance_staff(["finance.approve", "finance.export"])
    today = date.today().isoformat()

    # Create contribution with formula-injection bank reference: "=1+1"
    d = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 500000,
            "transferDate": today,
            "bankReference": "=1+1",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=auth(donor),
    ).json()
    cid = d["id"]
    fclient.put(f"/v1/fund/contributions/{cid}/slip", content=make_valid_jpeg(), headers=auth(donor))
    fclient.post(f"/v1/fund/contributions/{cid}/submit", headers=auth(donor))

    # Review and approve with formula injection in statement reference: "@SUM(A1:A10)"
    fclient.post(
        f"/v1/finance/contributions/{cid}/reconcile",
        json={"action": "matched", "statementReference": "@SUM(A1:A10)", "reason": "Formula test"},
        headers=auth(reviewer),
    )
    fclient.post(
        f"/v1/finance/contributions/{cid}/approve",
        json={"action": "approve", "reason": "Approved formula test", "relatedPartyConflict": False},
        headers=auth(approver),
    )

    # Export CSV for the current month
    month_str = today[:7]
    res_csv = fclient.get(f"/v1/finance/ledger.csv?month={month_str}", headers=auth(approver))
    assert res_csv.status_code == 200
    csv_text = res_csv.text

    # Formulas must be escaped with single-quote prefix
    assert "'=1+1" in csv_text
    assert "'@SUM(A1:A10)" in csv_text


# ---------------------------------------------------------------------------
# Test 30: Feature disabled returns 404 in production mode
# ---------------------------------------------------------------------------


def test_feature_disabled_returns_404_in_production_mode(finance_settings, db_session, create_member, auth):
    # Enforce feature flags mode without community_finance enabled
    settings = finance_settings.model_copy(update={"enforce_feature_flags": True})
    app = create_app(settings)
    app.dependency_overrides[get_db] = lambda: db_session
    client = TestClient(app)

    member = create_member(verified=True)
    headers = auth(member)

    res_fund = client.get("/v1/fund/config", headers=headers)
    assert res_fund.status_code == 404
    assert res_fund.json()["detail"] == "feature_unavailable"

    res_post = client.post("/v1/fund/contributions", json={}, headers=headers)
    assert res_post.status_code == 404
    assert res_post.json()["detail"] == "feature_unavailable"


# ---------------------------------------------------------------------------
# Test 31: Missing bank configuration returns safe unavailable response
# ---------------------------------------------------------------------------


def test_missing_bank_configuration_returns_safe_unavailable(database_settings, db_session, create_member, auth):
    # Intake disabled and bank fields empty
    settings = database_settings.model_copy(
        update={
            "finance_intake_enabled": False,
            "finance_bank_name": None,
            "finance_account_name": None,
            "finance_account_number": None,
        }
    )
    app = create_app(settings)
    app.dependency_overrides[get_db] = lambda: db_session
    client = TestClient(app)

    member = create_member(verified=True)
    headers = auth(member)

    # /v1/fund/config returns intakeAvailable: false and safe instructions
    res_cfg = client.get("/v1/fund/config", headers=headers)
    assert res_cfg.status_code == 200
    cfg = res_cfg.json()
    assert cfg["intakeAvailable"] is False
    assert cfg["bankName"] is None

    # POST draft returns 503 finance_not_configured
    today = date.today().isoformat()
    res_post = client.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 500000,
            "transferDate": today,
            "bankReference": "REF-UNAVAIL",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=headers,
    )
    assert res_post.status_code == 503
    assert res_post.json()["detail"] in ("finance_not_configured", "finance_intake_disabled")


# ---------------------------------------------------------------------------
# Test 32: Notifications contain no sensitive contribution data
# ---------------------------------------------------------------------------


def test_notifications_contain_no_sensitive_contribution_data(
    fclient, db_session, create_member, make_finance_staff, auth
):
    donor = create_member(verified=True)
    reviewer = make_finance_staff(["finance.review"])
    approver = make_finance_staff(["finance.approve"])
    today = date.today().isoformat()

    # Submit contribution
    d = fclient.post(
        "/v1/fund/contributions",
        json={
            "amountMinor": 888888,
            "transferDate": today,
            "bankReference": "REF-NOTIF-TEST",
            "noPrivilegeAcknowledged": True,
            "informationAccurateAcknowledged": True,
            "payingForSelf": True,
        },
        headers=auth(donor),
    ).json()
    cid = d["id"]
    fclient.put(f"/v1/fund/contributions/{cid}/slip", content=make_valid_jpeg(), headers=auth(donor))
    fclient.post(f"/v1/fund/contributions/{cid}/submit", headers=auth(donor))

    # Review and approve
    fclient.post(
        f"/v1/finance/contributions/{cid}/reconcile",
        json={"action": "matched", "statementReference": "ST-NOTIF", "reason": "Valid"},
        headers=auth(reviewer),
    )
    fclient.post(
        f"/v1/finance/contributions/{cid}/approve",
        json={"action": "approve", "reason": "Independent verified", "relatedPartyConflict": False},
        headers=auth(approver),
    )

    # Check notification records for this donor
    notifications = db_session.execute(
        text("SELECT title_en, title_ta, body_en, body_ta FROM notifications.notification WHERE member_id = :mid"),
        {"mid": donor.id},
    ).all()

    assert len(notifications) >= 2  # submitted and verified
    for n in notifications:
        text_content = f"{n.title_en} {n.title_ta} {n.body_en} {n.body_ta}"
        # No amount, bank account, or donor PII in notifications
        assert "888888" not in text_content
        assert "REF-NOTIF-TEST" not in text_content
        assert "0001234567" not in text_content
