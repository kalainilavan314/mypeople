'use server';

import { redirect } from 'next/navigation';

import { attempt } from '@/lib/formActions';
import { incomplete, text, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';

import {
  SUPPORT_REFUSED,
  readAppealDecision,
  readDecision,
  readDelivery,
  readIntake,
  readPartner,
  readProgramme,
  readReferral,
} from './forms';

// D13, D14: community support. Help never depends on membership, donations or political support,
// and nothing here reads them. The API lets only the assigned caseworker and the decision-makers
// open a case (403 "not_assigned", logged) and checks every action again.

function caseIdFrom(formData: FormData): string {
  const id = uuidOrNull(formData, 'caseId');
  if (!id) redirect('/support');
  return id;
}

function toCase(id: string, done: string): never {
  redirect(`/support/${id}?done=${done}`);
}

export async function recordIntake(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, ['category', 'summary', 'emergency', 'consent', 'fullName', 'phone', 'household', 'area', 'channel', 'partnerId']);
  const { input, problems } = readIntake(formData);
  if (!input) return incomplete(SUPPORT_REFUSED, problems, values);
  let id = '';
  const failed = await attempt(values, async (api) => {
    id = (await api.recordSupportIntake(input)).id;
  });
  if (failed) return failed;
  redirect(`/support?done=support_intake_recorded&case=${encodeURIComponent(id)}`);
}

/**
 * Screening: intake staff route a case to a caseworker, decision-makers may reassign it. Intake staff
 * then lose the case (S12: the file is the caseworker's), so they go back to the queue.
 */
export async function assignCaseworker(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = caseIdFrom(formData);
  const caseworkerId = uuidOrNull(formData, 'caseworkerId');
  if (!caseworkerId) return incomplete(SUPPORT_REFUSED, ['caseworker_required'], {});
  let stillOpen = true;
  const failed = await attempt({}, async (api) => {
    stillOpen = (await api.assignSupportCase(id, caseworkerId)).fullFile;
  });
  if (failed) return failed;
  if (!stillOpen) redirect('/support?done=support_assigned');
  toCase(id, 'support_assigned');
}

/** FR-AST-006: a possible duplicate is linked, never a reason to refuse help. */
export async function linkDuplicate(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = caseIdFrom(formData);
  const otherId = uuidOrNull(formData, 'otherCaseId');
  if (!otherId) toCase(id, 'support_linked');
  const failed = await attempt({}, (api) => api.linkSupportCase(id, otherId));
  if (failed) return failed;
  toCase(id, 'support_linked');
}

export async function addNote(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = caseIdFrom(formData);
  const values = valuesOf(formData, ['body']);
  if (values.body.length < 3) return incomplete(SUPPORT_REFUSED, ['case_note_required'], values);
  const failed = await attempt(values, (api) => api.addSupportCaseNote(id, values.body));
  if (failed) return failed;
  toCase(id, 'note_added');
}

export async function decideCase(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = caseIdFrom(formData);
  const values = valuesOf(formData, ['outcome', 'criteriaVersionId', 'reasonTa', 'reasonEn']);
  const { input, problems } = readDecision(formData);
  if (!input) return incomplete(SUPPORT_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.decideSupportCase(id, input));
  if (failed) return failed;
  toCase(id, 'support_decided');
}

export async function recordDelivery(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = caseIdFrom(formData);
  const values = valuesOf(formData, ['kind', 'amount', 'deliveredOn', 'provider', 'evidence']);
  const { input, problems } = readDelivery(formData);
  if (!input) return incomplete(SUPPORT_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.recordSupportDelivery(id, input));
  if (failed) return failed;
  toCase(id, 'support_delivered');
}

/**
 * M12, FR-AST-004: consent for each partner referral. A member answers the proposal in the app, so it
 * waits for them; for anyone else the caseworker confirms the consent the applicant gave them.
 */
export async function referCase(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = caseIdFrom(formData);
  const values = valuesOf(formData, ['partnerId', 'purpose', 'consent']);
  const { input, problems } = readReferral(formData);
  if (!input) return incomplete(SUPPORT_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.referSupportCase(id, input.partnerId, input.purpose, input.consent));
  if (failed) return failed;
  toCase(id, formData.get('consentInApp') === '1' ? 'support_referral_proposed' : 'support_referred');
}

export async function updateReferral(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = caseIdFrom(formData);
  const referralId = uuidOrNull(formData, 'referralId');
  if (!referralId) toCase(id, 'support_referral_updated');
  const values = valuesOf(formData, ['state', 'outcome']);
  const state = text(formData, 'state');
  if (state !== 'accepted' && state !== 'completed' && state !== 'declined') return incomplete(SUPPORT_REFUSED, ['referral_state_required'], values);
  const failed = await attempt(values, (api) => api.updateSupportReferral(id, referralId, state, values.outcome || undefined));
  if (failed) return failed;
  toCase(id, 'support_referral_updated');
}

export async function closeCase(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = caseIdFrom(formData);
  const values = valuesOf(formData, ['note']);
  if (values.note.length < 5) return incomplete(SUPPORT_REFUSED, ['close_note_required'], values);
  const failed = await attempt(values, (api) => api.closeSupportCase(id, values.note));
  if (failed) return failed;
  toCase(id, 'support_closed');
}

export async function decideAppeal(_previous: FormState, formData: FormData): Promise<FormState> {
  const appealId = uuidOrNull(formData, 'appealId');
  if (!appealId) redirect('/support');
  const values = valuesOf(formData, ['change', 'reason', 'outcome', 'criteriaVersionId', 'reasonTa']);
  const { input, problems } = readAppealDecision(formData);
  if (!input) return incomplete(SUPPORT_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.decideSupportAppeal(appealId, input));
  if (failed) return failed;
  const caseId = uuidOrNull(formData, 'caseId');
  const done = input.change ? 'support_appeal_changed' : 'support_appeal_upheld';
  redirect(caseId ? `/support/${caseId}?done=${done}` : `/support?done=${done}`);
}

export async function createProgramme(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, ['nameTa', 'nameEn', 'descriptionTa', 'descriptionEn']);
  const { input, problems } = readProgramme(formData);
  if (!input) return incomplete(SUPPORT_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.createSupportProgramme(input));
  if (failed) return failed;
  redirect('/support/programmes?done=support_programme_created');
}

/** A new criteria version; decisions already made keep citing the version they used. */
export async function publishCriteria(_previous: FormState, formData: FormData): Promise<FormState> {
  const programmeId = uuidOrNull(formData, 'programmeId');
  if (!programmeId) redirect('/support/programmes');
  const values = valuesOf(formData, ['criteriaTa', 'criteriaEn']);
  if (values.criteriaTa.length < 10 || values.criteriaEn.length < 10) return incomplete(SUPPORT_REFUSED, ['criteria_text_required'], values);
  const failed = await attempt(values, (api) => api.publishSupportCriteria(programmeId, values.criteriaEn, values.criteriaTa));
  if (failed) return failed;
  redirect('/support/programmes?done=support_criteria_published');
}

export async function setProgrammeActive(_previous: FormState, formData: FormData): Promise<FormState> {
  const programmeId = uuidOrNull(formData, 'programmeId');
  if (!programmeId) redirect('/support/programmes');
  const active = text(formData, 'active') === '1';
  const failed = await attempt({}, (api) => api.setSupportProgrammeActive(programmeId, active));
  if (failed) return failed;
  redirect(`/support/programmes?done=${active ? 'support_programme_activated' : 'support_programme_retired'}`);
}

export async function addPartner(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, ['name', 'kind', 'contact']);
  const { input, problems } = readPartner(formData);
  if (!input) return incomplete(SUPPORT_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.addSupportPartner(input));
  if (failed) return failed;
  redirect('/support/programmes?done=support_partner_added');
}
