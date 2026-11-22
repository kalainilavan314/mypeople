import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ASSISTANT_THRESHOLDS,
  FAIRNESS_LABELS,
  FAIRNESS_OUTCOMES,
  MODEL_TARGETS,
  PROVIDER_CODES,
  PROVIDER_LABELS,
  STATUSES,
  STATUS_LABELS,
  TASKS,
  TASK_LABELS,
  THRESHOLDS_TEXT,
  failureRate,
  readEvaluation,
  readFairness,
  readModel,
  readModelReason,
} from './forms.ts';
import { builtModules, plannedModules } from '../../lib/modules.ts';
import { targetOf } from '../../lib/formState.ts';
import { bilingualConfirmation, bilingualMessageFor, bilingualProblemText } from '../../lib/messages.ts';

const readSrc = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const TAMIL = /[஀-௿]/;

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const MODEL = {
  task: 'assistant', name: 'Claude Opus', provider: 'Anthropic (hosted API)', providerCode: 'anthropic', modelRef: 'claude-opus-5-5',
  version: '5.5', licence: 'Anthropic commercial terms', licenceCommercialUse: '1', dataLocation: 'United States (provider-hosted)',
  trainingDataSummary: 'Provider training data; no member data.',
};

test('the AI model registry is a built module for the AI Governance Lead and no longer planned (D21)', () => {
  const registered = builtModules.find((m) => m.href === '/ai-models');
  assert.ok(registered);
  assert.deepEqual([...registered.permission], ['ai.model.monitor', 'ai.model.approve']);
  assert.match(registered.ta, TAMIL);
  assert.equal(plannedModules.some((m) => /D21|model|AI monitoring/i.test(`${m.name} ${m.desc}`)), false);
  assert.ok(plannedModules.some((m) => m.name === 'Further reports'), 'further reports stay planned');
  for (const task of TASKS) assert.match(TASK_LABELS[task].ta, TAMIL, task);
  for (const code of PROVIDER_CODES) assert.match(PROVIDER_LABELS[code].ta, TAMIL, code);
  for (const status of STATUSES) assert.match(STATUS_LABELS[status].ta, TAMIL, status);
  for (const outcome of FAIRNESS_OUTCOMES) assert.match(FAIRNESS_LABELS[outcome].ta, TAMIL, outcome);
});

test('a registry entry needs its task, provider, model, version, licence and data terms (NFR-AI-01)', () => {
  const { input, problems } = readModel(form({ artefactHash: 'abc' }));
  assert.equal(input, null);
  assert.deepEqual(problems, [
    'task_required', 'model_name_required', 'provider_required', 'provider_code_required', 'model_ref_required', 'version_required',
    'licence_required', 'data_location_required', 'training_data_summary_required', 'artefact_hash_invalid',
  ]);
  for (const problem of problems) assert.ok(targetOf(MODEL_TARGETS, problem), problem);
  const ok = readModel(form(MODEL));
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.input.licenceCommercialUse, true);
  assert.equal(ok.input.noTrainingTerms, false, 'an unticked box is false');
  assert.equal(ok.input.artefactHash, null);
});

test('the assistant evaluation asks for the five NFR-AI-05 results; other tasks state pass or fail', () => {
  assert.deepEqual(ASSISTANT_THRESHOLDS, { minQuestions: 200, minGroundedPct: 95, maxUnsupportedPct: 2, maxPersuasionFailures: 0, maxFabricationFailures: 0 });
  assert.match(THRESHOLDS_TEXT.en, /200 questions; 95% or more grounded; 2% or fewer/);
  assert.match(THRESHOLDS_TEXT.ta, TAMIL);
  const base = { evaluatedOn: '2026-11-18', summary: 'Monthly Tamil and English set.', reportRef: 'EVAL-2026-11' };
  assert.deepEqual(readEvaluation(form({ ...base, questions: '200', groundedPct: '101' }), 'assistant').problems, ['percent_invalid', 'assistant_results_required']);
  const assistant = readEvaluation(form({ ...base, questions: '200', groundedPct: '96.5', unsupportedPct: '1', persuasionFailures: '0', fabricationFailures: '0' }), 'assistant');
  assert.deepEqual(assistant.input, { ...base, questions: 200, groundedPct: '96.5', unsupportedPct: '1', persuasionFailures: 0, fabricationFailures: 0 });
  assert.equal('passed' in assistant.input, false, 'the API decides pass or fail for the assistant');
  assert.deepEqual(readEvaluation(form(base), 'ocr').problems, ['result_required']);
  assert.equal(readEvaluation(form({ ...base, result: 'failed' }), 'ocr').input.passed, false);
});

test('fairness reviews and status changes are checked before the API is asked', () => {
  assert.deepEqual(readFairness(form({ groups: 'x' })).problems, ['reviewed_on_required', 'groups_required', 'findings_required', 'fairness_outcome_required']);
  assert.deepEqual(
    readFairness(form({ reviewedOn: '2026-11-18', groups: 'Jaffna, Vanni', findings: 'No meaningful gap.', outcome: 'passed' })).input,
    { reviewedOn: '2026-11-18', groups: 'Jaffna, Vanni', findings: 'No meaningful gap.', outcome: 'passed' },
  );
  assert.deepEqual(readModelReason(form({ reason: 'ok' })).problems, ['reason_required']);
  assert.equal(failureRate({ answers: 0, failed: 0 }), null);
  assert.equal(failureRate({ answers: 200, failed: 3 }), 2);
});

test('every refusal from the registry has Tamil and English words', () => {
  assert.match(bilingualMessageFor('model_refused').ta, TAMIL);
  for (const problem of [
    'already_registered', 'evaluated_in_future', 'assistant_results_required', 'result_required', 'reviewed_in_future',
    'licence_not_for_commercial_use', 'no_training_terms_missing', 'evaluation_missing', 'evaluation_failed', 'evaluation_out_of_date',
    'fairness_review_missing', 'fairness_review_not_passed', 'shadow_period_running', 'already_live', 'retired_before_going_live',
    'already_retired', 'percent_invalid', 'failures_invalid', 'questions_invalid',
  ]) {
    const words = bilingualProblemText(problem);
    assert.match(words.ta, TAMIL, problem);
    assert.notEqual(words.en, problem.replace(/_/g, ' '), problem);
  }
  for (const done of ['ai_model_registered', 'ai_evaluation_recorded', 'ai_fairness_recorded', 'ai_model_live', 'ai_model_retired']) {
    assert.match(bilingualConfirmation(done).ta, TAMIL, done);
  }
});

test('the pages show the server set-up, monitoring and every governance action', async () => {
  const list = await readSrc('app/(staff)/ai-models/page.tsx');
  assert.match(list, /getAiRegistry\(\)/);
  assert.match(list, /AI_PROVIDER=none/);
  const detail = await readSrc('app/(staff)/ai-models/[id]/page.tsx');
  for (const action of ['recordEvaluation', 'recordFairnessReview', 'makeModelLive', 'retireModel', 'usage7Days', 'feedback30Days', 'goLiveProblems']) {
    assert.ok(detail.includes(action), action);
  }
  assert.match(await readSrc('app/(staff)/ai-models/new/page.tsx'), /registerModel/);
  assert.match(await readSrc('components/ModuleIcons.tsx'), /case '\/ai-models':/);
});
