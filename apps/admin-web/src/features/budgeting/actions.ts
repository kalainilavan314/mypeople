'use server';

import type { ApiClient } from '@my-people/api-client';
import { redirect } from 'next/navigation';

import { attempt } from '@/lib/formActions';
import { incomplete, text, uuidOrNull, valuesOf, type FormState } from '@/lib/formState';

import {
  BUDGET_REFUSED,
  COMPLETION_TEXT_FIELDS,
  CYCLE_TEXT_FIELDS,
  EXPENDITURE_TEXT_FIELDS,
  PROJECT_TEXT_FIELDS,
  REVIEW_TEXT_FIELDS,
  STATUSES,
  ownProblems,
  readCompletion,
  readCycle,
  readExpenditure,
  readMove,
  readProject,
  readReview,
} from './forms';

// D19: pb.manage holders set up cycles and projects; two different pb.certify holders certify the
// recount; the Treasurer (finance.approve) records allocations. The API checks permission and area
// again on every call, and refuses anything the rules do not allow.

function cycleIdFrom(formData: FormData): string {
  const id = uuidOrNull(formData, 'cycleId');
  if (!id) redirect('/budgeting');
  return id;
}

function projectIdFrom(formData: FormData): string {
  const id = uuidOrNull(formData, 'projectId');
  if (!id) redirect('/budgeting');
  return id;
}

/** The API's refusal, with problems another module already has words for said in budgeting's own. */
async function tryCall(values: Record<string, string>, call: (api: ApiClient) => Promise<unknown>): Promise<FormState> {
  const failed = await attempt(values, call);
  return failed ? { ...failed, problems: ownProblems(failed.problems) } : null;
}

export async function saveCycle(_previous: FormState, formData: FormData): Promise<FormState> {
  const existing = uuidOrNull(formData, 'cycleId');
  const values = valuesOf(formData, CYCLE_TEXT_FIELDS);
  const { input, problems } = readCycle(formData, { needsArea: !existing });
  if (!input) return incomplete(BUDGET_REFUSED, problems, values);
  let id = existing;
  const failed = await tryCall(values, async (api) => {
    id = existing ? (await api.updateBudgetCycle(existing, input)).id : (await api.createBudgetCycle(input)).id;
  });
  if (failed) return failed;
  redirect(`/budgeting/${id}?done=${existing ? 'budget_rules_saved' : 'budget_cycle_created'}`);
}

/** Publish the rules, move to review, schedule or close voting, or cancel with a reason. */
export async function moveCycle(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = cycleIdFrom(formData);
  const status = STATUSES.find((item) => item === text(formData, 'status')) ?? 'cancelled';
  const values = valuesOf(formData, ['to', 'reason']);
  const { input, problems } = readMove(formData, status);
  if (!input) return incomplete(BUDGET_REFUSED, problems, values);
  const failed = await tryCall(values, (api) => api.moveBudgetCycle(id, input.to, input.reason));
  if (failed) return failed;
  redirect(`/budgeting/${id}?done=budget_moved_${input.to}`);
}

export async function addProject(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = cycleIdFrom(formData);
  const values = valuesOf(formData, PROJECT_TEXT_FIELDS);
  const { input, problems } = readProject(formData, { needsProposal: true });
  if (!input) return incomplete(BUDGET_REFUSED, problems, values);
  const failed = await tryCall(values, (api) => api.addBudgetProject(id, input));
  if (failed) return failed;
  redirect(`/budgeting/${id}?done=budget_project_added#projects`);
}

/** A new estimated cost clears the financial review and takes the project off the ballot (the API does it). */
export async function updateProject(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = cycleIdFrom(formData);
  const projectId = projectIdFrom(formData);
  const values = valuesOf(formData, PROJECT_TEXT_FIELDS);
  const { input, problems } = readProject(formData, { needsProposal: false });
  if (!input) return incomplete(BUDGET_REFUSED, problems, values);
  const failed = await tryCall(values, (api) => api.updateBudgetProject(projectId, input));
  if (failed) return failed;
  redirect(`/budgeting/${id}?done=budget_project_saved#projects`);
}

export async function recordReview(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = cycleIdFrom(formData);
  const projectId = projectIdFrom(formData);
  const values = valuesOf(formData, REVIEW_TEXT_FIELDS);
  const { input, problems } = readReview(formData);
  if (!input) return incomplete(BUDGET_REFUSED, problems, values);
  const failed = await tryCall(values, (api) => api.recordBudgetReview(projectId, input));
  if (failed) return failed;
  redirect(`/budgeting/${id}?done=budget_review_recorded#projects`);
}

/** FR-PBG-002: refused until both reviews are recorded. */
export async function placeProject(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = cycleIdFrom(formData);
  const projectId = projectIdFrom(formData);
  const onBallot = text(formData, 'onBallot') === '1';
  const failed = await tryCall({}, (api) => api.placeBudgetProject(projectId, onBallot));
  if (failed) return failed;
  redirect(`/budgeting/${id}?done=${onBallot ? 'budget_project_on_ballot' : 'budget_project_off_ballot'}#projects`);
}

/** FR-PBG-006: two different people certify the same recount; a mismatch blocks certification. */
export async function certifyCycle(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = cycleIdFrom(formData);
  const failed = await tryCall({}, (api) => api.certifyBudgetCycle(id));
  if (failed) return failed;
  redirect(`/budgeting/${id}?done=budget_certified`);
}

/** FR-PBG-008: the Treasurer records each funded project's allocation in the finance records. */
export async function allocateCycle(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = cycleIdFrom(formData);
  const failed = await tryCall({}, (api) => api.allocateBudgetCycle(id));
  if (failed) return failed;
  redirect(`/budgeting/${id}?done=budget_allocated`);
}

export async function recordExpenditure(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = cycleIdFrom(formData);
  const projectId = projectIdFrom(formData);
  const values = valuesOf(formData, EXPENDITURE_TEXT_FIELDS);
  const { input, problems } = readExpenditure(formData);
  if (!input) return incomplete(BUDGET_REFUSED, problems, values);
  const failed = await tryCall(values, (api) => api.recordBudgetExpenditure(projectId, input));
  if (failed) return failed;
  redirect(`/budgeting/${id}?done=budget_spending_recorded#funded`);
}

export async function recordCompletion(_previous: FormState, formData: FormData): Promise<FormState> {
  const id = cycleIdFrom(formData);
  const projectId = projectIdFrom(formData);
  const values = valuesOf(formData, COMPLETION_TEXT_FIELDS);
  const { input, problems } = readCompletion(formData);
  if (!input) return incomplete(BUDGET_REFUSED, problems, values);
  const failed = await tryCall(values, (api) => api.recordBudgetCompletion(projectId, input));
  if (failed) return failed;
  redirect(`/budgeting/${id}?done=budget_project_completed#funded`);
}
