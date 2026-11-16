"""FastAPI routers for member fund intake and staff finance reconciliation (M1.4)."""

import uuid
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.core.config import Settings
from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.auth.dependencies import CurrentMember
from app.modules.access.dependencies import require_permission
from app.modules.access.service import Staff
from app.modules.features.dependencies import require_feature
from app.modules.finance import service
from app.modules.finance.dependencies import (
    CanApprove,
    CanExport,
    CanInspectSlip,
    CanListFinance,
    CanReview,
    SlipBody,
    get_malware_scanner,
)
from app.modules.finance.images import SlipImageRejected
from app.modules.finance.scanner import MalwareDetected, MalwareScanner, ScannerUnavailable
from app.modules.finance.schemas import (
    ContributionCreateRequest,
    ContributionDetailResponse,
    FundConfigResponse,
    FinanceProductionControlRequest,
    FinanceProductionControlResponse,
    FinanceProductionReadinessResponse,
    ReceiptResponse,
    StaffApproveRequest,
    StaffContributionDetail,
    StaffContributionsListResponse,
    StaffReconcileRequest,
    StaffSlipViewTokenResponse,
)

# Gated member router: /v1/fund
fund_router = APIRouter(
    prefix="/v1/fund",
    tags=["fund"],
    dependencies=[Depends(require_feature("community_finance"))],
)

# Gated staff router: /v1/finance
finance_router = APIRouter(
    prefix="/v1/finance",
    tags=["finance"],
    dependencies=[Depends(require_feature("community_finance"))],
)

readiness_router = APIRouter(prefix="/v1/finance-readiness", tags=["finance-readiness"])

Db = Annotated[Session, Depends(get_db)]
Scanner = Annotated[MalwareScanner, Depends(get_malware_scanner)]
CanConfigureFinance = Annotated[Staff, Depends(require_permission("system.configure"))]


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def _handle_service_error(err: Exception) -> None:
    if isinstance(err, service.FinanceNotConfigured):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=err.code)
    if isinstance(err, service.FinanceIntakeDisabled):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=err.code)
    if isinstance(err, service.FinanceControlRefused):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err.code)
    if isinstance(err, service.ContributionNotFound):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=err.code)
    if isinstance(err, service.IdempotencyConflict):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err.code)
    if isinstance(err, service.ClaimConflict):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err.code)
    if isinstance(err, service.ReceiptNotIssued):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err.code)
    if isinstance(err, service.InvalidTransition):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err.code)
    if isinstance(err, (service.SelfReviewForbidden, service.SelfApprovalForbidden, service.IndependentApprovalRequired)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=err.code)
    if isinstance(err, service.FinanceError) and err.code in ("viewer_mismatch", "invalid_slip_view_token"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=err.code)
    if isinstance(err, (service.InvalidSubmission, service.SlipRequired)):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=err.code)
    if isinstance(err, SlipImageRejected):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=err.code)
    if isinstance(err, MalwareDetected):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="malware_detected")
    if isinstance(err, ScannerUnavailable):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="finance_scanner_unavailable")
    raise err


# ---------------------------------------------------------------------------
# Production readiness (/v1/finance-readiness)
# ---------------------------------------------------------------------------


@readiness_router.get("", response_model=FinanceProductionReadinessResponse)
def get_finance_readiness(
    _staff: CanConfigureFinance,
    db: Db,
    request: Request,
) -> FinanceProductionReadinessResponse:
    """Return fail-closed finance launch checks without exposing secrets or bank numbers."""
    return service.production_readiness(db, _settings(request))


@readiness_router.post(
    "/controls",
    response_model=FinanceProductionControlResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_finance_control(
    req: FinanceProductionControlRequest,
    staff: CanConfigureFinance,
    db: Db,
    request: Request,
) -> FinanceProductionControlResponse:
    """Record an immutable machine control for the exact approved decision revision."""
    try:
        return service.record_production_control(db, staff, req, ip=client_ip(request))
    except Exception as err:
        _handle_service_error(err)


# ---------------------------------------------------------------------------
# Member Fund Endpoints (/v1/fund)
# ---------------------------------------------------------------------------


@fund_router.get("/config", response_model=FundConfigResponse)
def get_fund_config(request: Request, db: Db) -> FundConfigResponse:
    """Return approved official bank-transfer configuration and contribution rules."""
    return service.get_config(db, _settings(request))


@fund_router.post("/contributions", response_model=ContributionDetailResponse)
def create_contribution(
    req: ContributionCreateRequest,
    member: CurrentMember,
    db: Db,
    request: Request,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    legacy_idempotency_key: Annotated[str | None, Header(alias="X-Idempotency-Key")] = None,
) -> ContributionDetailResponse:
    """Idempotently create or retrieve a contribution draft."""
    try:
        raw_key = idempotency_key or legacy_idempotency_key
        effective_key = req.idempotency_key
        if effective_key is None and raw_key:
            normalized_key = raw_key.strip()
            if not 8 <= len(normalized_key) <= 200:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="idempotency_key_invalid",
                )
            try:
                effective_key = UUID(normalized_key)
            except ValueError:
                effective_key = uuid.uuid5(uuid.NAMESPACE_URL, normalized_key)
        if effective_key is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="idempotency_key_required",
            )
        req_with_key = req.model_copy(update={"idempotency_key": effective_key})
        return service.create_or_get_draft(
            db, _settings(request), member.id, req_with_key, ip=client_ip(request)
        )
    except Exception as err:
        _handle_service_error(err)


@fund_router.put("/contributions/{id}/slip", status_code=status.HTTP_204_NO_CONTENT)
async def upload_slip(
    id: UUID,
    member: CurrentMember,
    db: Db,
    scanner: Scanner,
    request: Request,
    raw_bytes: SlipBody,
) -> Response:
    """Upload, scan, encrypt, and store a contribution transfer slip."""
    try:
        await run_in_threadpool(
            service.upload_slip,
            db,
            _settings(request),
            id,
            member.id,
            raw_bytes,
            scanner,
            client_ip(request),
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as err:
        _handle_service_error(err)


@fund_router.post("/contributions/{id}/submit", response_model=ContributionDetailResponse)
def submit_contribution(
    id: UUID,
    member: CurrentMember,
    db: Db,
    request: Request,
) -> ContributionDetailResponse:
    """Transition contribution from DRAFT/NEEDS_CORRECTION to SUBMITTED."""
    try:
        return service.submit_contribution(
            db, _settings(request), id, member.id, ip=client_ip(request)
        )
    except Exception as err:
        _handle_service_error(err)


@fund_router.get("/contributions/mine", response_model=list[ContributionDetailResponse])
def list_my_contributions(
    member: CurrentMember,
    db: Db,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0, le=10_000),
) -> list[ContributionDetailResponse]:
    """List current member's contribution records."""
    return service.list_member_contributions(db, member.id, limit=limit, offset=offset)


@fund_router.get("/contributions/{id}", response_model=ContributionDetailResponse)
def get_my_contribution(
    id: UUID,
    member: CurrentMember,
    db: Db,
) -> ContributionDetailResponse:
    """Get single contribution details and safe timeline history."""
    try:
        return service.get_contribution(db, id, member.id)
    except Exception as err:
        _handle_service_error(err)


@fund_router.get("/contributions/{id}/receipt", response_model=ReceiptResponse)
def get_my_receipt(
    id: UUID,
    member: CurrentMember,
    db: Db,
) -> ReceiptResponse:
    """Get official contribution receipt (only available once verified)."""
    try:
        return service.get_receipt(db, id, member.id)
    except Exception as err:
        _handle_service_error(err)


# ---------------------------------------------------------------------------
# Staff Finance Endpoints (/v1/finance)
# ---------------------------------------------------------------------------


@finance_router.get("/contributions", response_model=StaffContributionsListResponse)
def list_finance_contributions(
    staff: CanListFinance,
    db: Db,
    status: str | None = Query(None),
    month: str | None = Query(None),
    risk_flag: str | None = Query(None, alias="riskFlag"),
    reference: str | None = Query(None),
    claimed_by_me: bool = Query(False, alias="claimedByMe"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0, le=10_000),
) -> StaffContributionsListResponse:
    """Operational queue for staff with explicit finance review or approval grants."""
    claimed_filter = staff.member_id if claimed_by_me else None
    return service.list_staff_contributions(
        db,
        status=status,
        month=month,
        risk_flag=risk_flag,
        reference_search=reference,
        claimed_by_me=claimed_filter,
        limit=limit,
        offset=offset,
    )


@finance_router.get("/contributions/{id}", response_model=StaffContributionDetail)
def get_finance_contribution(
    id: UUID,
    staff: CanListFinance,
    db: Db,
) -> StaffContributionDetail:
    """Get contribution detail, status history, declarations, and review state."""
    try:
        return service.get_staff_contribution_detail(db, id)
    except Exception as err:
        _handle_service_error(err)


@finance_router.post("/contributions/{id}/claim", status_code=status.HTTP_204_NO_CONTENT)
def claim_contribution(
    id: UUID,
    staff: CanReview,
    db: Db,
    request: Request,
) -> Response:
    """Reviewer claims contribution for reconciliation review."""
    try:
        service.claim_contribution(db, id, staff, ip=client_ip(request))
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as err:
        _handle_service_error(err)


@finance_router.post("/contributions/{id}/slip-view", response_model=StaffSlipViewTokenResponse)
def get_slip_view_token(
    id: UUID,
    staff: CanInspectSlip,
    db: Db,
    request: Request,
) -> StaffSlipViewTokenResponse:
    """Issue a short-lived (5-minute) viewer-bound token to inspect encrypted slip."""
    try:
        return service.generate_slip_view_token(
            db, _settings(request), id, staff, ip=client_ip(request)
        )
    except Exception as err:
        _handle_service_error(err)


@finance_router.get("/slips/{token}")
def stream_slip(
    token: str,
    staff: CanInspectSlip,
    db: Db,
    request: Request,
) -> Response:
    """Unseal and stream the slip image bytes with no-store caching."""
    try:
        plaintext, content_type = service.stream_slip(
            db, _settings(request), token, staff, ip=client_ip(request)
        )
        return Response(
            content=plaintext,
            media_type=content_type,
            headers={
                "Cache-Control": "no-store, no-cache, must-revalidate, private",
                "X-Content-Type-Options": "nosniff",
            },
        )
    except Exception as err:
        _handle_service_error(err)


@finance_router.post("/contributions/{id}/reconcile", status_code=status.HTTP_204_NO_CONTENT)
def reconcile_contribution(
    id: UUID,
    req: StaffReconcileRequest,
    staff: CanReview,
    db: Db,
    request: Request,
) -> Response:
    """Reviewer matches to bank statement, requests correction, rejects, or places on hold."""
    try:
        service.reconcile_contribution(db, id, staff, req, ip=client_ip(request))
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as err:
        _handle_service_error(err)


@finance_router.post("/contributions/{id}/approve", response_model=ReceiptResponse | None)
def approve_contribution(
    id: UUID,
    req: StaffApproveRequest,
    staff: CanApprove,
    db: Db,
    request: Request,
) -> ReceiptResponse | None:
    """Independent second-person approver issues official CN receipt, rejects, or places on hold."""
    try:
        return service.approve_contribution(db, id, staff, req, ip=client_ip(request))
    except Exception as err:
        _handle_service_error(err)


@finance_router.get("/ledger.csv")
def export_ledger_csv(
    staff: CanExport,
    db: Db,
    request: Request,
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
) -> Response:
    """Monthly CSV ledger export for audited contributions."""
    try:
        csv_data = service.export_ledger_csv(db, month, staff, ip=client_ip(request))
        return Response(
            content=csv_data,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="finance-ledger-{month}.csv"',
                "Cache-Control": "no-store",
            },
        )
    except Exception as err:
        _handle_service_error(err)
