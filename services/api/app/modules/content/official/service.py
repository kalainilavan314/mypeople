"""Official content: publishers, signing, corrections, withdrawal and public checks
(BRD D30, M47, M48 check part; FR-AUT-001 to 005, 009; BR-148, BR-150; INT-22, INT-24).

Tier 5 registers approved publisher identities (FR-AUT-001); a registered holder of
content.sign_publish signs each statement and its image and publishes it with a public check code
(FR-AUT-002). Nobody registers themselves [ASSUMPTION]: a second person vouches for every official
voice. Without a configured key, or without a registration, signing is unavailable. A correction
is a new signed revision with its reason; earlier revisions stay (BR-150). Withdrawing keeps the
record and says so to everyone who checks it.

Statements reach every area, so a silence window declared anywhere blocks publishing and
corrections (NFR-ELC-03): [ASSUMPTION] until the election-mode policy (POL-12) says otherwise,
an official statement counts as political publishing. Withdrawing stays possible.

Every signature is checked again whenever a statement is shown or checked; the "Official
statement" label depends on that check, not on a stored flag (BR-148, FR-AUT-003).
"""

import hashlib
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.modules.access import repository as access_repository
from app.modules.access import rules as access_rules
from app.modules.access import service as access
from app.modules.access.service import AccessRefused, Staff
from app.modules.audit import service as audit
from app.modules.content.gallery import images
from app.modules.content.gallery.media_store import MediaStore, PhotoMissing
from app.modules.content.official import repository, rules, signing
from app.modules.content.official.check_limiter import CheckLimiter
from app.modules.content.official.repository import Image, Publisher, Revision, SigningKey, Statement
from app.modules.content.official.rules import REGISTER, SIGN_PUBLISH, SignedFields, StatementText
from app.modules.content.official.signing import Signer
from app.modules.election import service as election


class OfficialNotFound(Exception):
    pass


class OfficialRefused(Exception):
    def __init__(self, problems: list[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else problems
        super().__init__(", ".join(self.problems))


class SigningUnavailable(Exception):
    """No signing key is configured (INT-24): nothing can be published as official."""


class TooManyChecks(Exception):
    def __init__(self, retry_after: int) -> None:
        super().__init__("too_many_requests")
        self.retry_after = retry_after


def _now() -> datetime:
    return datetime.now(UTC)


def _can_sign(staff: Staff) -> bool:
    # PRM-57 has platform scope whatever the tier of the assignment that holds it (BRD §9.8).
    return access_rules.holds(staff.rule_assignments(), SIGN_PUBLISH)


def _can_register(staff: Staff) -> bool:
    return access.has_platform_permission(staff, REGISTER)


def _require_sign(staff: Staff) -> None:
    if not _can_sign(staff):
        raise AccessRefused("forbidden")


def _audit(db: Session, staff: Staff, action: str, target: tuple[str, str], ip: str, **details: object) -> None:
    audit.record(db, actor_id=staff.member_id, action=action, target_type=target[0], target_id=target[1],
                 details=details or None, ip=ip)


# --- Signing status and public keys -------------------------------------------------------------------------


@dataclass(frozen=True)
class SigningStatus:
    available: bool
    key_id: str | None
    public_key: str | None
    publisher: Publisher | None  # the caller's own registration, if any


def signing_status(db: Session, signer: Signer | None, staff: Staff) -> SigningStatus:
    return SigningStatus(
        available=signer is not None,
        key_id=signer.key_id if signer else None,
        public_key=signer.public_key if signer else None,
        publisher=repository.active_publisher_for(db, staff.member_id),
    )


@dataclass(frozen=True)
class PublicKey:
    key: SigningKey
    current: bool


def public_keys(db: Session, signer: Signer | None) -> list[PublicKey]:
    """Every key that has signed something, and the current one even before its first signature."""
    found = repository.keys(db)
    listed = [PublicKey(k, signer is not None and k.key_id == signer.key_id) for k in found]
    if signer is not None and all(k.key_id != signer.key_id for k in found):
        listed.append(PublicKey(SigningKey(signer.key_id, signing.ALGORITHM, signer.public_key, _now()), True))
    return listed


# --- Publishers (Tier 5, FR-AUT-001) ------------------------------------------------------------------------


def publishers(db: Session, staff: Staff) -> list[Publisher]:
    if not _can_register(staff):
        raise AccessRefused("platform_scope_required")
    return repository.publishers(db)


def register_publisher(db: Session, staff: Staff, member_code: str, name_en: str, name_ta: str, ip: str) -> Publisher:
    if not _can_register(staff):
        raise AccessRefused("platform_scope_required")
    found = access_repository.resolve_member_by_code(db, member_code)
    if found is None:
        raise OfficialRefused("member_not_found")
    member_id = found[0]
    if member_id == staff.member_id:
        access.refuse(db, staff, REGISTER, "own_record", ip, target=("official_publisher", "new"), area_path=None)
    if not _can_sign(access.load_staff(db, member_id)):
        raise OfficialRefused("needs_sign_publish_permission")
    if repository.active_publisher_for(db, member_id) is not None:
        raise OfficialRefused("already_registered")
    publisher_id = repository.insert_publisher(db, member_id, name_en.strip(), name_ta.strip(), staff.member_id)
    _audit(db, staff, "content.publisher.registered", ("official_publisher", str(publisher_id)), ip)
    db.commit()
    registered = repository.find_publisher(db, publisher_id)
    assert registered is not None
    return registered


def revoke_publisher(db: Session, staff: Staff, publisher_id: uuid.UUID, reason: str, ip: str) -> Publisher:
    if not _can_register(staff):
        raise AccessRefused("platform_scope_required")
    found = repository.find_publisher(db, publisher_id, lock=True)
    if found is None:
        raise OfficialNotFound()
    if found.state != "active":
        raise OfficialRefused("already_revoked")
    repository.revoke_publisher(db, publisher_id, staff.member_id, reason.strip())
    _audit(db, staff, "content.publisher.revoked", ("official_publisher", str(publisher_id)), ip)
    db.commit()
    revoked = repository.find_publisher(db, publisher_id)
    assert revoked is not None
    return revoked


# --- Images -------------------------------------------------------------------------------------------------


def save_image(db: Session, store: MediaStore, staff: Staff, data: bytes) -> Image:
    """Re-encoded as WebP without metadata, like gallery photos; the display size is what is signed."""
    _require_sign(staff)
    try:
        prepared = images.prepare(data)
    except images.ImageRejected as error:
        raise OfficialRefused(error.code) from None
    image_id = uuid.uuid4()
    store.save(image_id, "display", prepared.display)
    store.save(image_id, "thumb", prepared.thumb)
    digest = hashlib.sha256(prepared.display).hexdigest()
    repository.insert_image(db, image_id, staff.member_id, digest, len(prepared.display), prepared.width, prepared.height)
    db.commit()
    saved = repository.find_image(db, image_id)
    assert saved is not None
    return saved


def image_bytes(db: Session, store: MediaStore, image_id: uuid.UUID, size: str, staff: Staff | None = None) -> bytes:
    """Anyone may load an image a published revision carries; a draft's image only publishers and Tier 5."""
    if staff is not None:
        if not (_can_sign(staff) or _can_register(staff)) or repository.find_image(db, image_id) is None:
            raise OfficialNotFound()
    elif not repository.image_is_public(db, image_id):
        raise OfficialNotFound()
    try:
        return store.read(image_id, size)
    except PhotoMissing:
        raise OfficialNotFound() from None


# --- Drafts (D30) -------------------------------------------------------------------------------------------


def _draft_values(db: Session, values: dict[str, Any]) -> dict[str, Any]:
    image_id = values.get("image_id")
    if image_id is not None and repository.find_image(db, image_id) is None:
        raise OfficialRefused("image_not_found")
    return {
        "title_en": (values.get("title_en") or "").strip(),
        "title_ta": (values.get("title_ta") or "").strip(),
        "body_en": (values.get("body_en") or "").strip(),
        "body_ta": (values.get("body_ta") or "").strip(),
        "image_id": image_id,
    }


def create_draft(db: Session, staff: Staff, values: dict[str, Any], ip: str) -> Statement:
    _require_sign(staff)
    statement_id = repository.insert_statement(db, _draft_values(db, values), staff.member_id)
    _audit(db, staff, "content.official.drafted", ("official_statement", str(statement_id)), ip)
    db.commit()
    return _reload(db, statement_id)


def update_draft(db: Session, staff: Staff, statement_id: uuid.UUID, values: dict[str, Any]) -> Statement:
    _require_sign(staff)
    found = repository.find_statement(db, statement_id, lock=True)
    if found is None:
        raise OfficialNotFound()
    problem = rules.check_draftable(found.state)
    if problem:
        raise OfficialRefused(problem)
    repository.update_draft(db, statement_id, _draft_values(db, values))
    db.commit()
    return _reload(db, statement_id)


def _reload(db: Session, statement_id: uuid.UUID) -> Statement:
    found = repository.find_statement(db, statement_id)
    assert found is not None
    return found


# --- Signing and publishing (FR-AUT-002, BR-150) ------------------------------------------------------------


def _registered(db: Session, staff: Staff, target: tuple[str, str], ip: str) -> Publisher:
    """FR-AUT-001: an author who is not a registered publisher cannot sign (refusal audited)."""
    _require_sign(staff)
    publisher = repository.active_publisher_for(db, staff.member_id)
    if publisher is None:
        access.refuse(db, staff, SIGN_PUBLISH, "not_a_registered_publisher", ip, target=target, area_path=None)
    return publisher


def _refuse_if_silent(db: Session, staff: Staff, action: str, target: tuple[str, str], ip: str) -> None:
    now = _now()
    # Every declared period's area path starts at "platform", so this matches a silence window anywhere.
    election.refuse_if_silent(db, staff, action=action, target=target, area_path=["platform"], spans=[(now, now)], ip=ip)


def _new_code(db: Session) -> str:
    for _ in range(5):
        code = rules.new_check_code()
        if not repository.code_taken(db, code):
            return code
    raise RuntimeError("could not find a free check code")  # 32^8 codes: not expected to happen


def _sign_revision(
    db: Session,
    signer: Signer,
    statement: Statement,
    check_code: str,
    revision: int,
    text: StatementText,
    image: Image | None,
    reasons: tuple[str | None, str | None],
    publisher: Publisher,
) -> None:
    published_at = _now()
    repository.record_key(db, signer.key_id, signing.ALGORITHM, signer.public_key)
    fields = SignedFields(
        statement_ref=statement.statement_ref, check_code=check_code, revision=revision, text=text,
        image_sha256=image.sha256 if image else None, correction_reason_en=reasons[0], correction_reason_ta=reasons[1],
        publisher_id=str(publisher.id), publisher_name_en=publisher.name_en, publisher_name_ta=publisher.name_ta,
        key_id=signer.key_id, published_at=published_at,
    )
    payload = rules.signed_payload(fields)
    repository.insert_revision(db, {
        "statement_id": statement.id, "revision": revision, "title_en": text.title_en, "title_ta": text.title_ta,
        "body_en": text.body_en, "body_ta": text.body_ta, "image_id": image.id if image else None,
        "image_sha256": image.sha256 if image else None, "correction_reason_en": reasons[0],
        "correction_reason_ta": reasons[1], "publisher_id": publisher.id, "key_id": signer.key_id,
        "signed_payload": payload, "signature": signer.sign(payload.encode("utf-8")), "published_at": published_at,
    })


def publish(db: Session, signer: Signer | None, staff: Staff, statement_id: uuid.UUID, ip: str) -> Statement:
    target = ("official_statement", str(statement_id))
    if signer is None:
        raise SigningUnavailable()
    publisher = _registered(db, staff, target, ip)
    # Before the row is locked: a silence refusal commits its audit record.
    _refuse_if_silent(db, staff, "content.official.publish", target, ip)
    found = repository.find_statement(db, statement_id, lock=True)
    if found is None:
        raise OfficialNotFound()
    problem = rules.check_draftable(found.state)
    if problem:
        raise OfficialRefused(problem)
    text = StatementText(found.draft_title_en, found.draft_title_ta, found.draft_body_en, found.draft_body_ta)
    problems = rules.check_publishable(text)
    if problems:
        raise OfficialRefused(problems)
    image = repository.find_image(db, found.draft_image_id) if found.draft_image_id else None
    check_code = _new_code(db)
    _sign_revision(db, signer, found, check_code, 1, text, image, (None, None), publisher)
    repository.set_published(db, statement_id, check_code)
    _audit(db, staff, "content.official.published", target, ip, revision=1, keyId=signer.key_id,
           publisherId=str(publisher.id))
    db.commit()
    return _reload(db, statement_id)


def correct(db: Session, signer: Signer | None, staff: Staff, statement_id: uuid.UUID, values: dict[str, Any],
            ip: str) -> Statement:
    """A new signed revision with its reason, appended; the earlier ones stay as they were (BR-150)."""
    target = ("official_statement", str(statement_id))
    if signer is None:
        raise SigningUnavailable()
    publisher = _registered(db, staff, target, ip)
    _refuse_if_silent(db, staff, "content.official.correct", target, ip)
    found = repository.find_statement(db, statement_id, lock=True)
    if found is None:
        raise OfficialNotFound()
    problem = rules.check_correctable(found.state)
    if problem:
        raise OfficialRefused(problem)
    draft = _draft_values(db, values)
    text = StatementText(draft["title_en"], draft["title_ta"], draft["body_en"], draft["body_ta"])
    problems = rules.check_publishable(text)
    if problems:
        raise OfficialRefused(problems)
    latest = repository.revisions(db, [statement_id])[-1]
    if (text, draft["image_id"]) == (StatementText(latest.title_en, latest.title_ta, latest.body_en, latest.body_ta),
                                     latest.image_id):
        raise OfficialRefused("nothing_changed")
    image = repository.find_image(db, draft["image_id"]) if draft["image_id"] else None
    assert found.check_code is not None
    reasons = (values["reason_en"].strip(), values["reason_ta"].strip())
    _sign_revision(db, signer, found, found.check_code, latest.revision + 1, text, image, reasons, publisher)
    repository.touch(db, statement_id)
    _audit(db, staff, "content.official.corrected", target, ip, revision=latest.revision + 1, keyId=signer.key_id,
           publisherId=str(publisher.id))
    db.commit()
    return _reload(db, statement_id)


def withdraw(db: Session, staff: Staff, statement_id: uuid.UUID, reason_en: str, reason_ta: str, ip: str) -> Statement:
    """By a registered publisher or Tier 5. The record stays; every check then says "withdrawn" and why."""
    target = ("official_statement", str(statement_id))
    if not _can_register(staff):
        _registered(db, staff, target, ip)
    found = repository.find_statement(db, statement_id, lock=True)
    if found is None:
        raise OfficialNotFound()
    problem = rules.check_correctable(found.state)
    if problem:
        raise OfficialRefused(problem)
    repository.set_withdrawn(db, statement_id, staff.member_id, reason_en.strip(), reason_ta.strip())
    _audit(db, staff, "content.official.withdrawn", target, ip)
    db.commit()
    return _reload(db, statement_id)


# --- Reading and checking (M47, M48, INT-22) ----------------------------------------------------------------


def revision_verifies(statement: Statement, revision: Revision) -> bool:
    """The stored payload is exactly what the revision's own columns say, and its signature verifies
    against the recorded public key. Any change to the record breaks one or the other."""
    if statement.check_code is None:
        return False
    expected = rules.signed_payload(SignedFields(
        statement_ref=statement.statement_ref, check_code=statement.check_code, revision=revision.revision,
        text=StatementText(revision.title_en, revision.title_ta, revision.body_en, revision.body_ta),
        image_sha256=revision.image_sha256, correction_reason_en=revision.correction_reason_en,
        correction_reason_ta=revision.correction_reason_ta, publisher_id=str(revision.publisher_id),
        publisher_name_en=revision.publisher_name_en, publisher_name_ta=revision.publisher_name_ta,
        key_id=revision.key_id, published_at=revision.published_at,
    ))
    return expected == revision.signed_payload and signing.verify(
        revision.public_key, revision.signed_payload.encode("utf-8"), revision.signature
    )


@dataclass(frozen=True)
class StatementView:
    statement: Statement
    revisions: list[Revision]  # oldest first
    verified: dict[uuid.UUID, bool]  # by revision id

    @property
    def all_verified(self) -> bool:
        return bool(self.revisions) and all(self.verified.values())


def _views(db: Session, found: list[Statement]) -> list[StatementView]:
    revisions = repository.revisions(db, [s.id for s in found])
    views = []
    for statement in found:
        own = [r for r in revisions if r.statement_id == statement.id]
        views.append(StatementView(statement, own, {r.id: revision_verifies(statement, r) for r in own}))
    return views


def managed(db: Session, staff: Staff, states: list[str], limit: int) -> list[StatementView]:
    if not (_can_sign(staff) or _can_register(staff)):
        raise AccessRefused("forbidden")
    return _views(db, repository.statements(db, states, limit))


def staff_view(db: Session, staff: Staff, statement_id: uuid.UUID) -> StatementView:
    if not (_can_sign(staff) or _can_register(staff)):
        raise AccessRefused("forbidden")
    found = repository.find_statement(db, statement_id)
    if found is None:
        raise OfficialNotFound()
    return _views(db, [found])[0]


def published(db: Session, limit: int) -> list[StatementView]:
    """M47: published and withdrawn statements, latest change first. Drafts never leave the dashboard."""
    return _views(db, repository.statements(db, ["published", "withdrawn"], limit))


def member_view(db: Session, statement_id: uuid.UUID) -> StatementView:
    found = repository.find_statement(db, statement_id)
    if found is None or found.state == "draft":
        raise OfficialNotFound()
    return _views(db, [found])[0]


@dataclass(frozen=True)
class CheckResult:
    check_code: str | None  # as understood from what was typed, or None when it held no code
    status: rules.CheckStatus
    problem: rules.CheckProblem | None
    view: StatementView | None  # only for a verified or withdrawn record


def check(db: Session, limiter: CheckLimiter, raw: str, ip: str) -> CheckResult:
    """FR-AUT-005: verified, withdrawn, or not verified ("No matching official record"). Open to anyone,
    rate-limited by address (INT-22); nothing about the person checking is stored."""
    wait = limiter.wait_needed(ip)
    if wait is not None:
        raise TooManyChecks(wait)
    code = rules.normalise_check_code(raw)
    found = repository.find_by_code(db, code) if code else None
    view = _views(db, [found])[0] if found is not None and found.state != "draft" else None
    status, problem = rules.check_status(found.state if view else None, view.all_verified if view else False)
    return CheckResult(code, status, problem, view if status != "not_verified" else None)
