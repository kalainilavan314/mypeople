import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field

from app.core.schemas import CamelModel
from app.modules.content.official import rules
from app.modules.content.official.repository import Image, Publisher, Revision
from app.modules.content.official.service import CheckResult, PublicKey, SigningStatus, StatementView


def check_link(app_url: str, check_code: str) -> str:
    """The public check page in the member app (works without signing in)."""
    return f"{app_url.rstrip('/')}/check/{check_code}"


# --- Publishers and keys ------------------------------------------------------------------------------------


class PublisherIn(CamelModel):
    member_code: str = Field(min_length=3, max_length=40)
    name_en: str = Field(min_length=2, max_length=120, description="Shown on every statement: a role or office")
    name_ta: str = Field(min_length=2, max_length=120)


class RevokeIn(CamelModel):
    reason: str = Field(min_length=3, max_length=500)


class PublisherOut(CamelModel):
    id: uuid.UUID
    member_code: str
    full_name: str
    name_en: str
    name_ta: str
    state: Literal["active", "revoked"]
    registered_at: datetime
    revoked_at: datetime | None
    revoke_reason: str | None

    @classmethod
    def build(cls, p: Publisher) -> "PublisherOut":
        return cls(id=p.id, member_code=p.member_code, full_name=p.full_name, name_en=p.name_en, name_ta=p.name_ta,
                   state=p.state, registered_at=p.registered_at, revoked_at=p.revoked_at,  # type: ignore[arg-type]
                   revoke_reason=p.revoke_reason)


class SigningStatusOut(CamelModel):
    available: bool = Field(description="False while no signing key is configured (INT-24): publishing is blocked")
    key_id: str | None
    algorithm: Literal["ed25519"] = "ed25519"
    public_key: str | None
    my_publisher: PublisherOut | None = Field(description="The caller's registration; without one, signing is unavailable")

    @classmethod
    def build(cls, s: SigningStatus) -> "SigningStatusOut":
        return cls(available=s.available, key_id=s.key_id, public_key=s.public_key,
                   my_publisher=PublisherOut.build(s.publisher) if s.publisher else None)


class PublicKeyOut(CamelModel):
    key_id: str
    algorithm: Literal["ed25519"]
    public_key: str = Field(description="The raw 32-byte Ed25519 public key, base64-encoded")
    first_used_at: datetime
    current: bool

    @classmethod
    def build(cls, k: PublicKey) -> "PublicKeyOut":
        return cls(key_id=k.key.key_id, algorithm=k.key.algorithm, public_key=k.key.public_key,  # type: ignore[arg-type]
                   first_used_at=k.key.first_used_at, current=k.current)


class OfficialImageOut(CamelModel):
    id: uuid.UUID
    width: int
    height: int
    sha256: str

    @classmethod
    def build(cls, image: Image) -> "OfficialImageOut":
        return cls(id=image.id, width=image.width, height=image.height, sha256=image.sha256)


# --- Drafting, correcting, withdrawing ----------------------------------------------------------------------


class OfficialDraftIn(CamelModel):
    """A draft may be incomplete; both languages are needed before it can be signed."""

    title_en: str = Field(default="", max_length=rules.TITLE_MAX)
    title_ta: str = Field(default="", max_length=rules.TITLE_MAX)
    body_en: str = Field(default="", max_length=rules.BODY_MAX_EN)
    body_ta: str = Field(default="", max_length=rules.BODY_MAX_TA)
    image_id: uuid.UUID | None = None


class OfficialCorrectionIn(CamelModel):
    title_en: str = Field(min_length=1, max_length=rules.TITLE_MAX)
    title_ta: str = Field(min_length=1, max_length=rules.TITLE_MAX)
    body_en: str = Field(min_length=1, max_length=rules.BODY_MAX_EN)
    body_ta: str = Field(min_length=1, max_length=rules.BODY_MAX_TA)
    image_id: uuid.UUID | None = Field(default=None, description="The current image to keep it, a new one, or none")
    reason_en: str = Field(min_length=3, max_length=rules.REASON_MAX_EN, description="Shown with the correction")
    reason_ta: str = Field(min_length=3, max_length=rules.REASON_MAX_TA)


class OfficialWithdrawIn(CamelModel):
    reason_en: str = Field(min_length=3, max_length=rules.REASON_MAX_EN, description="Shown to everyone who checks it")
    reason_ta: str = Field(min_length=3, max_length=rules.REASON_MAX_TA)


# --- Statements as members, the public and publishers see them ----------------------------------------------


class OfficialRevisionOut(CamelModel):
    id: uuid.UUID
    revision: int
    title_en: str
    title_ta: str
    body_en: str
    body_ta: str
    image_id: uuid.UUID | None
    image_width: int | None
    image_height: int | None
    image_sha256: str | None
    correction_reason_en: str | None = Field(description="Null on the original; every correction says why (BR-150)")
    correction_reason_ta: str | None
    publisher_name_en: str
    publisher_name_ta: str
    published_at: datetime
    verified: bool = Field(description="The signature verifies against the published key now (BR-148)")
    key_id: str
    signature: str = Field(description="Ed25519 over signedPayload (UTF-8), base64")
    signed_payload: str

    @classmethod
    def build(cls, r: Revision, verified: bool) -> "OfficialRevisionOut":
        return cls(id=r.id, revision=r.revision, title_en=r.title_en, title_ta=r.title_ta, body_en=r.body_en,
                   body_ta=r.body_ta, image_id=r.image_id, image_width=r.image_width, image_height=r.image_height,
                   image_sha256=r.image_sha256, correction_reason_en=r.correction_reason_en,
                   correction_reason_ta=r.correction_reason_ta, publisher_name_en=r.publisher_name_en,
                   publisher_name_ta=r.publisher_name_ta, published_at=r.published_at, verified=verified,
                   key_id=r.key_id, signature=r.signature, signed_payload=r.signed_payload)


class OfficialStatementOut(CamelModel):
    """M47: the latest revision of a published or withdrawn statement, and its history."""

    id: uuid.UUID
    check_code: str
    check_link: str
    state: Literal["published", "withdrawn"]
    signed: bool = Field(description='Every revision verifies; only then is it labelled "Official statement" (FR-AUT-003)')
    first_published_at: datetime
    last_published_at: datetime
    revision_count: int
    latest: OfficialRevisionOut
    withdrawn_at: datetime | None
    withdrawal_reason_en: str | None
    withdrawal_reason_ta: str | None

    @classmethod
    def build(cls, view: StatementView, app_url: str) -> "OfficialStatementOut":
        s = view.statement
        assert s.check_code is not None and view.revisions
        latest = view.revisions[-1]
        return cls(id=s.id, check_code=s.check_code, check_link=check_link(app_url, s.check_code),
                   state=s.state, signed=view.all_verified,  # type: ignore[arg-type]
                   first_published_at=view.revisions[0].published_at, last_published_at=latest.published_at,
                   revision_count=len(view.revisions), latest=OfficialRevisionOut.build(latest, view.verified[latest.id]),
                   withdrawn_at=s.withdrawn_at, withdrawal_reason_en=s.withdrawal_reason_en,
                   withdrawal_reason_ta=s.withdrawal_reason_ta)


class OfficialStatementFileOut(OfficialStatementOut):
    revisions: list[OfficialRevisionOut] = Field(description="Oldest first; the original is never changed (BR-150)")

    @classmethod
    def from_view(cls, view: StatementView, app_url: str) -> "OfficialStatementFileOut":
        return cls(**OfficialStatementOut.build(view, app_url).model_dump(),
                   revisions=[OfficialRevisionOut.build(r, view.verified[r.id]) for r in view.revisions])


class OfficialCheckOut(CamelModel):
    """FR-AUT-005: what a check by code or link says. Nothing about the person checking is kept."""

    check_code: str | None = Field(description="The code as understood, or null when the text held none")
    status: Literal["verified", "withdrawn", "not_verified"]
    problem: Literal["no_matching_record", "signature_invalid"] | None
    statement: OfficialStatementFileOut | None = Field(description="Only for a verified or withdrawn record")

    @classmethod
    def build(cls, result: CheckResult, app_url: str) -> "OfficialCheckOut":
        return cls(check_code=result.check_code, status=result.status, problem=result.problem,
                   statement=OfficialStatementFileOut.from_view(result.view, app_url) if result.view else None)


class ManagedStatementOut(CamelModel):
    """D30: a statement as publishers see it: the draft while it is one, then its signed revisions."""

    id: uuid.UUID
    statement_ref: str
    check_code: str | None
    check_link: str | None
    state: Literal["draft", "published", "withdrawn"]
    draft_title_en: str
    draft_title_ta: str
    draft_body_en: str
    draft_body_ta: str
    draft_image_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    withdrawn_at: datetime | None
    withdrawal_reason_en: str | None
    withdrawal_reason_ta: str | None
    signed: bool
    revisions: list[OfficialRevisionOut]

    @classmethod
    def build(cls, view: StatementView, app_url: str) -> "ManagedStatementOut":
        s = view.statement
        return cls(id=s.id, statement_ref=s.statement_ref, check_code=s.check_code,
                   check_link=check_link(app_url, s.check_code) if s.check_code else None, state=s.state,  # type: ignore[arg-type]
                   draft_title_en=s.draft_title_en, draft_title_ta=s.draft_title_ta, draft_body_en=s.draft_body_en,
                   draft_body_ta=s.draft_body_ta, draft_image_id=s.draft_image_id, created_at=s.created_at,
                   updated_at=s.updated_at, withdrawn_at=s.withdrawn_at, withdrawal_reason_en=s.withdrawal_reason_en,
                   withdrawal_reason_ta=s.withdrawal_reason_ta, signed=view.all_verified,
                   revisions=[OfficialRevisionOut.build(r, view.verified[r.id]) for r in view.revisions])
