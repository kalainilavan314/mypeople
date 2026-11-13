'use server';

import type { ApiClient, CaseFindingKind, CaseReporterContact, GalleryImageType } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import {
  closingProblems,
  readChallengeDecision,
  readDistrictDecision,
  readExecutiveDecision,
  readForward,
  readPublicSummary,
  text,
  uuidOrNull,
  valuesOf,
  type CaseFormState,
} from '@/features/cases/forms';
import { evidenceRefsFrom, isFindingKind } from '@/features/cases/stages';
import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';
import { requireStaff } from '@/lib/staff';

// Every case action (W03 to W08). The API checks the permission, the area, the stage and the
// viewer's tier again on each call; a refusal comes back to the form with what was typed.
// Only the case id and a confirmation code travel in the address, never what was typed.

const UUID = /^[0-9a-f-]{36}$/i;
const MAX_PHOTOS = 6;
const PHOTO_TYPES: Record<string, GalleryImageType> = {
  'image/jpeg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
};

function caseIdFrom(formData: FormData): string {
  const id = text(formData, 'caseId');
  if (!UUID.test(id)) redirect('/cases');
  return id;
}

function done(caseId: string, code: string): never {
  redirect(`/cases/${caseId}?done=${encodeURIComponent(code)}`);
}

/** Moderation forms also sit in the one moderation queue (D12); only that fixed page is a way back, never an address from the form. */
function doneModerating(formData: FormData, caseId: string, code: string, section: string): never {
  if (text(formData, 'returnTo') === 'moderation') redirect(`/moderation?done=${encodeURIComponent(code)}#${section}`);
  done(caseId, code);
}

function refused(error: unknown, values: Record<string, string>): CaseFormState {
  const { code, problems } = failure(error);
  return { error: code, problems, values, attempt: Date.now() };
}

function incomplete(problems: string[], values: Record<string, string>): CaseFormState {
  return { error: 'case_refused', problems, values, attempt: Date.now() };
}

/** Uploads the chosen photos to the case first; the report then names them by id. */
async function uploadPhotos(api: ApiClient, caseId: string, formData: FormData): Promise<string[]> {
  const files = formData.getAll('photos').filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const ids: string[] = [];
  for (const file of files.slice(0, MAX_PHOTOS)) {
    const type = PHOTO_TYPES[file.type];
    if (!type) throw new PhotoRefused('unsupported_type');
    ids.push((await api.uploadCasePhoto(caseId, await file.arrayBuffer(), type)).id);
  }
  return ids;
}

function photoCount(formData: FormData): number {
  return formData.getAll('photos').filter((entry) => entry instanceof File && entry.size > 0).length;
}

class PhotoRefused extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function photoRefusal(error: unknown, values: Record<string, string>): CaseFormState {
  if (error instanceof PhotoRefused) return { error: error.code, problems: [], values, attempt: Date.now() };
  return refused(error, values);
}

// --- W03: GN collection ---------------------------------------------------------------------------------

export async function addFact(_previous: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const caseId = caseIdFrom(formData);
  const values = valuesOf(formData, ['statement', 'source']);
  try {
    await (await staffApi()).addCaseFact(caseId, { statement: values.statement, source: values.source });
  } catch (error) {
    return refused(error, values);
  }
  done(caseId, 'fact_added');
}

export async function returnForDetails(_previous: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const caseId = caseIdFrom(formData);
  const values = valuesOf(formData, ['question']);
  if (!values.question) return incomplete(['question_required'], values);
  try {
    await (await staffApi()).returnCaseForDetails(caseId, values.question);
  } catch (error) {
    return refused(error, values);
  }
  done(caseId, 'case_returned');
}

export async function linkDuplicate(_previous: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const caseId = caseIdFrom(formData);
  const values = valuesOf(formData, ['parentCaseNumber', 'note']);
  if (!values.parentCaseNumber) return incomplete(['parent_not_found'], values);
  try {
    await (await staffApi()).linkCaseToParent(caseId, values.parentCaseNumber.toUpperCase(), values.note || undefined);
  } catch (error) {
    return refused(error, values);
  }
  done(caseId, 'case_linked');
}

export async function forwardToDs(_previous: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const caseId = caseIdFrom(formData);
  const values = valuesOf(formData, ['locationConfirmed', 'descriptionClear', 'evidenceReviewed', 'affectedArea', 'ownerId', 'note']);
  const { input, problems } = readForward(formData);
  if (!input) return incomplete(problems, values);
  try {
    await (await staffApi()).forwardCase(caseId, input);
  } catch (error) {
    return refused(error, values);
  }
  done(caseId, 'case_forwarded');
}

// --- W04: divisional research ---------------------------------------------------------------------------

export async function addFinding(_previous: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const caseId = caseIdFrom(formData);
  const values = valuesOf(formData, ['kind', 'statement', 'source']);
  if (!isFindingKind(values.kind)) return incomplete(['finding_kind_required'], values);
  const kind: CaseFindingKind = values.kind;
  if (kind === 'verified_fact' && !values.source) return incomplete(['source_required'], values);
  try {
    await (await staffApi()).addCaseFinding(caseId, { kind, statement: values.statement, source: values.source || null });
  } catch (error) {
    return refused(error, values);
  }
  done(caseId, 'finding_added');
}

export async function sendDsReport(_previous: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const caseId = caseIdFrom(formData);
  const values = valuesOf(formData, ['summary', 'evidenceRefs', 'recommendation', 'districtOwnerId']);
  const districtOwnerId = uuidOrNull(formData, 'districtOwnerId');
  const problems = [
    ...(values.recommendation ? [] : ['recommendation_required']),
    ...(districtOwnerId ? [] : ['district_owner_required']),
  ];
  if (problems.length > 0 || !districtOwnerId) return incomplete(problems, values);
  try {
    await (await staffApi()).sendCaseDsReport(caseId, {
      summary: values.summary,
      evidenceRefs: evidenceRefsFrom(values.evidenceRefs),
      recommendation: values.recommendation,
      districtOwnerId,
    });
  } catch (error) {
    return refused(error, values);
  }
  done(caseId, 'ds_report_sent');
}

// --- W05 to W07: district decision, regional plan, executive approval ----------------------------------

export async function decideAtDistrict(_previous: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const caseId = caseIdFrom(formData);
  const values = valuesOf(formData, [
    'decision', 'authority', 'scope', 'resources', 'office', 'ownerId', 'dueDate', 'reason', 'decisionRequired', 'regionalOwnerId',
  ]);
  const { input, problems } = readDistrictDecision(formData);
  if (!input) return incomplete(problems, values);
  try {
    await (await staffApi()).decideCaseAtDistrict(caseId, input);
  } catch (error) {
    return refused(error, values);
  }
  done(caseId, input.decision === 'act' ? 'district_acted' : 'case_escalated');
}

export async function submitRegionalPlan(_previous: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const caseId = caseIdFrom(formData);
  const values = valuesOf(formData, ['solution', 'responsibleTier', 'resources', 'expectedOutcome', 'reportingPlan']);
  const tier = values.responsibleTier;
  if (tier !== '3A' && tier !== '3B' && tier !== '4' && tier !== '5') return incomplete(['responsible_tier_required'], values);
  try {
    await (await staffApi()).submitCaseRegionalPlan(caseId, {
      solution: values.solution,
      responsibleTier: tier,
      resources: values.resources,
      expectedOutcome: values.expectedOutcome,
      reportingPlan: values.reportingPlan,
    });
  } catch (error) {
    return refused(error, values);
  }
  done(caseId, 'regional_plan_sent');
}

export async function decideExecutive(_previous: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const caseId = caseIdFrom(formData);
  const values = valuesOf(formData, ['decision', 'conditions', 'implementerId', 'scope', 'reportingDuty', 'dueDate', 'question', 'reason']);
  const { input, problems } = readExecutiveDecision(formData);
  if (!input) return incomplete(problems, values);
  try {
    await (await staffApi()).decideCaseExecutive(caseId, input);
  } catch (error) {
    return refused(error, values);
  }
  done(caseId, `executive_${input.decision === 'approve' ? 'approved' : input.decision === 'return' ? 'returned' : 'declined'}`);
}

// --- W08: implementation and closing --------------------------------------------------------------------

export async function recordProgress(_previous: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const caseId = caseIdFrom(formData);
  const values = valuesOf(formData, ['step', 'evidenceRefs']);
  if (photoCount(formData) > MAX_PHOTOS) return incomplete(['too_many_photos'], values);
  try {
    const api = await staffApi();
    const photoIds = await uploadPhotos(api, caseId, formData);
    await api.recordCaseProgress(caseId, { step: values.step, evidenceRefs: evidenceRefsFrom(values.evidenceRefs), photoIds });
  } catch (error) {
    return photoRefusal(error, values);
  }
  done(caseId, 'progress_recorded');
}

export async function closeWithReport(_previous: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const caseId = caseIdFrom(formData);
  const values = valuesOf(formData, ['outcome', 'evidenceRefs', 'limitations', 'summaryTa', 'summaryEn']);
  const photos = photoCount(formData);
  const problems = [...closingProblems(formData, photos), ...(photos > MAX_PHOTOS ? ['too_many_photos'] : [])];
  if (problems.length > 0) return incomplete(problems, values);
  try {
    const api = await staffApi();
    const photoIds = await uploadPhotos(api, caseId, formData);
    await api.closeCase(caseId, {
      outcome: values.outcome,
      evidenceRefs: evidenceRefsFrom(values.evidenceRefs),
      photoIds,
      limitations: values.limitations || null,
      summaryEn: values.summaryEn,
      summaryTa: values.summaryTa,
    });
  } catch (error) {
    return photoRefusal(error, values);
  }
  done(caseId, 'case_closed');
}

// --- Any open stage: hand over, take, note --------------------------------------------------------------

export async function assignOwner(_previous: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const caseId = caseIdFrom(formData);
  const values = valuesOf(formData, ['ownerId', 'note']);
  const ownerId = uuidOrNull(formData, 'ownerId');
  if (!ownerId) return incomplete(['owner_required'], values);
  try {
    await (await staffApi()).assignCase(caseId, { ownerId, note: values.note });
  } catch (error) {
    return refused(error, values);
  }
  done(caseId, 'case_assigned');
}

/** An unowned case taken by the person looking at it; the id comes from the session, not the form. */
export async function takeCase(_previous: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const caseId = caseIdFrom(formData);
  const staff = await requireStaff();
  try {
    await (await staffApi()).assignCase(caseId, { ownerId: staff.member.id, note: 'Took this unassigned case.' });
  } catch (error) {
    return refused(error, {});
  }
  done(caseId, 'case_taken');
}

export async function addNote(_previous: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const caseId = caseIdFrom(formData);
  const values = valuesOf(formData, ['text']);
  try {
    await (await staffApi()).addCaseNote(caseId, values.text);
  } catch (error) {
    return refused(error, values);
  }
  done(caseId, 'note_added');
}

// --- Closure challenges, public summaries, added information --------------------------------------------

export async function decideChallenge(_previous: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const caseId = caseIdFrom(formData);
  const values = valuesOf(formData, ['accept', 'stage', 'ownerId', 'dueDate', 'reason']);
  const { input, problems } = readChallengeDecision(formData);
  if (!input) return incomplete(problems, values);
  try {
    await (await staffApi()).decideCaseChallenge(caseId, input);
  } catch (error) {
    return refused(error, values);
  }
  done(caseId, input.accept ? 'challenge_accepted' : 'challenge_rejected');
}

export async function setPublicSummary(_previous: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const caseId = caseIdFrom(formData);
  const values = valuesOf(formData, ['publish', 'titleTa', 'titleEn', 'summaryTa', 'summaryEn', 'reason']);
  const { input, problems } = readPublicSummary(formData);
  if (!input) return incomplete(problems, values);
  try {
    await (await staffApi()).setCasePublicSummary(caseId, input);
  } catch (error) {
    return refused(error, values);
  }
  doneModerating(formData, caseId, input.publish ? 'summary_published' : 'summary_withheld', 'case-summaries');
}

export async function moderateAddition(_previous: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const caseId = caseIdFrom(formData);
  const additionId = uuidOrNull(formData, 'additionId');
  if (!additionId) redirect(`/cases/${caseId}`);
  const values = valuesOf(formData, ['reason', 'editedBody']);
  const approve = formData.get('approve') === '1';
  if (!approve && !values.reason) return incomplete(['reason_required'], values);
  // An edited version is published instead of the member's words only when approving (D12).
  const editedBody = approve && values.editedBody ? values.editedBody : undefined;
  try {
    await (await staffApi()).moderateCaseAddition(caseId, additionId, approve, values.reason || undefined, editedBody);
  } catch (error) {
    return refused(error, values);
  }
  const code = approve ? (editedBody ? 'addition_redacted' : 'addition_approved') : 'addition_rejected';
  doneModerating(formData, caseId, code, 'case-additions');
}

// --- PRM-13: the reporter's contact, for the case owner only --------------------------------------------

export type ContactState = { contact: CaseReporterContact } | { error: string; attempt: number } | null;

/** The API records every look in the audit log; the contact is shown once and never put in the address. */
export async function showReporterContact(_previous: ContactState, formData: FormData): Promise<ContactState> {
  const caseId = caseIdFrom(formData);
  try {
    return { contact: await (await staffApi()).getCaseReporterContact(caseId) };
  } catch (error) {
    return { error: failure(error).code, attempt: Date.now() };
  }
}
