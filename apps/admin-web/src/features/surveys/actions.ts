'use server';

import { redirect } from 'next/navigation';

import { incomplete, text, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';
import { failure } from '@/lib/messages';
import { staffApi } from '@/lib/session';

import { SURVEY_REFUSED, SURVEY_TEXT_FIELDS, readSurvey } from './forms';

// Surveys (H14, H21 on the staff side). The API checks surveys.manage over the survey's area, that
// only drafts change and that an anonymous survey cannot allow edits, again on every call.

const FIELDS = [...SURVEY_TEXT_FIELDS, 'closesAt', 'area', 'questionsJson', 'anonymous', 'allowEdits'];

function refused(error: unknown, values: Record<string, string>): FormState {
  const { code, problems } = failure(error);
  return { error: code, problems, values, attempt: Date.now() };
}

export async function createSurvey(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, FIELDS);
  const { input, problems } = readSurvey(formData);
  if (!input) return incomplete(SURVEY_REFUSED, problems, values);
  let id: string;
  try {
    id = (await (await staffApi()).createSurvey(input)).id;
  } catch (error) {
    return refused(error, values);
  }
  redirect(`/surveys/${id}?done=survey_created`);
}

/** A draft's text, settings and questions replaced as a whole; an open or closed survey never changes. */
export async function updateSurvey(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidOrNull(formData, 'surveyId');
  if (!id) redirect('/surveys');
  const values = valuesOf(formData, FIELDS);
  const { input, problems } = readSurvey(formData);
  if (!input) return incomplete(SURVEY_REFUSED, problems, values);
  try {
    await (await staffApi()).updateSurveyDraft(id, input);
  } catch (error) {
    return refused(error, values);
  }
  redirect(`/surveys/${id}?done=survey_saved`);
}

/** Open a draft (the API checks its questions first) or close an open survey. */
export async function moveSurvey(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = uuidOrNull(formData, 'surveyId');
  if (!id) redirect('/surveys');
  const state = text(formData, 'state');
  if (state !== 'open' && state !== 'closed') return incomplete(SURVEY_REFUSED, ['decision_required'], {});
  try {
    await (await staffApi()).moveSurvey(id, state);
  } catch (error) {
    return refused(error, {});
  }
  redirect(`/surveys/${id}?done=survey_${state}`);
}
