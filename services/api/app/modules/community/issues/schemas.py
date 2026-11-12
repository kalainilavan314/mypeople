"""Member-facing request and response bodies for My Area and issue reporting (H05 to H09)."""

import uuid
from datetime import datetime

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.community.issues import rules
from app.modules.community.issues.rules import Category, LocationKind, MemberStatus, ResponsibleTier, Visibility
from app.modules.community.issues.service import IssueView, MyArea, ReportingOptions


class ReportingOptionsOut(CamelModel):
    allowed: bool = Field(description="Only Verified and Active members report (FR-RPT-017)")
    reason: str | None = Field(description="identity_not_verified or membership_not_active when not allowed")
    has_area: bool = Field(description="The member's profile names an area, which every report needs")
    gn_name_en: str | None
    gn_name_ta: str | None
    categories: list[Category]
    description_min: int
    max_photos: int

    @classmethod
    def build(cls, options: ReportingOptions) -> "ReportingOptionsOut":
        return cls(
            allowed=options.allowed,
            reason=options.reason,
            has_area=options.has_area,
            gn_name_en=options.gn_name_en,
            gn_name_ta=options.gn_name_ta,
            categories=list(rules.CATEGORIES),
            description_min=rules.DESCRIPTION_MIN,
            max_photos=rules.MAX_REPORT_PHOTOS,
        )


class IssuePhotoOut(CamelModel):
    id: uuid.UUID
    width: int
    height: int


class IssueReportIn(CamelModel):
    client_reference: uuid.UUID = Field(description="Made once per draft by the app; a repeated submit returns the first receipt")
    category: Category
    title: str = Field(min_length=5, max_length=120)
    description: str = Field(min_length=rules.DESCRIPTION_MIN, max_length=4000)
    location_kind: LocationKind
    location_text: str | None = Field(default=None, min_length=3, max_length=200)
    visibility: Visibility = "team"
    photo_ids: list[uuid.UUID] = Field(default_factory=list, max_length=rules.MAX_REPORT_PHOTOS)


class IssueStepOut(CamelModel):
    stage: int = Field(description="1 Reported, 2 Verified, 3 Decision, 4 Action and closure")
    reached_at: datetime | None


class CommunityUpdateOut(CamelModel):
    body: str
    created_at: datetime


class ClosureResponseOut(CamelModel):
    resolved: bool
    rating: int | None
    state: str
    decision_reason: str | None


class MyReportOut(CamelModel):
    """Only for the reporter: what they sent and where it stands (H09)."""

    title: str
    description: str
    location_kind: LocationKind
    location_text: str | None
    visibility: Visibility
    public_state: str
    photos: int
    next_step: str | None
    returned_question: str | None
    linked_to: str | None = Field(description="The parent case number when the report was linked as a duplicate")
    can_respond: bool
    challenge_until: datetime | None
    response: ClosureResponseOut | None
    created_at: datetime


class IssueSummaryOut(CamelModel):
    id: uuid.UUID
    case_number: str
    category: Category
    title_en: str
    title_ta: str
    status: MemberStatus
    stage: int
    responsible_tier: ResponsibleTier | None
    updated_at: datetime
    mine: bool
    following: bool

    @classmethod
    def from_view(cls, view: IssueView) -> "IssueSummaryOut":
        return cls(**_summary_fields(view.issue, view.view_stage, view.mine, view.following))


def _summary_fields(issue, view_stage: str, mine: bool, following: bool) -> dict:  # type: ignore[no-untyped-def]
    # The reporter sees their own words; everyone else only the moderator's public title.
    title_en = issue.title if mine else (issue.public_title_en or "")
    title_ta = issue.title if mine else (issue.public_title_ta or "")
    return {
        "id": issue.id,
        "case_number": issue.case_number,
        "category": issue.category,
        "title_en": title_en,
        "title_ta": title_ta,
        "status": rules.MEMBER_STATUS.get(view_stage, "received"),
        "stage": rules.MEMBER_STAGE.get(view_stage, 1),
        "responsible_tier": rules.RESPONSIBLE.get(view_stage),
        "updated_at": issue.updated_at,
        "mine": mine,
        "following": following,
    }


class IssueDetailOut(IssueSummaryOut):
    summary_en: str | None
    summary_ta: str | None
    steps: list[IssueStepOut]
    can_follow: bool
    can_add_information: bool
    community_updates: list[CommunityUpdateOut]
    closing_summary_en: str | None
    closing_summary_ta: str | None
    closed_at: datetime | None
    report: MyReportOut | None

    @classmethod
    def from_view(cls, view: IssueView) -> "IssueDetailOut":
        issue = view.issue
        report = None
        if view.mine:
            report = MyReportOut(
                title=issue.title,
                description=issue.description,
                location_kind=issue.location_kind,  # type: ignore[arg-type]
                location_text=issue.location_text,
                visibility=issue.visibility,  # type: ignore[arg-type]
                public_state=issue.public_state,
                photos=view.report_photos,
                next_step=view.next_step,
                returned_question=view.returned_question,
                linked_to=issue.parent_case_number,
                can_respond=view.next_step == "rate_closure",
                challenge_until=view.challenge_until,
                response=ClosureResponseOut(
                    resolved=view.response.resolved,
                    rating=view.response.rating,
                    state=view.response.state,
                    decision_reason=view.response.decision_reason,
                )
                if view.response
                else None,
                created_at=issue.created_at,
            )
        resolved = view.view_stage == "resolved"
        return cls(
            **_summary_fields(issue, view.view_stage, view.mine, view.following),
            summary_en=issue.public_summary_en if issue.public_state == "published" else None,
            summary_ta=issue.public_summary_ta if issue.public_state == "published" else None,
            steps=[IssueStepOut(stage=stage, reached_at=at) for stage, at in view.steps],
            can_follow=view.can_follow,
            can_add_information=view.can_add_information,
            community_updates=[CommunityUpdateOut(body=a.body, created_at=a.created_at) for a in view.community_updates],
            closing_summary_en=issue.closing_summary_en if resolved else None,
            closing_summary_ta=issue.closing_summary_ta if resolved else None,
            closed_at=issue.closed_at if resolved else None,
            report=report,
        )


class AreaUpdateOut(CamelModel):
    issue_id: uuid.UUID
    case_number: str
    title_en: str
    title_ta: str
    stage: int
    status: MemberStatus
    at: datetime


class MyAreaOut(CamelModel):
    has_area: bool
    gn_name_en: str | None
    gn_name_ta: str | None
    updates: list[AreaUpdateOut]
    issues: list[IssueSummaryOut]
    projects: list[IssueSummaryOut]

    @classmethod
    def build(cls, area: MyArea, member_id: uuid.UUID) -> "MyAreaOut":
        def card(issue) -> IssueSummaryOut:  # type: ignore[no-untyped-def]
            mine = issue.reporter_id == member_id
            # In the area lists everyone, the reporter too, sees the published public title.
            fields = _summary_fields(issue, issue.stage, False, issue.id in area.following)
            return IssueSummaryOut(**{**fields, "mine": mine})

        return cls(
            has_area=area.has_area,
            gn_name_en=area.gn_name_en,
            gn_name_ta=area.gn_name_ta,
            updates=[
                AreaUpdateOut(
                    issue_id=u.issue_id,
                    case_number=u.case_number,
                    title_en=u.public_title_en or "",
                    title_ta=u.public_title_ta or "",
                    stage=rules.MEMBER_STAGE.get(u.to_stage, 1),
                    status=rules.MEMBER_STATUS.get(u.to_stage, "received"),
                    at=u.at,
                )
                for u in area.updates
            ],
            issues=[card(issue) for issue in area.issues],
            projects=[card(issue) for issue in area.projects],
        )


class MyReportsOut(CamelModel):
    items: list[IssueSummaryOut]


class FollowIn(CamelModel):
    follow: bool


class AdditionIn(CamelModel):
    body: str = Field(min_length=5, max_length=2000)
    photo_ids: list[uuid.UUID] = Field(default_factory=list, max_length=2)


class AdditionOut(CamelModel):
    id: uuid.UUID
    state: str
    is_reply: bool
    created_at: datetime


class ClosureResponseIn(CamelModel):
    resolved: bool = Field(description="False challenges the closure (FR-RPT-016) and needs a note")
    rating: int | None = Field(default=None, ge=1, le=5)
    note: str | None = Field(default=None, min_length=5, max_length=1000)
