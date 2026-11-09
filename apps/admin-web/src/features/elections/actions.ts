'use server';

import type { DeclaredElectionPeriod } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { readCloseForm, readNoticeForm, readPeriodForm, type FormState } from '@/features/elections/forms';
import { overlapRefs } from '@/features/elections/periods';
import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

const UUID = /^[0-9a-f-]{36}$/i;

function back(periodId: string, query: string): never {
  redirect(`/elections/${periodId}?${query}`);
}

function refusedOnPeriod(periodId: string, error: unknown): never {
  const { code, problems } = failure(error);
  back(periodId, `error=${encodeURIComponent(code)}&problems=${encodeURIComponent(problems.join(','))}`);
}

function refusedState(error: unknown, values: Record<string, string>): FormState {
  const { code, problems } = failure(error);
  return { error: code, problems, values, attempt: Date.now() };
}

/**
 * D22: declare a period from an Election Commission publication (needs election.mode.manage).
 * Overlapping periods are allowed and come back as a warning, which the period's page shows.
 */
export async function declarePeriod(_previous: FormState, formData: FormData): Promise<FormState> {
  const { input, problems, values } = readPeriodForm(formData);
  if (!input) return { error: 'election_invalid', problems, values, attempt: Date.now() };

  let declared: DeclaredElectionPeriod;
  try {
    declared = await (await staffApi()).declareElectionPeriod(input);
  } catch (error) {
    return refusedState(error, values);
  }
  // Only period references travel in the address, never what was typed.
  const overlaps = overlapRefs(declared.overlaps.join(',')).join(',');
  redirect(`/elections/${declared.id}?done=period_declared${overlaps ? `&overlaps=${encodeURIComponent(overlaps)}` : ''}`);
}

/** FR-ELX-004: a notice labelled Election Commission information or Party information. */
export async function publishNotice(_previous: FormState, formData: FormData): Promise<FormState> {
  const periodId = String(formData.get('periodId') ?? '');
  if (!UUID.test(periodId)) redirect('/elections');
  const { input, problems, values } = readNoticeForm(formData);
  if (!input) return { error: 'election_invalid', problems, values, attempt: Date.now() };

  try {
    await (await staffApi()).publishElectionNotice(periodId, input);
  } catch (error) {
    return refusedState(error, values);
  }
  back(periodId, 'done=notice_published');
}

/** End the period when the election is over, or withdraw it if declared in error; silence stops at once. */
export async function closePeriod(formData: FormData): Promise<void> {
  const periodId = String(formData.get('periodId') ?? '');
  if (!UUID.test(periodId)) redirect('/elections');
  const { input, problems } = readCloseForm(formData);
  if (!input) back(periodId, `error=election_invalid&problems=${encodeURIComponent(problems.join(','))}`);

  try {
    await (await staffApi()).closeElectionPeriod(periodId, input.action, input.reason);
  } catch (error) {
    refusedOnPeriod(periodId, error);
  }
  back(periodId, `done=${input.action === 'end' ? 'period_ended' : 'period_withdrawn'}`);
}

/** NFR-ELC-06: when its source is superseded, a notice stops showing to members. */
export async function withdrawNotice(formData: FormData): Promise<void> {
  const periodId = String(formData.get('periodId') ?? '');
  const noticeId = String(formData.get('noticeId') ?? '');
  if (!UUID.test(periodId) || !UUID.test(noticeId)) redirect('/elections');
  if (formData.get('confirm') !== '1') back(periodId, 'error=confirmation_required');

  try {
    await (await staffApi()).withdrawElectionNotice(noticeId);
  } catch (error) {
    refusedOnPeriod(periodId, error);
  }
  back(periodId, 'done=notice_withdrawn');
}
