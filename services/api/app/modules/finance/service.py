"""Service layer for bank-transfer contributions, review, and receipt allocation (M1.4)."""

import csv
import io
import re
import secrets
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

import jwt
from pydantic import SecretStr
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.modules.access.service import Staff
from app.modules.audit import service as audit
from app.modules.features import repository as feature_repository
from app.modules.finance import images, repository, rules, vault
from app.modules.finance.scanner import MalwareScanner
from app.modules.finance.schemas import (
    ContributionCreateRequest,
    ContributionDetailResponse,
    FundConfigResponse,
    FinanceProductionControlRequest,
    FinanceProductionControlResponse,
    FinanceProductionReadinessResponse,
    FinanceReadinessCheck,
    ReceiptResponse,
    StaffApproveRequest,
    StaffContributionDetail,
    StaffContributionSummary,
    StaffContributionsListResponse,
    StaffReconcileRequest,
    StaffReconciliationDetail,
    StaffApprovalDetail,
    StaffSlipViewTokenResponse,
    StaffTimelineEvent,
    TimelineEventResponse,
)
from app.modules.messaging.notifications import service as notifications
from app.modules.policy_decisions import repository as decision_repository

VIEW_TOKEN_ALGORITHM = "HS256"
VIEW_TOKEN_TTL_SECONDS = 300  # 5 minutes


class FinanceError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class FinanceNotConfigured(FinanceError):
    pass


class FinanceIntakeDisabled(FinanceError):
    pass


class ContributionNotFound(FinanceError):
    pass


class IdempotencyConflict(FinanceError):
    pass


class InvalidSubmission(FinanceError):
    pass


class InvalidTransition(FinanceError):
    pass


class SlipRequired(FinanceError):
    pass


class SelfReviewForbidden(FinanceError):
    pass


class SelfApprovalForbidden(FinanceError):
    pass


class IndependentApprovalRequired(FinanceError):
    pass


class ClaimConflict(FinanceError):
    pass


class ReceiptNotIssued(FinanceError):
    pass


class FinanceControlRefused(FinanceError):
    pass


def _control_response(row: Any) -> FinanceProductionControlResponse:
    return FinanceProductionControlResponse(
        id=row["id"],
        controlKey=row["control_key"],
        decisionKey=row["decision_key"],
        decisionRevisionId=row["decision_revision_id"],
        decisionRevision=row["decision_revision"],
        integerValue=row["integer_value"],
        textValue=row["text_value"],
        evidenceRef=row["evidence_ref"],
        reason=row["reason"],
        recordedAt=row["recorded_at"],
    )


def record_production_control(
    db: Session,
    staff: Staff,
    req: FinanceProductionControlRequest,
    *,
    ip: str | None = None,
) -> FinanceProductionControlResponse:
    problem = rules.production_control_problem(req.control_key, req.integer_value, req.text_value)
    if problem:
        raise FinanceControlRefused(problem)

    expected_decision = rules.PRODUCTION_CONTROLS[req.control_key]
    latest = decision_repository.latest_revisions(db).get(expected_decision)
    if latest is None or latest.id != req.decision_revision_id or latest.status != "approved":
        raise FinanceControlRefused("approved_current_decision_required")

    try:
        row = repository.insert_production_control(
            db,
            control_key=req.control_key,
            decision_revision_id=req.decision_revision_id,
            integer_value=req.integer_value,
            text_value=req.text_value,
            evidence_ref=req.evidence_ref.strip(),
            reason=req.reason.strip(),
            recorded_by=staff.member_id,
        )
    except IntegrityError:
        db.rollback()
        raise FinanceControlRefused("control_already_recorded_for_decision") from None

    audit.record(
        db,
        actor_id=staff.member_id,
        action="finance.production_control_recorded",
        target_type="finance_control",
        target_id=req.control_key,
        details={"controlKey": req.control_key, "decisionKey": expected_decision},
        ip=ip,
    )
    db.commit()
    return _control_response(row)


def production_readiness(db: Session, settings: Settings) -> FinanceProductionReadinessResponse:
    latest_decisions = decision_repository.latest_revisions(db)
    stored_controls = repository.latest_production_controls(db)
    reviewer_count, approver_count, distinct_count = repository.finance_staff_coverage(db)
    receipt_last = repository.receipt_counter_value(db)

    checks: list[FinanceReadinessCheck] = []

    required_decisions = sorted(set(rules.PRODUCTION_CONTROLS.values()))
    approved = [
        key for key in required_decisions
        if key in latest_decisions and latest_decisions[key].status == "approved"
    ]
    missing_decisions = [key for key in required_decisions if key not in approved]
    checks.append(
        FinanceReadinessCheck(
            key="approved_policy_decisions",
            label="Approved finance decisions",
            ready=not missing_decisions,
            detail=(
                "FIN-01, FIN-02, FIN-03 and FIN-05 are approved."
                if not missing_decisions
                else f"Missing current approval: {', '.join(missing_decisions)}."
            ),
        )
    )

    current_controls: list[FinanceProductionControlResponse] = []
    stale_or_missing: list[str] = []
    for control_key, decision_key in rules.PRODUCTION_CONTROLS.items():
        row = stored_controls.get(control_key)
        decision = latest_decisions.get(decision_key)
        if (
            row is None
            or decision is None
            or decision.status != "approved"
            or row["decision_revision_id"] != decision.id
        ):
            stale_or_missing.append(control_key)
        else:
            current_controls.append(_control_response(row))
    checks.append(
        FinanceReadinessCheck(
            key="current_production_controls",
            label="Current production controls",
            ready=not stale_or_missing,
            detail=(
                "All machine-enforced controls match the current approved decisions."
                if not stale_or_missing
                else f"Missing or stale controls: {', '.join(stale_or_missing)}."
            ),
        )
    )

    feature_enabled = not settings.feature_flags_enforced or feature_repository.is_enabled(db, "community_finance")
    checks.append(
        FinanceReadinessCheck(
            key="feature_gate",
            label="Community-finance release gate",
            ready=feature_enabled,
            detail=(
                "Community finance is enabled."
                if feature_enabled
                else "Record Gate G1 and enable community_finance before live intake."
            ),
        )
    )
    checks.append(
        FinanceReadinessCheck(
            key="runtime_configuration",
            label="Banking and evidence configuration",
            ready=settings.finance_intake_enabled and settings.is_finance_configured,
            detail=(
                "Bank details, bilingual instructions, encryption and intake are configured."
                if settings.finance_intake_enabled and settings.is_finance_configured
                else "Complete the finance environment configuration and explicitly enable intake."
            ),
        )
    )
    scanner_ready = (
        settings.finance_malware_scanner != "none"
        if settings.app_env == "development"
        else settings.finance_malware_scanner == "clamav"
    )
    checks.append(
        FinanceReadinessCheck(
            key="malware_scanner",
            label="Fail-closed malware scanning",
            ready=scanner_ready,
            detail=(
                "The configured scanner is permitted for this environment."
                if scanner_ready
                else "ClamAV is required outside development."
            ),
        )
    )
    staffing_ready = reviewer_count > 0 and approver_count > 0 and distinct_count > 1
    checks.append(
        FinanceReadinessCheck(
            key="dual_control_staffing",
            label="Independent finance staffing",
            ready=staffing_ready,
            detail=(
                f"{reviewer_count} reviewer(s), {approver_count} approver(s), "
                f"{distinct_count} distinct finance staff member(s)."
            ),
        )
    )
    receipt_remaining = 99_999 - receipt_last
    checks.append(
        FinanceReadinessCheck(
            key="receipt_capacity",
            label="Official receipt capacity",
            ready=receipt_remaining > 0,
            detail=f"CN-{receipt_last:05d} is the last allocated number; {receipt_remaining:,} remain.",
        )
    )
    checks.append(
        FinanceReadinessCheck(
            key="deferred_capabilities",
            label="Unapproved capabilities remain disabled",
            ready=True,
            detail="Card payments and automated evidence deletion are not implemented or enabled.",
        )
    )

    return FinanceProductionReadinessResponse(
        ready=all(item.ready for item in checks),
        checks=checks,
        controls=sorted(current_controls, key=lambda item: item.control_key),
        reviewerCount=reviewer_count,
        approverCount=approver_count,
        distinctFinanceStaffCount=distinct_count,
        receiptLastNumber=receipt_last,
        receiptRemaining=receipt_remaining,
        cardPaymentsEnabled=False,
        automatedEvidenceDeletionEnabled=False,
    )


def _active_production_values(db: Session, settings: Settings) -> tuple[int, str, str]:
    if not settings.feature_flags_enforced:
        return settings.finance_internal_review_threshold_minor, "not_applicable", "manual_review"

    readiness = production_readiness(db, settings)
    if not readiness.ready:
        failed = [check.key for check in readiness.checks if not check.ready]
        raise FinanceIntakeDisabled(f"finance_not_production_ready:{','.join(failed)}")
    controls = {control.control_key: control for control in readiness.controls}
    threshold = controls["enhanced_review_threshold_minor"].integer_value
    reporting_mode = controls["statutory_reporting_mode"].text_value
    third_party_mode = controls["third_party_payment_mode"].text_value
    assert threshold is not None and reporting_mode is not None and third_party_mode is not None
    return threshold, reporting_mode, third_party_mode


def get_config(db: Session, settings: Settings) -> FundConfigResponse:
    """Return member-facing bank transfer configuration."""
    available = settings.finance_intake_enabled and settings.is_finance_configured
    if settings.feature_flags_enforced:
        available = available and production_readiness(db, settings).ready
    acc_num = (
        settings.finance_account_number.get_secret_value()
        if isinstance(settings.finance_account_number, SecretStr)
        else (settings.finance_account_number or "")
    )
    masked_acc = f"••••••••{acc_num[-4:]}" if len(acc_num) >= 4 else None

    return FundConfigResponse(
        currency="LKR",
        amount_presets=[50000, 100000, 250000, 500000, 1000000],  # 500, 1000, 2500, 5000, 10000 LKR
        bank_name=settings.finance_bank_name if available else None,
        account_name=settings.finance_account_name if available else None,
        account_number=acc_num if available else None,
        account_number_masked=masked_acc if available else None,
        branch_name=settings.finance_branch_name if available else None,
        transfer_instructions_en=settings.finance_transfer_instructions_en if available else None,
        transfer_instructions_ta=settings.finance_transfer_instructions_ta if available else None,
        disclaimer_en="A contribution does not provide membership, political, service, employment or assistance privileges.",
        disclaimer_ta="நிதிப் பங்களிப்பானது உறுப்புரிமை, அரசியல், சேவை, வேலைவாய்ப்பு அல்லது உதவிச் சலுகைகளை வழங்காது.",
        no_reward_statement_en="Official receipts are issued only after independent finance review and verification.",
        no_reward_statement_ta="சுயாதீன நிதி மதிப்பாய்வு மற்றும் சரிபார்ப்பிற்குப் பிறகே அதிகாரப்பூர்வ ரசீதுகள் வழங்கப்படும்.",
        intake_available=available,
    )


def create_or_get_draft(
    db: Session,
    settings: Settings,
    member_id: UUID,
    req: ContributionCreateRequest,
    ip: str | None = None,
) -> ContributionDetailResponse:
    if not settings.finance_intake_enabled:
        raise FinanceIntakeDisabled("finance_intake_disabled")
    if not settings.is_finance_configured:
        raise FinanceNotConfigured("finance_not_configured")
    threshold_minor, reporting_mode, third_party_mode = _active_production_values(db, settings)
    if not req.paying_for_self and third_party_mode == "blocked":
        raise InvalidSubmission("third_party_payment_not_allowed")

    # 1. Validate submission rules and declarations
    today = datetime.now(UTC).date()
    problems = rules.check_submission(req.amount_minor, req.transfer_date, today, req.bank_reference)
    problems.extend(
        rules.check_declarations(req.no_privilege_acknowledged, req.information_accurate_acknowledged)
    )
    if problems:
        raise InvalidSubmission(",".join(problems))

    # 2. Check idempotency
    existing = repository.find_by_member_and_idempotency(db, member_id, req.idempotency_key)
    if existing:
        if (
            existing.amount_minor == req.amount_minor
            and existing.transfer_date == req.transfer_date
            and existing.bank_reference.strip() == req.bank_reference.strip()
            and existing.paying_for_self == req.paying_for_self
        ):
            return get_contribution(db, existing.id, member_id)
        raise IdempotencyConflict("idempotency_conflict")

    # 3. Generate unique contribution reference MP-XXXXXXXX
    while True:
        candidate_ref = f"MP-{secrets.token_hex(4).upper()}"
        if not db.execute(
            repository.text("SELECT 1 FROM finance.contribution WHERE contribution_ref = :ref"),
            {"ref": candidate_ref},
        ).scalar_one_or_none():
            break

    # 4. Initial risk flags
    has_dup = repository.count_existing_bank_reference(db, req.bank_reference) > 0
    risk_flags = rules.evaluate_risk_flags(
        req.amount_minor,
        threshold_minor,
        has_dup,
        req.paying_for_self,
        reporting_mode,
    )

    draft = repository.insert_draft(
        db,
        member_id=member_id,
        contribution_ref=candidate_ref,
        amount_minor=req.amount_minor,
        transfer_date=req.transfer_date,
        bank_reference=req.bank_reference,
        idempotency_key=req.idempotency_key,
        declaration_version=req.declaration_version,
        no_privilege_acknowledged=req.no_privilege_acknowledged,
        information_accurate_acknowledged=req.information_accurate_acknowledged,
        paying_for_self=req.paying_for_self,
        risk_flags=risk_flags,
    )

    repository.insert_event(
        db,
        contribution_id=draft.id,
        from_status=None,
        to_status="DRAFT",
        actor_id=member_id,
        reason="Contribution draft created",
    )

    db.commit()
    return get_contribution(db, draft.id, member_id)


def upload_slip(
    db: Session,
    settings: Settings,
    contribution_id: UUID,
    member_id: UUID,
    raw_bytes: bytes,
    scanner: MalwareScanner,
    ip: str | None = None,
) -> None:
    if not settings.finance_intake_enabled:
        raise FinanceIntakeDisabled("finance_intake_disabled")
    if not settings.is_finance_configured:
        raise FinanceNotConfigured("finance_not_configured")
    _active_production_values(db, settings)

    row = repository.find_by_id(db, contribution_id, for_update=True)
    if not row or row.member_id != member_id:
        raise ContributionNotFound("contribution_not_found")
    if row.status not in ("DRAFT", "NEEDS_CORRECTION"):
        raise InvalidTransition("slip_upload_forbidden_in_current_state")

    # 1. Malware scan raw upload bytes first (fails closed if scanner unavailable or infected)
    scanner.scan(raw_bytes)

    # 2. Decode, sanitize and canonicalize image
    prepared = images.prepare_slip(raw_bytes)

    # 3. Encrypt slip ciphertext
    finance_key = settings.finance_key
    if not finance_key:
        raise FinanceNotConfigured("finance_encryption_key_missing")

    next_version = repository.get_latest_slip_version(db, contribution_id) + 1
    sealed = vault.seal(finance_key, contribution_id, next_version, prepared.data)
    key_id = vault.key_id(finance_key)

    slip = repository.insert_slip(
        db,
        contribution_id=contribution_id,
        version=next_version,
        encrypted_image=sealed,
        key_id=key_id,
        content_type=prepared.content_type,
        sha256=prepared.sha256,
    )

    audit.record(
        db,
        actor_id=member_id,
        action="finance.slip_uploaded",
        target_type="contribution",
        target_id=str(contribution_id),
        details={"contributionRef": row.contribution_ref, "slipVersion": next_version},
        ip=ip,
    )

    db.commit()


def submit_contribution(
    db: Session,
    settings: Settings,
    contribution_id: UUID,
    member_id: UUID,
    ip: str | None = None,
) -> ContributionDetailResponse:
    if not settings.finance_intake_enabled:
        raise FinanceIntakeDisabled("finance_intake_disabled")
    if not settings.is_finance_configured:
        raise FinanceNotConfigured("finance_not_configured")
    threshold_minor, reporting_mode, third_party_mode = _active_production_values(db, settings)

    row = repository.find_by_id(db, contribution_id, for_update=True)
    if not row or row.member_id != member_id:
        raise ContributionNotFound("contribution_not_found")
    if row.status not in ("DRAFT", "NEEDS_CORRECTION"):
        raise InvalidTransition(f"cannot_submit_from_status:{row.status}")

    slip = repository.get_current_slip(db, contribution_id)
    if not slip:
        raise SlipRequired("slip_required")
    if not row.paying_for_self and third_party_mode == "blocked":
        raise InvalidSubmission("third_party_payment_not_allowed")

    has_dup = repository.count_existing_bank_reference(db, row.bank_reference, exclude_id=contribution_id) > 0
    risk_flags = rules.evaluate_risk_flags(
        row.amount_minor,
        threshold_minor,
        has_dup,
        row.paying_for_self,
        reporting_mode,
    )

    prev_status = row.status
    repository.update_status(db, contribution_id, "SUBMITTED", risk_flags)
    repository.insert_event(
        db,
        contribution_id=contribution_id,
        from_status=prev_status,
        to_status="SUBMITTED",
        actor_id=member_id,
        reason="Contribution submitted by donor",
    )

    notifications.notify(db, member_id, "contribution_submitted", contribution_id)

    audit.record(
        db,
        actor_id=member_id,
        action="finance.submitted",
        target_type="contribution",
        target_id=str(contribution_id),
        details={"contributionRef": row.contribution_ref, "status": "SUBMITTED"},
        ip=ip,
    )

    db.commit()
    return get_contribution(db, contribution_id, member_id)


def _safe_timeline(events: list[Any]) -> list[TimelineEventResponse]:
    timeline = []
    descriptions = {
        "DRAFT": ("Draft started", "வரைவு தொடங்கப்பட்டது"),
        "SUBMITTED": ("Contribution submitted", "பங்களிப்பு சமர்ப்பிக்கப்பட்டது"),
        "PENDING_REVIEW": ("Under finance review", "நிதி மதிப்பாய்வில் உள்ளது"),
        "RECONCILED": ("Bank transfer matched", "வங்கிப் பரிவர்த்தனை பொருத்தப்பட்டது"),
        "APPROVAL_PENDING": ("Pending final approval", "இறுதி ஒப்புதலுக்காகக் காத்திருக்கிறது"),
        "VERIFIED": ("Verified and official receipt issued", "சரிபார்க்கப்பட்டு அதிகாரப்பூர்வ ரசீது வழங்கப்பட்டது"),
        "NEEDS_CORRECTION": ("Slip correction requested", "சீட்டுத் திருத்தம் கோரப்பட்டது"),
        "REJECTED": ("Contribution not accepted", "பங்களிப்பு ஏற்றுக்கொள்ளப்படவில்லை"),
        "ON_HOLD": ("Placed on review hold", "மதிப்பாய்வு இடைநிறுத்தப்பட்டது"),
        "REFUNDED": ("Refund processed", "பணத்தைத் திரும்பப்பெறுதல் செய்யப்பட்டது"),
    }
    for e in events:
        en, ta = descriptions.get(e.to_status, (e.to_status, e.to_status))
        timeline.append(
            TimelineEventResponse(
                status=e.to_status,
                occurred_at=e.occurred_at,
                description_en=en,
                description_ta=ta,
            )
        )
    return timeline


def get_contribution(db: Session, contribution_id: UUID, member_id: UUID) -> ContributionDetailResponse:
    row = repository.find_by_id(db, contribution_id)
    if not row or row.member_id != member_id:
        raise ContributionNotFound("contribution_not_found")

    events = repository.get_events(db, contribution_id)
    receipt_row = repository.get_receipt(db, contribution_id)
    receipt_resp = None
    if receipt_row and row.status == "VERIFIED":
        receipt_code = rules.receipt_code(receipt_row.number)
        receipt_resp = ReceiptResponse(
            receipt_code=receipt_code,
            contribution_ref=row.contribution_ref,
            amount_minor=row.amount_minor,
            currency=row.currency,
            transfer_date=row.transfer_date,
            issued_at=receipt_row.issued_at,
            status="VERIFIED",
            share_payload=f"My People Official Contribution Receipt\nReceipt No: {receipt_code}\nReference: {row.contribution_ref}\nDate: {row.transfer_date}\nStatus: Verified",
        )

    return ContributionDetailResponse(
        id=row.id,
        contribution_ref=row.contribution_ref,
        amount_minor=row.amount_minor,
        currency=row.currency,
        transfer_date=row.transfer_date,
        bank_reference=row.bank_reference,
        status=row.status,
        created_at=row.created_at,
        updated_at=row.updated_at,
        has_slip=row.current_slip_id is not None,
        receipt=receipt_resp,
        timeline=_safe_timeline(events),
    )


def list_member_contributions(db: Session, member_id: UUID, limit: int = 50, offset: int = 0) -> list[ContributionDetailResponse]:
    rows, _ = repository.list_for_member(db, member_id, limit, offset)
    return [get_contribution(db, r.id, member_id) for r in rows]


def get_receipt(db: Session, contribution_id: UUID, member_id: UUID) -> ReceiptResponse:
    row = repository.find_by_id(db, contribution_id)
    if not row or row.member_id != member_id:
        raise ContributionNotFound("contribution_not_found")
    if row.status != "VERIFIED":
        raise ReceiptNotIssued("receipt_not_issued")

    receipt_row = repository.get_receipt(db, contribution_id)
    if not receipt_row:
        raise ReceiptNotIssued("receipt_not_issued")

    code = rules.receipt_code(receipt_row.number)
    return ReceiptResponse(
        receipt_code=code,
        contribution_ref=row.contribution_ref,
        amount_minor=row.amount_minor,
        currency=row.currency,
        transfer_date=row.transfer_date,
        issued_at=receipt_row.issued_at,
        status="VERIFIED",
        share_payload=f"My People Official Contribution Receipt\nReceipt No: {code}\nReference: {row.contribution_ref}\nDate: {row.transfer_date}\nStatus: Verified",
    )


# Staff operations


def list_staff_contributions(
    db: Session,
    *,
    status: str | None = None,
    month: str | None = None,
    risk_flag: str | None = None,
    reference_search: str | None = None,
    claimed_by_me: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> StaffContributionsListResponse:
    limit = min(max(1, limit), 100)
    rows, total = repository.list_for_staff(
        db,
        status=status,
        month=month,
        risk_flag=risk_flag,
        reference_search=reference_search,
        claimed_by_me=claimed_by_me,
        limit=limit,
        offset=offset,
    )
    items = []
    for r in rows:
        receipt_code = rules.receipt_code(r.receipt_number) if r.receipt_number else None
        items.append(
            StaffContributionSummary(
                id=r.id,
                contribution_ref=r.contribution_ref,
                donor_member_code=r.donor_member_code,
                amount_minor=r.amount_minor,
                currency=r.currency,
                transfer_date=r.transfer_date,
                status=r.status,
                risk_flags=r.risk_flags if isinstance(r.risk_flags, list) else [],
                claimed_by=r.claimed_by,
                claimed_by_name=r.claimed_by_name,
                created_at=r.created_at,
                receipt_code=receipt_code,
            )
        )
    return StaffContributionsListResponse(items=items, total=total, limit=limit, offset=offset)


def get_staff_contribution_detail(db: Session, contribution_id: UUID) -> StaffContributionDetail:
    row = repository.find_by_id(db, contribution_id)
    if not row:
        raise ContributionNotFound("contribution_not_found")

    events = repository.get_events(db, contribution_id)
    recon = repository.get_reconciliation(db, contribution_id)
    approval = repository.get_approval(db, contribution_id)
    receipt_row = repository.get_receipt(db, contribution_id)
    slip = repository.get_current_slip(db, contribution_id)

    recon_detail = (
        StaffReconciliationDetail(
            statement_reference=recon.statement_reference,
            reviewed_by=recon.reviewed_by,
            reviewed_at=recon.reviewed_at,
            reason=recon.reason,
        )
        if recon
        else None
    )

    approval_detail = (
        StaffApprovalDetail(
            approved_by=approval.approved_by,
            approved_at=approval.approved_at,
            reason=approval.reason,
            related_party_conflict=approval.related_party_conflict,
        )
        if approval
        else None
    )

    receipt_resp = None
    if receipt_row and row.status == "VERIFIED":
        code = rules.receipt_code(receipt_row.number)
        receipt_resp = ReceiptResponse(
            receipt_code=code,
            contribution_ref=row.contribution_ref,
            amount_minor=row.amount_minor,
            currency=row.currency,
            transfer_date=row.transfer_date,
            issued_at=receipt_row.issued_at,
            status="VERIFIED",
            share_payload=f"My People Official Contribution Receipt\nReceipt No: {code}\nReference: {row.contribution_ref}\nDate: {row.transfer_date}\nStatus: Verified",
        )

    timeline = [
        StaffTimelineEvent(
            id=e.id,
            from_status=e.from_status,
            to_status=e.to_status,
            occurred_at=e.occurred_at,
            reason=e.reason,
        )
        for e in events
    ]

    return StaffContributionDetail(
        id=row.id,
        contribution_ref=row.contribution_ref,
        donor_member_code=row.donor_member_code,
        donor_member_id=row.member_id,
        amount_minor=row.amount_minor,
        currency=row.currency,
        transfer_date=row.transfer_date,
        bank_reference=row.bank_reference,
        status=row.status,
        risk_flags=row.risk_flags if isinstance(row.risk_flags, list) else [],
        claimed_by=row.claimed_by,
        claimed_by_name=row.claimed_by_code,
        claimed_at=row.claimed_at,
        declaration_version=row.declaration_version,
        no_privilege_acknowledged=row.no_privilege_acknowledged,
        information_accurate_acknowledged=row.information_accurate_acknowledged,
        paying_for_self=row.paying_for_self,
        has_slip=slip is not None,
        slip_version=slip.version if slip else None,
        reconciliation=recon_detail,
        approval=approval_detail,
        receipt=receipt_resp,
        timeline=timeline,
    )


def claim_contribution(db: Session, contribution_id: UUID, staff: Staff, ip: str | None = None) -> None:
    row = repository.find_by_id(db, contribution_id, for_update=True)
    if not row:
        raise ContributionNotFound("contribution_not_found")
    if row.member_id == staff.member_id:
        raise SelfReviewForbidden("donor_cannot_review_own_contribution")
    if row.status != "PENDING_REVIEW" and rules.check_transition(row.status, "PENDING_REVIEW"):
        raise InvalidTransition(f"cannot_claim_from_status:{row.status}")

    if not repository.claim(db, contribution_id, staff.member_id):
        raise ClaimConflict("already_claimed")

    if row.status in ("SUBMITTED", "ON_HOLD"):
        repository.update_status(db, contribution_id, "PENDING_REVIEW")
        repository.insert_event(
            db,
            contribution_id=contribution_id,
            from_status=row.status,
            to_status="PENDING_REVIEW",
            actor_id=staff.member_id,
            reason="Claimed by reviewer",
        )

    audit.record(
        db,
        actor_id=staff.member_id,
        action="finance.claimed",
        target_type="contribution",
        target_id=str(contribution_id),
        details={"contributionRef": row.contribution_ref},
        ip=ip,
    )
    db.commit()


def generate_slip_view_token(
    db: Session,
    settings: Settings,
    contribution_id: UUID,
    staff: Staff,
    ip: str | None = None,
) -> StaffSlipViewTokenResponse:
    row = repository.find_by_id(db, contribution_id)
    if not row:
        raise ContributionNotFound("contribution_not_found")

    slip = repository.get_current_slip(db, contribution_id)
    if not slip:
        raise SlipRequired("slip_not_found")

    now = datetime.now(UTC)
    expires_at = now + timedelta(seconds=VIEW_TOKEN_TTL_SECONDS)
    payload = {
        "sub": str(staff.member_id),
        "cid": str(contribution_id),
        "vid": slip.version,
        "jti": str(uuid4()),
        "exp": int(expires_at.timestamp()),
    }
    repository.insert_slip_view_grant(
        db,
        token_id=UUID(payload["jti"]),
        contribution_id=contribution_id,
        slip_version=slip.version,
        viewer_id=staff.member_id,
        expires_at=expires_at,
    )
    secret = settings.jwt_secret.get_secret_value()
    token = jwt.encode(payload, secret, algorithm=VIEW_TOKEN_ALGORITHM)

    audit.record(
        db,
        actor_id=staff.member_id,
        action="finance.slip_view_token_generated",
        target_type="contribution",
        target_id=str(contribution_id),
        details={"contributionRef": row.contribution_ref, "slipVersion": slip.version},
        ip=ip,
    )
    db.commit()

    return StaffSlipViewTokenResponse(
        token=token,
        expires_at=expires_at,
        view_url=f"/v1/finance/slips/{token}",
    )


def stream_slip(
    db: Session,
    settings: Settings,
    token_str: str,
    staff: Staff,
    ip: str | None = None,
) -> tuple[bytes, str]:
    secret = settings.jwt_secret.get_secret_value()
    try:
        decoded = jwt.decode(token_str, secret, algorithms=[VIEW_TOKEN_ALGORITHM])
    except (jwt.PyJWTError, Exception):
        raise FinanceError("invalid_slip_view_token") from None

    if decoded.get("sub") != str(staff.member_id):
        raise FinanceError("viewer_mismatch")

    cid = UUID(decoded["cid"])
    vid = int(decoded["vid"])
    try:
        token_id = UUID(decoded["jti"])
    except (KeyError, TypeError, ValueError):
        raise FinanceError("invalid_slip_view_token") from None

    if not repository.consume_slip_view_grant(
        db,
        token_id=token_id,
        contribution_id=cid,
        slip_version=vid,
        viewer_id=staff.member_id,
    ):
        raise FinanceError("invalid_slip_view_token")

    slip = repository.get_slip_by_version(db, cid, vid)
    if not slip:
        raise SlipRequired("slip_not_found")

    finance_key = settings.finance_key
    if not finance_key:
        raise FinanceNotConfigured("finance_encryption_key_missing")

    plaintext = vault.unseal(finance_key, cid, vid, bytes(slip.encrypted_image))

    audit.record(
        db,
        actor_id=staff.member_id,
        action="finance.slip_inspected",
        target_type="contribution",
        target_id=str(cid),
        details={"slipVersion": vid},
        ip=ip,
    )
    db.commit()

    return plaintext, slip.content_type


def reconcile_contribution(
    db: Session,
    contribution_id: UUID,
    staff: Staff,
    req: StaffReconcileRequest,
    ip: str | None = None,
) -> None:
    row = repository.find_by_id(db, contribution_id, for_update=True)
    if not row:
        raise ContributionNotFound("contribution_not_found")
    if row.member_id == staff.member_id:
        raise SelfReviewForbidden("donor_cannot_review_own_contribution")

    workflow_status = "PENDING_REVIEW" if row.status == "SUBMITTED" else row.status
    target_status = {
        "matched": "RECONCILED",
        "needs_correction": "NEEDS_CORRECTION",
        "reject": "REJECTED",
        "hold": "ON_HOLD",
    }[req.action]
    if rules.check_transition(workflow_status, target_status):
        raise InvalidTransition(f"cannot_{req.action}_from_status:{row.status}")

    if row.claimed_by is not None and row.claimed_by != staff.member_id:
        raise ClaimConflict("claimed_by_another_reviewer")
    if row.claimed_by is None:
        repository.claim(db, contribution_id, staff.member_id)

    if row.status == "SUBMITTED":
        repository.update_status(db, contribution_id, "PENDING_REVIEW")
        repository.insert_event(
            db,
            contribution_id=contribution_id,
            from_status="SUBMITTED",
            to_status="PENDING_REVIEW",
            actor_id=staff.member_id,
            reason="Claimed by reviewer",
        )
        workflow_status = "PENDING_REVIEW"

    if req.action == "matched":
        if not req.statement_reference or not 1 <= len(req.statement_reference.strip()) <= 120:
            raise InvalidSubmission("statement_reference_invalid")
        if not 3 <= len(req.reason.strip()) <= 1000:
            raise InvalidSubmission("reason_invalid")

        # Transitions: SUBMITTED or PENDING_REVIEW -> RECONCILED -> APPROVAL_PENDING
        repository.insert_reconciliation(
            db,
            contribution_id=contribution_id,
            statement_reference=req.statement_reference.strip(),
            reviewed_by=staff.member_id,
            reason=req.reason.strip(),
        )
        repository.update_status(db, contribution_id, "APPROVAL_PENDING")
        repository.insert_event(
            db,
            contribution_id=contribution_id,
            from_status=workflow_status,
            to_status="RECONCILED",
            actor_id=staff.member_id,
            reason=f"Matched to bank statement: {req.reason.strip()}",
        )
        repository.insert_event(
            db,
            contribution_id=contribution_id,
            from_status="RECONCILED",
            to_status="APPROVAL_PENDING",
            actor_id=staff.member_id,
            reason="Submitted for independent second-person approval",
        )
        audit.record(
            db,
            actor_id=staff.member_id,
            action="finance.reconciled",
            target_type="contribution",
            target_id=str(contribution_id),
            details={"contributionRef": row.contribution_ref, "action": "matched"},
            ip=ip,
        )

    elif req.action == "needs_correction":
        if not 3 <= len(req.reason.strip()) <= 1000:
            raise InvalidSubmission("reason_invalid")

        repository.update_status(db, contribution_id, "NEEDS_CORRECTION")
        repository.insert_event(
            db,
            contribution_id=contribution_id,
            from_status=workflow_status,
            to_status="NEEDS_CORRECTION",
            actor_id=staff.member_id,
            reason=req.reason.strip(),
        )
        notifications.notify(db, row.member_id, "contribution_needs_correction", contribution_id)
        audit.record(
            db,
            actor_id=staff.member_id,
            action="finance.correction_requested",
            target_type="contribution",
            target_id=str(contribution_id),
            details={"contributionRef": row.contribution_ref, "action": "needs_correction"},
            ip=ip,
        )

    elif req.action == "reject":
        if not 3 <= len(req.reason.strip()) <= 1000:
            raise InvalidSubmission("reason_invalid")

        repository.update_status(db, contribution_id, "REJECTED")
        repository.insert_event(
            db,
            contribution_id=contribution_id,
            from_status=workflow_status,
            to_status="REJECTED",
            actor_id=staff.member_id,
            reason=req.reason.strip(),
        )
        notifications.notify(db, row.member_id, "contribution_rejected", contribution_id)
        audit.record(
            db,
            actor_id=staff.member_id,
            action="finance.rejected",
            target_type="contribution",
            target_id=str(contribution_id),
            details={"contributionRef": row.contribution_ref, "action": "reject"},
            ip=ip,
        )

    elif req.action == "hold":
        if not 3 <= len(req.reason.strip()) <= 1000:
            raise InvalidSubmission("reason_invalid")

        repository.update_status(db, contribution_id, "ON_HOLD")
        repository.insert_event(
            db,
            contribution_id=contribution_id,
            from_status=workflow_status,
            to_status="ON_HOLD",
            actor_id=staff.member_id,
            reason=req.reason.strip(),
        )
        audit.record(
            db,
            actor_id=staff.member_id,
            action="finance.held",
            target_type="contribution",
            target_id=str(contribution_id),
            details={"contributionRef": row.contribution_ref, "action": "hold"},
            ip=ip,
        )

    db.commit()


def approve_contribution(
    db: Session,
    contribution_id: UUID,
    staff: Staff,
    req: StaffApproveRequest,
    ip: str | None = None,
) -> ReceiptResponse | None:
    row = repository.find_by_id(db, contribution_id, for_update=True)
    if not row:
        raise ContributionNotFound("contribution_not_found")
    if row.status != "APPROVAL_PENDING":
        raise InvalidTransition(f"cannot_approve_from_status:{row.status}")

    # Check separation of duties
    if row.member_id == staff.member_id:
        raise SelfApprovalForbidden("donor_cannot_approve_own_contribution")

    recon = repository.get_reconciliation(db, contribution_id)
    if recon and recon.reviewed_by == staff.member_id:
        raise IndependentApprovalRequired("reviewer_cannot_approve_own_review")

    if req.action == "approve":
        if req.related_party_conflict:
            raise IndependentApprovalRequired("related_party_conflict")
        if not 3 <= len(req.reason.strip()) <= 1000:
            raise InvalidSubmission("reason_invalid")

        # Transactional allocation of official CN-XXXXX receipt
        receipt = repository.allocate_receipt_and_approve(
            db,
            contribution_id=contribution_id,
            approved_by=staff.member_id,
            reason=req.reason.strip(),
            related_party_conflict=req.related_party_conflict,
        )
        repository.update_status(db, contribution_id, "VERIFIED")
        repository.insert_event(
            db,
            contribution_id=contribution_id,
            from_status="APPROVAL_PENDING",
            to_status="VERIFIED",
            actor_id=staff.member_id,
            reason=f"Approved: {req.reason.strip()}",
        )
        notifications.notify(db, row.member_id, "contribution_verified", contribution_id)
        audit.record(
            db,
            actor_id=staff.member_id,
            action="finance.approved",
            target_type="contribution",
            target_id=str(contribution_id),
            details={
                "contributionRef": row.contribution_ref,
                "receiptNumber": receipt.number,
                "action": "approve",
            },
            ip=ip,
        )
        db.commit()

        receipt_code = rules.receipt_code(receipt.number)
        return ReceiptResponse(
            receipt_code=receipt_code,
            contribution_ref=row.contribution_ref,
            amount_minor=row.amount_minor,
            currency=row.currency,
            transfer_date=row.transfer_date,
            issued_at=receipt.issued_at,
            status="VERIFIED",
            share_payload=f"My People Official Contribution Receipt\nReceipt No: {receipt_code}\nReference: {row.contribution_ref}\nDate: {row.transfer_date}\nStatus: Verified",
        )

    elif req.action == "reject":
        if not 3 <= len(req.reason.strip()) <= 1000:
            raise InvalidSubmission("reason_invalid")

        repository.update_status(db, contribution_id, "REJECTED")
        repository.insert_event(
            db,
            contribution_id=contribution_id,
            from_status=row.status,
            to_status="REJECTED",
            actor_id=staff.member_id,
            reason=req.reason.strip(),
        )
        notifications.notify(db, row.member_id, "contribution_rejected", contribution_id)
        audit.record(
            db,
            actor_id=staff.member_id,
            action="finance.rejected",
            target_type="contribution",
            target_id=str(contribution_id),
            details={"contributionRef": row.contribution_ref, "action": "reject"},
            ip=ip,
        )
        db.commit()
        return None

    elif req.action == "hold":
        if not 3 <= len(req.reason.strip()) <= 1000:
            raise InvalidSubmission("reason_invalid")

        repository.update_status(db, contribution_id, "ON_HOLD")
        repository.insert_event(
            db,
            contribution_id=contribution_id,
            from_status=row.status,
            to_status="ON_HOLD",
            actor_id=staff.member_id,
            reason=req.reason.strip(),
        )
        audit.record(
            db,
            actor_id=staff.member_id,
            action="finance.held",
            target_type="contribution",
            target_id=str(contribution_id),
            details={"contributionRef": row.contribution_ref, "action": "hold"},
            ip=ip,
        )
        db.commit()
        return None

    raise InvalidSubmission("unknown_action")


def _sanitize_csv_cell(value: Any) -> str:
    """Escape potential formula injection prefixes (=, +, -, @, tab, cr)."""
    text_val = str(value) if value is not None else ""
    if text_val and text_val[0] in ("=", "+", "-", "@", "\t", "\r"):
        return f"'{text_val}"
    return text_val


def export_ledger_csv(
    db: Session,
    month: str,
    staff: Staff,
    ip: str | None = None,
) -> str:
    if not re.match(r"^\d{4}-\d{2}$", month):
        raise InvalidSubmission("month_must_be_yyyy_mm")

    rows = repository.export_ledger_rows(db, month)

    out = io.StringIO()
    writer = csv.writer(out, dialect="excel")
    writer.writerow(
        [
            "Contribution Reference",
            "Transfer Date",
            "Amount Minor",
            "Currency",
            "Bank Reference",
            "Statement Reference",
            "Status",
            "Receipt Number",
            "Receipt Issued At",
            "Donor Member Code",
        ]
    )

    for r in rows:
        receipt_code = rules.receipt_code(r.receipt_number) if r.receipt_number else ""
        issued_at_str = r.receipt_issued_at.isoformat() if r.receipt_issued_at else ""
        writer.writerow(
            [
                _sanitize_csv_cell(r.contribution_ref),
                _sanitize_csv_cell(r.transfer_date),
                _sanitize_csv_cell(r.amount_minor),
                _sanitize_csv_cell(r.currency),
                _sanitize_csv_cell(r.bank_reference),
                _sanitize_csv_cell(getattr(r, "statement_reference", "")),
                _sanitize_csv_cell(r.status),
                _sanitize_csv_cell(receipt_code),
                _sanitize_csv_cell(issued_at_str),
                _sanitize_csv_cell(r.donor_member_code),
            ]
        )

    audit.record(
        db,
        actor_id=staff.member_id,
        action="finance.ledger_exported",
        target_type="finance_ledger",
        target_id=month,
        details={"month": month, "rowCount": len(rows)},
        ip=ip,
    )
    db.commit()

    return out.getvalue()
