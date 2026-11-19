"""Request and response bodies for wings and committees (M31, M32, S18, D23)."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import AwareDatetime, Field

from app.core.schemas import CamelModel
from app.modules.access.schemas import AreaRef
from app.modules.engagement.committees import repository
from app.modules.engagement.committees.rules import (
    CommitteeState,
    ItemState,
    ItemType,
    Kind,
    MembershipState,
    PostState,
    Role,
    WingType,
)
from app.modules.engagement.committees.service import AdminView, CommitteeCard, ManageView, Space, ThreadView


class CommitteeOut(CamelModel):
    id: uuid.UUID
    committee_ref: str
    kind: Kind
    wing_type: WingType
    wing_id: uuid.UUID | None
    wing_name_en: str | None
    wing_name_ta: str | None
    name_en: str
    name_ta: str
    purpose_en: str
    purpose_ta: str
    area_key: str
    state: CommitteeState
    members: int

    @classmethod
    def fields(cls, c: repository.Committee) -> dict[str, object]:
        return {
            "id": c.id, "committee_ref": c.committee_ref, "kind": c.kind, "wing_type": c.wing_type, "wing_id": c.wing_id,
            "wing_name_en": c.wing_name_en, "wing_name_ta": c.wing_name_ta, "name_en": c.name_en, "name_ta": c.name_ta,
            "purpose_en": c.purpose_en, "purpose_ta": c.purpose_ta, "area_key": c.area_key, "state": c.state,
            "members": c.members,
        }

    @classmethod
    def build(cls, c: repository.Committee) -> "CommitteeOut":
        return cls(**cls.fields(c))  # type: ignore[arg-type]


class CommitteeMembershipOut(CamelModel):
    id: uuid.UUID
    state: MembershipState
    role: Role | None
    applied_at: datetime
    decided_at: datetime | None
    decision_reason: str | None

    @classmethod
    def build(cls, m: repository.Membership) -> "CommitteeMembershipOut":
        return cls(id=m.id, state=m.state, role=m.role, applied_at=m.applied_at,  # type: ignore[arg-type]
                   decided_at=m.decided_at, decision_reason=m.decision_reason)


class CommitteeCardOut(CommitteeOut):
    """M31: a committee with the member's own application or role, and why they cannot apply, if so."""

    my_membership: CommitteeMembershipOut | None
    apply_problem: str | None

    @classmethod
    def from_card(cls, card: CommitteeCard) -> "CommitteeCardOut":
        return cls(
            **CommitteeOut.fields(card.committee),  # type: ignore[arg-type]
            my_membership=CommitteeMembershipOut.build(card.membership) if card.membership else None,
            apply_problem=card.apply_problem,
        )


class CommitteeItemOut(CamelModel):
    id: uuid.UUID
    item_ref: str
    item_type: ItemType
    title: str
    body: str
    author_name: str
    mine: bool  # written by the viewer: a coordinator never approves their own minutes
    state: ItemState
    starts_at: datetime | None
    ends_at: datetime | None
    place: str | None
    meeting_id: uuid.UUID | None
    due_on: date | None
    assignee_name: str | None
    assigned_to_me: bool
    places: int | None
    signups: int
    signed_up: bool
    done_at: datetime | None
    overdue: bool
    access_roles: list[Role]
    replies: int
    decision_reason: str | None
    created_at: datetime

    @classmethod
    def build(cls, item: repository.Item, *, viewer: uuid.UUID | None, signed_up: bool = False,
              today: date | None = None) -> "CommitteeItemOut":
        overdue = today is not None and item.item_type == "task" and item.done_at is None and item.due_on is not None \
            and item.due_on < today
        return cls(
            id=item.id, item_ref=item.item_ref, item_type=item.item_type, title=item.title,  # type: ignore[arg-type]
            body=item.body, author_name=item.author_name, mine=viewer is not None and item.author_id == viewer,
            state=item.state,  # type: ignore[arg-type]
            starts_at=item.starts_at, ends_at=item.ends_at, place=item.place, meeting_id=item.meeting_id,
            due_on=item.due_on, assignee_name=item.assignee_name,
            assigned_to_me=viewer is not None and item.assignee_id == viewer, places=item.places, signups=item.signups,
            signed_up=signed_up, done_at=item.done_at, overdue=overdue,
            access_roles=item.access_roles,  # type: ignore[arg-type]
            replies=item.replies, decision_reason=item.decision_reason if item.state == "returned" else None,
            created_at=item.created_at,
        )


class CommitteeSpaceOut(CamelModel):
    """M32. `items` is empty unless the member is an approved member of an active committee."""

    committee: CommitteeOut
    my_membership: CommitteeMembershipOut | None
    apply_problem: str | None
    items: list[CommitteeItemOut]
    my_waiting: list[CommitteeItemOut]

    @classmethod
    def from_space(cls, view: Space, today: date) -> "CommitteeSpaceOut":
        return cls(
            committee=CommitteeOut.build(view.committee),
            my_membership=CommitteeMembershipOut.build(view.membership) if view.membership else None,
            apply_problem=view.apply_problem,
            items=[CommitteeItemOut.build(i, viewer=view.member_id, signed_up=i.id in view.my_signups, today=today)
                   for i in view.items],
            my_waiting=[CommitteeItemOut.build(i, viewer=view.member_id) for i in view.own_waiting],
        )


class CommitteePostOut(CamelModel):
    id: uuid.UUID
    author_name: str
    mine: bool
    body: str
    state: PostState
    decision_reason: str | None
    created_at: datetime

    @classmethod
    def build(cls, post: repository.Post, viewer: uuid.UUID | None) -> "CommitteePostOut":
        return cls(id=post.id, author_name=post.author_name, mine=post.author_id == viewer, body=post.body,
                   state=post.state, decision_reason=post.decision_reason if post.state != "published" else None,  # type: ignore[arg-type]
                   created_at=post.created_at)


class CommitteeThreadOut(CamelModel):
    thread: CommitteeItemOut
    posts: list[CommitteePostOut]
    can_moderate: bool

    @classmethod
    def from_view(cls, view: ThreadView, viewer: uuid.UUID) -> "CommitteeThreadOut":
        return cls(thread=CommitteeItemOut.build(view.thread, viewer=viewer),
                   posts=[CommitteePostOut.build(p, viewer) for p in view.posts], can_moderate=view.can_moderate)


class CommitteeApplicationIn(CamelModel):
    note: str | None = Field(default=None, max_length=500)


class CommitteeThreadIn(CamelModel):
    title: str = Field(min_length=3, max_length=160)
    body: str = Field(min_length=2, max_length=4000)


class CommitteePostIn(CamelModel):
    body: str = Field(min_length=2, max_length=2000)


class CommitteeSignupIn(CamelModel):
    signed_up: bool


# --- Coordinators (S18) ----------------------------------------------------------------------------------


class CommitteeCoordinatingOut(CamelModel):
    committee: CommitteeOut
    role: Role
    waiting: int


class CommitteeRosterEntryOut(CamelModel):
    """A person in the committee's roster: name, member code, state and role; nothing else (RB-09)."""

    id: uuid.UUID
    name: str
    member_code: str
    state: MembershipState
    role: Role | None
    application_note: str | None
    applied_at: datetime
    decided_at: datetime | None
    role_set_at: datetime | None

    @classmethod
    def build(cls, m: repository.Membership) -> "CommitteeRosterEntryOut":
        return cls(id=m.id, name=m.name, member_code=m.member_code, state=m.state, role=m.role,  # type: ignore[arg-type]
                   application_note=m.application_note, applied_at=m.applied_at, decided_at=m.decided_at,
                   role_set_at=m.role_set_at)


class CommitteeWaitingPostOut(CommitteePostOut):
    thread_id: uuid.UUID
    thread_title: str


class CommitteeActivityOut(CamelModel):
    """FR-COM-009, RPT-23: one committee's activity in numbers, since `since`."""

    since: datetime
    coordinators: int
    secretaries: int
    members: int
    applications_waiting: int
    joined_recently: int
    left_recently: int
    announcements: int
    meetings_held: int
    meetings_planned: int
    minutes_approved: int
    minutes_waiting: int
    tasks_open: int
    tasks_overdue: int
    tasks_done: int
    volunteer_signups: int
    documents: int
    threads: int
    replies: int
    discussion_waiting: int

    @classmethod
    def build(cls, counts: dict[str, int], since: datetime) -> "CommitteeActivityOut":
        return cls(since=since, **counts)


class CommitteeManageOut(CamelModel):
    committee: CommitteeOut
    role: Role
    applications: list[CommitteeRosterEntryOut]
    roster: list[CommitteeRosterEntryOut]
    waiting_items: list[CommitteeItemOut]
    waiting_posts: list[CommitteeWaitingPostOut]
    recent_items: list[CommitteeItemOut]
    report: CommitteeActivityOut

    @classmethod
    def from_view(cls, view: ManageView, today: date, viewer: uuid.UUID) -> "CommitteeManageOut":
        return cls(
            committee=CommitteeOut.build(view.committee),
            role=view.role,  # type: ignore[arg-type]
            applications=[CommitteeRosterEntryOut.build(m) for m in view.applications],
            roster=[CommitteeRosterEntryOut.build(m) for m in view.roster],
            waiting_items=[CommitteeItemOut.build(i, viewer=viewer) for i in view.waiting_items],
            waiting_posts=[CommitteeWaitingPostOut(**CommitteePostOut.build(p, None).model_dump(), thread_id=p.thread_id, thread_title=title)
                           for p, title in view.waiting_posts],
            recent_items=[CommitteeItemOut.build(i, viewer=viewer, today=today) for i in view.recent_items],
            report=CommitteeActivityOut.build(view.report, view.report_since),
        )


class CommitteeApplicationDecisionIn(CamelModel):
    approve: bool
    role: Role = "member"
    reason: str | None = Field(default=None, max_length=500)


class CommitteeRoleIn(CamelModel):
    role: Role


class CommitteeReasonIn(CamelModel):
    reason: str = Field(min_length=3, max_length=500)


class CommitteeDecisionIn(CamelModel):
    approve: bool
    reason: str | None = Field(default=None, max_length=500)


class CommitteePostDecisionIn(CamelModel):
    decision: Literal["publish", "return", "hide"]
    reason: str | None = Field(default=None, max_length=500)


class CommitteeItemIn(CamelModel):
    """An announcement, meeting, minutes, task, volunteer opportunity or document (FR-COM-004 to 007)."""

    item_type: Literal["announcement", "meeting", "minutes", "task", "volunteer", "document"]
    title: str = Field(min_length=3, max_length=160)
    body: str = Field(min_length=1, max_length=8000)
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None
    place: str | None = Field(default=None, max_length=200)
    meeting_id: uuid.UUID | None = None
    due_on: date | None = None
    assignee_membership_id: uuid.UUID | None = None
    places: int | None = Field(default=None, ge=1, le=500)
    access_roles: list[Role] | None = Field(default=None, max_length=3)


class CommitteeSignupsOut(CamelModel):
    names: list[str]


# --- Administrators (D23) --------------------------------------------------------------------------------


class CommitteeAdminOut(CommitteeOut):
    area_path: list[str]
    applications: int
    proposed_at: datetime
    decided_at: datetime | None
    decision_reason: str | None
    closed_at: datetime | None
    close_reason: str | None

    @classmethod
    def build(cls, c: repository.Committee) -> "CommitteeAdminOut":  # type: ignore[override]
        return cls(**CommitteeOut.fields(c), area_path=c.area_path, applications=c.applications,  # type: ignore[arg-type]
                   proposed_at=c.proposed_at, decided_at=c.decided_at, decision_reason=c.decision_reason,
                   closed_at=c.closed_at, close_reason=c.close_reason)


class CommitteeAdminDetailOut(CamelModel):
    committee: CommitteeAdminOut
    roster: list[CommitteeRosterEntryOut]
    committees: list[CommitteeAdminOut]
    report: CommitteeActivityOut | None

    @classmethod
    def from_view(cls, view: AdminView) -> "CommitteeAdminDetailOut":
        return cls(
            committee=CommitteeAdminOut.build(view.committee),
            roster=[CommitteeRosterEntryOut.build(m) for m in view.roster],
            committees=[CommitteeAdminOut.build(c) for c in view.committees],
            report=CommitteeActivityOut.build(view.report, view.report_since) if view.report is not None else None,
        )


class CommitteeProposalIn(CamelModel):
    kind: Kind
    wing_type: WingType
    wing_id: uuid.UUID | None = None
    name_en: str = Field(min_length=3, max_length=120)
    name_ta: str = Field(min_length=3, max_length=160)
    purpose_en: str = Field(min_length=10, max_length=1000)
    purpose_ta: str = Field(min_length=10, max_length=1500)
    area: AreaRef


class CommitteeRoleGrantIn(CamelModel):
    member_code: str = Field(min_length=3, max_length=40)
    role: Role
