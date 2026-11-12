"""My Area and issue reporting for members (BRD H05 to H09, FR-RPT-001 to 017): /v1/issues."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.auth.dependencies import CurrentMember
from app.modules.community.issues import service
from app.modules.community.issues.evidence import IssueVault
from app.modules.community.issues.schemas import (
    AdditionIn,
    AdditionOut,
    ClosureResponseIn,
    FollowIn,
    IssueDetailOut,
    IssuePhotoOut,
    IssueReportIn,
    IssueSummaryOut,
    MyAreaOut,
    MyReportsOut,
    ReportingOptionsOut,
)
from app.modules.content.gallery.dependencies import PhotoBody
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]

router = APIRouter(prefix="/v1/issues", tags=["issues"], dependencies=[Depends(require_feature("community_issues"))])

NOT_FOUND = {404: {"description": "not_found: no such issue, or not visible to this member"}}


def _refused(error: service.IssueRefused) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "issue_refused", "problems": error.problems}
    )


@router.get("/area", response_model=MyAreaOut)
def read_my_area(member: CurrentMember, db: Db) -> MyAreaOut:
    """H05: Updates, Issues and Projects published for the member's GN division."""
    return MyAreaOut.build(service.my_area(db, member.id), member.id)


@router.get("/reporting", response_model=ReportingOptionsOut)
def read_reporting_options(member: CurrentMember, db: Db) -> ReportingOptionsOut:
    """H07: whether the member may report, and the controlled lists for the form."""
    return ReportingOptionsOut.build(service.reporting_options(db, member.id))


@router.post(
    "/photos",
    status_code=status.HTTP_201_CREATED,
    response_model=IssuePhotoOut,
    responses={415: {"description": "unsupported_type"}, 413: {"description": "too_large"}},
)
def upload_report_photo(member: CurrentMember, photo: PhotoBody, vault: IssueVault, db: Db) -> IssuePhotoOut:
    """A photo for a report being written; location data is removed and it goes to the restricted
    evidence store, never the gallery (FR-RPT-009). Attach it by id when the report is sent."""
    try:
        saved = service.save_photo(db, vault, member.id, photo, purpose="report")
    except service.IssueRefused as error:
        raise _refused(error) from None
    return IssuePhotoOut(id=saved.id, width=saved.width, height=saved.height)


@router.post("/addition-photos", status_code=status.HTTP_201_CREATED, response_model=IssuePhotoOut)
def upload_addition_photo(member: CurrentMember, photo: PhotoBody, vault: IssueVault, db: Db) -> IssuePhotoOut:
    try:
        saved = service.save_photo(db, vault, member.id, photo, purpose="addition")
    except service.IssueRefused as error:
        raise _refused(error) from None
    return IssuePhotoOut(id=saved.id, width=saved.width, height=saved.height)


@router.post("", status_code=status.HTTP_201_CREATED, response_model=IssueDetailOut)
def submit_report(body: IssueReportIn, member: CurrentMember, request: Request, db: Db) -> IssueDetailOut:
    """H08: send the report. The receipt exists only once the server has the case (FR-RPT-013)."""
    try:
        issue = service.submit_report(
            db,
            member.id,
            service.NewReport(
                client_reference=body.client_reference,
                category=body.category,
                title=body.title,
                description=body.description,
                location_kind=body.location_kind,
                location_text=body.location_text,
                visibility=body.visibility,
                photo_ids=body.photo_ids,
            ),
            client_ip(request),
        )
    except service.IssueRefused as error:
        raise _refused(error) from None
    return IssueDetailOut.from_view(service.detail(db, member.id, issue.id))


@router.get("/mine", response_model=MyReportsOut)
def list_my_reports(member: CurrentMember, db: Db) -> MyReportsOut:
    return MyReportsOut(items=[IssueSummaryOut.from_view(view) for view in service.my_reports(db, member.id)])


@router.get("/{issue_id}", response_model=IssueDetailOut, responses=NOT_FOUND)
def read_issue(issue_id: uuid.UUID, member: CurrentMember, db: Db) -> IssueDetailOut:
    """H06 for anyone in the area; H09 with the reporter's own details for the reporter."""
    try:
        return IssueDetailOut.from_view(service.detail(db, member.id, issue_id))
    except service.IssueNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None


@router.put("/{issue_id}/follow", response_model=IssueDetailOut, responses=NOT_FOUND)
def set_following(issue_id: uuid.UUID, body: FollowIn, member: CurrentMember, db: Db) -> IssueDetailOut:
    """FR-RPT-005: follow an issue to be told of each stage change."""
    try:
        return IssueDetailOut.from_view(service.set_following(db, member.id, issue_id, body.follow))
    except service.IssueNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.IssueRefused as error:
        raise _refused(error) from None


@router.post("/{issue_id}/information", status_code=status.HTTP_201_CREATED, response_model=AdditionOut, responses=NOT_FOUND)
def add_information(issue_id: uuid.UUID, body: AdditionIn, member: CurrentMember, request: Request, db: Db) -> AdditionOut:
    """FR-RPT-006: held for moderation; the reporter's answer to a request for details reopens the GN stage."""
    try:
        addition = service.add_information(db, member.id, issue_id, body.body, body.photo_ids, client_ip(request))
    except service.IssueNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.IssueRefused as error:
        raise _refused(error) from None
    return AdditionOut(id=addition.id, state=addition.state, is_reply=addition.is_reply, created_at=addition.created_at)


@router.post("/{issue_id}/closure-response", response_model=IssueDetailOut, responses=NOT_FOUND)
def respond_to_closure(
    issue_id: uuid.UUID, body: ClosureResponseIn, member: CurrentMember, request: Request, db: Db
) -> IssueDetailOut:
    """FR-RPT-016: rate a closure, or challenge it with a note within 30 days."""
    try:
        view = service.respond_to_closure(
            db, member.id, issue_id, resolved=body.resolved, rating=body.rating, note=body.note, ip=client_ip(request)
        )
    except service.IssueNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.IssueRefused as error:
        raise _refused(error) from None
    return IssueDetailOut.from_view(view)
