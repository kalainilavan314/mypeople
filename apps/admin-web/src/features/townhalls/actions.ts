'use server';

import { redirect } from 'next/navigation';

import { attempt } from '@/lib/formActions';
import { incomplete, text, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';

import { TOWNHALL_FIELDS, TOWNHALL_REFUSED, readAnswer, readArchive, readModeration, readTownHall, townhallRefusalCode } from './forms';

// D18: town halls. Producers (townhall.produce) make and run sessions; moderators
// (townhall.moderate) approve, merge or reject questions. The API checks both, the area, and an
// election silence window (409) on every call.

function sessionIdFrom(formData: FormData): string {
  const id = uuidOrNull(formData, 'townhallId');
  if (!id) redirect('/town-halls');
  return id;
}

export async function saveTownHall(_previous: FormState, formData: FormData): Promise<FormState> {
  const existing = uuidOrNull(formData, 'townhallId');
  const values = valuesOf(formData, TOWNHALL_FIELDS);
  const { input, problems } = readTownHall(formData, { needsArea: !existing });
  if (!input) return incomplete(TOWNHALL_REFUSED, problems, values);
  let id = existing ?? '';
  const failed = await attempt(
    values,
    async (api) => {
      id = existing ? (await api.updateTownHall(existing, input)).id : (await api.createTownHall(input)).id;
    },
    townhallRefusalCode,
  );
  if (failed) return failed;
  redirect(`/town-halls/${id}?done=${existing ? 'townhall_saved' : 'townhall_created'}`);
}

/** Schedule, go live, end, or cancel with a reason. */
export async function moveTownHall(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = sessionIdFrom(formData);
  const values = valuesOf(formData, ['reason']);
  const state = text(formData, 'state');
  if (state !== 'scheduled' && state !== 'live' && state !== 'ended' && state !== 'cancelled') return incomplete(TOWNHALL_REFUSED, ['decision_required'], values);
  if (state === 'cancelled' && !values.reason) return incomplete(TOWNHALL_REFUSED, ['reason_required'], values);
  const failed = await attempt(values, (api) => api.moveTownHall(id, state, values.reason || undefined), townhallRefusalCode);
  if (failed) return failed;
  redirect(`/town-halls/${id}?done=townhall_${state}`);
}

export async function moderateQuestion(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = sessionIdFrom(formData);
  const questionId = uuidOrNull(formData, 'questionId');
  if (!questionId) redirect(`/town-halls/${id}`);
  const values = valuesOf(formData, ['decision', 'reason', 'mergeInto']);
  const { input, problems } = readModeration(formData);
  if (!input) return incomplete(TOWNHALL_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.moderateTownHallQuestion(questionId, input.decision, input.reason, input.mergeInto));
  if (failed) return failed;
  redirect(`/town-halls/${id}?done=question_${input.decision}`);
}

export async function answerQuestion(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = sessionIdFrom(formData);
  const questionId = uuidOrNull(formData, 'questionId');
  if (!questionId) redirect(`/town-halls/${id}`);
  const values = valuesOf(formData, ['mode', 'atSecond', 'answerTa', 'answerEn']);
  const { input, problems } = readAnswer(formData);
  if (!input) return incomplete(TOWNHALL_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.answerTownHallQuestion(questionId, input));
  if (failed) return failed;
  redirect(`/town-halls/${id}?done=question_answered`);
}

export async function archiveTownHall(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = sessionIdFrom(formData);
  const values = valuesOf(formData, ['recordingUrl', 'transcriptTa', 'transcriptEn', 'outcomesJson']);
  const { input, problems } = readArchive(formData);
  if (!input) return incomplete(TOWNHALL_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.archiveTownHall(id, input));
  if (failed) return failed;
  redirect(`/town-halls/${id}?done=townhall_archived`);
}
