'use server';

import { redirect } from 'next/navigation';

import { attempt } from '@/lib/formActions';
import { incomplete, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';

import {
  EVALUATION_TEXT_FIELDS,
  FAIRNESS_TEXT_FIELDS,
  MODEL_REFUSED,
  MODEL_TEXT_FIELDS,
  TASKS,
  readEvaluation,
  readFairness,
  readModel,
  readModelReason,
} from './forms';

// D21: the AI Governance Lead registers, evaluates and watches each model (ai.model.monitor); only
// ai.model.approve makes one live or retires it. The API checks the permission and every rule again.

function modelIdFrom(formData: FormData): string {
  const id = uuidOrNull(formData, 'modelId');
  if (!id) redirect('/ai-models');
  return id;
}

/** A new entry starts in shadow mode: nothing it does is shown to members (15B.5). */
export async function registerModel(_previous: FormState, formData: FormData): Promise<FormState> {
  const values = valuesOf(formData, MODEL_TEXT_FIELDS);
  const { input, problems } = readModel(formData);
  if (!input) return incomplete(MODEL_REFUSED, problems, values);
  let id = '';
  const failed = await attempt(values, async (api) => {
    id = (await api.registerAiModel(input)).id;
  });
  if (failed) return failed;
  redirect(`/ai-models/${id}?done=ai_model_registered`);
}

/** For the assistant the API works out pass or fail from NFR-AI-05; other tasks state the result. */
export async function recordEvaluation(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = modelIdFrom(formData);
  const values = valuesOf(formData, EVALUATION_TEXT_FIELDS);
  // The page sends the model's task, which decides which results are asked for.
  const task = TASKS.find((value) => value === formData.get('task'));
  if (!task) redirect(`/ai-models/${id}`);
  const { input, problems } = readEvaluation(formData, task);
  if (!input) return incomplete(MODEL_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.recordAiEvaluation(id, input));
  if (failed) return failed;
  redirect(`/ai-models/${id}?done=ai_evaluation_recorded`);
}

export async function recordFairnessReview(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = modelIdFrom(formData);
  const values = valuesOf(formData, FAIRNESS_TEXT_FIELDS);
  const { input, problems } = readFairness(formData);
  if (!input) return incomplete(MODEL_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.recordAiFairnessReview(id, input));
  if (failed) return failed;
  redirect(`/ai-models/${id}?done=ai_fairness_recorded`);
}

/** PRM-30. A version that was live before goes live again at once (rollback, NFR-AI-07). */
export async function makeModelLive(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = modelIdFrom(formData);
  const values = valuesOf(formData, ['reason']);
  const { input, problems } = readModelReason(formData);
  if (!input) return incomplete(MODEL_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.makeAiModelLive(id, input.reason));
  if (failed) return failed;
  redirect(`/ai-models/${id}?done=ai_model_live`);
}

export async function retireModel(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = modelIdFrom(formData);
  const values = valuesOf(formData, ['reason']);
  const { input, problems } = readModelReason(formData);
  if (!input) return incomplete(MODEL_REFUSED, problems, values);
  const failed = await attempt(values, (api) => api.retireAiModel(id, input.reason));
  if (failed) return failed;
  redirect(`/ai-models/${id}?done=ai_model_retired`);
}
