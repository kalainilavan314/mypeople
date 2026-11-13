import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { PROPOSAL_TARGETS, readModeration } from '../development/forms.ts';
import { OUTCOMES, OUTCOME_LABELS, readMisinfoAppeal, readMisinfoDecision } from './factcheck.ts';
import { builtModules } from '../../lib/modules.ts';
import { bilingualConfirmation, bilingualMessageFor, bilingualProblemText } from '../../lib/messages.ts';

const readSrc = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

function form(fields) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

test('the moderation queue is a built module for content.moderate', () => {
  const registered = builtModules.find((m) => m.href === '/moderation');
  assert.ok(registered);
  assert.equal(registered.permission, 'content.moderate');
  assert.equal(registered.ta, 'நடுவர் வரிசை');
  assert.equal(registered.en, 'Moderation queue');
});

test('publishing needs nothing more; rejecting needs the reason the author is told', () => {
  assert.deepEqual(readModeration(form({ publish: '1' })).input, { publish: true, reason: null });
  assert.deepEqual(readModeration(form({ publish: '0' })).problems, ['reason_required']);
  assert.deepEqual(readModeration(form({ publish: '0', reason: 'Names a private person' })).input, { publish: false, reason: 'Names a private person' });
  assert.deepEqual(readModeration(form({})).problems, ['decision_required']);
  assert.equal(PROPOSAL_TARGETS.reason_required, 'reason');
});

test('one queue holds ideas, proposals, case summaries, added information and appeals, oldest first (D12)', async () => {
  const page = await readSrc('app/(staff)/moderation/page.tsx');
  assert.match(page, /listPendingIdeas\(\)/);
  assert.match(page, /listManagedProposals\(\{ stage: \['pending_moderation'\] \}\)/);
  assert.match(page, /oldestFirst\(/);
  assert.match(page, /listPendingCaseModeration\(\)/);
  assert.match(page, /listModerationAppeals\(\)/);
  // The case forms come back to the queue, and nobody moderates their own case or addition.
  assert.match(page, /returnTo="moderation"/);
  assert.match(page, /another moderator decides it/);
  assert.match(page, /id="case-summaries"|'case-summaries'/);
});

test('misinformation reports are decided by a person, with a reason, never an automatic score (BR-149)', async () => {
  const page = await readSrc('app/(staff)/moderation/page.tsx');
  assert.match(page, /A person decides; there is no automatic score\./);
  assert.match(page, /தவறான தகவல் முறைப்பாடுகள்/);
  assert.match(page, /listFactCheckQueue\(true\)/);
  assert.match(page, /\/evidence\/factcheck\/\$\{report\.id\}/);
  assert.doesNotMatch(page, /not built yet|confidence|score=|aiScore/i);
  assert.deepEqual(readMisinfoDecision(form({ outcome: 'false', reason: 'too short' })).problems, ['factcheck_reason_required']);
  assert.deepEqual(readMisinfoDecision(form({ reason: 'The photo is from 2019, not this week.' })).problems, ['outcome_required']);
  assert.deepEqual(readMisinfoDecision(form({ outcome: 'misleading', reason: 'The photo is from 2019, not this week.' })).input, {
    outcome: 'misleading',
    reason: 'The photo is from 2019, not this week.',
  });
  assert.deepEqual(readMisinfoAppeal(form({ change: 'change', reason: 'New evidence from the GN office.' })).problems, ['new_outcome_required']);
  assert.deepEqual(readMisinfoAppeal(form({ change: 'uphold', reason: 'The original evidence stands.' })).input, { change: false, reason: 'The original evidence stands.' });
  assert.equal(OUTCOMES.length, 4);
  for (const outcome of OUTCOMES) assert.match(OUTCOME_LABELS[outcome].ta, /[஀-௿]/, outcome);
});

test('the screenshot proxy never lets a browser or proxy keep the image', async () => {
  const route = await readSrc('app/evidence/factcheck/[reportId]/route.ts');
  assert.match(route, /no-store, private/);
  assert.match(route, /\/v1\/fact-checks\/manage\/\$\{encodeURIComponent\(reportId\)\}\/screenshot/);
  assert.match(route, /readStaffToken/);
});

test('fact-check refusals say who cannot decide', () => {
  assert.match(bilingualMessageFor('original_decider').en, /someone else must decide the appeal/);
  assert.match(bilingualMessageFor('original_decider').ta, /[஀-௿]/);
  assert.match(bilingualMessageFor('factcheck_refused').ta, /[஀-௿]/);
  for (const done of ['misinfo_decided', 'misinfo_appeal_upheld', 'misinfo_appeal_changed']) assert.match(bilingualConfirmation(done).ta, /[஀-௿]/, done);
});

test('moderation refusals and confirmations have Tamil and English words', () => {
  for (const code of ['idea_refused', 'proposal_refused', 'own_record', 'outside_your_area']) {
    assert.match(bilingualMessageFor(code).ta, /[஀-௿]/, code);
  }
  for (const problem of ['reason_required', 'already_moderated']) assert.match(bilingualProblemText(problem).ta, /[஀-௿]/, problem);
  for (const done of ['idea_published', 'idea_rejected', 'proposal_review', 'proposal_rejected']) {
    assert.match(bilingualConfirmation(done).ta, /[஀-௿]/, done);
  }
});
