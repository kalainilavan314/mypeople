"""Dependencies for the finance module (M1.4)."""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from app.core.config import Settings
from app.modules.access.dependencies import require_permission
from app.modules.access.service import Staff
from app.modules.auth.dependencies import CurrentMember
from app.modules.finance.images import MAX_UPLOAD_BYTES
from app.modules.finance.scanner import (
    ClamAVScanner,
    DevScanner,
    MalwareScanner,
    StubScanner,
    UnavailableScanner,
)

CanReview = Annotated[Staff, Depends(require_permission("finance.review"))]
CanApprove = Annotated[Staff, Depends(require_permission("finance.approve"))]
CanExport = Annotated[Staff, Depends(require_permission("finance.export"))]
CanAuditRead = Annotated[Staff, Depends(require_permission("finance.audit_read"))]

CanListFinance = Annotated[
    Staff,
    Depends(require_permission("finance.review", "finance.approve", "finance.export", "finance.audit_read")),
]

CanInspectSlip = Annotated[
    Staff,
    Depends(require_permission("finance.review", "finance.approve", "finance.audit_read")),
]


async def read_slip_body(request: Request, _member: CurrentMember) -> bytes:
    """Read one authenticated image upload without buffering past the limit."""
    declared = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if declared and declared not in {"image/jpeg", "image/png"}:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="unsupported_type")

    length = request.headers.get("content-length", "")
    if length.isdigit() and int(length) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="too_large")

    body = bytearray()
    async for chunk in request.stream():
        body += chunk
        if len(body) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="too_large")
    if not body:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="empty_file")
    return bytes(body)


SlipBody = Annotated[bytes, Depends(read_slip_body)]


def build_malware_scanner(settings: Settings) -> MalwareScanner:
    mode = settings.finance_malware_scanner
    if mode in ("development", "dev"):
        return DevScanner()
    if mode == "stub":
        return StubScanner()
    if mode == "clamav":
        return ClamAVScanner(
            settings.finance_clamav_host,
            settings.finance_clamav_port,
            settings.finance_clamav_timeout_seconds,
        )
    return UnavailableScanner()


def get_malware_scanner(request: Request) -> MalwareScanner:
    # Allow test injection via app.state
    if hasattr(request.app.state, "finance_scanner") and request.app.state.finance_scanner is not None:
        return request.app.state.finance_scanner
    return build_malware_scanner(request.app.state.settings)
