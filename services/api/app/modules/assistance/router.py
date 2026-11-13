"""Community Support / சமூக உதவி (BRD M11 to M14, S11, S12, D13, D14, FR-AST-001 to 013): /v1/assistance."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.request_info import client_ip
from app.db.session import get_db
from app.modules.access.dependencies import require_permission
from app.modules.access.rules import Area
from app.modules.access.service import AccessRefused, Staff
from app.modules.assistance import repository, rules, service
from app.modules.assistance.schemas import (
    ActiveIn,
    AppealDecisionIn,
    AppealIn,
    SupportAppealOut,
    SupportAssignIn,
    CaseNoteIn,
    CaseworkerOut,
    SupportCloseIn,
    CriteriaIn,
    DecisionIn,
    DeliveryIn,
    EmergencyContactOut,
    IntakeIn,
    SupportLinkIn,
    MyRequestOut,
    MyRequestSummaryOut,
    PartnerIn,
    PartnerOut,
    ProgrammeIn,
    ProgrammeOut,
    PublicReceiptOut,
    PublicSupportFormOut,
    PublicSupportStatisticsOut,
    ReferralConsentIn,
    ReferralIn,
    ReferralUpdateIn,
    StaffCaseFileOut,
    StaffCaseSummaryOut,
    StatisticsOut,
    SupportHomeOut,
    SupportRequestIn,
)
from app.modules.auth.dependencies import CurrentMember
from app.modules.features.dependencies import require_feature

Db = Annotated[Session, Depends(get_db)]
SupportStaff = Annotated[Staff, Depends(require_permission(rules.INTAKE, rules.CASEWORK, rules.DECIDE))]
Intake = Annotated[Staff, Depends(require_permission(rules.INTAKE))]
Decider = Annotated[Staff, Depends(require_permission(rules.DECIDE))]
ProgrammeManager = Annotated[Staff, Depends(require_permission(rules.PROGRAMMES))]
StatisticsReader = Annotated[Staff, Depends(require_permission(rules.DECIDE, rules.PROGRAMMES))]

router = APIRouter(prefix="/v1/assistance", tags=["assistance"], dependencies=[Depends(require_feature("community_support"))])


@contextmanager
def _answers() -> Iterator[None]:
    try:
        yield
    except AccessRefused as error:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=error.code) from None
    except service.SupportNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="not_found") from None
    except service.SupportRefused as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail={"code": "support_refused", "problems": error.problems}
        ) from None


def _request(body: SupportRequestIn) -> service.NewRequest:
    return service.NewRequest(
        category=body.category, summary=body.summary, emergency=body.emergency, consent=body.consent,
        full_name=body.full_name, phone=body.phone, household=body.household,
        area=Area(body.area.level, body.area.code) if body.area else None,
    )


def _emergency_contacts() -> list[EmergencyContactOut]:
    return [EmergencyContactOut(number=n, name_en=en, name_ta=ta) for n, en, ta in rules.EMERGENCY_CONTACTS]


# --- Applicants ---------------------------------------------------------------------------------------


@router.get("", response_model=SupportHomeOut)
def support_home(member: CurrentMember, db: Db) -> SupportHomeOut:
    """M11: emergency numbers first, the ten categories, and the member's own requests."""
    return SupportHomeOut(
        emergency_contacts=_emergency_contacts(),
        categories=list(rules.CATEGORIES),
        requests=[MyRequestSummaryOut.build(c) for c in service.my_requests(db, member.id)],
    )


@router.post("/requests", status_code=status.HTTP_201_CREATED, response_model=MyRequestOut)
def request_support(body: SupportRequestIn, member: CurrentMember, request: Request, db: Db) -> MyRequestOut:
    """M12: needs no membership; consent to collect the case information is required."""
    with _answers():
        case = service.request_in_app(db, member.id, _request(body), client_ip(request))
        return MyRequestOut.from_view(service.my_request(db, member.id, case.id))


@router.get("/public-form", response_model=PublicSupportFormOut)
def public_form() -> PublicSupportFormOut:
    """S11 public web form, no account needed: the official emergency numbers first, then the categories."""
    return PublicSupportFormOut(
        emergency_contacts=_emergency_contacts(),
        categories=list(rules.CATEGORIES),
    )


@router.post("/public-requests", status_code=status.HTTP_201_CREATED, response_model=PublicReceiptOut)
def request_support_publicly(body: SupportRequestIn, request: Request, db: Db) -> PublicReceiptOut:
    """The public web form for people without an account: answers only the AS- reference."""
    with _answers():
        return PublicReceiptOut(case_ref=service.request_public(db, _request(body), client_ip(request)).case_ref)


@router.get("/statistics", response_model=PublicSupportStatisticsOut)
def public_statistics(db: Db) -> PublicSupportStatisticsOut:
    """D14, no account needed: requests by district and kind of help only; groups under 10 hidden (FR-AST-012)."""
    return PublicSupportStatisticsOut.build(service.public_statistics(db))


@router.get("/requests/{case_id}", response_model=MyRequestOut)
def read_my_request(case_id: uuid.UUID, member: CurrentMember, db: Db) -> MyRequestOut:
    """M13: status, decisions with reasons, help delivered and appeals."""
    with _answers():
        return MyRequestOut.from_view(service.my_request(db, member.id, case_id))


@router.post("/requests/{case_id}/appeals", status_code=status.HTTP_201_CREATED, response_model=SupportAppealOut)
def appeal(case_id: uuid.UUID, body: AppealIn, member: CurrentMember, request: Request, db: Db) -> SupportAppealOut:
    """M14: one complaint or appeal per decision."""
    with _answers():
        return SupportAppealOut.build(service.appeal(db, member.id, case_id, body.decision_id, body.kind, body.body, client_ip(request)))


@router.post("/requests/{case_id}/referrals/{referral_id}/consent", response_model=MyRequestOut)
def answer_referral(case_id: uuid.UUID, referral_id: uuid.UUID, body: ReferralConsentIn, member: CurrentMember, request: Request,
                    db: Db) -> MyRequestOut:
    """M12: the applicant agrees that this partner may see the request (it is then sent), or refuses; once."""
    with _answers():
        service.answer_referral(db, member.id, case_id, referral_id, body.consent, client_ip(request))
        return MyRequestOut.from_view(service.my_request(db, member.id, case_id))


# --- Staff ----------------------------------------------------------------------------------------------


@router.get("/manage/cases", response_model=list[StaffCaseSummaryOut])
def staff_queue(
    staff: SupportStaff, db: Db,
    state: Annotated[list[Literal["screening", "assessment", "decided", "closed", "withdrawn"]] | None, Query()] = None,
) -> list[StaffCaseSummaryOut]:
    with _answers():
        return [StaffCaseSummaryOut.build(c) for c in service.queue(db, staff, list(state) if state else None)]


@router.post("/manage/intake", status_code=status.HTTP_201_CREATED, response_model=StaffCaseSummaryOut)
def intake(body: IntakeIn, staff: Intake, request: Request, db: Db) -> StaffCaseSummaryOut:
    """S11: a hotline call or partner referral, without needing membership."""
    with _answers():
        return StaffCaseSummaryOut.build(service.intake(db, staff, _request(body), body.channel, body.partner_id, client_ip(request)))


@router.get("/manage/cases/{case_id}", response_model=StaffCaseFileOut)
def read_case(case_id: uuid.UUID, staff: SupportStaff, request: Request, db: Db) -> StaffCaseFileOut:
    """S12: the full file only for the assigned caseworker and decision-makers; intake staff get the summary of a
    case waiting for screening (fullFile false). Every opening is audited."""
    with _answers():
        return StaffCaseFileOut.from_file(service.case_file(db, staff, case_id, client_ip(request)))


def _after(db: Session, staff: Staff, case_id: uuid.UUID, ip: str) -> StaffCaseFileOut:
    return StaffCaseFileOut.from_file(service.case_file(db, staff, case_id, ip, audited=False))


@router.get("/manage/cases/{case_id}/caseworkers", response_model=list[CaseworkerOut])
def list_caseworkers(case_id: uuid.UUID, staff: SupportStaff, request: Request, db: Db) -> list[CaseworkerOut]:
    with _answers():
        return [CaseworkerOut(member_id=m, full_name=n) for m, n in service.caseworkers(db, staff, case_id, client_ip(request))]


@router.post("/manage/cases/{case_id}/assign", response_model=StaffCaseFileOut)
def assign(case_id: uuid.UUID, body: SupportAssignIn, staff: SupportStaff, request: Request, db: Db) -> StaffCaseFileOut:
    """Intake staff route a case waiting for screening and get its summary back; decision-makers may reassign."""
    with _answers():
        return StaffCaseFileOut.from_file(service.assign(db, staff, case_id, body.caseworker_id, client_ip(request)))


@router.post("/manage/cases/{case_id}/link", response_model=StaffCaseFileOut)
def link(case_id: uuid.UUID, body: SupportLinkIn, staff: SupportStaff, request: Request, db: Db) -> StaffCaseFileOut:
    ip = client_ip(request)
    with _answers():
        service.link(db, staff, case_id, body.other_case_id, ip)
        return _after(db, staff, case_id, ip)


@router.post("/manage/cases/{case_id}/notes", response_model=StaffCaseFileOut)
def add_note(case_id: uuid.UUID, body: CaseNoteIn, staff: SupportStaff, request: Request, db: Db) -> StaffCaseFileOut:
    ip = client_ip(request)
    with _answers():
        service.add_note(db, staff, case_id, body.body, ip)
        return _after(db, staff, case_id, ip)


@router.post("/manage/cases/{case_id}/decision", response_model=StaffCaseFileOut)
def decide(case_id: uuid.UUID, body: DecisionIn, staff: Decider, request: Request, db: Db) -> StaffCaseFileOut:
    """FR-AST-008: against the published criteria version, with reasons in both languages."""
    ip = client_ip(request)
    with _answers():
        service.decide(db, staff, case_id, body.outcome, body.criteria_version_id, body.reason_en, body.reason_ta, ip)
        return _after(db, staff, case_id, ip)


@router.post("/manage/cases/{case_id}/deliveries", response_model=StaffCaseFileOut)
def record_delivery(case_id: uuid.UUID, body: DeliveryIn, staff: SupportStaff, request: Request, db: Db) -> StaffCaseFileOut:
    ip = client_ip(request)
    with _answers():
        service.record_delivery(db, staff, case_id, body.kind, body.amount, body.delivered_on, body.provider, body.evidence, ip)
        return _after(db, staff, case_id, ip)


@router.post("/manage/cases/{case_id}/referrals", response_model=StaffCaseFileOut)
def refer(case_id: uuid.UUID, body: ReferralIn, staff: SupportStaff, request: Request, db: Db) -> StaffCaseFileOut:
    """M12: proposed to an applicant with an app account, who answers there; sent at once with the consent the
    caseworker records for anyone else."""
    ip = client_ip(request)
    with _answers():
        service.refer(db, staff, case_id, body.partner_id, body.purpose, body.consent, ip)
        return _after(db, staff, case_id, ip)


@router.post("/manage/cases/{case_id}/referrals/{referral_id}", response_model=StaffCaseFileOut)
def update_referral(case_id: uuid.UUID, referral_id: uuid.UUID, body: ReferralUpdateIn, staff: SupportStaff, request: Request,
                    db: Db) -> StaffCaseFileOut:
    ip = client_ip(request)
    with _answers():
        service.update_referral(db, staff, case_id, referral_id, body.state, body.outcome, ip)
        return _after(db, staff, case_id, ip)


@router.post("/manage/cases/{case_id}/close", response_model=StaffCaseFileOut)
def close(case_id: uuid.UUID, body: SupportCloseIn, staff: SupportStaff, request: Request, db: Db) -> StaffCaseFileOut:
    ip = client_ip(request)
    with _answers():
        service.close(db, staff, case_id, body.note, ip)
        return _after(db, staff, case_id, ip)


@router.get("/manage/appeals", response_model=list[SupportAppealOut])
def open_appeals(staff: Decider, db: Db) -> list[SupportAppealOut]:
    with _answers():
        return [SupportAppealOut.build(a) for a in service.open_appeals(db, staff)]


@router.post("/manage/appeals/{appeal_id}/decision", status_code=status.HTTP_204_NO_CONTENT)
def decide_appeal(appeal_id: uuid.UUID, body: AppealDecisionIn, staff: Decider, request: Request, db: Db) -> None:
    """FR-AST-011: never by the person whose decision is appealed (403 original_decider)."""
    with _answers():
        service.decide_appeal(db, staff, appeal_id, body.change, body.reason, body.outcome, body.criteria_version_id,
                              body.reason_ta, client_ip(request))


@router.get("/manage/programmes", response_model=list[ProgrammeOut])
def list_programmes(staff: SupportStaff, db: Db) -> list[ProgrammeOut]:
    """Programmes with their current criteria version, for decisions and D14."""
    return [ProgrammeOut.build(p) for p in repository.programmes(db, active_only=False)]


@router.post("/manage/programmes", status_code=status.HTTP_201_CREATED, response_model=ProgrammeOut)
def create_programme(body: ProgrammeIn, staff: ProgrammeManager, request: Request, db: Db) -> ProgrammeOut:
    with _answers():
        return ProgrammeOut.build(service.create_programme(db, staff, body.model_dump(), client_ip(request)))


@router.post("/manage/programmes/{programme_id}/criteria", response_model=ProgrammeOut)
def publish_criteria(programme_id: uuid.UUID, body: CriteriaIn, staff: ProgrammeManager, request: Request, db: Db) -> ProgrammeOut:
    with _answers():
        return ProgrammeOut.build(service.publish_criteria(db, staff, programme_id, body.criteria_en, body.criteria_ta,
                                                           client_ip(request)))


@router.post("/manage/programmes/{programme_id}/active", status_code=status.HTTP_204_NO_CONTENT)
def set_programme_active(programme_id: uuid.UUID, body: ActiveIn, staff: ProgrammeManager, request: Request, db: Db) -> None:
    with _answers():
        service.set_programme_active(db, staff, programme_id, body.active, client_ip(request))


@router.get("/manage/partners", response_model=list[PartnerOut])
def list_partners(staff: SupportStaff, db: Db) -> list[PartnerOut]:
    return [PartnerOut.build(p) for p in repository.partners(db, active_only=False)]


@router.post("/manage/partners", status_code=status.HTTP_201_CREATED, response_model=PartnerOut)
def add_partner(body: PartnerIn, staff: ProgrammeManager, request: Request, db: Db) -> PartnerOut:
    with _answers():
        return PartnerOut.build(service.add_partner(db, staff, body.name, body.kind, body.contact, client_ip(request)))


@router.get("/manage/statistics", response_model=StatisticsOut)
def statistics(staff: StatisticsReader, db: Db) -> StatisticsOut:
    """FR-AST-012: counts only, minimum cell 10, also by subtraction."""
    with _answers():
        return StatisticsOut.build(service.statistics(db, staff))
