'use server';

import { redirect } from 'next/navigation';

import { attempt } from '@/lib/formActions';
import { incomplete, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';

import { METRICS, SCORECARD_REFUSED, readCorrectionDecision, readPeriod } from './forms';

// D17: scorecards are drafted for a finished quarter, shared with the responsible tiers for 10
// working days, then published. The API checks scorecard.publish (or a case permission to ask for a
// correction) on every call.

function cardIdFrom(formData: FormData): string {
  const id = uuidOrNull(formData, 'scorecardId');
  if (!id) redirect('/scorecards');
  return id;
}

export async function draftScorecard(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, ['period']);
  const { period, problems } = readPeriod(formData);
  if (!period) return incomplete(SCORECARD_REFUSED, problems, values);
  let id = '';
  const failed = await attempt(values, async (api) => {
    id = (await api.draftScorecard(period)).id;
  });
  if (failed) return failed;
  redirect(`/scorecards/${id}?done=scorecard_drafted`);
}

export async function shareScorecard(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = cardIdFrom(formData);
  const failed = await attempt({}, (api) => api.shareScorecard(id));
  if (failed) return failed;
  redirect(`/scorecards/${id}?done=scorecard_shared`);
}

export async function publishScorecard(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = cardIdFrom(formData);
  const failed = await attempt({}, (api) => api.publishScorecard(id));
  if (failed) return failed;
  redirect(`/scorecards/${id}?done=scorecard_published`);
}

/** A context note beside an area's values; empty in both languages removes it. */
export async function setScorecardNote(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = cardIdFrom(formData);
  const values = valuesOf(formData, ['areaKey', 'noteTa', 'noteEn']);
  if (!values.areaKey) return incomplete(SCORECARD_REFUSED, ['area_key_required'], values);
  if (Boolean(values.noteTa) !== Boolean(values.noteEn)) return incomplete(SCORECARD_REFUSED, ['note_text_required'], values);
  const failed = await attempt(values, (api) => api.setScorecardNote(id, values.areaKey, values.noteEn, values.noteTa));
  if (failed) return failed;
  redirect(`/scorecards/${id}?done=scorecard_note_saved`);
}

export async function requestCorrection(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = cardIdFrom(formData);
  const values = valuesOf(formData, ['areaKey', 'metric', 'reason']);
  const problems = [
    ...(values.areaKey ? [] : ['area_key_required']),
    ...(METRICS.some((metric) => metric.key === values.metric) ? [] : ['unknown_metric']),
    ...(values.reason.length >= 5 ? [] : ['reason_required']),
  ];
  if (problems.length) return incomplete(SCORECARD_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.requestScorecardCorrection(id, values.areaKey, values.metric, values.reason));
  if (failed) return failed;
  redirect(`/scorecards/${id}?done=scorecard_correction_requested`);
}

/** Accepting a correction on a published scorecard publishes the next version; the page then shows that one. */
export async function decideCorrection(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = cardIdFrom(formData);
  const correctionId = uuidOrNull(formData, 'correctionId');
  if (!correctionId) redirect(`/scorecards/${id}`);
  const values = valuesOf(formData, ['decision', 'note']);
  const { input, problems } = readCorrectionDecision(formData);
  if (!input) return incomplete(SCORECARD_REFUSED, problems, values);
  let resultId = id;
  const failed = await attempt(values, async (api) => {
    resultId = (await api.decideScorecardCorrection(correctionId, input.accept, input.note)).id;
  });
  if (failed) return failed;
  const done = !input.accept ? 'scorecard_correction_rejected' : resultId !== id ? 'scorecard_new_version' : 'scorecard_correction_accepted';
  redirect(`/scorecards/${resultId}?done=${done}`);
}
