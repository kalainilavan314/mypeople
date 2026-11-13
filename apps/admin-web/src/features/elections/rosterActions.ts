'use server';

import { redirect } from 'next/navigation';

import { attempt } from '@/lib/formActions';
import { incomplete, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';

import { ROSTER_REFUSED, memberCodeFrom, readShift } from './roster';

// FR-ELX-006, 007: the election duty roster. The API checks election.roster.manage and the shift's
// area on every call. Only ids travel in the address, never what was typed.

function periodIdFrom(formData: FormData): string {
  const id = uuidOrNull(formData, 'periodId');
  if (!id) redirect('/elections');
  return id;
}

function shiftPath(formData: FormData): { periodId: string; shiftId: string } {
  const periodId = periodIdFrom(formData);
  const shiftId = uuidOrNull(formData, 'shiftId');
  if (!shiftId) redirect(`/elections/${periodId}/roster`);
  return { periodId, shiftId };
}

export async function createShift(_previous: FormState, formData: FormData): Promise<FormState> {
  const periodId = periodIdFrom(formData);
  const values = valuesOf(formData, ['roleTa', 'roleEn', 'siteTa', 'siteEn', 'startsAt', 'endsAt', 'places', 'area']);
  const { input, problems } = readShift(formData, periodId);
  if (!input) return incomplete(ROSTER_REFUSED, problems, values);
  let shiftId = '';
  const failed = await attempt(values, async (api) => {
    shiftId = (await api.createRosterShift(input)).id;
  });
  if (failed) return failed;
  redirect(`/elections/${periodId}/roster/${shiftId}?done=roster_shift_created`);
}

/** An offer to a member by the ID on their card; they accept or decline in the app. */
export async function offerShift(_previous: FormState, formData: FormData): Promise<FormState> {
  const { periodId, shiftId } = shiftPath(formData);
  const values = valuesOf(formData, ['memberCode']);
  const code = memberCodeFrom(formData);
  if (!code) return incomplete(ROSTER_REFUSED, ['code_required'], values);
  const failed = await attempt(values, (api) => api.offerRosterShift(shiftId, code));
  if (failed) return failed;
  redirect(`/elections/${periodId}/roster/${shiftId}?done=roster_offered`);
}

/** Everyone offered or accepted is told; the reason is kept in the audit log. */
export async function cancelShift(_previous: FormState, formData: FormData): Promise<FormState> {
  const { periodId, shiftId } = shiftPath(formData);
  const values = valuesOf(formData, ['reason']);
  if (values.reason.length < 3) return incomplete(ROSTER_REFUSED, ['reason_required'], values);
  const failed = await attempt(values, (api) => api.cancelRosterShift(shiftId, values.reason));
  if (failed) return failed;
  redirect(`/elections/${periodId}/roster/${shiftId}?done=roster_shift_cancelled`);
}

/** FR-ELX-007: an operational message to the volunteers who accepted the shift, in Tamil and English. */
export async function messageShift(_previous: FormState, formData: FormData): Promise<FormState> {
  const { periodId, shiftId } = shiftPath(formData);
  const values = valuesOf(formData, ['bodyTa', 'bodyEn']);
  if (values.bodyTa.length < 3 || values.bodyEn.length < 3) return incomplete(ROSTER_REFUSED, ['message_required'], values);
  const failed = await attempt(values, (api) => api.messageRosterShift(shiftId, values.bodyEn, values.bodyTa));
  if (failed) return failed;
  redirect(`/elections/${periodId}/roster/${shiftId}?done=roster_message_sent`);
}
