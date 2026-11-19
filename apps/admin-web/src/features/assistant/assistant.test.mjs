import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ERROR_STATE_LABELS,
  HANDOVER_STATE_LABELS,
  KINDS,
  KIND_LABELS,
  OUTCOME_LABELS,
  REFUSAL_LABELS,
  SOURCE_TARGETS,
  STATES,
  STATE_LABELS,
  UNAVAILABLE_WORDS,
  colomboToday,
  defaultReviewDue,
  readQuestion,
  readReply,
  readResolution,
  readReviewDue,
  readSource,
  readSourceDecision,
} from './forms.ts';
import { builtModules, plannedModules } from '../../lib/modules.ts';
import { targetOf } from '../../lib/formState.ts';
import { bilingualConfirmation, bilingualMessageFor, bilingualProblemText } from '../../lib/messages.ts';

const readSrc = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const TAMIL = /[஀-௿]/;
const NOW = new Date('2026-11-19T06:00:00Z');

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const SOURCE = {
  kind: 'app_help',
  titleTa: 'வீதிப் பிரச்சினைகளை அறிவித்தல்',
  titleEn: 'Reporting road problems',
  bodyTa: 'வீதிகளில் உள்ள குழிகளை முகப்புத் தாவலில் இருந்து அறிவிக்கலாம்.',
  bodyEn: '',
  publisher: 'TMK member services',
  reviewDue: '2027-11-19',
};

test('the assistant knowledge base is a built module for Knowledge Editors (D20, PRM-47)', () => {
  const registered = builtModules.find((m) => m.href === '/assistant');
  assert.ok(registered);
  assert.deepEqual([...registered.permission], ['ai.kb.manage']);
  assert.match(registered.ta, TAMIL);
  assert.equal(plannedModules.some((m) => /assistant|knowledge/i.test(m.name)), false);
  for (const kind of KINDS) assert.match(KIND_LABELS[kind].ta, TAMIL, kind);
  for (const state of STATES) assert.match(STATE_LABELS[state].ta, TAMIL, state);
  for (const words of [...Object.values(OUTCOME_LABELS), ...Object.values(REFUSAL_LABELS), ...Object.values(ERROR_STATE_LABELS), ...Object.values(HANDOVER_STATE_LABELS)]) {
    assert.match(words.ta, TAMIL, words.en);
  }
});

test('a source needs its kind, both titles, one text, who issued it and a review date ahead', () => {
  const { input, problems } = readSource(form({ titleEn: 'Roads', sourceUrl: 'http://example.org', reviewDue: '2026-11-19' }), NOW);
  assert.equal(input, null);
  assert.deepEqual(problems, ['kind_required', 'kb_title_required', 'source_text_required', 'publisher_required', 'source_url_invalid', 'review_date_must_be_ahead']);
  for (const problem of problems) assert.ok(targetOf(SOURCE_TARGETS, problem), problem);
  const ok = readSource(form(SOURCE), NOW);
  assert.deepEqual(ok.problems, []);
  assert.equal(ok.input.bodyEn, null, 'an empty text is sent as null');
  assert.equal(ok.input.sourceUrl, null);
  assert.deepEqual(readSource(form({ ...SOURCE, bodyTa: 'சுருக்கம்' }), NOW).problems, ['kb_body_too_short']);
});

test('the next review defaults to a year ahead, in Sri Lankan time', () => {
  assert.equal(colomboToday(new Date('2026-11-18T19:00:00Z')), '2026-11-19');
  assert.equal(defaultReviewDue(new Date('2026-11-18T19:00:00Z')), '2027-11-19');
  assert.equal(defaultReviewDue(new Date('2028-02-29T06:00:00Z')), '2029-02-28');
  assert.deepEqual(readReviewDue(form({ reviewDue: '2026-11-19' }), NOW).problems, ['review_date_must_be_ahead']);
  assert.deepEqual(readReviewDue(form({ reviewDue: '2027-05-01' }), NOW).input, { reviewDue: '2027-05-01' });
});

test('a second editor approves or sends back with a reason; the drafter is told why not', async () => {
  assert.deepEqual(readSourceDecision(form({ decision: 'approve' })).input, { approve: true });
  assert.deepEqual(readSourceDecision(form({ decision: 'return', reason: 'ok' })).problems, ['reason_required']);
  assert.deepEqual(readSourceDecision(form({})).problems, ['decision_required']);
  assert.match(bilingualMessageFor('kb_own_draft').en, /another Knowledge Editor/);
  assert.match(bilingualMessageFor('kb_own_draft').ta, TAMIL);
  const actions = await readSrc('features/assistant/actions.ts');
  assert.match(actions, /'own_draft' \? 'kb_own_draft'/);
  assert.match(actions, /'draft_exists' \? 'kb_draft_exists'/);
});

test('error reports close as fixed or no change with what was done; replies and questions are checked', () => {
  assert.deepEqual(readResolution(form({ resolution: 'Done' })).problems, ['outcome_required', 'resolution_required']);
  assert.deepEqual(readResolution(form({ outcome: 'fixed', resolution: 'Source corrected.' })).input, { outcome: 'fixed', resolution: 'Source corrected.' });
  assert.deepEqual(readReply(form({ reply: 'ok' })).problems, ['handover_reply_required']);
  assert.deepEqual(readQuestion(form({ question: '' })).problems, ['question_required']);
  assert.deepEqual(readQuestion(form({ question: 'எப்படி?', language: 'xx' })).input, { question: 'எப்படி?', language: 'ta' });
});

test('every refusal from the assistant endpoints has Tamil and English words', () => {
  for (const code of ['source_refused', 'assistant_refused', 'assistant_unavailable', 'kb_own_draft']) {
    const words = bilingualMessageFor(code);
    assert.match(words.ta, TAMIL, code);
    assert.notEqual(words.en, code.replace(/_/g, ' '), code);
  }
  for (const problem of [
    'source_text_required', 'review_date_must_be_ahead', 'review_date_too_far', 'kb_draft_exists', 'reason_required', 'kb_title_required',
    'kb_body_too_short', 'publisher_required', 'source_url_invalid', 'review_due_required', 'resolution_required', 'handover_reply_required',
    'already_resolved', 'already_closed', 'provider_not_configured', 'model_not_registered', 'model_not_approved', 'not_allowed_from:approved',
  ]) {
    const words = bilingualProblemText(problem);
    assert.match(words.ta, TAMIL, problem);
    assert.notEqual(words.en, problem.replace(/_/g, ' '), problem);
  }
  for (const done of [
    'kb_source_drafted', 'kb_source_saved', 'kb_source_approved', 'kb_source_returned', 'kb_version_drafted', 'kb_source_reviewed',
    'kb_source_retired', 'kb_report_resolved', 'kb_handover_answered', 'kb_handover_closed',
  ]) {
    assert.match(bilingualConfirmation(done).ta, TAMIL, done);
  }
  for (const reason of ['provider_not_configured', 'model_not_registered']) {
    assert.match(UNAVAILABLE_WORDS[reason].en, /^Not available yet, because/);
    assert.match(UNAVAILABLE_WORDS[reason].ta, TAMIL);
  }
});

test('the pages keep official text apart from the AI explanation and show the queues', async () => {
  const answer = await readSrc('features/assistant/AnswerView.tsx');
  assert.match(answer, /AI explanation/);
  assert.match(answer, /Official text/);
  const detail = await readSrc('app/(staff)/assistant/[id]/page.tsx');
  for (const action of ['decideSource', 'draftSourceVersion', 'reviewSource', 'retireSource', 'SourceForm']) assert.ok(detail.includes(action), action);
  assert.match(await readSrc('app/(staff)/assistant/errors/page.tsx'), /resolveErrorReport/);
  const handovers = await readSrc('app/(staff)/assistant/handovers/page.tsx');
  assert.match(handovers, /replyToHandover/);
  assert.match(handovers, /did not share the conversation/);
  assert.match(await readSrc('features/assistant/TryForm.tsx'), /tryQuestion/);
  assert.match(await readSrc('app/(staff)/assistant/page.tsx'), /getAssistantSummary\(\)/);
});
