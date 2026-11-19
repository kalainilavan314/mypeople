'use server';

import { redirect } from 'next/navigation';

import { attempt } from '@/lib/formActions';
import { incomplete, text, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';

import { COMMITTEE_REFUSED, PROPOSAL_TEXT_FIELDS, readCommitteeDecision, readProposal, readRoleGrant } from './forms';

// D23: roles.assign proposes wings and committees and assigns roles over its area; only a Tier 5
// (system.configure) approves, rejects or closes. The API checks permission and area again.

function committeeIdFrom(formData: FormData): string {
  const id = uuidOrNull(formData, 'committeeId');
  if (!id) redirect('/committees');
  return id;
}

/** Back to the page the form was on: the committee, or the list. */
function back(formData: FormData, id: string, done: string): never {
  redirect(text(formData, 'returnTo') === 'list' ? `/committees?done=${done}` : `/committees/${id}?done=${done}`);
}

export async function proposeCommittee(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, PROPOSAL_TEXT_FIELDS);
  const { input, problems } = readProposal(formData);
  if (!input) return incomplete(COMMITTEE_REFUSED, problems, values);
  let id = '';
  const failed = await attempt(values, async (api) => {
    id = (await api.proposeCommittee(input)).id;
  });
  if (failed) return failed;
  redirect(`/committees/${id}?done=committee_proposed`);
}

/** FR-COM-001: Tier 5 approves, or rejects with a reason. */
export async function decideCommittee(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = committeeIdFrom(formData);
  const values = valuesOf(formData, ['decision', 'reason']);
  const { input, problems } = readCommitteeDecision(formData);
  if (!input) return incomplete(COMMITTEE_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.decideCommittee(id, input.approve, input.reason ?? undefined));
  if (failed) return failed;
  back(formData, id, input.approve ? 'committee_approved' : 'committee_rejected');
}

export async function closeCommittee(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = committeeIdFrom(formData);
  const values = valuesOf(formData, ['reason']);
  if (values.reason.length < 3) return incomplete(COMMITTEE_REFUSED, ['reason_required'], values);
  const failed = await attempt(values, (api) => api.closeCommittee(id, values.reason));
  if (failed) return failed;
  back(formData, id, 'committee_closed');
}

export async function grantCommitteeRole(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = committeeIdFrom(formData);
  const values = valuesOf(formData, ['memberCode', 'role']);
  const { input, problems } = readRoleGrant(formData);
  if (!input) return incomplete(COMMITTEE_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.grantCommitteeRole(id, input.memberCode, input.role));
  if (failed) return failed;
  back(formData, id, 'committee_role_granted');
}

export async function removeCommitteeMember(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = committeeIdFrom(formData);
  const membershipId = uuidOrNull(formData, 'membershipId');
  if (!membershipId) redirect(`/committees/${id}`);
  const values = valuesOf(formData, ['reason']);
  if (values.reason.length < 3) return incomplete(COMMITTEE_REFUSED, ['reason_required'], values);
  const failed = await attempt(values, (api) => api.removeCommitteeMemberAsAdmin(id, membershipId, values.reason));
  if (failed) return failed;
  back(formData, id, 'committee_member_removed');
}

/** FR-DSP-002: list an event for supporters abroad, or take it off the list. */
export async function setEventListed(_previous: FormState, formData: FormData): Promise<FormState> {
  const eventId = uuidOrNull(formData, 'eventId');
  if (!eventId) redirect('/committees/diaspora');
  const listed = text(formData, 'international') === 'yes';
  const failed = await attempt({}, (api) => api.setDiasporaEventListed(eventId, listed));
  if (failed) return failed;
  redirect(`/committees/diaspora?done=${listed ? 'diaspora_event_listed' : 'diaspora_event_unlisted'}`);
}
