'use server';

import { redirect } from 'next/navigation';

import { attempt } from '@/lib/formActions';
import { incomplete, text, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';

import { DONOR_REFUSED, OUTCOMES, readDecision, readPartner, readRequest } from './forms';

// D27: partner requesters (PRM-55) raise and close requests for their own organisation; Tier 5
// (donor.oversight) authorises partners and their requesters and decides requests over the hourly limit.

export async function raiseRequest(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, ['bloodGroup', 'districtCode', 'dsCode', 'units', 'urgency', 'neededBy']);
  const { input, problems } = readRequest(formData);
  if (!input) return incomplete(DONOR_REFUSED, problems, values);
  let id = '';
  const failed = await attempt(values, async (api) => {
    id = (await api.raiseBloodRequest(input)).id;
  });
  if (failed) return failed;
  redirect(`/blood-requests/${id}?done=blood_request_raised`);
}

export async function closeRequest(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidOrNull(formData, 'requestId');
  if (!id) redirect('/blood-requests');
  const values = valuesOf(formData, ['outcome']);
  const outcome = OUTCOMES.find((item) => item === values.outcome);
  if (!outcome) return incomplete(DONOR_REFUSED, ['outcome_required'], values);
  const failed = await attempt(values, (api) => api.closeBloodRequest(id, outcome));
  if (failed) return failed;
  redirect(`/blood-requests/${id}?done=blood_request_closed`);
}

export async function addPartner(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, ['name', 'kind', 'districtCode', 'agreementRef']);
  const { input, problems } = readPartner(formData);
  if (!input) return incomplete(DONOR_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.addBloodPartner(input));
  if (failed) return failed;
  redirect('/blood-requests?done=blood_partner_added');
}

export async function setPartnerActive(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidOrNull(formData, 'partnerId');
  if (!id) redirect('/blood-requests');
  const active = text(formData, 'active') === '1';
  const failed = await attempt({}, (api) => api.setBloodPartnerActive(id, active));
  if (failed) return failed;
  redirect(`/blood-requests?done=${active ? 'blood_partner_activated' : 'blood_partner_suspended'}`);
}

export async function authoriseRequester(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidOrNull(formData, 'partnerId');
  if (!id) redirect('/blood-requests');
  const values = valuesOf(formData, ['memberCode']);
  if (values.memberCode.length < 3) return incomplete(DONOR_REFUSED, ['member_code_required'], values);
  const failed = await attempt(values, (api) => api.authoriseBloodRequester(id, values.memberCode));
  if (failed) return failed;
  redirect('/blood-requests?done=blood_requester_authorised');
}

export async function revokeRequester(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidOrNull(formData, 'requesterId');
  if (!id) redirect('/blood-requests');
  const failed = await attempt({}, (api) => api.revokeBloodRequester(id));
  if (failed) return failed;
  redirect('/blood-requests?done=blood_requester_revoked');
}

export async function decideRequest(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidOrNull(formData, 'requestId');
  if (!id) redirect('/blood-requests');
  const values = valuesOf(formData, ['decision', 'reason']);
  const { input, problems } = readDecision(formData);
  if (!input) return incomplete(DONOR_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.decideBloodRequest(id, input.approve, input.reason));
  if (failed) return failed;
  redirect(`/blood-requests?done=${input.approve ? 'blood_request_approved' : 'blood_request_refused'}`);
}
